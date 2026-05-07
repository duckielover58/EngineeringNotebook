-- EngiLog: ensure create_project_for_student records the creator.
--
-- Migration 20260507130000_engilog_creator_and_deletion.sql added projects.created_by
-- and updated this RPC to set it. However, 20260508160000_invites_visibility_coteachers.sql
-- (timestamp later) re-CREATE OR REPLACEs the RPC without including created_by, which
-- silently regresses creator-only delete on any fresh DB rebuild.
--
-- This migration's timestamp is later than 20260508160000, so it wins on every fresh apply.
-- Idempotent.

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

grant execute on function public.create_project_for_student(uuid, text) to authenticated;
