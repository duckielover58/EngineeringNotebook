import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { NotebookPdfExport } from "@/components/export/notebook-pdf-export";
import type {
  ConclusionAnswer,
  ConclusionQuestion,
  DesignBrief,
  GanttData,
  ProjectMathImage,
  ProjectSketch,
} from "@/types/database";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectExportPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "title, status, team_photo_url, classroom_id, problem_title, school_name, course_title, start_date, end_date, design_problem, title_page_updated_at, design_brief, design_brief_updated_at, matrix_criteria, matrix_options, matrix_ratings, matrix_updated_at, gantt_data, gantt_updated_at, math_notes, math_notes_updated_at",
    )
    .eq("id", projectId)
    .single();

  if (error || !project) notFound();
  if (project.status === "setup") redirect(`/projects/${projectId}/setup`);

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("content, image_urls, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const { data: sketchRows } = await supabase
    .from("project_sketches")
    .select("id, project_id, kind, url, member_label, uploaded_by, position, created_at, updated_at")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  const allSketches = (sketchRows as ProjectSketch[] | null) ?? [];

  const { data: mathImages } = await supabase
    .from("project_math_images")
    .select("id, project_id, url, uploaded_by, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const { data: questions } = project.classroom_id
    ? await supabase
        .from("classroom_conclusion_questions")
        .select("id, classroom_id, prompt, position, created_at, updated_at")
        .eq("classroom_id", project.classroom_id)
        .order("position", { ascending: true })
    : { data: [] as ConclusionQuestion[] };

  const { data: answers } = await supabase
    .from("project_conclusion_answers")
    .select("id, project_id, question_id, body, answered_by, created_at, updated_at")
    .eq("project_id", projectId);

  const { data: memberRows } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  const memberIds = (memberRows ?? []).map((r) => r.user_id as string);
  const { data: memberProfiles } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] as { id: string; full_name: string | null }[] };

  return (
    <NotebookPdfExport
      project={{
        title: project.title,
        team_photo_url: project.team_photo_url,
        problem_title: (project.problem_title as string | null) ?? null,
        school_name: (project.school_name as string | null) ?? null,
        course_title: (project.course_title as string | null) ?? null,
        start_date: (project.start_date as string | null) ?? null,
        end_date: (project.end_date as string | null) ?? null,
        design_problem: (project.design_problem as string | null) ?? null,
        title_page_updated_at: (project.title_page_updated_at as string | null) ?? null,
        design_brief: (project.design_brief as DesignBrief | null) ?? null,
        design_brief_updated_at: (project.design_brief_updated_at as string | null) ?? null,
        team_member_names: (memberProfiles ?? [])
          .map((p) => (p.full_name ?? "").trim())
          .filter((n) => n.length > 0),
        brainstorm_sketches: allSketches.filter((s) => s.kind === "brainstorming"),
        initial_design_sketches: allSketches.filter((s) => s.kind === "initial_design"),
        final_sketches: allSketches.filter((s) => s.kind === "final"),
        matrix_criteria: project.matrix_criteria ?? [],
        matrix_options: project.matrix_options ?? [],
        matrix_ratings: (project.matrix_ratings as number[][] | null) ?? [],
        matrix_updated_at: (project.matrix_updated_at as string | null) ?? null,
        gantt_data: project.gantt_data as GanttData | null,
        gantt_updated_at: (project.gantt_updated_at as string | null) ?? null,
        math_notes: project.math_notes ?? null,
        math_notes_updated_at: (project.math_notes_updated_at as string | null) ?? null,
        math_images: (mathImages as ProjectMathImage[] | null) ?? [],
        conclusion_questions: (questions as ConclusionQuestion[] | null) ?? [],
        conclusion_answers: (answers as ConclusionAnswer[] | null) ?? [],
      }}
      logs={logs ?? []}
    />
  );
}
