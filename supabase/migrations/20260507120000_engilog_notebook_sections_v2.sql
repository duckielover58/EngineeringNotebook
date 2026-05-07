-- EngiLog: notebook sections v2
-- Adds columns for the post-activation initial design sketch section,
-- the new Math section (replacing the LaTeX-only Technicals page), and
-- per-sketch teammate metadata for brainstorming sketches.
-- Idempotent so it is safe to re-run.

alter table public.projects
  add column if not exists initial_design_sketch_urls text[],
  add column if not exists math_image_urls text[],
  add column if not exists math_notes text,
  add column if not exists initial_sketch_meta jsonb;
