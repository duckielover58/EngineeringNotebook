-- EngiLog: track project creator + allow creators to delete their own notebook.
-- Classroom deletion already permitted by classrooms_delete_teacher (teacher_id = auth.uid()).
-- Idempotent.

-- 1. Add created_by column
alter table public.projects
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- 2. Best-effort backfill for existing rows: pick any project_member as creator.
update public.projects p
set created_by = pm.user_id
from (
  select distinct on (project_id) project_id, user_id
  from public.project_members
  order by project_id, user_id
) pm
where p.created_by is null
  and pm.project_id = p.id;

-- 3. Update RPC so new projects record their creator.
create or replace function public.create_project_for_student(p_classroom uuid, p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_project uuid;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;
  if not public.can_student_insert_project_in_classroom(p_classroom, v_user) then
    raise exception 'new row violates row-level security policy for table "projects"';
  end if;

  insert into public.projects (classroom_id, title, status, created_by)
  values (p_classroom, p_title, 'setup', v_user)
  returning id into v_project;

  insert into public.project_members (project_id, user_id)
  values (v_project, v_user)
  on conflict do nothing;

  return v_project;
end;
$$;

-- 4. Allow the creator student to delete their own project.
--    The existing projects_delete_teacher policy still allows classroom teachers.
drop policy if exists "projects_delete_creator" on public.projects;
create policy "projects_delete_creator"
  on public.projects for delete
  using (created_by = auth.uid());
