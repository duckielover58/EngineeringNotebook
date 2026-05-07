-- Students who joined a class could still get "new row violates row-level security"
-- on projects / project_members when the INSERT policy used bare EXISTS on
-- public.profiles inside WITH CHECK (nested evaluation + RLS can deny the check
-- even though the user is a legitimate classroom member with role student).
-- Use SECURITY DEFINER helpers (same pattern as is_classroom_member) so checks
-- read profiles and classroom_members authoritatively.

create or replace function public.profile_is_student(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = p_user and pr.role = 'student'
  );
$$;

create or replace function public.can_student_insert_project_in_classroom(p_classroom uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_classroom_member(p_classroom, p_user)
    and public.profile_is_student(p_user);
$$;

create or replace function public.can_student_insert_project_member(p_project uuid, p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.profile_is_student(p_actor)
    and exists (
      select 1 from public.projects p
      where p.id = p_project
        and public.is_classroom_member(p.classroom_id, p_actor)
    );
$$;

drop policy if exists "projects_insert_classroom_participant" on public.projects;
create policy "projects_insert_classroom_participant"
  on public.projects for insert
  with check ( public.can_student_insert_project_in_classroom(classroom_id, auth.uid()) );

drop policy if exists "project_members_insert_self_if_classroom_ok" on public.project_members;
create policy "project_members_insert_self_if_classroom_ok"
  on public.project_members for insert
  with check (
    user_id = auth.uid()
    and public.can_student_insert_project_member(project_id, auth.uid())
  );

grant execute on function public.profile_is_student(uuid) to authenticated;
grant execute on function public.can_student_insert_project_in_classroom(uuid, uuid) to authenticated;
grant execute on function public.can_student_insert_project_member(uuid, uuid) to authenticated;
