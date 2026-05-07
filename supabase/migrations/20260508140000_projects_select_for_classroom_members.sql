-- createProject does: insert into projects → .select('id').single()
-- SELECT on projects used to require project_members or classroom teacher.
-- The creator is not in project_members yet, so the new row failed SELECT RLS
-- and the whole request failed (often reported as an RLS violation), even when
-- the student had joined the class. Allow any classroom member to read projects
-- in that classroom (OR-combined with existing policies).

create policy "projects_select_classroom_member"
  on public.projects for select
  using ( public.is_classroom_member(classroom_id, auth.uid()) );
