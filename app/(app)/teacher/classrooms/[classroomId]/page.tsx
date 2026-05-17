import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { INACTIVE_PROJECT_DAYS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { isDevTestUser } from "@/lib/dev-test-account";
import { CoTeacherManager } from "@/components/classrooms/co-teacher-manager";
import { DevClassroomId } from "@/components/classrooms/dev-classroom-id";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { params: Promise<{ classroomId: string }> };

type LogLite = { created_at: string };
type TeacherRow = { teacher_id: string; profiles: { full_name: string } | { full_name: string }[] | null };

function lastLogDate(logs: LogLite[] | null | undefined): Date | null {
  if (!logs?.length) return null;
  const times = logs.map((l) => new Date(l.created_at).getTime());
  return new Date(Math.max(...times));
}

function isInactive(projectCreated: string, logs: LogLite[] | null | undefined): boolean {
  const last = lastLogDate(logs);
  const now = Date.now();
  const threshold = INACTIVE_PROJECT_DAYS * 24 * 60 * 60 * 1000;
  if (!last) {
    return now - new Date(projectCreated).getTime() > threshold;
  }
  return now - last.getTime() > threshold;
}

export default async function TeacherClassroomDashboard({ params }: Props) {
  const { classroomId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: room, error } = await supabase.from("classrooms").select("id, name, join_code, teacher_id").eq("id", classroomId).single();
  if (error || !room) notFound();
  const { data: teacherMembership } = await supabase
    .from("classroom_teachers")
    .select("teacher_id")
    .eq("classroom_id", classroomId)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!teacherMembership) notFound();

  const { data: profile } = await supabase.from("profiles").select("school_name").eq("id", user.id).single();
  const showDevClassroomId = isDevTestUser(profile?.school_name as string | null | undefined, user.email);

  const { data: teacherRows } = await supabase
    .from("classroom_teachers")
    .select("teacher_id, profiles(full_name)")
    .eq("classroom_id", classroomId)
    .order("created_at", { ascending: true });

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, status, created_at, created_by, daily_logs(created_at)")
    .eq("classroom_id", classroomId)
    .order("created_at", { ascending: false });

  const creatorIds = Array.from(
    new Set(
      (projects ?? [])
        .map((p) => p.created_by as string | null | undefined)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  const creatorNames = new Map<string, string>();
  if (creatorIds.length) {
    const { data: creatorProfiles } = await supabase.from("profiles").select("id, full_name").in("id", creatorIds);
    for (const row of creatorProfiles ?? []) {
      const n = ((row.full_name as string | null | undefined) ?? "").trim();
      creatorNames.set(row.id as string, n || "Student");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Teacher dashboard</h1>
        <p className="text-muted-foreground">
          {room.name} · Join code <span className="font-mono tracking-widest">{room.join_code}</span>
        </p>
        {showDevClassroomId && <DevClassroomId id={room.id} />}
      </div>

      <CoTeacherManager
        classroomId={classroomId}
        ownerId={room.teacher_id}
        currentUserId={user.id}
        rows={(teacherRows as TeacherRow[]) ?? []}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {(projects ?? []).map((p) => {
          const logs = p.daily_logs as LogLite[] | null | undefined;
          const inactive = isInactive(p.created_at, logs);
          const last = lastLogDate(logs);
          const createdBy = p.created_by as string | null | undefined;
          const studentLabel = createdBy ? (creatorNames.get(createdBy) ?? "Unknown") : "Unknown";
          return (
            <Card key={p.id} className={inactive ? "border-amber-500/60" : undefined}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-lg">{p.title}</CardTitle>
                  <CardDescription>
                    Student: {studentLabel} · Last log: {last ? last.toLocaleDateString() : "—"}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {inactive && <Badge variant="destructive">Inactive</Badge>}
                  <Badge variant="secondary">{p.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Link href={`/projects/${p.id}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                  Open notebook
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(projects ?? []).length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>When students create notebooks, they will appear here.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
