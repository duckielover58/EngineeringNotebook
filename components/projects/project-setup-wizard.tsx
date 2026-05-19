"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  activateProject,
  addProjectSketch,
  removeProjectSketch,
  updateProjectMatrix,
  updateProjectSketchLabel,
} from "@/actions/projects";
import { createClient } from "@/lib/supabase/client";
import { uploadProjectFile } from "@/lib/storage-upload";
import { formatStamp } from "@/lib/format-stamp";
import { optionTotals, winningOptionIndex } from "@/lib/matrix";
import type { DesignBrief, GanttData, ProjectSketch, ProjectStatus } from "@/types/database";
import { GanttChartEditor } from "@/components/projects/gantt-chart-editor";
import {
  TitlePageForm,
  type TeamMember,
  type TitlePageData,
} from "@/components/projects/title-page-card";
import { DesignBriefForm, normalizeBrief } from "@/components/projects/design-brief-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ProjectRow = {
  id: string;
  title: string;
  status: ProjectStatus;
  problem_title: string | null;
  school_name: string | null;
  course_title: string | null;
  start_date: string | null;
  end_date: string | null;
  design_problem: string | null;
  team_photo_url: string | null;
  title_page_updated_at: string | null;
  design_brief: DesignBrief | null;
  design_brief_updated_at: string | null;
  matrix_criteria: string[] | null;
  matrix_options: string[] | null;
  matrix_ratings: number[][] | null;
  gantt_data: GanttData | null;
};

function emptyCriteria(): string[] {
  return ["", "", "", ""];
}

function defaultMatrixRows(optionCount: number, criteriaCount: number): number[][] {
  return Array.from({ length: optionCount }, () => Array.from({ length: criteriaCount }, () => 3));
}

