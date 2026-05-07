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
import { cn } from "@/lib/utils";
import type { GanttData, GanttMember, GanttTask, ProjectStatus } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PRESET_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#f97316",
  "#a855f7",
  "#eab308",
  "#ec4899",
  "#14b8a6",
];
const DAY_LABELS = ["M", "T", "W", "R", "F"];

function migrateGanttData(data: GanttData | null): { tasks: GanttTask[]; members: GanttMember[]; totalWeeks: number } {
  if (!data) return { tasks: defaultTasks(), members: [], totalWeeks: 3 };
  const members: GanttMember[] = data.members ?? [];
  const totalWeeks: number = data.totalWeeks ?? 3;
  const tasks: GanttTask[] = (data.tasks ?? []).map((t, i) => {
    if ("startDay" in t && typeof t.startDay === "number") return t as GanttTask;
    const legacy = t as unknown as { id: string; name: string; startWeek?: number; durationWeeks?: number };
    return {
      id: legacy.id ?? crypto.randomUUID(),
      name: legacy.name ?? "Task",
      startDay: (legacy.startWeek ?? 0) * 5,
      durationDays: (legacy.durationWeeks ?? 1) * 5,
      memberIds: [],
      color: PRESET_COLORS[i % PRESET_COLORS.length],
    };
  });
  return { tasks, members, totalWeeks };
}

