import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { FinalSketchesForm } from "@/components/projects/final-sketches-form";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectFinalPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project, error } = await supabase.from("projects").select("final_sketch_urls, status").eq("id", projectId).single();
  if (error || !project) notFound();
  if (project.status === "setup") redirect(`/projects/${projectId}/setup`);

  return <FinalSketchesForm projectId={projectId} initialUrls={project.final_sketch_urls ?? []} />;
}
