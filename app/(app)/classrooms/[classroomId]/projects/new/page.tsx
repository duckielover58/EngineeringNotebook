import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ classroomId: string }> };

export default async function NewProjectPage({ params }: Props) {
  const { classroomId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: room, error } = await supabase.from("classrooms").select("id, name").eq("id", classroomId).single();
  if (error || !room) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New notebook</h1>
          <p className="text-sm text-muted-foreground">{room.name}</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/classrooms/${classroomId}`}>Back</Link>
        </Button>
      </div>
      <NewProjectForm classroomId={classroomId} />
    </div>
  );
}
