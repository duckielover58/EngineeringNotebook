import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { optionTotals, sortOptionIndexesByTotal, winningOptionIndex } from "@/lib/matrix";
import { BrainstormingSketchesSection } from "@/components/projects/brainstorming-sketches-section";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { DesignBriefCard } from "@/components/projects/design-brief-card";
import { GanttChartEditor } from "@/components/projects/gantt-chart-editor";
import { GanttGridFromData } from "@/components/projects/gantt-grid";
import { isDevTestUser } from "@/lib/dev-test-account";
import { InitialDesignSketchSection } from "@/components/projects/initial-design-sketch-section";
import { TitlePageCard } from "@/components/projects/title-page-card";
import { TeacherCommentsPanel } from "@/components/teacher/teacher-comments-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  ConclusionAnswer,
  ConclusionQuestion,
  DesignBrief,
  GanttData,
  ProjectSketch,
} from "@/types/database";

function formatStamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectOverviewPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, school_name").eq("id", user.id).single();

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, title, status, team_photo_url, problem_title, school_name, course_title, start_date, end_date, design_problem, title_page_updated_at, design_brief, design_brief_updated_at, matrix_criteria, matrix_options, matrix_ratings, matrix_updated_at, gantt_data, gantt_updated_at, classroom_id, created_by, classrooms(teacher_id)"
    )
    .eq("id", projectId)
    .single();

  if (error || !project) notFound();

  if (project.status === "setup") {
    if (profile?.role === "student") {
      redirect(`/projects/${projectId}/setup`);
    }
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Badge variant="secondary">Status: setup</Badge>
        <Card>
          <CardHeader>
            <CardTitle>Notebook setup in progress</CardTitle>
            <CardDescription>
              The student is still completing setup. This page will show the full notebook after they activate it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/classrooms/${project.classroom_id}`}>Back to classroom</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: teacherMembership } = await supabase
    .from("classroom_teachers")
    .select("teacher_id")
    .eq("classroom_id", project.classroom_id)
    .eq("teacher_id", user.id)
    .maybeSingle();
  const isClassTeacher = profile?.role === "teacher" && !!teacherMembership;
  const { data: memberRow } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  const isProjectMember = profile?.role === "student" && !!memberRow;
  const canEditGanttAfterSetup =
    isProjectMember && isDevTestUser(profile?.school_name as string | null | undefined, user.email);

  const matrix = (project.matrix_ratings as number[][] | null) ?? [];
  const options: string[] = (project.matrix_options as string[] | null) ?? [];
  const criteria: string[] = (project.matrix_criteria as string[] | null) ?? [];
  const totals = matrix.length && options.length ? optionTotals(matrix) : [];
  const winnerIdx = totals.length ? winningOptionIndex(totals) : -1;
  const rankedIndexes = sortOptionIndexesByTotal(totals);

  const gantt = project.gantt_data as GanttData | null;
  const matrixUpdatedAt = project.matrix_updated_at as string | null;
  const ganttUpdatedAt = project.gantt_updated_at as string | null;

  const { data: sketchRows } = await supabase
    .from("project_sketches")
    .select("id, project_id, kind, url, member_label, uploaded_by, position, created_at, updated_at")
    .eq("project_id", projectId)
    .in("kind", ["brainstorming", "initial_design"])
    .order("position", { ascending: true });
  const allSketches = (sketchRows as ProjectSketch[] | null) ?? [];
  const brainstormSketches = allSketches.filter((s) => s.kind === "brainstorming");
  const initialDesignSketches = allSketches.filter((s) => s.kind === "initial_design");

  const { data: conclusionQuestions } = project.classroom_id
    ? await supabase
        .from("classroom_conclusion_questions")
        .select("id, classroom_id, prompt, position, created_at, updated_at")
        .eq("classroom_id", project.classroom_id)
        .order("position", { ascending: true })
    : { data: [] as ConclusionQuestion[] };
  const { data: conclusionAnswers } = await supabase
    .from("project_conclusion_answers")
    .select("id, project_id, question_id, body, answered_by, created_at, updated_at")
    .eq("project_id", projectId);
  const answersByQuestion: Record<string, ConclusionAnswer> = Object.fromEntries(
    ((conclusionAnswers as ConclusionAnswer[] | null) ?? []).map((a) => [a.question_id, a]),
  );

  const { data: comments } = await supabase
    .from("project_comments")
    .select("id, body, created_at, teacher_id")
    .eq("project_id", projectId)
    .eq("anchor_section", "overview")
    .order("created_at", { ascending: false });

  const teacherIds = Array.from(new Set((comments ?? []).map((c) => c.teacher_id).filter(Boolean)));
  const { data: teacherProfiles } = teacherIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", teacherIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const teacherNamesById: Record<string, string> = Object.fromEntries(
    (teacherProfiles ?? []).map((p) => [p.id, (p.full_name ?? "").trim() || "Teacher"]),
  );

  const isCreator = !!project.created_by && project.created_by === user.id;

  const { data: memberRows } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  const memberIds = (memberRows ?? []).map((r) => r.user_id as string);
  const { data: memberProfiles } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const teamMembers = (memberProfiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name ?? null }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="secondary">Status: {project.status}</Badge>
        {isCreator && (
          <DeleteProjectButton
            projectId={projectId}
            projectTitle={project.title}
            classroomId={project.classroom_id ?? null}
          />
        )}
      </div>

      <TitlePageCard
        projectId={projectId}
        teamMembers={teamMembers}
        canEdit={isProjectMember}
        initial={{
          problem_title: (project.problem_title as string | null) ?? null,
          school_name: (project.school_name as string | null) ?? null,
          course_title: (project.course_title as string | null) ?? null,
          start_date: (project.start_date as string | null) ?? null,
          end_date: (project.end_date as string | null) ?? null,
          design_problem: (project.design_problem as string | null) ?? null,
          team_photo_url: (project.team_photo_url as string | null) ?? null,
          title_page_updated_at: (project.title_page_updated_at as string | null) ?? null,
        }}
      />

      <DesignBriefCard
        projectId={projectId}
        canEdit={isProjectMember}
        designProblem={(project.design_problem as string | null) ?? null}
        initial={(project.design_brief as DesignBrief | null) ?? null}
        initialUpdatedAt={(project.design_brief_updated_at as string | null) ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle>Decision matrix summary</CardTitle>
          <CardDescription>Highest total leads</CardDescription>
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
                {rankedIndexes.map((i) => (
                  <li key={options[i] ?? i}>
                    {options[i]}: total {totals[i] ?? "—"}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <BrainstormingSketchesSection
        projectId={projectId}
        initialSketches={brainstormSketches}
        canEdit={isProjectMember}
      />

      <Card>
        <CardHeader>
          <CardTitle>Decision matrix</CardTitle>
          <CardDescription>
            Each option scored against your criteria.
            {matrixUpdatedAt && <> · Last updated {formatStamp(matrixUpdatedAt)}</>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {options.length === 0 || criteria.length === 0 ? (
            <p className="text-sm text-muted-foreground">Matrix not filled in.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Option</TableHead>
                    {criteria.map((c, i) => (
                      <TableHead key={i} className="min-w-[4.5rem] text-center">
                        {c || `C${i + 1}`}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {options.map((opt, row) => (
                    <TableRow key={row} className={row === winnerIdx ? "bg-muted/60" : undefined}>
                      <TableCell className="font-medium">{opt || `Option ${row + 1}`}</TableCell>
                      {criteria.map((_, col) => (
                        <TableCell key={col} className="text-center">
                          {matrix[row]?.[col] ?? "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-mono">
                        {totals[row] ?? "—"}
                        {row === winnerIdx && <span className="ml-2 text-xs text-muted-foreground">leader</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InitialDesignSketchSection projectId={projectId} initialSketches={initialDesignSketches} canEdit={isProjectMember} />

      <Card>
        <CardHeader>
          <CardTitle>Gantt chart</CardTitle>
          <CardDescription>
            {canEditGanttAfterSetup
              ? "Dev test account: you can edit the schedule after setup."
              : gantt?.startDate
                ? `Starts ${gantt.startDate} · view: ${gantt?.viewMode ?? "weeks"}`
                : "No start date set"}
            {ganttUpdatedAt && <> · Last updated {formatStamp(ganttUpdatedAt)}</>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canEditGanttAfterSetup ? (
            <GanttChartEditor projectId={projectId} initialGantt={gantt} saveLabel="Save Gantt chart" />
          ) : !gantt?.tasks?.length ? (
            <p className="text-sm text-muted-foreground">No tasks recorded.</p>
          ) : (
            <GanttGridFromData data={gantt} />
          )}
        </CardContent>
      </Card>

      {(conclusionQuestions ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Conclusion</CardTitle>
            <CardDescription>
              Final reflections for this notebook.{" "}
              <Link href={`/projects/${projectId}/conclusion`} className="underline-offset-2 hover:underline">
                Open conclusion
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {(conclusionQuestions as ConclusionQuestion[]).map((q, idx) => {
                const answer = answersByQuestion[q.id];
                const snippet = (answer?.body ?? "").trim();
                const truncated = snippet.length > 240 ? `${snippet.slice(0, 240)}…` : snippet;
                return (
                  <li key={q.id} className="space-y-1 rounded-md border bg-muted/30 p-3">
                    <p className="font-medium">
                      <span className="text-muted-foreground">{idx + 1}.</span> {q.prompt}
                    </p>
                    {snippet ? (
                      <p className="whitespace-pre-wrap text-muted-foreground">{truncated}</p>
                    ) : (
                      <p className="italic text-muted-foreground">No answer yet.</p>
                    )}
                    {answer?.updated_at && (
                      <p className="text-xs text-muted-foreground">
                        Last updated {formatStamp(answer.updated_at)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {(isClassTeacher || (comments?.length ?? 0) > 0) && (
        <TeacherCommentsPanel
          projectId={projectId}
          isTeacher={!!isClassTeacher}
          initialComments={comments ?? []}
          teacherNamesById={teacherNamesById}
        />
      )}
    </div>
  );
}
