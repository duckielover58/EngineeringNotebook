"use server";

import { revalidatePath } from "next/cache";

import { syncProfileRoleFromAuth } from "@/actions/profile";
import { createClient } from "@/lib/supabase/server";
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