function defaultTasks(): GanttTask[] {
  return [
    { id: crypto.randomUUID(), name: "Design", startDay: 0, durationDays: 5, memberIds: [], color: PRESET_COLORS[0] },
    { id: crypto.randomUUID(), name: "Build", startDay: 5, durationDays: 10, memberIds: [], color: PRESET_COLORS[1] },
    { id: crypto.randomUUID(), name: "Test", startDay: 15, durationDays: 5, memberIds: [], color: PRESET_COLORS[2] },
  ];
}

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

  const initialGantt = migrateGanttData(project.gantt_data);
  const [tasks, setTasks] = useState<GanttTask[]>(initialGantt.tasks);
  const [members, setMembers] = useState<GanttMember[]>(initialGantt.members);
  const [totalWeeks, setTotalWeeks] = useState(initialGantt.totalWeeks);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberColor, setNewMemberColor] = useState(PRESET_COLORS[0]);

  const [finalFiles, setFinalFiles] = useState<File[]>([]);
  const [finalUrls, setFinalUrls] = useState<string[]>(project.final_sketch_urls ?? []);

  const totals = useMemo(() => optionTotals(ratings), [ratings]);
  const winnerIdx = useMemo(() => winningOptionIndex(totals), [totals]);

  function setRating(row: number, col: number, value: number) {
    const clamped = Math.min(5, Math.max(1, Math.round(value)));
    setRatings((prev) => {
      const next = prev.map((r) => [...r]);
      if (!next[row]) next[row] = [3, 3, 3, 3, 3];
      next[row][col] = clamped;
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

  function addMember() {
    const name = newMemberName.trim();
    if (!name) return;
    setMembers((m) => [...m, { id: crypto.randomUUID(), name, color: newMemberColor }]);
    setNewMemberName("");
    setNewMemberColor(PRESET_COLORS[(members.length + 1) % PRESET_COLORS.length]);
  }

  function removeMember(id: string) {
    setMembers((m) => m.filter((x) => x.id !== id));
    setTasks((prev) => prev.map((t) => ({ ...t, memberIds: t.memberIds.filter((mid) => mid !== id) })));
  }

  function toggleTaskMember(taskIdx: number, memberId: string) {
    setTasks((prev) =>
      prev.map((t, i) =>
        i !== taskIdx
          ? t
          : { ...t, memberIds: t.memberIds.includes(memberId) ? t.memberIds.filter((id) => id !== memberId) : [...t.memberIds, memberId] },
      ),
    );
  }

  function setTaskField<K extends keyof GanttTask>(idx: number, key: K, value: GanttTask[K]) {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, [key]: value } : t)));
  }

  async function saveGantt() {
    setError(null);
    setPending(true);
    const gantt_data: GanttData = { tasks, members, totalWeeks };
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
            <CardDescription>Plan tasks by day. Add team members, assign colors, then mark each task's start and duration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* ── Team members ── */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Team members</p>
              {members.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <span
                      key={m.id}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                      style={{ backgroundColor: m.color + "22", border: `1.5px solid ${m.color}`, color: m.color }}
                    >
                      <span className="inline-block size-2 rounded-full" style={{ backgroundColor: m.color }} />
                      {m.name}
                      <button
                        type="button"
                        className="ml-1 opacity-60 hover:opacity-100"
                        onClick={() => removeMember(m.id)}
                        aria-label={`Remove ${m.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Member name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMember()}
                  className="w-40"
                />
                <div className="flex gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn("size-5 rounded-full border-2 transition-transform hover:scale-110", newMemberColor === c ? "border-foreground scale-110" : "border-transparent")}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewMemberColor(c)}
                      aria-label={c}
                    />
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addMember} disabled={!newMemberName.trim()}>
                  Add member
                </Button>
              </div>
            </div>

            <Separator />

            {/* ── Task editor table ── */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Tasks</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-2 font-normal">Task name</th>
                      <th className="pb-2 pr-2 font-normal">Color</th>
                      {members.length > 0 && <th className="pb-2 pr-2 font-normal">Members</th>}
                      <th className="pb-2 pr-2 font-normal w-20">Start day</th>
                      <th className="pb-2 pr-2 font-normal w-20">Days</th>
                      <th className="pb-2 font-normal" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tasks.map((t, idx) => (
                      <tr key={t.id}>
                        <td className="py-1.5 pr-2">
                          <Input value={t.name} onChange={(e) => setTaskField(idx, "name", e.target.value)} className="h-8" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <div className="flex gap-1">
                            {PRESET_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                className={cn("size-5 rounded-full border-2 transition-transform hover:scale-110", t.color === c ? "border-foreground scale-110" : "border-transparent")}
                                style={{ backgroundColor: c }}
                                onClick={() => setTaskField(idx, "color", c)}
                                aria-label={c}
                              />
                            ))}
                          </div>
                        </td>
                        {members.length > 0 && (
                          <td className="py-1.5 pr-2">
                            <div className="flex flex-wrap gap-1">
                              {members.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  className={cn("rounded px-1.5 py-0.5 text-xs font-medium transition-opacity", t.memberIds.includes(m.id) ? "opacity-100" : "opacity-35")}
                                  style={{ backgroundColor: m.color + "33", color: m.color }}
                                  onClick={() => toggleTaskMember(idx, m.id)}
                                >
                                  {m.name}
                                </button>
                              ))}
                            </div>
                          </td>
                        )}
                        <td className="py-1.5 pr-2">
                          <Input
                            type="number"
                            min={1}
                            value={t.startDay + 1}
                            onChange={(e) => setTaskField(idx, "startDay", Math.max(0, Number(e.target.value) - 1))}
                            className="h-8 w-20 text-center"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            type="number"
                            min={1}
                            value={t.durationDays}
                            onChange={(e) => setTaskField(idx, "durationDays", Math.max(1, Number(e.target.value)))}
                            className="h-8 w-20 text-center"
                          />
                        </td>
                        <td className="py-1.5">
                          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={() => setTasks((p) => p.filter((_, i) => i !== idx))}>
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setTasks((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      name: "New task",
                      startDay: 0,
                      durationDays: 5,
                      memberIds: [],
                      color: PRESET_COLORS[prev.length % PRESET_COLORS.length],
                    },
                  ])
                }
              >
                Add task
              </Button>
            </div>

            <Separator />

            {/* ── Visual Gantt grid ── */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium">Preview</p>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <button type="button" className="rounded border px-1.5 py-0.5 hover:bg-muted" onClick={() => setTotalWeeks((w) => Math.max(1, w - 1))}>−</button>
                  <span>{totalWeeks} {totalWeeks === 1 ? "week" : "weeks"}</span>
                  <button type="button" className="rounded border px-1.5 py-0.5 hover:bg-muted" onClick={() => setTotalWeeks((w) => Math.min(12, w + 1))}>+</button>
                </div>
              </div>
              <div className="overflow-x-auto rounded border">
                <table className="border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/60">
                      <th className="w-36 border-b border-r px-2 py-1 text-left font-medium text-muted-foreground">Task</th>
                      {members.length > 0 && (
                        <th className="border-b border-r px-2 py-1 text-left font-medium text-muted-foreground whitespace-nowrap">Members</th>
                      )}
                      {Array.from({ length: totalWeeks }, (_, w) => (
                        <th key={w} colSpan={5} className="border-b border-l px-1 py-1 text-center font-medium">
                          Week {w + 1}
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-muted/30">
                      <th className="border-b border-r" />
                      {members.length > 0 && <th className="border-b border-r" />}
                      {Array.from({ length: totalWeeks }, (_, w) =>
                        DAY_LABELS.map((d) => (
                          <th key={`${w}-${d}`} className="w-7 border-b border-l py-0.5 text-center font-normal text-muted-foreground">
                            {d}
                          </th>
                        )),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={99} className="px-3 py-4 text-center text-muted-foreground">No tasks yet</td>
                      </tr>
                    )}
                    {tasks.map((t) => {
                      const taskMembers = members.filter((m) => t.memberIds.includes(m.id));
                      return (
                        <tr key={t.id} className="border-b last:border-0">
                          <td className="border-r px-2 py-1 font-medium" style={{ borderLeftColor: t.color, borderLeftWidth: 3 }}>
                            {t.name || "—"}
                          </td>
                          {members.length > 0 && (
                            <td className="border-r px-2 py-1 text-muted-foreground whitespace-nowrap">
                              {taskMembers.length > 0
                                ? taskMembers.map((m) => m.name).join(", ")
                                : <span className="italic opacity-50">—</span>}
                            </td>
                          )}
                          {Array.from({ length: totalWeeks * 5 }, (_, d) => {
                            const active = d >= t.startDay && d < t.startDay + t.durationDays;
                            const isFirst = d === t.startDay;
                            const isLast = d === t.startDay + t.durationDays - 1;
                            return (
                              <td
                                key={d}
                                className={cn(
                                  "h-7 w-7 border-l",
                                  active ? "" : "bg-background",
                                  d % 5 === 0 && d > 0 ? "border-l-border" : "border-l-border/40",
                                )}
                                style={
                                  active
                                    ? {
                                        backgroundColor: t.color + "cc",
                                        borderRadius: `${isFirst ? "4px" : "0"} ${isLast ? "4px" : "0"} ${isLast ? "4px" : "0"} ${isFirst ? "4px" : "0"}`,
                                      }
                                    : undefined
                                }
                              />
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <Button onClick={saveGantt} disabled={pending}>
              {pending ? "Saving…" : "Continue"}
            </Button>
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
