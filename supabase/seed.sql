-- DEV_TEST_ACCOUNTS: remove after development with supabase/seed.cleanup.sql
--
-- Supabase Auth needs both auth.users and auth.identities (email provider) for
-- signInWithPassword to work. Also set instance_id (from auth.instances on hosted projects).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  base_email text;
  base_name text;
  base_role text;
  v_user_id uuid;
  v_identity_id uuid;
  inst_id uuid;
BEGIN
  SELECT i.id INTO inst_id FROM auth.instances i LIMIT 1;
  IF inst_id IS NULL THEN
    inst_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  FOR base_name, base_role IN
    VALUES
      ('Student1', 'student'),
      ('Student2', 'student'),
      ('Student3', 'student'),
      ('Student4', 'student'),
      ('Student5', 'student'),
      ('Teacher1', 'teacher')
  LOOP
    base_email := lower(base_name) || '@devtest.engilog.local';

    SELECT u.id INTO v_user_id FROM auth.users u WHERE u.email = base_email LIMIT 1;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      )
      VALUES (
        v_user_id,
        inst_id,
        'authenticated',
        'authenticated',
        base_email,
        crypt('test123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
          'full_name',
          base_name,
          'role',
          base_role,
          'engilog_role',
          base_role,
          'dev_seed_tag',
          'DEV_TEST_ACCOUNTS'
        ),
        now(),
        now(),
        '',
        '',
        '',
        ''
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM auth.identities i WHERE i.user_id = v_user_id AND i.provider = 'email'
    ) THEN
      v_identity_id := gen_random_uuid();
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        v_identity_id,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', base_email),
        'email',
        v_user_id::text,
        now(),
        now(),
        now()
      );
    END IF;

    UPDATE auth.users
    SET
      encrypted_password = crypt('test123', gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = v_user_id;

    INSERT INTO public.profiles (id, full_name, role, school_name)
    VALUES (v_user_id, base_name, base_role, 'DEV_TEST_ACCOUNTS')
    ON CONFLICT (id) DO UPDATE
    SET
      full_name = excluded.full_name,
      role = excluded.role,
      school_name = excluded.school_name;
  END LOOP;
END $$;
