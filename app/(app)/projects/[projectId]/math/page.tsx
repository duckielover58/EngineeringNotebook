import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { MathSectionForm } from "@/components/math/math-section-form";
import type { ProjectMathImage } from "@/types/database";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectMathPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project, error } = await supabase
    .from("projects")
    .select("status, math_notes, math_notes_updated_at")
    .eq("id", projectId)
    .single();
  if (error || !project) notFound();
  if (project.status === "setup") redirect(`/projects/${projectId}/setup`);

  const { data: images } = await supabase
    .from("project_math_images")
    .select("id, project_id, url, uploaded_by, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const { data: memberRow } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  const canEdit = profile?.role === "student" && !!memberRow;

  return (
    <MathSectionForm
      projectId={projectId}
      initialNotes={(project.math_notes as string | null) ?? null}
      notesUpdatedAt={(project.math_notes_updated_at as string | null) ?? null}
      initialImages={(images as ProjectMathImage[] | null) ?? []}
      canEdit={canEdit}
    />
  );
}
