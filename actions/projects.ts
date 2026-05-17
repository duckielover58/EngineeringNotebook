"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isDevTestUser } from "@/lib/dev-test-account";
import { deleteProjectStorage } from "@/lib/storage-cleanup";
import type { DesignBrief, GanttData, SketchKind } from "@/types/database";

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
  const { supabase, userId } = auth;

  const [{ data: authUser }, { data: nameRow }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
  ]);
  const email = authUser.user?.email ?? "";
  const trimmedName = ((nameRow?.full_name as string | null | undefined) ?? "").trim();
  const displayName = trimmedName || email.split("@")[0]?.trim() || "Student";
  const composedTitle = `${displayName} — ${t}`;

  const { data: projectId, error } = await supabase.rpc("create_project_for_student", {
    p_classroom: classroomId,
    p_title: composedTitle,
  });
  if (error || !projectId) return { error: friendlyProjectRlsMessage(error?.message) };

  revalidatePath(`/classrooms/${classroomId}`);
  revalidatePath("/classrooms");
  return { ok: true as const, projectId: projectId as string };
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

// ---------------------------------------------------------------------------
// Title page (problem title, school, course, dates, design problem, team photo)
// ---------------------------------------------------------------------------

export type TitlePagePayload = {
  problem_title?: string | null;
  school_name?: string | null;
  course_title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  design_problem?: string | null;
  team_photo_url?: string | null;
};

export async function updateProjectTitlePage(projectId: string, payload: TitlePagePayload) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;

  const update: Record<string, unknown> = {};
  if (payload.problem_title !== undefined) update.problem_title = payload.problem_title;
  if (payload.school_name !== undefined) update.school_name = payload.school_name;
  if (payload.course_title !== undefined) update.course_title = payload.course_title;
  if (payload.start_date !== undefined) update.start_date = payload.start_date;
  if (payload.end_date !== undefined) update.end_date = payload.end_date;
  if (payload.design_problem !== undefined) update.design_problem = payload.design_problem;
  if (payload.team_photo_url !== undefined) update.team_photo_url = payload.team_photo_url;
  if (Object.keys(update).length === 0) return { ok: true as const, updatedAt: null as string | null };

  const now = new Date().toISOString();
  update.title_page_updated_at = now;

  const { error } = await supabase.from("projects").update(update).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const, updatedAt: now };
}

// ---------------------------------------------------------------------------
// Design brief
// ---------------------------------------------------------------------------

export async function updateDesignBrief(projectId: string, brief: DesignBrief) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;

  const cleaned: DesignBrief = {
    client: (brief.client ?? "").trim(),
    target_consumer: (brief.target_consumer ?? "").trim(),
    design_team: (brief.design_team ?? "").trim(),
    design_statement: (brief.design_statement ?? "").trim(),
    criteria: (brief.criteria ?? []).map((c) => c.trim()).filter((c) => c.length > 0),
    deliverables: (brief.deliverables ?? []).map((d) => d.trim()).filter((d) => d.length > 0),
  };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("projects")
    .update({ design_brief: cleaned, design_brief_updated_at: now })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const, updatedAt: now, brief: cleaned };
}

// ---------------------------------------------------------------------------
// Sketches (per-row table public.project_sketches)
// ---------------------------------------------------------------------------

export async function addProjectSketch(
  projectId: string,
  kind: SketchKind,
  url: string,
  memberLabel?: string | null,
) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase, userId } = auth;

  // Compute next position (append to end).
  const { data: posRow } = await supabase
    .from("project_sketches")
    .select("position")
    .eq("project_id", projectId)
    .eq("kind", kind)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = ((posRow?.position as number | undefined) ?? -1) + 1;

  const { data, error } = await supabase
    .from("project_sketches")
    .insert({
      project_id: projectId,
      kind,
      url,
      member_label: memberLabel?.trim() || null,
      uploaded_by: userId,
      position: nextPos,
    })
    .select("id, project_id, kind, url, member_label, uploaded_by, position, created_at, updated_at")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const, sketch: data };
}

export async function removeProjectSketch(sketchId: string) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const { data: row } = await supabase
    .from("project_sketches")
    .select("project_id")
    .eq("id", sketchId)
    .single();
  const { error } = await supabase.from("project_sketches").delete().eq("id", sketchId);
  if (error) return { error: error.message };
  if (row?.project_id) revalidatePath(`/projects/${row.project_id}`);
  return { ok: true as const };
}

export async function updateProjectSketchLabel(sketchId: string, memberLabel: string) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const trimmed = memberLabel.trim();
  const { data, error } = await supabase
    .from("project_sketches")
    .update({ member_label: trimmed || null })
    .eq("id", sketchId)
    .select("project_id")
    .single();
  if (error) return { error: error.message };
  if (data?.project_id) revalidatePath(`/projects/${data.project_id}`);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Math images (per-row table public.project_math_images)
