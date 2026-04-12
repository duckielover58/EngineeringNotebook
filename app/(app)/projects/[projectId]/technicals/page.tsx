import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LatexTechnicalsForm } from "@/components/technicals/latex-technicals-form";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectTechnicalsPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project, error } = await supabase.from("projects").select("technical_latex, status").eq("id", projectId).single();
  if (error || !project) notFound();
  if (project.status === "setup") redirect(`/projects/${projectId}/setup`);

  return <LatexTechnicalsForm projectId={projectId} initial={project.technical_latex} />;
}
