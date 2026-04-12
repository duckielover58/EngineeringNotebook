-- Prefer engilog_role in auth metadata (JWT key "role" is reserved). Keeps profiles.role in sync on signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  r := coalesce(
    nullif(trim(new.raw_user_meta_data->>'engilog_role'), ''),
    nullif(trim(new.raw_user_meta_data->>'role'), ''),
    'student'
  );
  if r not in ('student', 'teacher') then
    r := 'student';
  end if;

  insert into public.profiles (id, full_name, role, school_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), ''),
    r,
    coalesce(nullif(trim(new.raw_user_meta_data->>'school_name'), ''), '')
  );
  return new;
end;
$$;
