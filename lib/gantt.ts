import type { GanttData, GanttMember, GanttTask, GanttViewMode } from "@/types/database";

export const GANTT_PRESET_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#f97316",
  "#a855f7",
  "#eab308",
  "#ec4899",
  "#14b8a6",
] as const;

export function defaultGanttTasks(): GanttTask[] {
  return [
    { id: "1", name: "Research", startDay: 0, durationDays: 5, memberIds: [], color: GANTT_PRESET_COLORS[0] },
    { id: "2", name: "Design", startDay: 5, durationDays: 5, memberIds: [], color: GANTT_PRESET_COLORS[1] },
    { id: "3", name: "Build", startDay: 10, durationDays: 10, memberIds: [], color: GANTT_PRESET_COLORS[2] },
  ];
}

export function migrateGanttData(data: GanttData | null): {
  tasks: GanttTask[];
  members: GanttMember[];
  totalWeeks: number;
  startDate: string;
  viewMode: GanttViewMode;
} {
  if (!data) return { tasks: defaultGanttTasks(), members: [], totalWeeks: 3, startDate: "", viewMode: "weeks" };
  const members: GanttMember[] = data.members ?? [];
  const totalWeeks = data.totalWeeks ?? 3;
  const tasks: GanttTask[] = (data.tasks ?? []).map((t, i) => {
    if ("startDay" in t && typeof t.startDay === "number") return t as GanttTask;
    const legacy = t as { startWeek?: number; weeks?: number; name?: string; color?: string; memberIds?: string[] };
    return {
      id: (t as GanttTask).id ?? String(i + 1),
      name: legacy.name ?? "",
      startDay: (legacy.startWeek ?? 0) * 5,
      durationDays: (legacy.weeks ?? 1) * 5,
      memberIds: legacy.memberIds ?? [],
      color: legacy.color ?? GANTT_PRESET_COLORS[i % GANTT_PRESET_COLORS.length],
    };
  });
  return {
    tasks: tasks.length ? tasks : defaultGanttTasks(),
    members,
    totalWeeks,
    startDate: data.startDate ?? "",
    viewMode: data.viewMode ?? "weeks",
  };
}
