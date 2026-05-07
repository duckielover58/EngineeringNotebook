"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

async function requireStudentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "student") return { error: "Only students can edit notebooks." as const };
  return { supabase, userId: user.id };
}

export async function createDailyLog(projectId: string, content: string, image_urls: string[]) {
  const text = content.trim();
  if (!text) return { error: "Write a short summary for this log." };
  if (image_urls.length > 3) return { error: "You can attach up to 3 photos." };

  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;

  const { error } = await supabase.from("daily_logs").insert({
    project_id: projectId,
    content: text,
    image_urls,
    is_locked: false,
  });

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}/logs`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateDailyLog(logId: string, projectId: string, content: string, image_urls: string[]) {
  const text = content.trim();
  if (!text) return { error: "Summary cannot be empty." };
  if (image_urls.length > 3) return { error: "You can attach up to 3 photos." };

  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const { data: row, error: fetchError } = await supabase
    .from("daily_logs")
    .select("id, is_locked, created_at")
    .eq("id", logId)
    .single();

  if (fetchError || !row) return { error: "Log not found." };
  if (row.is_locked) return { error: "This log is locked." };
  const deadline = new Date(row.created_at).getTime() + 24 * 60 * 60 * 1000;
  if (Date.now() >= deadline) return { error: "The 24-hour edit window has passed." };

  const { error } = await supabase.from("daily_logs").update({ content: text, image_urls }).eq("id", logId);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}/logs`);
  return { ok: true as const };
}
