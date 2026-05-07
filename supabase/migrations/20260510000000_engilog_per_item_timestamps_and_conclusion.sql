-- EngiLog: per-item timestamps for sketches/math images, section-level *_updated_at columns,
-- and classroom-level conclusion questions + per-notebook answers.
-- Idempotent.

-- 1. Generic touch_updated_at trigger
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Section-level updated_at columns on projects
alter table public.projects
  add column if not exists math_notes_updated_at timestamptz,
  add column if not exists gantt_updated_at      timestamptz,
  add column if not exists matrix_updated_at     timestamptz;

-- 3. project_math_images: one row per uploaded math photo
create table if not exists public.project_math_images (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  url         text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists project_math_images_project_idx
  on public.project_math_images(project_id, created_at);

drop trigger if exists project_math_images_touch on public.project_math_images;
create trigger project_math_images_touch
  before update on public.project_math_images
  for each row execute function public.touch_updated_at();

-- Backfill from legacy arrays (one row per legacy URL). Anchored to project's created_at.
-- The IS NULL guards make this idempotent (won't double-insert on re-run).
insert into public.project_math_images (project_id, url, created_at, updated_at)
select p.id, u.url, p.created_at, p.created_at
from public.projects p,
     unnest(coalesce(p.math_image_urls, '{}'::text[])) as u(url)
where coalesce(array_length(p.math_image_urls, 1), 0) > 0
  and not exists (
    select 1 from public.project_math_images mi
    where mi.project_id = p.id and mi.url = u.url
  );

alter table public.project_math_images enable row level security;

drop policy if exists "math_images_select_visible" on public.project_math_images;
create policy "math_images_select_visible"
  on public.project_math_images for select
  using (
    public.is_project_member(project_id, auth.uid())
    or public.is_project_classroom_teacher(project_id, auth.uid())
  );

drop policy if exists "math_images_insert_member" on public.project_math_images;
create policy "math_images_insert_member"
  on public.project_math_images for insert
  with check (public.is_project_member(project_id, auth.uid()));

drop policy if exists "math_images_update_member" on public.project_math_images;
create policy "math_images_update_member"
  on public.project_math_images for update
  using (public.is_project_member(project_id, auth.uid()))
  with check (public.is_project_member(project_id, auth.uid()));

drop policy if exists "math_images_delete_member" on public.project_math_images;
create policy "math_images_delete_member"
  on public.project_math_images for delete
  using (public.is_project_member(project_id, auth.uid()));

-- 4. project_sketches: one row per sketch (brainstorming, initial_design, final)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'sketch_kind') then
    create type public.sketch_kind as enum ('brainstorming','initial_design','final');
  end if;
end $$;

create table if not exists public.project_sketches (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  kind         public.sketch_kind not null,
  url          text not null,
  member_label text,
  uploaded_by  uuid references auth.users(id) on delete set null,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists project_sketches_project_kind_idx
  on public.project_sketches(project_id, kind, position);

drop trigger if exists project_sketches_touch on public.project_sketches;
create trigger project_sketches_touch
  before update on public.project_sketches
  for each row execute function public.touch_updated_at();

-- Backfill brainstorming sketches from initial_sketch_urls + initial_sketch_meta
insert into public.project_sketches (project_id, kind, url, member_label, position, created_at, updated_at)
select p.id,
       'brainstorming'::public.sketch_kind,
       u.url,
       nullif(trim(coalesce(p.initial_sketch_meta -> u.url ->> 'memberLabel', '')), ''),
       u.ord - 1,
       p.created_at,
       p.created_at
from public.projects p,
     unnest(coalesce(p.initial_sketch_urls, '{}'::text[])) with ordinality as u(url, ord)
where coalesce(array_length(p.initial_sketch_urls, 1), 0) > 0
  and not exists (
    select 1 from public.project_sketches s
    where s.project_id = p.id and s.kind = 'brainstorming' and s.url = u.url
  );

-- Backfill initial design sketches
insert into public.project_sketches (project_id, kind, url, position, created_at, updated_at)
select p.id, 'initial_design'::public.sketch_kind, u.url, u.ord - 1, p.created_at, p.created_at
from public.projects p,
     unnest(coalesce(p.initial_design_sketch_urls, '{}'::text[])) with ordinality as u(url, ord)
where coalesce(array_length(p.initial_design_sketch_urls, 1), 0) > 0
  and not exists (
    select 1 from public.project_sketches s
    where s.project_id = p.id and s.kind = 'initial_design' and s.url = u.url
  );

-- Backfill final sketches
insert into public.project_sketches (project_id, kind, url, position, created_at, updated_at)
select p.id, 'final'::public.sketch_kind, u.url, u.ord - 1, p.created_at, p.created_at
from public.projects p,
     unnest(coalesce(p.final_sketch_urls, '{}'::text[])) with ordinality as u(url, ord)
where coalesce(array_length(p.final_sketch_urls, 1), 0) > 0
  and not exists (
    select 1 from public.project_sketches s
    where s.project_id = p.id and s.kind = 'final' and s.url = u.url
  );

alter table public.project_sketches enable row level security;

drop policy if exists "sketches_select_visible" on public.project_sketches;
create policy "sketches_select_visible"
  on public.project_sketches for select
  using (
    public.is_project_member(project_id, auth.uid())
    or public.is_project_classroom_teacher(project_id, auth.uid())
  );

drop policy if exists "sketches_insert_member" on public.project_sketches;
create policy "sketches_insert_member"
  on public.project_sketches for insert
  with check (public.is_project_member(project_id, auth.uid()));

drop policy if exists "sketches_update_member" on public.project_sketches;
create policy "sketches_update_member"
  on public.project_sketches for update
  using (public.is_project_member(project_id, auth.uid()))
  with check (public.is_project_member(project_id, auth.uid()));

drop policy if exists "sketches_delete_member" on public.project_sketches;
create policy "sketches_delete_member"
  on public.project_sketches for delete
  using (public.is_project_member(project_id, auth.uid()));

-- 5. classroom_conclusion_questions: teacher-defined prompts at the classroom level
create table if not exists public.classroom_conclusion_questions (
  id           uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  prompt       text not null,
  position     int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists classroom_conclusion_questions_class_pos_idx
  on public.classroom_conclusion_questions(classroom_id, position);

drop trigger if exists classroom_conclusion_questions_touch on public.classroom_conclusion_questions;
create trigger classroom_conclusion_questions_touch
  before update on public.classroom_conclusion_questions
  for each row execute function public.touch_updated_at();

alter table public.classroom_conclusion_questions enable row level security;

drop policy if exists "ccq_select_visible" on public.classroom_conclusion_questions;
create policy "ccq_select_visible"
  on public.classroom_conclusion_questions for select
  using (
    public.is_classroom_teacher(classroom_id, auth.uid())
    or public.is_classroom_member(classroom_id, auth.uid())
  );

drop policy if exists "ccq_insert_teacher" on public.classroom_conclusion_questions;
create policy "ccq_insert_teacher"
  on public.classroom_conclusion_questions for insert
  with check (public.is_classroom_teacher(classroom_id, auth.uid()));

drop policy if exists "ccq_update_teacher" on public.classroom_conclusion_questions;
create policy "ccq_update_teacher"
  on public.classroom_conclusion_questions for update
  using (public.is_classroom_teacher(classroom_id, auth.uid()))
  with check (public.is_classroom_teacher(classroom_id, auth.uid()));

drop policy if exists "ccq_delete_teacher" on public.classroom_conclusion_questions;
create policy "ccq_delete_teacher"
  on public.classroom_conclusion_questions for delete
  using (public.is_classroom_teacher(classroom_id, auth.uid()));

-- 6. project_conclusion_answers: per-notebook, per-question answer with timestamp
create table if not exists public.project_conclusion_answers (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  question_id  uuid not null references public.classroom_conclusion_questions(id) on delete cascade,
  body         text not null default '',
  answered_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, question_id)
);

create index if not exists project_conclusion_answers_project_idx
  on public.project_conclusion_answers(project_id);

drop trigger if exists project_conclusion_answers_touch on public.project_conclusion_answers;
create trigger project_conclusion_answers_touch
  before update on public.project_conclusion_answers
  for each row execute function public.touch_updated_at();

alter table public.project_conclusion_answers enable row level security;

drop policy if exists "pca_select_visible" on public.project_conclusion_answers;
create policy "pca_select_visible"
  on public.project_conclusion_answers for select
  using (
    public.is_project_member(project_id, auth.uid())
    or public.is_project_classroom_teacher(project_id, auth.uid())
  );

drop policy if exists "pca_insert_member" on public.project_conclusion_answers;
create policy "pca_insert_member"
  on public.project_conclusion_answers for insert
  with check (public.is_project_member(project_id, auth.uid()));

drop policy if exists "pca_update_member" on public.project_conclusion_answers;
create policy "pca_update_member"
  on public.project_conclusion_answers for update
  using (public.is_project_member(project_id, auth.uid()))
  with check (public.is_project_member(project_id, auth.uid()));

drop policy if exists "pca_delete_member" on public.project_conclusion_answers;
create policy "pca_delete_member"
  on public.project_conclusion_answers for delete
  using (public.is_project_member(project_id, auth.uid()));
