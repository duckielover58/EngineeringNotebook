create or replace function public.is_authorized_student_for_project(p_project uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.profiles pr on pr.id = pm.user_id
    where pm.project_id = p_project
      and pm.user_id = p_user
      and pr.role = 'student'
  );
$$;

drop policy if exists "projects_insert_classroom_participant" on public.projects;
create policy "projects_insert_classroom_participant"
  on public.projects for insert
  with check (
    public.is_classroom_member(classroom_id, auth.uid())
    and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'student')
  );

drop policy if exists "projects_update_members_only" on public.projects;
create policy "projects_update_members_only"
  on public.projects for update
  using (public.is_authorized_student_for_project(projects.id, auth.uid()))
  with check (public.is_authorized_student_for_project(projects.id, auth.uid()));

drop policy if exists "project_members_insert_self_if_classroom_ok" on public.project_members;
create policy "project_members_insert_self_if_classroom_ok"
  on public.project_members for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'student')
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.is_classroom_member(p.classroom_id, auth.uid())
    )
  );

drop policy if exists "daily_logs_insert_members" on public.daily_logs;
create policy "daily_logs_insert_members"
  on public.daily_logs for insert
  with check (
    public.is_authorized_student_for_project(daily_logs.project_id, auth.uid())
    and is_locked = false
  );

drop policy if exists "daily_logs_update_unlocked" on public.daily_logs;
create policy "daily_logs_update_unlocked"
  on public.daily_logs for update
  using (
    public.is_authorized_student_for_project(daily_logs.project_id, auth.uid())
    and is_locked = false
    and now() < daily_logs.created_at + interval '24 hours'
  )
  with check (
    public.is_authorized_student_for_project(daily_logs.project_id, auth.uid())
    and is_locked = false
    and now() < daily_logs.created_at + interval '24 hours'
  );

drop policy if exists "daily_logs_delete_unlocked" on public.daily_logs;
create policy "daily_logs_delete_unlocked"
  on public.daily_logs for delete
  using (
    public.is_authorized_student_for_project(daily_logs.project_id, auth.uid())
    and is_locked = false
    and now() < daily_logs.created_at + interval '24 hours'
  );

drop policy if exists "team_photos_insert_member" on storage.objects;
create policy "team_photos_insert_member"
  on storage.objects for insert
  with check (
    bucket_id = 'team-photos'
    and auth.role() = 'authenticated'
    and public.is_authorized_student_for_project((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists "log_images_insert_member" on storage.objects;
create policy "log_images_insert_member"
  on storage.objects for insert
  with check (
    bucket_id = 'log-images'
    and auth.role() = 'authenticated'
    and public.is_authorized_student_for_project((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists "sketches_insert_member" on storage.objects;
create policy "sketches_insert_member"
  on storage.objects for insert
  with check (
    bucket_id = 'sketches'
    and auth.role() = 'authenticated'
    and public.is_authorized_student_for_project((storage.foldername(name))[1]::uuid, auth.uid())
  );
