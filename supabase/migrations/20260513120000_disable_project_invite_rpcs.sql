-- Individual notebooks: student-to-student sharing removed at the app layer.
-- Replace invite RPCs so direct RPC calls cannot add notebook members.

create or replace function public.create_project_invite(p_project uuid, p_invitee_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Notebook sharing is disabled.';
end;
$$;

create or replace function public.accept_project_invite(p_invite uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Notebook sharing is disabled.';
end;
$$;

create or replace function public.revoke_project_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  return;
end;
$$;
