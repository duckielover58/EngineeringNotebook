export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "student" | "teacher";
export type ProjectStatus = "setup" | "active" | "concluded";

export type GanttMember = {
  id: string;
  name: string;
  color: string;
};

export type GanttTask = {
  id: string;
  name: string;
  startDay: number;      // 0-indexed weekday offset (0 = first Monday)
  durationDays: number;
  memberIds: string[];
  color: string;         // hex display color in the grid
};

export type GanttData = {
  tasks: GanttTask[];
  members: GanttMember[];
  totalWeeks: number;
};

/** Use generated types from Supabase CLI in production; `any` avoids hand-schema drift with PostgREST. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
