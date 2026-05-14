import Link from "next/link";
import { redirect } from "next/navigation";

import { syncProfileRoleFromAuth } from "@/actions/profile";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await syncProfileRoleFromAuth();

  const { data: profile, error: profileError } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();

  const hasProfile = Boolean(profile) && !profileError;
  const role: "teacher" | "student" | null = !hasProfile ? null : profile!.role === "teacher" ? "teacher" : "student";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>
            {role === "teacher"
              ? "Create a classroom and share the 6-digit join code with your students."
              : role === "student"
                ? "Join a classroom with your teacher’s code, then create or open your notebook."
                : "We couldn’t load your profile. Open Classrooms after signing in again, or use Sign in below."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/classrooms">{role === "teacher" ? "My classrooms" : "Classrooms"}</Link>
          </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}
