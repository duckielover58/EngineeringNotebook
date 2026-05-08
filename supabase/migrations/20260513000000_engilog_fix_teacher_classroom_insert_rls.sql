-- Teachers were getting "new row violates row-level security policy for table 'classrooms'"
-- on the very first classroom create, even with a valid teacher profile + signed-in
-- session. Two layered bugs were at play:
--
-- 1. classrooms_insert_teacher used a bare EXISTS on public.profiles inside its
--    WITH CHECK. Same pitfall the student-side fix in
--    20260508120000_fix_student_project_insert_rls.sql called out: nested RLS
--    evaluation on profiles can deny the check even when the user clearly
--    satisfies it. Switch to a SECURITY DEFINER helper.
--
-- 2. classrooms_select_visible was rewritten in
--    20260508160000_invites_visibility_coteachers.sql to test
--    is_classroom_teacher(id, auth.uid()), which now reads classroom_teachers
--    (the co-teacher membership table). When the create-classroom action does
--    INSERT INTO classrooms ... RETURNING id (which supabase-js does for
--    .insert(...).select().single()), Postgres evaluates the SELECT policy on
--    the freshly inserted row before classroom_teachers has its membership
--    row, so the check returns false and PostgREST surfaces it as the
--    misleading "new row violates row-level security policy" message.
--    Allow the row's own teacher_id to satisfy SELECT so RETURNING works for
--    the creator immediately after INSERT.

create or replace function public.profile_is_teacher(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = p_user and pr.role = 'teacher'
  );
$$;

grant execute on function public.profile_is_teacher(uuid) to authenticated;

drop policy if exists "classrooms_insert_teacher" on public.classrooms;
create policy "classrooms_insert_teacher"
  on public.classrooms for insert
  with check (
    teacher_id = auth.uid()
    and public.profile_is_teacher(auth.uid())
  );

-- Same bare-EXISTS pattern on classroom_members (used when a student joins a
-- class directly via INSERT rather than via the SECURITY DEFINER RPC). Mirror
-- the fix using the existing profile_is_student helper.
drop policy if exists "classroom_members_insert_self_via_membership" on public.classroom_members;
create policy "classroom_members_insert_self_via_membership"
  on public.classroom_members for insert
  with check (
    user_id = auth.uid()
    and public.profile_is_student(auth.uid())
  );

-- Restore direct teacher_id check in the classrooms SELECT policy so that
-- INSERT ... RETURNING is visible to the creator before the classroom_teachers
-- membership row is in place.
drop policy if exists "classrooms_select_visible" on public.classrooms;
create policy "classrooms_select_visible"
  on public.classrooms for select
  using (
    teacher_id = auth.uid()
    or public.is_classroom_teacher(id, auth.uid())
    or public.is_classroom_member(id, auth.uid())
  );
