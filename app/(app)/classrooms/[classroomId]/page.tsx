import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CoTeacherManager } from "@/components/classrooms/co-teacher-manager";
import { PendingProjectInvites } from "@/components/classrooms/pending-project-invites";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { params: Promise<{ classroomId: string }> };
type TeacherRow = { teacher_id: string; profiles: { full_name: string } | { full_name: string }[] | null };
type PendingInviteRow = {
  id: string;
  project_id: string;
  invitee_email: string;
  created_at: string;
  projects: { title: string } | { title: string }[] | null;
};

export default async function ClassroomDetailPage({ params }: Props) {
  const { classroomId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: room, error } = await supabase.from("classrooms").select("id, name, join_code, teacher_id").eq("id", classroomId).single();
  if (error || !room) notFound();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const { data: teacherMembership } = await supabase
    .from("classroom_teachers")
    .select("teacher_id")
    .eq("classroom_id", classroomId)
    .eq("teacher_id", user.id)
    .maybeSingle();
  const isTeacher = profile?.role === "teacher" && !!teacherMembership;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, status, created_at")
    .eq("classroom_id", classroomId)
    .order("created_at", { ascending: false });

  const canCreate =
    profile?.role === "student" &&
    (await supabase.from("classroom_members").select("user_id").eq("classroom_id", classroomId).eq("user_id", user.id).maybeSingle()).data;

  const { data: pendingInvites } =
    profile?.role === "student"
      ? await supabase
          .from("project_invites")
          .select("id, project_id, invitee_email, created_at, projects(title)")
          .eq("classroom_id", classroomId)
          .eq("status", "pending")
          .ilike("invitee_email", user.email ?? "")
          .order("created_at", { ascending: false })
      : { data: [] as never[] };

  const { data: teacherRows } = isTeacher
    ? await supabase
        .from("classroom_teachers")
        .select("teacher_id, profiles(full_name)")
        .eq("classroom_id", classroomId)
        .order("created_at", { ascending: true })
    : { data: [] as never[] };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{room.name}</h1>
          {isTeacher && (
            <p className="mt-1 text-muted-foreground">
              Join code: <span className="font-mono font-medium tracking-widest text-foreground">{room.join_code}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isTeacher && (
            <Button variant="secondary" asChild>
              <Link href={`/teacher/classrooms/${room.id}`}>Teacher dashboard</Link>
            </Button>
          )}
          {canCreate && (
            <Button asChild>
              <Link href={`/classrooms/${room.id}/projects/new`}>New notebook</Link>
            </Button>
          )}
        </div>
      </div>

      {profile?.role === "student" && <PendingProjectInvites invites={(pendingInvites as PendingInviteRow[]) ?? []} />}

      {isTeacher && (
        <CoTeacherManager
          classroomId={classroomId}
          ownerId={room.teacher_id}
          currentUserId={user.id}
          rows={(teacherRows as TeacherRow[]) ?? []}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Team notebooks</CardTitle>
          <CardDescription>Each project is an engineering notebook for one team.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(projects ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet. Start the first notebook for this class.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {projects!.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: {p.status} · Created {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={p.status === "setup" ? `/projects/${p.id}/setup` : `/projects/${p.id}`}>Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
