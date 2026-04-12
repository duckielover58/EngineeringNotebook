export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "student" | "teacher";
export type ProjectStatus = "setup" | "active" | "concluded";

export type GanttTask = {
  id: string;
  name: string;
  startWeek: number;
  durationWeeks: number;
};

export type GanttData = {
  tasks: GanttTask[];
};

/** Use generated types from Supabase CLI in production; `any` avoids hand-schema drift with PostgREST. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
