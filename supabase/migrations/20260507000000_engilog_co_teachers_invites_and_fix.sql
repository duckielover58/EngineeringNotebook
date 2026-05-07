-- EngiLog: align repo with live Supabase schema (co-teachers, project invites)
-- and fix RLS so the classroom owner / co-teachers can create projects too.
-- Idempotent so it is safe to re-run.

-- -----------------------------------------------------------------------------
-- New tables: classroom_teachers, project_invites
-- -----------------------------------------------------------------------------

create table if not exists public.classroom_teachers (
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (classroom_id, teacher_id)
);

alter table public.classroom_teachers enable row level security;

create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  inviter_user_id uuid not null references public.profiles (id) on delete cascade,
  invitee_email text not null,
  invitee_user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.project_invites enable row level security;

-- -----------------------------------------------------------------------------
-- Helper functions (replace originals to use classroom_teachers + add new ones)
-- -----------------------------------------------------------------------------

create or replace function public.auth_email()
returns text
language sql
stable security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt()->>'email', ''));
$$;

create or replace function public.profile_is_student(p_user uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = p_user and pr.role = 'student'
  );
$$;

create or replace function public.is_classroom_teacher(p_classroom uuid, p_user uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classroom_teachers ct
    where ct.classroom_id = p_classroom and ct.teacher_id = p_user
  );
$$;

create or replace function public.is_project_classroom_teacher(p_project uuid, p_user uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join public.classroom_teachers ct on ct.classroom_id = p.classroom_id
    where p.id = p_project and ct.teacher_id = p_user
  );
$$;

