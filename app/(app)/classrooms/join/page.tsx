import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { JoinClassroomForm } from "@/components/classrooms/join-classroom-form";
import { Button } from "@/components/ui/button";

export default async function JoinClassroomPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
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
