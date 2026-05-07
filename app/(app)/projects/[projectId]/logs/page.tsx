import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { DailyLogSection } from "@/components/daily-log/daily-log-section";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectLogsPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const { data: project, error } = await supabase.from("projects").select("id, status").eq("id", projectId).single();
  if (error || !project) notFound();
  if (project.status === "setup") redirect(`/projects/${projectId}/setup`);

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("id, content, image_urls, created_at, is_locked")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const { data: logComments } = await supabase
    .from("project_comments")
    .select("id, body, created_at, teacher_id, anchor_section")
    .eq("project_id", projectId)
    .like("anchor_section", "daily_log:%")
    .order("created_at", { ascending: true });

  const commentsByLogId = (logComments ?? []).reduce<Record<string, { id: string; body: string; created_at: string; teacher_id: string }[]>>((acc, c) => {
    const anchor = c.anchor_section ?? "";
    const logId = anchor.startsWith("daily_log:") ? anchor.slice("daily_log:".length) : "";
    if (!logId) return acc;
    if (!acc[logId]) acc[logId] = [];
    acc[logId].push({ id: c.id, body: c.body, created_at: c.created_at, teacher_id: c.teacher_id });
    return acc;
  }, {});

  const teacherIds = Array.from(new Set((logComments ?? []).map((c) => c.teacher_id).filter(Boolean)));
  const { data: teacherProfiles } = teacherIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", teacherIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const teacherNamesById: Record<string, string> = Object.fromEntries(
    (teacherProfiles ?? []).map((p) => [p.id, (p.full_name ?? "").trim() || "Teacher"]),
  );

  return (
    <DailyLogSection
      projectId={projectId}
      initialLogs={logs ?? []}
      isTeacherView={profile?.role === "teacher"}
      commentsByLogId={commentsByLogId}
      teacherNamesById={teacherNamesById}
    />
  );
}