create or replace function public.can_student_insert_project_in_classroom(p_classroom uuid, p_user uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select public.is_classroom_member(p_classroom, p_user)
    and public.profile_is_student(p_user);
$$;

create or replace function public.can_student_insert_project_member(p_project uuid, p_actor uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select public.profile_is_student(p_actor)
    and exists (
      select 1 from public.projects p
      where p.id = p_project
        and public.is_classroom_member(p.classroom_id, p_actor)
    );
$$;

-- -----------------------------------------------------------------------------
-- Backfill classroom_teachers from classrooms.teacher_id (every owner is a teacher)
-- -----------------------------------------------------------------------------

insert into public.classroom_teachers (classroom_id, teacher_id, added_by)
select c.id, c.teacher_id, c.teacher_id
from public.classrooms c
on conflict (classroom_id, teacher_id) do nothing;

-- -----------------------------------------------------------------------------
-- RLS: classroom_teachers
-- -----------------------------------------------------------------------------

drop policy if exists "classroom_teachers_select_visible" on public.classroom_teachers;
create policy "classroom_teachers_select_visible"
  on public.classroom_teachers for select
  using (
    teacher_id = auth.uid()
    or public.is_classroom_teacher(classroom_id, auth.uid())
    or public.is_classroom_member(classroom_id, auth.uid())
  );

drop policy if exists "classroom_teachers_insert_owner_only" on public.classroom_teachers;
create policy "classroom_teachers_insert_owner_only"
  on public.classroom_teachers for insert
  with check (
    exists (
      select 1 from public.classrooms c
      where c.id = classroom_teachers.classroom_id and c.teacher_id = auth.uid()
    )
  );

drop policy if exists "classroom_teachers_delete_owner_only" on public.classroom_teachers;
create policy "classroom_teachers_delete_owner_only"
  on public.classroom_teachers for delete
  using (
    teacher_id <> auth.uid()
    and exists (
      select 1 from public.classrooms c
      where c.id = classroom_teachers.classroom_id and c.teacher_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- RLS fix: allow classroom teachers (owners and co-teachers) to create
-- projects and add themselves as project_members. This is the bug that
-- produced "new row violates row-level security policy for table 'projects'".
-- -----------------------------------------------------------------------------

drop policy if exists "projects_insert_classroom_participant" on public.projects;
create policy "projects_insert_classroom_participant"
  on public.projects for insert
  with check (
    public.can_student_insert_project_in_classroom(classroom_id, auth.uid())
    or public.is_classroom_teacher(classroom_id, auth.uid())
  );

drop policy if exists "project_members_insert_self_if_classroom_ok" on public.project_members;
create policy "project_members_insert_self_if_classroom_ok"
  on public.project_members for insert
  with check (
    user_id = auth.uid()
    and (
      public.can_student_insert_project_member(project_id, auth.uid())
      or exists (
        select 1 from public.projects p
        where p.id = project_id
          and public.is_classroom_teacher(p.classroom_id, auth.uid())
      )
    )
  );

-- -----------------------------------------------------------------------------
-- RLS: project_invites
-- -----------------------------------------------------------------------------

drop policy if exists "project_invites_select_visible" on public.project_invites;
create policy "project_invites_select_visible"
  on public.project_invites for select
  using (
    public.is_project_member(project_id, auth.uid())
    or public.is_project_classroom_teacher(project_id, auth.uid())
    or lower(invitee_email) = public.auth_email()
  );

-- -----------------------------------------------------------------------------
-- Co-teacher RPCs
-- -----------------------------------------------------------------------------

create or replace function public.add_classroom_coteacher_by_email(p_classroom uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_target uuid;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;

  select teacher_id into v_owner from public.classrooms where id = p_classroom;
  if v_owner is null then
    raise exception 'Classroom not found.';
  end if;
  if v_owner <> v_user then
    raise exception 'Only the classroom owner can manage co-teachers.';
  end if;

  select u.id
  into v_target
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email)) and p.role = 'teacher'
  limit 1;

  if v_target is null then
    raise exception 'Teacher account not found for that email.';
  end if;

  insert into public.classroom_teachers (classroom_id, teacher_id, added_by)
  values (p_classroom, v_target, v_user)
  on conflict (classroom_id, teacher_id) do nothing;

  return v_target;
end;
$$;

grant execute on function public.add_classroom_coteacher_by_email(uuid, text) to authenticated;

create or replace function public.remove_classroom_coteacher(p_classroom uuid, p_teacher uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;

  select teacher_id into v_owner from public.classrooms where id = p_classroom;
  if v_owner is null then
    raise exception 'Classroom not found.';
  end if;
  if v_owner <> v_user then
    raise exception 'Only the classroom owner can manage co-teachers.';
  end if;
  if p_teacher = v_owner then
    raise exception 'Owner teacher cannot be removed.';
  end if;

  delete from public.classroom_teachers
  where classroom_id = p_classroom and teacher_id = p_teacher;
end;
$$;

grant execute on function public.remove_classroom_coteacher(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Project invite RPCs
-- -----------------------------------------------------------------------------

create or replace function public.create_project_invite(p_project uuid, p_invitee_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(trim(p_invitee_email));
  v_classroom uuid;
  v_invitee_user uuid;
  v_invite uuid;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;
  if not public.profile_is_student(v_user) then
    raise exception 'Only students can invite teammates.';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Enter a valid email.';
  end if;
  if not public.is_project_member(p_project, v_user) then
    raise exception 'Only notebook members can send invites.';
  end if;

  select p.classroom_id into v_classroom from public.projects p where p.id = p_project;
  if v_classroom is null then
    raise exception 'Project not found.';
  end if;

  select u.id into v_invitee_user from auth.users u where lower(u.email) = v_email limit 1;
  if v_invitee_user is not null and not public.profile_is_student(v_invitee_user) then
    raise exception 'Invites can only be sent to student accounts.';
  end if;

  update public.project_invites
  set status = 'revoked'
  where project_id = p_project and lower(invitee_email) = v_email and status = 'pending';

  insert into public.project_invites (
    project_id, classroom_id, inviter_user_id, invitee_email, invitee_user_id, status
  )
  values (p_project, v_classroom, v_user, v_email, v_invitee_user, 'pending')
  returning id into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.create_project_invite(uuid, text) to authenticated;

create or replace function public.accept_project_invite(p_invite uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text := public.auth_email();
  v_project uuid;
  v_classroom uuid;
  v_invite_email text;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;
  if not public.profile_is_student(v_user) then
    raise exception 'Only students can accept invites.';
  end if;

  select project_id, classroom_id, invitee_email
  into v_project, v_classroom, v_invite_email
  from public.project_invites
  where id = p_invite and status = 'pending'
  for update;

  if v_project is null then
    raise exception 'Invite not found.';
  end if;
  if lower(v_invite_email) <> v_email then
    raise exception 'This invite is for a different email address.';
  end if;
  if not public.is_classroom_member(v_classroom, v_user) then
    raise exception 'Join this class first, then accept the invite.';
  end if;

  update public.project_invites
  set status = 'accepted', invitee_user_id = v_user, accepted_at = now()
  where id = p_invite;

  insert into public.project_members (project_id, user_id)
  values (v_project, v_user)
  on conflict do nothing;

  return v_project;
end;
$$;

grant execute on function public.accept_project_invite(uuid) to authenticated;

create or replace function public.revoke_project_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_project uuid;
  v_inviter uuid;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;

  select project_id, inviter_user_id
  into v_project, v_inviter
  from public.project_invites
  where id = p_invite and status = 'pending'
  for update;

  if v_project is null then
    raise exception 'Invite not found.';
  end if;

  if v_inviter <> v_user and not public.is_project_classroom_teacher(v_project, v_user) then
    raise exception 'Not allowed to revoke this invite.';
  end if;

  update public.project_invites
  set status = 'revoked'
  where id = p_invite and status = 'pending';
end;
$$;

grant execute on function public.revoke_project_invite(uuid) to authenticated;
