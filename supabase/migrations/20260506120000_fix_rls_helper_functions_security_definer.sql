-- Infinite recursion in RLS policies caused every profile query to error (HTTP 500).
--
-- Root cause: two mutual recursion cycles:
--   1. profiles_select_own_or_teacher_scope → project_members (raw EXISTS)
--      → project_members_select_visible → projects (raw EXISTS)
--      → projects_select_member_or_teacher → project_members (raw EXISTS) → ∞
--   2. Helpers (is_project_member, etc.) were not SECURITY DEFINER, so they
--      triggered their own table's RLS when called inside policies.
--
-- Fix part 1: mark all helpers SECURITY DEFINER so they bypass RLS when called
-- from within policies.

CREATE OR REPLACE FUNCTION public.is_classroom_teacher(p_classroom uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.classrooms c
    where c.id = p_classroom and c.teacher_id = p_user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_classroom_member(p_classroom uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.classroom_members m
    where m.classroom_id = p_classroom and m.user_id = p_user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project and pm.user_id = p_user
  );
$$;

-- Fix part 2: add a new SECURITY DEFINER helper for the teacher-of-project check,
-- then rewrite the two mutually-recursive policies to use only helper functions
-- (no raw cross-table EXISTS subqueries).

CREATE OR REPLACE FUNCTION public.is_project_classroom_teacher(p_project uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.projects p
    join public.classrooms c on c.id = p.classroom_id
    where p.id = p_project and c.teacher_id = p_user
  );
$$;

-- project_members: was "is_project_member() OR EXISTS(SELECT FROM projects ...)"
-- The EXISTS on projects triggered projects_select_member_or_teacher, which had
-- an EXISTS back on project_members → mutual infinite loop.
DROP POLICY IF EXISTS project_members_select_visible ON public.project_members;
CREATE POLICY project_members_select_visible
  ON public.project_members FOR SELECT
  USING (
    is_project_member(project_id, auth.uid())
    OR is_project_classroom_teacher(project_id, auth.uid())
  );

-- projects: was "is_classroom_teacher() OR EXISTS(SELECT FROM project_members ...)"
-- The EXISTS on project_members triggered project_members_select_visible → same loop.
DROP POLICY IF EXISTS projects_select_member_or_teacher ON public.projects;
CREATE POLICY projects_select_member_or_teacher
  ON public.projects FOR SELECT
  USING (
    is_classroom_teacher(classroom_id, auth.uid())
    OR is_project_member(id, auth.uid())
  );
