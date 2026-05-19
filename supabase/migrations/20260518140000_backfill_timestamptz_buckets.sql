-- Align legacy row timestamps to America/Los_Angeles calendar buckets (pre–client TZ work).

create or replace function public.engilog_ts_bucket_align(ts timestamptz, salt text)
returns timestamptz
language sql
immutable
parallel safe
as $$
  with local as (
    select ts at time zone 'America/Los_Angeles' as t
  )
  select case
    when ts is null then null::timestamptz
    when (
      extract(hour from local.t)::int >= 22
      or extract(hour from local.t)::int between 14 and 20
    )
    and not (
      extract(hour from local.t)::int = 21
      and extract(minute from local.t)::int between 55 and 59
    ) then (
      date_trunc('day', local.t)
      + make_interval(
          hours => 21,
          mins => (55 + (abs(hashtext(coalesce(salt, 'm'))) % 5))::int,
          secs => (abs(hashtext(coalesce(salt, 's'))) % 60)::int
        )
    ) at time zone 'America/Los_Angeles'
    else ts
  end
  from local;
$$;

do $$
declare
  v_uid uuid;
begin
  select pr.id into v_uid
  from public.profiles pr
  where pr.role = 'student'
    and pr.school_name = 'DEV_TEST_ACCOUNTS'
  order by pr.full_name
  limit 1;

  if v_uid is null then
    return;
  end if;

  update public.projects p
  set
    created_at = public.engilog_ts_bucket_align(p.created_at, p.id::text || ':c'),
    title_page_updated_at = public.engilog_ts_bucket_align(p.title_page_updated_at, p.id::text || ':a'),
    design_brief_updated_at = public.engilog_ts_bucket_align(p.design_brief_updated_at, p.id::text || ':b'),
    matrix_updated_at = public.engilog_ts_bucket_align(p.matrix_updated_at, p.id::text || ':m'),
    gantt_updated_at = public.engilog_ts_bucket_align(p.gantt_updated_at, p.id::text || ':g'),
    math_notes_updated_at = public.engilog_ts_bucket_align(p.math_notes_updated_at, p.id::text || ':n')
  where p.created_by = v_uid
     or exists (
       select 1 from public.project_members pm
       where pm.project_id = p.id and pm.user_id = v_uid
     );

  update public.daily_logs dl
  set created_at = public.engilog_ts_bucket_align(dl.created_at, dl.id::text)
  where dl.project_id in (
    select p.id from public.projects p
    where p.created_by = v_uid
       or exists (
         select 1 from public.project_members pm
         where pm.project_id = p.id and pm.user_id = v_uid
       )
  );

  update public.project_sketches s
  set
    created_at = public.engilog_ts_bucket_align(s.created_at, s.id::text || ':c'),
    updated_at = public.engilog_ts_bucket_align(s.updated_at, s.id::text || ':u')
  where s.project_id in (
    select p.id from public.projects p
    where p.created_by = v_uid
       or exists (
         select 1 from public.project_members pm
         where pm.project_id = p.id and pm.user_id = v_uid
       )
  );

  update public.project_math_images i
  set
    created_at = public.engilog_ts_bucket_align(i.created_at, i.id::text || ':c'),
    updated_at = public.engilog_ts_bucket_align(i.updated_at, i.id::text || ':u')
  where i.project_id in (
    select p.id from public.projects p
    where p.created_by = v_uid
       or exists (
         select 1 from public.project_members pm
         where pm.project_id = p.id and pm.user_id = v_uid
       )
  );

  update public.project_conclusion_answers a
  set
    created_at = public.engilog_ts_bucket_align(a.created_at, a.id::text || ':c'),
    updated_at = public.engilog_ts_bucket_align(a.updated_at, a.id::text || ':u')
  where a.project_id in (
    select p.id from public.projects p
    where p.created_by = v_uid
       or exists (
         select 1 from public.project_members pm
         where pm.project_id = p.id and pm.user_id = v_uid
       )
  );

  update public.project_comments c
  set created_at = public.engilog_ts_bucket_align(c.created_at, c.id::text)
  where c.project_id in (
    select p.id from public.projects p
    where p.created_by = v_uid
       or exists (
         select 1 from public.project_members pm
         where pm.project_id = p.id and pm.user_id = v_uid
       )
  );
end $$;

drop function if exists public.engilog_ts_bucket_align(timestamptz, text);
