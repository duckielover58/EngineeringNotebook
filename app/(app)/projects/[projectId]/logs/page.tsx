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

  const { data: project, error } = await supabase.from("projects").select("id, status").eq("id", projectId).single();
  if (error || !project) notFound();
  if (project.status === "setup") redirect(`/projects/${projectId}/setup`);

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("id, content, image_urls, created_at, is_locked")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return <DailyLogSection projectId={projectId} initialLogs={logs ?? []} />;
}
