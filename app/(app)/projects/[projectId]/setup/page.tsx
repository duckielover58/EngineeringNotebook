import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ProjectSetupWizard } from "@/components/projects/project-setup-wizard";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectSetupPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, title, status, initial_sketch_urls, matrix_criteria, matrix_options, matrix_ratings, gantt_data, final_sketch_urls"
    )
    .eq("id", projectId)
    .single();

  if (error || !project) notFound();
  if (project.status !== "setup") redirect(`/projects/${projectId}`);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/projects/${projectId}`}>Back to notebook</Link>
      </Button>
      <ProjectSetupWizard
        project={{
          ...project,
          matrix_ratings: (project.matrix_ratings as number[][] | null) ?? null,
          gantt_data: project.gantt_data as import("@/types/database").GanttData | null,
        }}
      />
    </div>
  );
}
