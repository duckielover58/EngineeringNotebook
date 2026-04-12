import Link from "next/link";
import { redirect } from "next/navigation";

import { syncProfileRoleFromAuth } from "@/actions/profile";
import { createClient } from "@/lib/supabase/server";
import { JoinClassroomForm } from "@/components/classrooms/join-classroom-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function JoinClassroomPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await syncProfileRoleFromAuth();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role === "teacher") {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Join classroom</h1>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/classrooms">Back</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Teachers don’t use join codes</CardTitle>
            <CardDescription>
              Join codes are for students entering your class. Create a classroom to get a code you can share with your teams.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/classrooms/new">New classroom</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/classrooms">All classrooms</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (profile?.role !== "student") redirect("/classrooms");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Join classroom</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/classrooms">Back</Link>
        </Button>
      </div>
      <JoinClassroomForm />
    </div>
  );
}
