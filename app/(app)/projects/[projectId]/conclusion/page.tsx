import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ConclusionSection } from "@/components/projects/conclusion-section";
import type { ConclusionAnswer, ConclusionQuestion } from "@/types/database";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectConclusionPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project, error } = await supabase
    .from("projects")
    .select("status, classroom_id")
    .eq("id", projectId)
    .single();
  if (error || !project) notFound();
  if (project.status === "setup") redirect(`/projects/${projectId}/setup`);

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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const { data: memberRow } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  const canEdit = profile?.role === "student" && !!memberRow;

  return (
    <ConclusionSection
      projectId={projectId}
      questions={(questions as ConclusionQuestion[] | null) ?? []}
      initialAnswers={(answers as ConclusionAnswer[] | null) ?? []}
      canEdit={canEdit}
    />
  );
}
