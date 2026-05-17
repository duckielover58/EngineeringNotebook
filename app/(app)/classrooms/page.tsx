import Link from "next/link";
import { redirect } from "next/navigation";

import { syncProfileRoleFromAuth } from "@/actions/profile";
import { DevClassroomId } from "@/components/classrooms/dev-classroom-id";
import { createClient } from "@/lib/supabase/server";
import { isDevTestUser } from "@/lib/dev-test-account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClassroomsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await syncProfileRoleFromAuth();

  const { data: profile, error: profileError } = await supabase.from("profiles").select("role, full_name, school_name").eq("id", user.id).single();
  const showDevClassroomId = isDevTestUser(profile?.school_name as string | null | undefined, user.email);

  const hasProfile = Boolean(profile) && !profileError;
  /** Map DB role to UI; non-teacher values (including null) → student so join/create is never a blank page. */
  const role: "teacher" | "student" | null = !hasProfile ? null : profile!.role === "teacher" ? "teacher" : "student";

  const teacherRooms =
    role === "teacher"
      ? (
          await supabase
            .from("classroom_teachers")
            .select("classrooms(id, name, join_code, created_at)")
            .eq("teacher_id", user.id)
            .order("created_at", { ascending: false, referencedTable: "classrooms" })
        ).data
      : null;

  const studentRows =
    role === "student"
      ? (
          await supabase
            .from("classroom_members")
            .select("joined_at, classrooms ( id, name, join_code, created_at )")
            .eq("user_id", user.id)
        ).data
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Classrooms</h1>
          <p className="text-muted-foreground">
            {role === "teacher"
              ? "Manage join codes and open the teacher dashboard."
              : role === "student"
                ? "Join with a code, then create your own engineering notebook for each class."
                : "Sign in again if your profile didn’t load."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {role === "teacher" && (
            <Button asChild>
              <Link href="/classrooms/new">New classroom</Link>
            </Button>
          )}
          {role === "student" && (
            <Button variant="outline" asChild>
              <Link href="/classrooms/join">Join with code</Link>
            </Button>
          )}
          {role === null && (
            <Button variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>

      {!hasProfile ? (
        <Card>
          <CardHeader>
            <CardTitle>Profile not found</CardTitle>
            <CardDescription>Try signing out and signing in again. If this keeps happening, your account may need a profile row in Supabase.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/login">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {role === "teacher" && (
        <div className="space-y-3">
          {(teacherRooms ?? []).length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No classrooms yet</CardTitle>
                <CardDescription>Create one to get a 6-digit join code for your students.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            teacherRooms!.map((row) => {
              const raw = row.classrooms as { id: string; name: string; join_code: string; created_at: string } | { id: string; name: string; join_code: string; created_at: string }[] | null;
              const c = Array.isArray(raw) ? raw[0] : raw;
              if (!c) return null;
              return (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg">{c.name}</CardTitle>
                  <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm tracking-widest">{c.join_code}</span>
                </CardHeader>
                {showDevClassroomId && (
                  <CardContent className="pt-0">
                    <DevClassroomId id={c.id} />
                  </CardContent>
                )}
                <CardContent className="flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link href={`/classrooms/${c.id}`}>Open</Link>
                  </Button>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/teacher/classrooms/${c.id}`}>Teacher dashboard</Link>
                  </Button>
                </CardContent>
              </Card>
            );
            })
          )}
        </div>
      )}

      {role === "student" && (
        <div className="space-y-3">
          {(studentRows ?? []).length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Not in a class yet</CardTitle>
                <CardDescription>Use the join code from your teacher to enter a classroom.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/classrooms/join">Join with code</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            studentRows!.map((row) => {
              const raw = row.classrooms as { id: string; name: string; join_code: string; created_at: string } | { id: string; name: string; join_code: string; created_at: string }[] | null;
              const c = Array.isArray(raw) ? raw[0] : raw;
              if (!c) return null;
              return (
                <Card key={c.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{c.name}</CardTitle>
                    <CardDescription>Joined {new Date(row.joined_at).toLocaleDateString()}</CardDescription>
                    {showDevClassroomId && <DevClassroomId id={c.id} />}
                  </CardHeader>
                  <CardContent>
                    <Button asChild>
                      <Link href={`/classrooms/${c.id}`}>Open classroom</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
