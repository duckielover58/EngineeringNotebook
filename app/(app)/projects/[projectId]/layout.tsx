import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ProjectSubnav } from "@/components/projects/project-subnav";
import { Button } from "@/components/ui/button";

type Props = { children: React.ReactNode; params: Promise<{ projectId: string }> };

export default async function ProjectLayout({ children, params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, title, status, classroom_id, team_photo_url, classrooms(name)")
    .eq("id", projectId)
    .single();

  if (error || !project) notFound();

  const rawClass = project.classrooms as { name: string } | { name: string }[] | null;
  const classroom = Array.isArray(rawClass) ? rawClass[0] : rawClass;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{classroom?.name ?? "Classroom"}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/classrooms/${project.classroom_id}`}>Back to class</Link>
        </Button>
      </div>
      <ProjectSubnav projectId={projectId} status={project.status} />
      {children}
    </div>
  );
}
