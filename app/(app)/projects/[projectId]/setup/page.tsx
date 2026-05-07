import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ProjectSetupWizard } from "@/components/projects/project-setup-wizard";
import { Button } from "@/components/ui/button";
import type { DesignBrief, GanttData, ProjectSketch } from "@/types/database";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectSetupPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "student") redirect(`/projects/${projectId}`);

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, title, status, problem_title, school_name, course_title, start_date, end_date, design_problem, team_photo_url, title_page_updated_at, design_brief, design_brief_updated_at, matrix_criteria, matrix_options, matrix_ratings, gantt_data",
    )
    .eq("id", projectId)
    .single();

  if (error || !project) notFound();
  if (project.status !== "setup") redirect(`/projects/${projectId}`);

  const { data: sketches } = await supabase
    .from("project_sketches")
    .select("id, project_id, kind, url, member_label, uploaded_by, position, created_at, updated_at")
    .eq("project_id", projectId)
    .in("kind", ["brainstorming", "final"])
    .order("position", { ascending: true });

  const all = (sketches ?? []) as ProjectSketch[];
  const brainstormingSketches = all.filter((s) => s.kind === "brainstorming");
  const finalSketches = all.filter((s) => s.kind === "final");

  const { data: memberRows } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  const memberIds = (memberRows ?? []).map((r) => r.user_id as string);
  const { data: memberProfiles } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] as { id: string; full_name: string | null }[] };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/projects/${projectId}`}>Back to notebook</Link>
      </Button>
      <ProjectSetupWizard
        project={{
          ...project,
          matrix_ratings: (project.matrix_ratings as number[][] | null) ?? null,
          gantt_data: project.gantt_data as GanttData | null,
          design_brief: (project.design_brief as DesignBrief | null) ?? null,
        }}
        brainstormingSketches={brainstormingSketches}
        finalSketches={finalSketches}
        teamMembers={(memberProfiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name ?? null }))}
      />
    </div>
  );
}
