import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { NotebookPdfExport } from "@/components/export/notebook-pdf-export";
import type { GanttData } from "@/types/database";

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
      "title, status, team_photo_url, initial_sketch_urls, matrix_criteria, matrix_options, matrix_ratings, gantt_data, technical_latex, final_sketch_urls"
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

  return (
    <NotebookPdfExport
      project={{
        title: project.title,
        team_photo_url: project.team_photo_url,
        initial_sketch_urls: project.initial_sketch_urls ?? [],
        matrix_criteria: project.matrix_criteria ?? [],
        matrix_options: project.matrix_options ?? [],
        matrix_ratings: (project.matrix_ratings as number[][] | null) ?? [],
        gantt_data: project.gantt_data as GanttData | null,
        technical_latex: project.technical_latex,
        final_sketch_urls: project.final_sketch_urls ?? [],
      }}
      logs={logs ?? []}
    />
  );
}
