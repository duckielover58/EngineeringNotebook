"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { GanttData } from "@/types/database";

function validateMatrixRatings(matrix: number[][] | null, optionCount: number, criteriaCount: number) {
  if (!matrix || matrix.length !== optionCount) return "Matrix is incomplete.";
  for (const row of matrix) {
    if (!row || row.length !== criteriaCount) return "Matrix is incomplete.";
    for (const cell of row) {
      if (!Number.isInteger(cell) || cell < 1 || cell > 5) return "Each score must be between 1 (best) and 5 (worst).";
    }
  }
  return null;
}

export async function createProject(classroomId: string, title: string) {
  const t = title.trim();
  if (!t) return { error: "Project title is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ classroom_id: classroomId, title: t, status: "setup" })
    .select("id")
    .single();

  if (error || !project) return { error: error?.message ?? "Could not create project." };

  const { error: memberError } = await supabase.from("project_members").insert({ project_id: project.id, user_id: user.id });
  if (memberError) return { error: memberError.message };

  revalidatePath(`/classrooms/${classroomId}`);
  revalidatePath("/classrooms");
  return { ok: true as const, projectId: project.id };
}

export async function updateProjectBasics(
  projectId: string,
  payload: { title?: string; team_photo_url?: string | null }
) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(payload).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateProjectSketches(projectId: string, urls: string[]) {
  const supabase = await createClient();
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
  if (payload.matrix_criteria.length !== 5) return { error: "Define exactly 5 categories." };
  if (payload.matrix_criteria.some((c) => !c.trim())) return { error: "Each category needs a name." };
  if (payload.matrix_options.length < 1) return { error: "Add at least one design option." };
  if (payload.matrix_options.some((o) => !o.trim())) return { error: "Each option needs a name." };

  const err = validateMatrixRatings(payload.matrix_ratings, payload.matrix_options.length, 5);
  if (err) return { error: err };

  const supabase = await createClient();
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
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ gantt_data }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateProjectTechnicals(projectId: string, technical_latex: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ technical_latex }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateFinalSketches(projectId: string, urls: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ final_sketch_urls: urls }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function activateProject(projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ status: "active" }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}
