"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function addProjectComment(projectId: string, body: string, anchor_section?: string | null) {
  const text = body.trim();
  if (!text) return { error: "Comment cannot be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "teacher") return { error: "Only teachers can add comments." };

  const { error } = await supabase.from("project_comments").insert({
    project_id: projectId,
    teacher_id: user.id,
    body: text,
    anchor_section: anchor_section ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/teacher/classrooms`);
  return { ok: true as const };
}
