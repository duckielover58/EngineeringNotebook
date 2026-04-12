import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CreateClassroomForm } from "@/components/classrooms/create-classroom-form";
import { Button } from "@/components/ui/button";

export default async function NewClassroomPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "teacher") redirect("/classrooms");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">New classroom</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/classrooms">Back</Link>
        </Button>
      </div>
      <CreateClassroomForm />
    </div>
  );
}
