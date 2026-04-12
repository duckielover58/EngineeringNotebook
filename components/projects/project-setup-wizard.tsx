"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  activateProject,
  updateFinalSketches,
  updateProjectGantt,
  updateProjectMatrix,
  updateProjectSketches,
} from "@/actions/projects";
import { createClient } from "@/lib/supabase/client";
import { uploadProjectFile } from "@/lib/storage-upload";
import { optionTotals, winningOptionIndex } from "@/lib/matrix";
import type { GanttData, GanttTask, ProjectStatus } from "@/types/database";
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
  initial_sketch_urls: string[] | null;
  matrix_criteria: string[] | null;
  matrix_options: string[] | null;
  matrix_ratings: number[][] | null;
  gantt_data: GanttData | null;
  final_sketch_urls: string[] | null;
};

function emptyCriteria(): string[] {
  return ["", "", "", "", ""];
}

function defaultMatrixRows(optionCount: number): number[][] {
  return Array.from({ length: optionCount }, () => [3, 3, 3, 3, 3]);
}

export function ProjectSetupWizard({ project }: { project: ProjectRow }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [sketchFiles, setSketchFiles] = useState<File[]>([]);
  const [sketchUrls, setSketchUrls] = useState<string[]>(project.initial_sketch_urls ?? []);

  const initialOptions = project.matrix_options?.length ? project.matrix_options : ["Option A", "Option B", "Option C"];
  const initialCriteria = project.matrix_criteria?.length === 5 ? project.matrix_criteria : emptyCriteria();
  const initialRatings =
    project.matrix_ratings && project.matrix_ratings.length === initialOptions.length
      ? project.matrix_ratings
      : defaultMatrixRows(initialOptions.length);

  const [criteria, setCriteria] = useState<string[]>(initialCriteria);
  const [options, setOptions] = useState<string[]>(initialOptions);
  const [ratings, setRatings] = useState<number[][]>(initialRatings);

  const [tasks, setTasks] = useState<GanttTask[]>(
    project.gantt_data?.tasks?.length
      ? project.gantt_data.tasks
      : [
          { id: crypto.randomUUID(), name: "Design", startWeek: 0, durationWeeks: 2 },
          { id: crypto.randomUUID(), name: "Build", startWeek: 2, durationWeeks: 3 },
          { id: crypto.randomUUID(), name: "Test", startWeek: 5, durationWeeks: 1 },
        ]
  );

  const [finalFiles, setFinalFiles] = useState<File[]>([]);
  const [finalUrls, setFinalUrls] = useState<string[]>(project.final_sketch_urls ?? []);

  const totals = useMemo(() => optionTotals(ratings), [ratings]);
  const winnerIdx = useMemo(() => winningOptionIndex(totals), [totals]);

  function setRating(row: number, col: number, value: number) {
    setRatings((prev) => {
      const next = prev.map((r) => [...r]);
      if (!next[row]) next[row] = [3, 3, 3, 3, 3];
      next[row][col] = value;
      return next;
    });
  }

  function addOption() {
    setOptions((o) => [...o, `Option ${o.length + 1}`]);
    setRatings((r) => [...r, [3, 3, 3, 3, 3]]);
  }

  function removeOption(idx: number) {
    if (options.length <= 1) return;
    setOptions((o) => o.filter((_, i) => i !== idx));
    setRatings((r) => r.filter((_, i) => i !== idx));
  }

  async function saveSketches() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const uploaded: string[] = [...sketchUrls];
      for (const f of sketchFiles) {
        uploaded.push(await uploadProjectFile(supabase, "sketches", project.id, f));
      }
      const res = await updateProjectSketches(project.id, uploaded);
      if ("error" in res && res.error) {
        setError(res.error);
        setPending(false);
        return;
      }
      setSketchUrls(uploaded);
      setSketchFiles([]);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
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
    setStep(2);
  }

  async function saveGantt() {
    setError(null);
    setPending(true);
    const gantt_data: GanttData = { tasks };
    const res = await updateProjectGantt(project.id, gantt_data);
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setStep(3);
  }

  async function saveFinalAndFinish() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const uploaded: string[] = [...finalUrls];
      for (const f of finalFiles) {
        uploaded.push(await uploadProjectFile(supabase, "sketches", project.id, f));
      }
      const up = await updateFinalSketches(project.id, uploaded);
      if ("error" in up && up.error) {
        setError(up.error);
        setPending(false);
        return;
      }
      setFinalUrls(uploaded);
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Project setup</h1>
        <p className="text-muted-foreground">{project.title}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <span className={step === 0 ? "font-medium text-foreground" : ""}>1 · Sketches</span>
        <span>→</span>
        <span className={step === 1 ? "font-medium text-foreground" : ""}>2 · Matrix</span>
        <span>→</span>
        <span className={step === 2 ? "font-medium text-foreground" : ""}>3 · Gantt</span>
        <span>→</span>
        <span className={step === 3 ? "font-medium text-foreground" : ""}>4 · Final comparison</span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Initial sketches</CardTitle>
            <CardDescription>Upload photos of early concepts. You can add more files later from the notebook.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="file" accept="image/*" multiple capture="environment" onChange={(e) => setSketchFiles(Array.from(e.target.files ?? []))} />
            {sketchUrls.length > 0 && (
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {sketchUrls.map((u) => (
                  <li key={u} className="truncate">
                    {u}
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={saveSketches} disabled={pending}>
              {pending ? "Saving…" : "Continue"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Decision matrix</CardTitle>
            <CardDescription>Five categories rate each design option. 1 is best, 5 is worst. Lowest total wins.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 overflow-x-auto">
            <div className="grid gap-2 md:grid-cols-5">
              {criteria.map((c, i) => (
                <div key={i} className="space-y-1">
                  <Label>Category {i + 1}</Label>
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
                          onChange={(e) => setRating(row, col, Number(e.target.value))}
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
                Current winner: <span className="font-medium text-foreground">{options[winnerIdx] || `Option ${winnerIdx + 1}`}</span> (total{" "}
                {totals[winnerIdx]})
              </p>
            )}
            <Button onClick={saveMatrix} disabled={pending}>
              {pending ? "Saving…" : "Continue"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Gantt chart</CardTitle>
            <CardDescription>Week index starts at 0. Adjust task names and durations for your build season.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Start week</TableHead>
                  <TableHead>Duration (weeks)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t, idx) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Input
                        value={t.name}
                        onChange={(e) =>
                          setTasks((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={t.startWeek}
                        onChange={(e) =>
                          setTasks((prev) => prev.map((x, i) => (i === idx ? { ...x, startWeek: Number(e.target.value) } : x)))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={t.durationWeeks}
                        onChange={(e) =>
                          setTasks((prev) => prev.map((x, i) => (i === idx ? { ...x, durationWeeks: Number(e.target.value) } : x)))
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTasks((prev) => [...prev, { id: crypto.randomUUID(), name: "New task", startWeek: 0, durationWeeks: 1 }])}
            >
              Add task
            </Button>
            <div>
              <Button onClick={saveGantt} disabled={pending}>
                {pending ? "Saving…" : "Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Final design comparison</CardTitle>
            <CardDescription>Upload comparison photos of your final concept before activating the notebook.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="file" accept="image/*" multiple capture="environment" onChange={(e) => setFinalFiles(Array.from(e.target.files ?? []))} />
            {finalUrls.length > 0 && (
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {finalUrls.map((u) => (
                  <li key={u} className="truncate">
                    {u}
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={saveFinalAndFinish} disabled={pending}>
              {pending ? "Finishing…" : "Finish setup"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
