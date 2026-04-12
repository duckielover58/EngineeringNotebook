import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClassroomsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();

  const teacherRooms =
    profile?.role === "teacher"
      ? (
          await supabase.from("classrooms").select("id, name, join_code, created_at").eq("teacher_id", user.id).order("created_at", { ascending: false })
        ).data
      : null;

  const studentRows =
    profile?.role === "student"
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
            {profile?.role === "teacher" ? "Manage join codes and open the teacher dashboard." : "Join with a code, then start a notebook for your team."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile?.role === "teacher" && (
            <Button asChild>
              <Link href="/classrooms/new">New classroom</Link>
            </Button>
          )}
          {profile?.role === "student" && (
            <Button variant="outline" asChild>
              <Link href="/classrooms/join">Join with code</Link>
            </Button>
          )}
        </div>
      </div>

      {profile?.role === "teacher" && (
        <div className="space-y-3">
          {(teacherRooms ?? []).length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No classrooms yet</CardTitle>
                <CardDescription>Create one to get a 6-digit join code for your students.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            teacherRooms!.map((c) => (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg">{c.name}</CardTitle>
                  <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm tracking-widest">{c.join_code}</span>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link href={`/classrooms/${c.id}`}>Open</Link>
                  </Button>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/teacher/classrooms/${c.id}`}>Teacher dashboard</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {profile?.role === "student" && (
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
