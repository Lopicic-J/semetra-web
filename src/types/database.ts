// ── Database types matching the Supabase schema (001_initial.sql) ─────────────

export type TaskStatus   = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Module {
  id: string;
  user_id: string;
  name: string;
  professor: string | null;
  ects: number | null;
  semester: string | null;
  day: string | null;
  time_start: string | null;
  time_end: string | null;
  room: string | null;
  color: string;
  notes: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  module?: Module;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  start_dt: string;
  end_dt: string | null;
  location: string | null;
  description: string | null;
  color: string;
  event_type: string;
  created_at: string;
}

export interface TimeLog {
  id: string;
  user_id: string;
  module_id: string | null;
  duration_seconds: number;
  started_at: string;
  note: string | null;
  created_at: string;
  module?: Module;
}

export interface Topic {
  id: string;
  user_id: string;
  module_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
}

export interface Grade {
  id: string;
  user_id: string;
  module_id: string | null;
  title: string;
  grade: number;
  weight: number;
  date: string | null;
  exam_type: string | null;
  notes: string | null;
  created_at: string;
  module?: Module;
}

export interface StundenplanEntry {
  id: string;
  user_id: string;
  module_id: string | null;
  title: string;
  day: string;
  time_start: string;
  time_end: string;
  room: string | null;
  color: string;
  created_at: string;
}

export interface AppSetting {
  user_id: string;
  key: string;
  value: string;
}
