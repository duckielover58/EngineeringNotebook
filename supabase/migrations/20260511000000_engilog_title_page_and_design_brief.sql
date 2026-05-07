-- EngiLog: title-page details + structured design brief.
-- Adds per-project columns plus section-level *_updated_at stamps. Idempotent.

alter table public.projects
  add column if not exists problem_title           text,
  add column if not exists school_name             text,
  add column if not exists course_title            text,
  add column if not exists start_date              date,
  add column if not exists end_date                date,
  add column if not exists design_problem          text,
  add column if not exists design_brief            jsonb,
  add column if not exists title_page_updated_at   timestamptz,
  add column if not exists design_brief_updated_at timestamptz;
