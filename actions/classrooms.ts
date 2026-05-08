"use server";

import { revalidatePath } from "next/cache";

import { syncProfileRoleFromAuth } from "@/actions/profile";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { deleteProjectStorage } from "@/lib/storage-cleanup";
import { randomSixDigitCode } from "@/lib/join-code";

export async function createClassroom(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Classroom name is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  await syncProfileRoleFromAuth();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "teacher") return { error: "Only teachers can create classrooms." };

  for (let i = 0; i < 12; i++) {
    const join_code = randomSixDigitCode();
    const { data, error } = await supabase
      .from("classrooms")
      .insert({ teacher_id: user.id, name, join_code })
      .select("id")
      .single();
    if (!error && data) {
      const { error: teacherRowError } = await supabase
        .from("classroom_teachers")
        .insert({ classroom_id: data.id, teacher_id: user.id, added_by: user.id });
      if (teacherRowError) {
        await supabase.from("classrooms").delete().eq("id", data.id);
        return { error: teacherRowError.message };
      }
      revalidatePath("/classrooms");
      return { ok: true as const, classroomId: data.id };
    }
    if (error?.code !== "23505") return { error: error?.message ?? "Could not create classroom." };
  }

  return { error: "Could not allocate a unique join code. Try again." };
}

export async function joinClassroomByCode(code: string) {
  const cleaned = code.replace(/\D/g, "").slice(0, 6);
  if (cleaned.length !== 6) return { error: "Enter the 6-digit join code." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  await syncProfileRoleFromAuth();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "student") return { error: "Only students join classrooms with a code." };

  const { data: classroomId, error } = await supabase.rpc("join_classroom_by_code", { p_code: cleaned });
  if (error) return { error: error.message };
  revalidatePath("/classrooms");
  return { ok: true as const, classroomId: classroomId as string };
}

export async function addCoTeacherByEmail(classroomId: string, email: string) {
  const cleaned = email.trim().toLowerCase();
  if (!cleaned || !cleaned.includes("@")) return { error: "Enter a valid teacher email." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const { error } = await supabase.rpc("add_classroom_coteacher_by_email", {
    p_classroom: classroomId,
    p_email: cleaned,
  });
  if (error) return { error: error.message };
  revalidatePath(`/classrooms/${classroomId}`);
  revalidatePath(`/teacher/classrooms/${classroomId}`);
  revalidatePath("/classrooms");
  return { ok: true as const };
}

type ConclusionQuestionInput = { id?: string; prompt: string };

export async function setClassroomConclusionQuestions(
  classroomId: string,
  questions: ConclusionQuestionInput[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Pre-check teacher membership for a clearer error than RLS rejection.
  const { data: membership } = await supabase
    .from("classroom_teachers")
    .select("teacher_id")
    .eq("classroom_id", classroomId)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!membership) {
    return { error: "Only classroom teachers can edit conclusion questions." };
  }

  const cleaned = questions
    .map((q, i) => ({ id: q.id ?? null, prompt: q.prompt.trim(), position: i }))
    .filter((q) => q.prompt.length > 0);

  // Atomic delete/update/insert via RPC to avoid partial-save corruption.
  const { error } = await supabase.rpc("set_classroom_conclusion_questions", {
    p_classroom: classroomId,
    p_questions: cleaned,
  });
  if (error) return { error: error.message };

  revalidatePath(`/classrooms/${classroomId}`);
  revalidatePath(`/teacher/classrooms/${classroomId}`);
  return { ok: true as const };
}

export async function deleteClassroom(classroomId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Only the original creator (classrooms.teacher_id) can delete.
  // RLS classrooms_delete_teacher will also enforce this; we pre-check for a clearer error.
  const { data: room, error: readErr } = await supabase
    .from("classrooms")
    .select("teacher_id")
    .eq("id", classroomId)
    .single();
  if (readErr || !room) return { error: "Classroom not found." };
  if (room.teacher_id !== user.id) {
    return { error: "Only the classroom creator can delete this classroom." };
  }

  const { data: projectRows, error: projectsReadErr } = await supabase
    .from("projects")
    .select("id")
    .eq("classroom_id", classroomId);
  if (projectsReadErr) return { error: projectsReadErr.message };

  const admin = createServiceClient();
  if (!admin) {
    return {
      error:
        "Server is not configured with SUPABASE_SERVICE_ROLE_KEY, so uploaded notebook files cannot be removed. Add it in .env.local (Supabase → Project Settings → API → service_role secret), then try again.",
    };
  }
  try {
    for (const row of projectRows ?? []) {
      await deleteProjectStorage(admin, row.id as string);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not remove notebook files from storage.";
    return { error: msg };
  }

  const { error } = await supabase.from("classrooms").delete().eq("id", classroomId);
  if (error) return { error: error.message };
  revalidatePath("/classrooms");
  revalidatePath(`/classrooms/${classroomId}`);
  revalidatePath(`/teacher/classrooms/${classroomId}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function removeCoTeacher(classroomId: string, teacherId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const { error } = await supabase.rpc("remove_classroom_coteacher", {
    p_classroom: classroomId,
    p_teacher: teacherId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/classrooms/${classroomId}`);
  revalidatePath(`/teacher/classrooms/${classroomId}`);
  revalidatePath("/classrooms");
  return { ok: true as const };
}