export function ProjectSetupWizard({
  project,
  brainstormingSketches: initialBrainstormingSketches,
  finalSketches: initialFinalSketches,
  teamMembers,
}: {
  project: ProjectRow;
  brainstormingSketches: ProjectSketch[];
  finalSketches: ProjectSketch[];
  teamMembers: TeamMember[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [notebookTitle, setNotebookTitle] = useState(project.title);

  const [titlePage, setTitlePage] = useState<TitlePageData>({
    problem_title: project.problem_title,
    school_name: project.school_name,
    course_title: project.course_title,
    start_date: project.start_date,
    end_date: project.end_date,
    design_problem: project.design_problem,
    team_photo_url: project.team_photo_url,
    title_page_updated_at: project.title_page_updated_at,
  });
  const [designBrief, setDesignBrief] = useState<DesignBrief>(
    normalizeBrief(project.design_brief),
  );
  const [designBriefSavedAt, setDesignBriefSavedAt] = useState<string | null>(
    project.design_brief_updated_at,
  );

  const [sketchFiles, setSketchFiles] = useState<File[]>([]);
  const [brainstormingSketches, setBrainstormingSketches] = useState<ProjectSketch[]>(initialBrainstormingSketches);
  // Local label edits not yet persisted (keyed by sketch id).
  const [pendingLabels, setPendingLabels] = useState<Record<string, string>>({});

  const initialOptions = project.matrix_options?.length ? project.matrix_options : ["Option A", "Option B", "Option C"];
  const initialCriteria = project.matrix_criteria?.length ? project.matrix_criteria : emptyCriteria();
  const initialRatings =
    project.matrix_ratings && project.matrix_ratings.length === initialOptions.length
      ? project.matrix_ratings.map((row) =>
          Array.from({ length: initialCriteria.length }, (_, idx) => {
            const value = row?.[idx];
            return Number.isInteger(value) ? Math.max(1, Math.min(5, value)) : 3;
          }),
        )
      : defaultMatrixRows(initialOptions.length, initialCriteria.length);

  const [criteria, setCriteria] = useState<string[]>(initialCriteria);
  const [options, setOptions] = useState<string[]>(initialOptions);
  const [ratings, setRatings] = useState<number[][]>(initialRatings);

  const [finalFiles, setFinalFiles] = useState<File[]>([]);
  const [finalSketches, setFinalSketches] = useState<ProjectSketch[]>(initialFinalSketches);

  const totals = useMemo(() => optionTotals(ratings), [ratings]);
  const winnerIdx = useMemo(() => winningOptionIndex(totals), [totals]);

  function setRating(row: number, col: number, value: number) {
    const clamped = Math.min(5, Math.max(1, Math.round(value)));
    setRatings((prev) => {
      const next = prev.map((r) => [...r]);
      if (!next[row]) next[row] = Array.from({ length: criteria.length }, () => 3);
      next[row][col] = clamped;
      return next;
    });
  }

  function addOption() {
    setOptions((o) => [...o, `Option ${o.length + 1}`]);
    setRatings((r) => [...r, Array.from({ length: criteria.length }, () => 3)]);
  }

  function removeOption(idx: number) {
    if (options.length <= 1) return;
    setOptions((o) => o.filter((_, i) => i !== idx));
    setRatings((r) => r.filter((_, i) => i !== idx));
  }

  function addCriterion() {
    setCriteria((prev) => [...prev, ""]);
    setRatings((prev) => prev.map((row) => [...row, 3]));
  }

  function removeCriterion(idx: number) {
    if (criteria.length <= 1) return;
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
    setRatings((prev) => prev.map((row) => row.filter((_, i) => i !== idx)));
  }

  async function saveSketches() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const inserted: ProjectSketch[] = [];
      for (const f of sketchFiles) {
        const url = await uploadProjectFile(supabase, "sketches", project.id, f);
        const res = await addProjectSketch(project.id, "brainstorming", url);
        if ("error" in res && res.error) {
          setError(res.error);
          if (inserted.length > 0) setBrainstormingSketches((prev) => [...prev, ...inserted]);
          setPending(false);
          return;
        }
        if ("sketch" in res && res.sketch) {
          inserted.push(res.sketch as ProjectSketch);
        }
      }

      // Persist any label edits the user typed.
      for (const [id, label] of Object.entries(pendingLabels)) {
        const original = [...brainstormingSketches, ...inserted].find((s) => s.id === id);
        if (original && (original.member_label ?? "") !== label.trim()) {
          const res = await updateProjectSketchLabel(id, label);
          if ("error" in res && res.error) {
            setError(res.error);
            setPending(false);
            return;
          }
        }
      }

      const merged = [...brainstormingSketches.map((s) => ({
        ...s,
        member_label: pendingLabels[s.id] !== undefined ? pendingLabels[s.id].trim() || null : s.member_label,
      })), ...inserted];
      setBrainstormingSketches(merged);
      setPendingLabels({});
      setSketchFiles([]);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
    setPending(false);
  }

  function setBrainstormingLabel(id: string, value: string) {
    setPendingLabels((prev) => ({ ...prev, [id]: value }));
  }

  async function removeBrainstormingSketch(id: string) {
    setError(null);
    setPending(true);
    const res = await removeProjectSketch(id);
    if ("error" in res && res.error) {
      setError(res.error);
    } else {
      setBrainstormingSketches((prev) => prev.filter((s) => s.id !== id));
      setPendingLabels((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setPending(false);
  }

  async function saveMatrix() {
    setError(null);
    setPending(true);
    const res = await updateProjectMatrix(project.id, {
      matrix_criteria: criteria,
      matrix_options: options,
      matrix_ratings: ratings,
    });
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setStep(4);
  }

  async function saveFinalAndFinish() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const inserted: ProjectSketch[] = [];
      for (const f of finalFiles) {
        const url = await uploadProjectFile(supabase, "sketches", project.id, f);
        const res = await addProjectSketch(project.id, "final", url);
        if ("error" in res && res.error) {
          setError(res.error);
          if (inserted.length > 0) setFinalSketches((prev) => [...prev, ...inserted]);
          setPending(false);
          return;
        }
        if ("sketch" in res && res.sketch) {
          inserted.push(res.sketch as ProjectSketch);
        }
      }
      if (inserted.length > 0) {
        setFinalSketches((prev) => [...prev, ...inserted]);
      }
      setFinalFiles([]);
      const act = await activateProject(project.id);
      if ("error" in act && act.error) {
        setError(act.error);
        setPending(false);
        return;
      }
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
    setPending(false);
  }

  async function removeFinalSketch(id: string) {
    setError(null);
    setPending(true);
    const res = await removeProjectSketch(id);
    if ("error" in res && res.error) {
      setError(res.error);
    } else {
      setFinalSketches((prev) => prev.filter((s) => s.id !== id));
    }
    setPending(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Project setup</h1>
        <p className="text-muted-foreground">{notebookTitle}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <span className={step === 0 ? "font-medium text-foreground" : ""}>1 · Title page</span>
        <span>→</span>
        <span className={step === 1 ? "font-medium text-foreground" : ""}>2 · Design brief</span>
        <span>→</span>
        <span className={step === 2 ? "font-medium text-foreground" : ""}>3 · Brainstorming</span>
        <span>→</span>
        <span className={step === 3 ? "font-medium text-foreground" : ""}>4 · Matrix</span>
        <span>→</span>
        <span className={step === 4 ? "font-medium text-foreground" : ""}>5 · Gantt</span>
        <span>→</span>
        <span className={step === 5 ? "font-medium text-foreground" : ""}>6 · Final comparison</span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Title page</CardTitle>
            <CardDescription>
              Capture the problem title, school + course, dates, cover photo, and design problem. This notebook is yours; your name appears on the title from when you created it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TitlePageForm
              projectId={project.id}
              notebookTitle={notebookTitle}
              initial={titlePage}
              onSavedAction={(saved, savedNotebookTitle) => {
                setTitlePage(saved);
                if (savedNotebookTitle) setNotebookTitle(savedNotebookTitle);
              }}
              actionsSlot={({ save, pending: formPending }) => (
                <>
                  <Button
                    type="button"
                    onClick={async () => {
                      const ok = await save();
                      if (ok) setStep(1);
                    }}
                    disabled={formPending}
                  >
                    {formPending ? "Saving…" : "Continue"}
                  </Button>
                  {titlePage.title_page_updated_at && (
                    <p className="text-xs text-muted-foreground">Saved {formatStamp(titlePage.title_page_updated_at)}</p>
                  )}
                </>
              )}
            />
            {teamMembers.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                People on this notebook:{" "}
                {teamMembers.map((m) => (m.full_name ?? "").trim()).filter((n) => n.length > 0).join(", ") || "—"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Design brief</CardTitle>
            <CardDescription>
              Specify the brief. The &quot;Problem&quot; Or Need row mirrors the design problem from the title page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DesignBriefForm
              projectId={project.id}
              initial={designBrief}
              designProblem={titlePage.design_problem}
              onSavedAction={(saved, updatedAt) => {
                setDesignBrief(saved);
                setDesignBriefSavedAt(updatedAt);
              }}
              actionsSlot={({ save, pending: formPending }) => (
                <>
                  <Button
                    type="button"
                    onClick={async () => {
                      const ok = await save();
                      if (ok) setStep(2);
                    }}
                    disabled={formPending}
                  >
                    {formPending ? "Saving…" : "Continue"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setStep(0)} disabled={formPending}>
                    Back
                  </Button>
                  {designBriefSavedAt && (
                    <p className="text-xs text-muted-foreground">Saved {formatStamp(designBriefSavedAt)}</p>
                  )}
                </>
              )}
            />
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Brainstorming sketches</CardTitle>
            <CardDescription>Upload photos of early concepts and tag who drew each one. You can add more later from the notebook.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brainstorm-files">Add sketches</Label>
              <Input
                id="brainstorm-files"
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={(e) => setSketchFiles(Array.from(e.target.files ?? []))}
              />
            </div>
            {brainstormingSketches.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Saved sketches</p>
                <ul className="space-y-3">
                  {brainstormingSketches.map((s, idx) => {
                    const labelValue = pendingLabels[s.id] ?? s.member_label ?? "";
                    return (
                      <li key={s.id} className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center">
                        <div className="text-sm text-muted-foreground sm:w-24">Sketch {idx + 1}</div>
                        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            placeholder="Drawn by (e.g. Alice)"
                            value={labelValue}
                            onChange={(e) => setBrainstormingLabel(s.id, e.target.value)}
                            className="sm:max-w-xs"
                          />
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
                          >
                            {s.url.split("/").pop()}
                          </a>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Uploaded {formatStamp(s.created_at)}
                          </span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeBrainstormingSketch(s.id)} disabled={pending}>
                          Remove
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={saveSketches} disabled={pending}>
                {pending ? "Saving…" : "Continue"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={pending}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Decision matrix</CardTitle>
            <CardDescription>Rate each design option across your criteria. 1 is low and 5 is high. Highest total leads.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 overflow-x-auto">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addCriterion}>
                Add criterion
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              {criteria.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>Category {i + 1}</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => removeCriterion(i)} disabled={criteria.length <= 1}>
                      Delete
                    </Button>
                  </div>
                  <Input value={c} onChange={(e) => setCriteria((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Criterion ${i + 1}`} />
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addOption}>
                Add option
              </Button>
            </div>
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
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {options.map((opt, row) => (
                  <TableRow key={row}>
                    <TableCell>
                      <Input value={opt} onChange={(e) => setOptions((o) => o.map((v, j) => (j === row ? e.target.value : v)))} />
                    </TableCell>
                    {criteria.map((_, col) => (
                      <TableCell key={col} className="p-1">
                        <Input
                          className="text-center"
                          type="number"
                          min={1}
                          max={5}
                          value={ratings[row]?.[col] ?? 3}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (!isNaN(n)) setRating(row, col, n);
                          }}
                          onBlur={(e) => {
                            const n = parseInt(e.target.value, 10);
                            setRating(row, col, isNaN(n) ? 3 : n);
                          }}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono">{totals[row] ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(row)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {winnerIdx >= 0 && (
              <p className="text-sm text-muted-foreground">
                Leading option: <span className="font-medium text-foreground">{options[winnerIdx] || `Option ${winnerIdx + 1}`}</span> (total{" "}
                {totals[winnerIdx]})
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={saveMatrix} disabled={pending}>
                {pending ? "Saving…" : "Continue"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep(2)} disabled={pending}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Gantt chart</CardTitle>
            <CardDescription>Pick a project start date, then plan tasks. Click a cell to extend a task to that day or week.</CardDescription>
          </CardHeader>
          <CardContent>
            <GanttChartEditor
              projectId={project.id}
              initialGantt={project.gantt_data}
              saveLabel="Continue"
              showBack
              onBack={() => setStep(3)}
              onSaved={() => setStep(5)}
            />
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Final design comparison</CardTitle>
            <CardDescription>Upload comparison photos of your final concept before activating the notebook.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="file" accept="image/*" multiple capture="environment" onChange={(e) => setFinalFiles(Array.from(e.target.files ?? []))} />
            {finalSketches.length > 0 && (
              <ul className="space-y-2 text-sm">
                {finalSketches.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded border bg-muted/30 p-2">
                    <a href={s.url} target="_blank" rel="noreferrer" className="truncate underline-offset-2 hover:underline">
                      {s.url.split("/").pop()}
                    </a>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Uploaded {formatStamp(s.created_at)}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFinalSketch(s.id)} disabled={pending}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={saveFinalAndFinish} disabled={pending}>
                {pending ? "Finishing…" : "Finish setup"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep(4)} disabled={pending}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