// ---------------------------------------------------------------------------

export async function addMathImage(projectId: string, url: string) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from("project_math_images")
    .insert({ project_id: projectId, url, uploaded_by: userId })
    .select("id, project_id, url, uploaded_by, created_at, updated_at")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/math`);
  return { ok: true as const, image: data };
}

export async function removeMathImage(imageId: string) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const { data: row } = await supabase
    .from("project_math_images")
    .select("project_id")
    .eq("id", imageId)
    .single();
  const { error } = await supabase.from("project_math_images").delete().eq("id", imageId);
  if (error) return { error: error.message };
  if (row?.project_id) {
    revalidatePath(`/projects/${row.project_id}`);
    revalidatePath(`/projects/${row.project_id}/math`);
  }
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Math notes (single text field with section-level updated_at)
// ---------------------------------------------------------------------------

export async function updateProjectMath(
  projectId: string,
  payload: { notes?: string | null }
) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  if (payload.notes === undefined) return { ok: true as const };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("projects")
    .update({ math_notes: payload.notes, math_notes_updated_at: now })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/math`);
  return { ok: true as const, updatedAt: now };
}

// ---------------------------------------------------------------------------
// Decision matrix
// ---------------------------------------------------------------------------

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
      matrix_updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Gantt
// ---------------------------------------------------------------------------

export async function updateProjectGantt(projectId: string, gantt_data: GanttData) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase, userId } = auth;

  const [{ data: project }, { data: authUser }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("status").eq("id", projectId).single(),
    supabase.auth.getUser(),
    supabase.from("profiles").select("school_name").eq("id", userId).single(),
  ]);
  if (!project) return { error: "Notebook not found." };
  if (
    project.status === "active" &&
    !isDevTestUser(profile?.school_name as string | null | undefined, authUser.user?.email)
  ) {
    return { error: "Gantt chart can only be edited during notebook setup." };
  }

  const { error } = await supabase
    .from("projects")
    .update({ gantt_data, gantt_updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Conclusion answers (per-question, per-project)
// ---------------------------------------------------------------------------

export async function upsertConclusionAnswer(projectId: string, questionId: string, body: string) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase, userId } = auth;

  // Defense-in-depth: confirm the question belongs to the project's classroom
  // before writing. The DB trigger also enforces this; the precheck just
  // surfaces a friendlier error than a raw constraint violation.
  const [{ data: projectRow }, { data: questionRow }] = await Promise.all([
    supabase.from("projects").select("classroom_id").eq("id", projectId).single(),
    supabase
      .from("classroom_conclusion_questions")
      .select("classroom_id")
      .eq("id", questionId)
      .single(),
  ]);
  if (
    !projectRow ||
    !questionRow ||
    !projectRow.classroom_id ||
    !questionRow.classroom_id ||
    projectRow.classroom_id !== questionRow.classroom_id
  ) {
    return { error: "That question does not belong to this notebook's classroom." };
  }

  const { data, error } = await supabase
    .from("project_conclusion_answers")
    .upsert(
      {
        project_id: projectId,
        question_id: questionId,
        body,
        answered_by: userId,
      },
      { onConflict: "project_id,question_id" },
    )
    .select("id, project_id, question_id, body, answered_by, created_at, updated_at")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/conclusion`);
  return { ok: true as const, answer: data };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function activateProject(projectId: string) {
  const auth = await requireStudentUser();
  if ("error" in auth) return auth;
  const { supabase } = auth;
  const { error } = await supabase.from("projects").update({ status: "active" }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Creator-only deletion. RLS still allows classroom teachers via projects_delete_teacher
  // (defense in depth / cleanup), but the explicit user-facing action is creator-only.
  const { data: row, error: readErr } = await supabase
    .from("projects")
    .select("classroom_id, created_by")
    .eq("id", projectId)
    .single();
  if (readErr || !row) return { error: "Notebook not found." };
  if (row.created_by !== user.id) {
    return { error: "Only the notebook creator can delete it." };
  }

  const admin = createServiceClient();
  if (!admin) {
    return {
      error:
        "Server is not configured with SUPABASE_SERVICE_ROLE_KEY, so uploaded files cannot be removed. Add it in .env.local (Supabase → Project Settings → API → service_role secret), then try again.",
    };
  }
  try {
    await deleteProjectStorage(admin, projectId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not remove notebook files from storage.";
    return { error: msg };
  }

  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { error: error.message };

  if (row.classroom_id) {
    revalidatePath(`/classrooms/${row.classroom_id}`);
    revalidatePath(`/teacher/classrooms/${row.classroom_id}`);
  }
  revalidatePath("/classrooms");
  revalidatePath("/dashboard");
  return { ok: true as const, classroomId: row.classroom_id as string | null };
}
