-- Post-setup Gantt edits: only dev/test accounts (matches actions/projects.updateProjectGantt).

create or replace function public.is_dev_test_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user
      and (
        trim(coalesce(p.school_name, '')) = 'DEV_TEST_ACCOUNTS'
        or exists (
          select 1
          from auth.users u
          where u.id = p_user
            and lower(coalesce(u.email, '')) like '%@devtest.engilog.local'
        )
      )
  );
$$;

create or replace function public.enforce_project_gantt_update_on_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;

  if NEW.gantt_data is not distinct from OLD.gantt_data
     and NEW.gantt_updated_at is not distinct from OLD.gantt_updated_at then
    return NEW;
  end if;

  if OLD.status = 'setup' then
    return NEW;
  end if;

  if public.is_dev_test_user(auth.uid()) then
    return NEW;
  end if;

  raise exception 'Gantt chart can only be edited during notebook setup.';
end;
$$;

drop trigger if exists enforce_project_gantt_update_on_active on public.projects;
create trigger enforce_project_gantt_update_on_active
  before update on public.projects
  for each row
  execute function public.enforce_project_gantt_update_on_active();
