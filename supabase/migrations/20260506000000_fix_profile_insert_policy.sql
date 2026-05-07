-- Allow authenticated users to insert their own profile row.
-- The handle_new_user trigger handles this at signup, but this policy
-- enables the client-side upsert fallback in syncProfileRoleFromAuth
-- when the trigger has not fired (e.g. migrations not yet pushed to the
-- live project, or edge-case email-confirmation flows).
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());
