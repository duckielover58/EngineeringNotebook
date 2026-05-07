"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Supabase JWT `role` is reserved (e.g. "authenticated"). Storing app role under `role`
 * in user_metadata can be dropped or wrong in `profiles`. We store `engilog_role` in
 * signup metadata and sync here so `profiles.role` matches the JWT.
 */
export async function syncProfileRoleFromAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const raw = meta?.engilog_role ?? meta?.role;
  if (raw !== "teacher" && raw !== "student") return;

  const { data: row } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (!row) {
    // Profile row is missing (trigger may not have fired); create it now.
    const role = (raw === "teacher" || raw === "student") ? raw : "student";
    await supabase.from("profiles").insert({
      id: user.id,
      full_name: String(meta?.full_name ?? ""),
      role,
      school_name: String(meta?.school_name ?? ""),
    });
    return;
  }

  if (row.role === raw) return;

  await supabase.from("profiles").update({ role: raw }).eq("id", user.id);
}
