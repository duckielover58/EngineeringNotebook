-- DEV_TEST_ACCOUNTS: remove after development with supabase/seed.cleanup.sql
do $$
declare
  base_email text;
  base_name text;
  base_role text;
  user_id uuid;
begin
  for base_name, base_role in
    values
      ('Student1', 'student'),
      ('Student2', 'student'),
      ('Student3', 'student'),
      ('Student4', 'student'),
      ('Student5', 'student'),
      ('Teacher1', 'teacher')
  loop
    base_email := lower(base_name) || '@devtest.engilog.local';
    user_id := gen_random_uuid();

    if not exists (select 1 from auth.users u where u.email = base_email) then
      insert into auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      )
      values (
        user_id,
        'authenticated',
        'authenticated',
        base_email,
        crypt('test', gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', array['email']),
        jsonb_build_object('full_name', base_name, 'role', base_role, 'engilog_role', base_role, 'dev_seed_tag', 'DEV_TEST_ACCOUNTS'),
        now(),
        now(),
        '',
        '',
        '',
        ''
      );
    end if;

    update public.profiles
    set full_name = base_name, role = base_role, school_name = 'DEV_TEST_ACCOUNTS'
    where id = (select id from auth.users where email = base_email);
  end loop;
end $$;
