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

export type GanttViewMode = "days" | "weeks";

export type GanttData = {
  tasks: GanttTask[];
  members: GanttMember[];
  totalWeeks: number;
  /** Optional ISO date (YYYY-MM-DD) of the first workday (Monday). */
  startDate?: string;
  /** Default view mode for the Gantt grid; falls back to "weeks" when absent. */
  viewMode?: GanttViewMode;
};

/** Per-sketch teammate label, keyed by sketch URL. Legacy/JSON shape on `projects.initial_sketch_meta`. */
export type SketchMeta = Record<string, { memberLabel?: string }>;

export type SketchKind = "brainstorming" | "initial_design" | "final";

export type ProjectSketch = {
  id: string;
  project_id: string;
  kind: SketchKind;
  url: string;
  member_label: string | null;
  uploaded_by: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type ProjectMathImage = {
  id: string;
  project_id: string;
  url: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ConclusionQuestion = {
  id: string;
  classroom_id: string;
  prompt: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type DesignBrief = {
  client: string;
  target_consumer: string;
  design_team: string;
  design_statement: string;
  criteria: string[];
  deliverables: string[];
};

export type ConclusionAnswer = {
  id: string;
  project_id: string;
  question_id: string;
  body: string;
  answered_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Use generated types from Supabase CLI in production; `any` avoids hand-schema drift with PostgREST. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
