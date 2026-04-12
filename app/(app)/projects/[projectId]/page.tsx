import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { optionTotals, winningOptionIndex } from "@/lib/matrix";
import { TeacherCommentsPanel } from "@/components/teacher/teacher-comments-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GanttData } from "@/types/database";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectOverviewPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, title, status, team_photo_url, initial_sketch_urls, matrix_criteria, matrix_options, matrix_ratings, gantt_data, technical_latex, final_sketch_urls, classroom_id, classrooms(teacher_id)"
    )
    .eq("id", projectId)
    .single();

  if (error || !project) notFound();
  if (project.status === "setup") redirect(`/projects/${projectId}/setup`);

  const rawClass = project.classrooms as { teacher_id: string } | { teacher_id: string }[] | null;
  const classroom = Array.isArray(rawClass) ? rawClass[0] : rawClass;
  const isClassTeacher = profile?.role === "teacher" && classroom?.teacher_id === user.id;

  const matrix = (project.matrix_ratings as number[][] | null) ?? [];
  const options: string[] = (project.matrix_options as string[] | null) ?? [];
  const totals = matrix.length && options.length ? optionTotals(matrix) : [];
  const winnerIdx = totals.length ? winningOptionIndex(totals) : -1;

  const gantt = project.gantt_data as GanttData | null;

  const { data: comments } = await supabase
    .from("project_comments")
    .select("id, body, created_at, teacher_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">Status: {project.status}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Title page</CardTitle>
            <CardDescription>Team identity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.team_photo_url ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                <Image src={project.team_photo_url} alt="Team" fill className="object-cover" sizes="(max-width:768px) 100vw, 50vw" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No team photo uploaded.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Decision matrix</CardTitle>
            <CardDescription>1 = best, 5 = worst · lowest total wins</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {options.length === 0 ? (
              <p className="text-muted-foreground">Matrix not filled in.</p>
            ) : (
              <>
                <p>
                  Leading option:{" "}
                  <span className="font-medium">
                    {winnerIdx >= 0 ? options[winnerIdx] : "—"} {winnerIdx >= 0 && `(total ${totals[winnerIdx]})`}
                  </span>
                </p>
                <ul className="list-inside list-disc text-muted-foreground">
                  {options.map((o: string, i: number) => (
                    <li key={o}>
                      {o}: total {totals[i] ?? "—"}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gantt snapshot</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {!gantt?.tasks?.length ? (
            <p>No tasks recorded.</p>
          ) : (
            <ul className="space-y-1">
              {gantt.tasks.map((t) => (
                <li key={t.id}>
                  <span className="font-medium text-foreground">{t.name}</span> — start week {t.startWeek}, duration {t.durationWeeks} wk
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Initial sketches</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {(project.initial_sketch_urls ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No sketches on file.</p>
          ) : (
            ((project.initial_sketch_urls as string[] | null) ?? []).map((url: string) => (
              <div key={url} className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                <Image src={url} alt="Sketch" fill className="object-cover" sizes="200px" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {(isClassTeacher || (comments?.length ?? 0) > 0) && (
        <TeacherCommentsPanel projectId={projectId} isTeacher={!!isClassTeacher} initialComments={comments ?? []} />
      )}
    </div>
  );
}
