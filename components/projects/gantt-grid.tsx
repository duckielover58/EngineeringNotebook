"use client";

import { cn } from "@/lib/utils";
import type { GanttData, GanttMember, GanttTask, GanttViewMode } from "@/types/database";

const DAY_LABELS = ["M", "T", "W", "Th", "F"];

function parseStartDate(startDate: string | undefined): Date | null {
  if (!startDate) return null;
  const parts = startDate.split("-").map((s) => Number(s));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function fmtMonthDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Convert a day offset (Monday-based, weekend-skipping where startDay counts only
 * workdays in 5-day weeks) into a calendar Date by walking weeks*5 + day-in-week.
 */
function workdayOffsetToDate(start: Date, dayOffset: number): Date {
  const week = Math.floor(dayOffset / 5);
  const dow = ((dayOffset % 5) + 5) % 5;
  return addDays(start, week * 7 + dow);
}

export type GanttGridProps = {
  tasks: GanttTask[];
  members: GanttMember[];
  totalWeeks: number;
  startDate?: string;
  viewMode?: GanttViewMode;
  /** When set, weekly cells are clickable to extend a task's range to that week. */
  onWeekCellClick?: (taskIdx: number, week: number) => void;
  /** When set, daily cells are clickable to extend a task's range to that day. */
  onDayCellClick?: (taskIdx: number, day: number) => void;
  className?: string;
};

const FALLBACK_TASK_COLOR = "#6b7280";

function normalizeTask(t: GanttTask): GanttTask {
  // Legacy gantt_data rows may be missing memberIds, durationDays, color, etc.
  const startDay = Number.isFinite(t.startDay) ? t.startDay : 0;
  const durationDays = Number.isFinite(t.durationDays) ? t.durationDays : 5;
  return {
    id: t.id,
    name: t.name ?? "",
    startDay,
    durationDays,
    memberIds: Array.isArray(t.memberIds) ? t.memberIds : [],
    color: t.color || FALLBACK_TASK_COLOR,
  };
}

export function GanttGrid({
  tasks: rawTasks,
  members: rawMembers,
  totalWeeks: rawTotalWeeks,
  startDate,
  viewMode = "weeks",
  onWeekCellClick,
  onDayCellClick,
  className,
}: GanttGridProps) {
  const tasks = Array.isArray(rawTasks) ? rawTasks.map(normalizeTask) : [];
  const members: GanttMember[] = Array.isArray(rawMembers) ? rawMembers : [];
  const totalWeeks = Number.isFinite(rawTotalWeeks) && rawTotalWeeks > 0 ? rawTotalWeeks : 3;
  const start = parseStartDate(startDate);
  const showMembersCol = members.length > 0;
  const editableWeeks = !!onWeekCellClick;
  const editableDays = !!onDayCellClick;

  if (viewMode === "days") {
    return (
      <div className={cn("overflow-x-auto rounded border", className)}>
        <table className="border-collapse text-xs">
          <thead>
            <tr className="bg-muted/60">
              <th className="w-36 border-b border-r px-2 py-1 text-left font-medium text-muted-foreground">Task</th>
              {showMembersCol && (
                <th className="border-b border-r px-2 py-1 text-left font-medium text-muted-foreground whitespace-nowrap">Members</th>
              )}
              {Array.from({ length: totalWeeks * 5 }, (_, dayIdx) => {
                const date = start ? workdayOffsetToDate(start, dayIdx) : null;
                return (
                  <th key={dayIdx} className="border-b border-l px-1.5 py-1 text-center font-medium whitespace-nowrap">
                    <div>{DAY_LABELS[dayIdx % 5]}</div>
                    {date && <div className="text-[10px] font-normal text-muted-foreground">{fmtMonthDay(date)}</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr>
                <td colSpan={99} className="px-3 py-4 text-center text-muted-foreground">
                  No tasks yet
                </td>
              </tr>
            )}
            {tasks.map((t, taskIdx) => {
              const taskMembers = members.filter((m) => t.memberIds.includes(m.id));
              const taskStart = t.startDay;
              const taskEnd = t.startDay + Math.max(1, t.durationDays);
              const displayColor = taskMembers[0]?.color ?? t.color;
              return (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="border-r px-2 py-1 font-medium" style={{ borderLeftColor: t.color, borderLeftWidth: 3 }}>
                    {t.name || "—"}
                  </td>
                  {showMembersCol && (
                    <td className="border-r px-2 py-1 text-muted-foreground whitespace-nowrap">
                      {taskMembers.length > 0 ? (
                        taskMembers.map((m) => m.name).join(", ")
                      ) : (
                        <span className="italic opacity-50">—</span>
                      )}
                    </td>
                  )}
                  {Array.from({ length: totalWeeks * 5 }, (_, dayIdx) => {
                    const active = dayIdx >= taskStart && dayIdx < taskEnd;
                    return (
                      <td
                        key={dayIdx}
                        className={cn(
                          "h-8 w-10 border-l transition-colors",
                          editableDays ? "cursor-pointer" : "cursor-default",
                          active ? "" : "bg-background",
                        )}
                        style={active ? { backgroundColor: displayColor + "cc" } : undefined}
                        onClick={editableDays ? () => onDayCellClick!(taskIdx, dayIdx) : undefined}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded border", className)}>
      <table className="border-collapse text-xs">
        <thead>
          <tr className="bg-muted/60">
            <th className="w-36 border-b border-r px-2 py-1 text-left font-medium text-muted-foreground">Task</th>
            {showMembersCol && (
              <th className="border-b border-r px-2 py-1 text-left font-medium text-muted-foreground whitespace-nowrap">Members</th>
            )}
            {Array.from({ length: totalWeeks }, (_, w) => {
              const date = start ? workdayOffsetToDate(start, w * 5) : null;
              return (
                <th key={w} className="border-b border-l px-2 py-1 text-center font-medium whitespace-nowrap">
                  <div>Week {w + 1}</div>
                  {date && <div className="text-[10px] font-normal text-muted-foreground">{fmtMonthDay(date)}</div>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && (
            <tr>
              <td colSpan={99} className="px-3 py-4 text-center text-muted-foreground">
                No tasks yet
              </td>
            </tr>
          )}
          {tasks.map((t, taskIdx) => {
            const taskMembers = members.filter((m) => t.memberIds.includes(m.id));
            const taskStartWeek = Math.floor(t.startDay / 5);
            const taskWeeks = Math.max(1, Math.ceil(t.durationDays / 5));
            const displayColor = taskMembers[0]?.color ?? t.color;
            return (
              <tr key={t.id} className="border-b last:border-0">
                <td className="border-r px-2 py-1 font-medium" style={{ borderLeftColor: t.color, borderLeftWidth: 3 }}>
                  {t.name || "—"}
                </td>
                {showMembersCol && (
                  <td className="border-r px-2 py-1 text-muted-foreground whitespace-nowrap">
                    {taskMembers.length > 0 ? (
                      taskMembers.map((m) => m.name).join(", ")
                    ) : (
                      <span className="italic opacity-50">—</span>
                    )}
                  </td>
                )}
                {Array.from({ length: totalWeeks }, (_, w) => {
                  const active = w >= taskStartWeek && w < taskStartWeek + taskWeeks;
                  return (
                    <td
                      key={w}
                      className={cn(
                        "h-8 w-20 border-l transition-colors",
                        editableWeeks ? "cursor-pointer" : "cursor-default",
                        active ? "" : "bg-background",
                      )}
                      style={active ? { backgroundColor: displayColor + "cc" } : undefined}
                      onClick={editableWeeks ? () => onWeekCellClick!(taskIdx, w) : undefined}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Convenience read-only renderer for a stored GanttData blob. */
export function GanttGridFromData({ data, className }: { data: GanttData | null; className?: string }) {
  if (!data) return null;
  return (
    <GanttGrid
      tasks={data.tasks ?? []}
      members={data.members ?? []}
      totalWeeks={data.totalWeeks ?? 3}
      startDate={data.startDate}
      viewMode={data.viewMode ?? "weeks"}
      className={className}
    />
  );
}
