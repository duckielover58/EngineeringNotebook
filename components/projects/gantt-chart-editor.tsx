"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateProjectGantt } from "@/actions/projects";
import { GANTT_PRESET_COLORS, migrateGanttData } from "@/lib/gantt";
import { cn } from "@/lib/utils";
import type { GanttData, GanttMember, GanttTask, GanttViewMode } from "@/types/database";
import { GanttGrid } from "@/components/projects/gantt-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Props = {
  projectId: string;
  initialGantt: GanttData | null;
  saveLabel?: string;
  showBack?: boolean;
  onBack?: () => void;
  onSaved?: () => void;
};

export function GanttChartEditor({
  projectId,
  initialGantt,
  saveLabel = "Save",
  showBack,
  onBack,
  onSaved,
}: Props) {
  const router = useRouter();
  const initial = migrateGanttData(initialGantt);
  const [tasks, setTasks] = useState<GanttTask[]>(initial.tasks);
  const [members, setMembers] = useState<GanttMember[]>(initial.members);
  const [totalWeeks, setTotalWeeks] = useState(initial.totalWeeks);
  const [ganttStartDate, setGanttStartDate] = useState(initial.startDate);
  const [ganttViewMode, setGanttViewMode] = useState<GanttViewMode>(initial.viewMode);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberColor, setNewMemberColor] = useState<string>(GANTT_PRESET_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function addMember() {
    const name = newMemberName.trim();
    if (!name) return;
    setMembers((m) => [...m, { id: crypto.randomUUID(), name, color: newMemberColor }]);
    setNewMemberName("");
    setNewMemberColor(GANTT_PRESET_COLORS[(members.length + 1) % GANTT_PRESET_COLORS.length]);
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

  function setTaskWeekRange(taskIdx: number, week: number) {
    setTasks((prev) =>
      prev.map((task, idx) => {
        if (idx !== taskIdx) return task;
        const startWeek = Math.floor(task.startDay / 5);
        const taskWeeks = Math.max(1, Math.ceil(task.durationDays / 5));
        const endExclusive = startWeek + taskWeeks;
        if (week >= startWeek && week < endExclusive) return task;
        if (week < startWeek) {
          const newWeeks = endExclusive - week;
          return { ...task, startDay: week * 5, durationDays: newWeeks * 5 };
        }
        const newWeeks = week - startWeek + 1;
        return { ...task, startDay: startWeek * 5, durationDays: newWeeks * 5 };
      }),
    );
  }

  function setTaskDayRange(taskIdx: number, day: number) {
    setTasks((prev) =>
      prev.map((task, idx) => {
        if (idx !== taskIdx) return task;
        const start = task.startDay;
        const duration = Math.max(1, task.durationDays);
        const endExclusive = start + duration;
        if (day >= start && day < endExclusive) return task;
        if (day < start) return { ...task, startDay: day, durationDays: endExclusive - day };
        return { ...task, startDay: start, durationDays: day - start + 1 };
      }),
    );
  }

  async function save() {
    setError(null);
    setPending(true);
    const gantt_data: GanttData = {
      tasks,
      members,
      totalWeeks,
      startDate: ganttStartDate || undefined,
      viewMode: ganttViewMode,
    };
    const res = await updateProjectGantt(projectId, gantt_data);
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
    onSaved?.();
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="gantt-start-date">Project start date (Monday)</Label>
          <Input
            id="gantt-start-date"
            type="date"
            value={ganttStartDate}
            onChange={(e) => setGanttStartDate(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <Label>View</Label>
          <div className="inline-flex overflow-hidden rounded-md border">
            <button
              type="button"
              className={cn("px-3 py-1.5 text-sm", ganttViewMode === "weeks" ? "bg-muted font-medium" : "hover:bg-muted/50")}
              onClick={() => setGanttViewMode("weeks")}
            >
              Weeks
            </button>
            <button
              type="button"
              className={cn("border-l px-3 py-1.5 text-sm", ganttViewMode === "days" ? "bg-muted font-medium" : "hover:bg-muted/50")}
              onClick={() => setGanttViewMode("days")}
            >
              Days
            </button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-sm font-medium">People for tasks</p>
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
            {GANTT_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  "size-5 rounded-full border-2 transition-transform hover:scale-110",
                  newMemberColor === c ? "border-foreground scale-110" : "border-transparent",
                )}
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

      <div className="space-y-2">
        <p className="text-sm font-medium">Tasks</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-2 font-normal">Task name</th>
                <th className="pb-2 pr-2 font-normal">Color</th>
                {members.length > 0 && <th className="pb-2 pr-2 font-normal">Members</th>}
                <th className="pb-2 pr-2 font-normal w-24">{ganttViewMode === "days" ? "Start day" : "Start week"}</th>
                <th className="pb-2 pr-2 font-normal w-24">{ganttViewMode === "days" ? "Days" : "Weeks"}</th>
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
                      {GANTT_PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={cn(
                            "size-5 rounded-full border-2 transition-transform hover:scale-110",
                            t.color === c ? "border-foreground scale-110" : "border-transparent",
                          )}
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
                            className={cn(
                              "rounded px-1.5 py-0.5 text-xs font-medium transition-opacity",
                              t.memberIds.includes(m.id) ? "opacity-100" : "opacity-35",
                            )}
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
                      value={ganttViewMode === "days" ? t.startDay + 1 : Math.floor(t.startDay / 5) + 1}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (ganttViewMode === "days") {
                          setTaskField(idx, "startDay", Math.max(0, n - 1));
                        } else {
                          setTaskField(idx, "startDay", Math.max(0, (n - 1) * 5));
                        }
                      }}
                      className="h-8 w-24 text-center"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      min={1}
                      value={
                        ganttViewMode === "days"
                          ? Math.max(1, t.durationDays)
                          : Math.max(1, Math.ceil(t.durationDays / 5))
                      }
                      onChange={(e) => {
                        const n = Math.max(1, Number(e.target.value));
                        if (ganttViewMode === "days") {
                          setTaskField(idx, "durationDays", n);
                        } else {
                          setTaskField(idx, "durationDays", n * 5);
                        }
                      }}
                      className="h-8 w-24 text-center"
                    />
                  </td>
                  <td className="py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-muted-foreground"
                      onClick={() => setTasks((p) => p.filter((_, i) => i !== idx))}
                    >
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
                color: GANTT_PRESET_COLORS[prev.length % GANTT_PRESET_COLORS.length],
              },
            ])
          }
        >
          Add task
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium">{ganttViewMode === "days" ? "Daily planning grid" : "Weekly planning grid"}</p>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <button type="button" className="rounded border px-1.5 py-0.5 hover:bg-muted" onClick={() => setTotalWeeks((w) => Math.max(1, w - 1))}>
              −
            </button>
            <span>
              {totalWeeks} {totalWeeks === 1 ? "week" : "weeks"}
            </span>
            <button type="button" className="rounded border px-1.5 py-0.5 hover:bg-muted" onClick={() => setTotalWeeks((w) => Math.min(12, w + 1))}>
              +
            </button>
          </div>
        </div>
        <GanttGrid
          tasks={tasks}
          members={members}
          totalWeeks={totalWeeks}
          startDate={ganttStartDate || undefined}
          viewMode={ganttViewMode}
          onWeekCellClick={ganttViewMode === "weeks" ? setTaskWeekRange : undefined}
          onDayCellClick={ganttViewMode === "days" ? setTaskDayRange : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : saveLabel}
        </Button>
        {showBack && onBack && (
          <Button type="button" variant="ghost" onClick={onBack} disabled={pending}>
            Back
          </Button>
        )}
      </div>
    </div>
  );
}
