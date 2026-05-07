"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { GanttData } from "@/types/database";

function validateMatrixRatings(matrix: number[][] | null, optionCount: number, criteriaCount: number) {
  if (!matrix || matrix.length !== optionCount) return "Matrix is incomplete.";
  for (const row of matrix) {
    if (!row || row.length !== criteriaCount) return "Matrix is incomplete.";
    for (const cell of row) {
      if (!Number.isInteger(cell) || cell < 1 || cell > 5) return "Each score must be between 1 and 5.";
    }
  }
  return null;
}

function friendlyProjectRlsMessage(raw: string | undefined): string {
  const msg = raw ?? "";
  if (/row-level security|violates row-level security/i.test(msg)) {
    return "Could not create the notebook. Reload the page and try again. If you have not joined this class with its join code yet, use Join class first.";
  }
  return msg || "Could not create project.";
}

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

export async function createProject(classroomId: string, title: string) {
  const t = title.trim();
  if (!t) return { error: "Project title is required." };
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;

  const { data: projectId, error } = await supabase.rpc("create_project_for_student", {
    p_classroom: classroomId,
    p_title: t,
  });
  if (error || !projectId) return { error: friendlyProjectRlsMessage(error?.message) };

  revalidatePath(`/classrooms/${classroomId}`);
  revalidatePath("/classrooms");
  return { ok: true as const, projectId: projectId as string };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function inviteStudentToProject(projectId: string, email: string) {
  const inviteeEmail = normalizeEmail(email);
  if (!inviteeEmail || !inviteeEmail.includes("@")) return { error: "Enter a valid email address." };
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;

  const { error } = await supabase.rpc("create_project_invite", {
    p_project: projectId,
    p_invitee_email: inviteeEmail,
  });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function acceptProjectInvite(inviteId: string) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const { data: projectId, error } = await supabase.rpc("accept_project_invite", { p_invite: inviteId });
  if (error || !projectId) return { error: error?.message ?? "Could not accept invite." };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/classrooms");
  return { ok: true as const, projectId: projectId as string };
}

export async function revokeProjectInvite(inviteId: string, projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const { error } = await supabase.rpc("revoke_project_invite", { p_invite: inviteId });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateProjectBasics(
  projectId: string,
  payload: { title?: string; team_photo_url?: string | null }
) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const { error } = await supabase.from("projects").update(payload).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateProjectSketches(projectId: string, urls: string[]) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const { error } = await supabase.from("projects").update({ initial_sketch_urls: urls }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateProjectMatrix(
  projectId: string,
  payload: {
    matrix_criteria: string[];
    matrix_options: string[];
    matrix_ratings: number[][];
  }
) {
  if (payload.matrix_criteria.length < 1) return { error: "Add at least one category." };
  if (payload.matrix_criteria.some((c) => !c.trim())) return { error: "Each category needs a name." };
  if (payload.matrix_options.length < 1) return { error: "Add at least one design option." };
  if (payload.matrix_options.some((o) => !o.trim())) return { error: "Each option needs a name." };

  const err = validateMatrixRatings(payload.matrix_ratings, payload.matrix_options.length, payload.matrix_criteria.length);
  if (err) return { error: err };

  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const { error } = await supabase
    .from("projects")
    .update({
      matrix_criteria: payload.matrix_criteria.map((c) => c.trim()),
      matrix_options: payload.matrix_options.map((o) => o.trim()),
      matrix_ratings: payload.matrix_ratings,
    })
    .eq("id", projectId);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateProjectGantt(projectId: string, gantt_data: GanttData) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const { error } = await supabase.from("projects").update({ gantt_data }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateProjectTechnicals(projectId: string, technical_latex: string) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const { error } = await supabase.from("projects").update({ technical_latex }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateFinalSketches(projectId: string, urls: string[]) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const { error } = await supabase.from("projects").update({ final_sketch_urls: urls }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function activateProject(projectId: string) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const { error } = await supabase.from("projects").update({ status: "active" }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}
