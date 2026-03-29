export type ModuleStatus = "planned" | "active" | "completed" | "paused";
export type ModuleType   = "pflicht" | "wahl" | "vertiefung";
export type TaskStatus   = "Open" | "In Progress" | "Done";
export type TaskPriority = "Low" | "Medium" | "High" | "Critical";
export type EventKind    = "study_block" | "custom";
export type Recurrence   = "none" | "daily" | "weekly";
export type GradeMode    = "points" | "direct";
export type DataType     = "objective" | "content_section" | "assessment";

export interface Module {
  id: number;
  user_id: string;
  name: string;
  code: string;
  semester: string;
  ects: number;
  lecturer: string;
  link: string;
  status: ModuleStatus;
  exam_date: string;
  weighting: number;
  github_link: string;
  sharepoint_link: string;
  literature_links: string;
  notes_link: string;
  module_type: ModuleType;
  in_plan: boolean;
  target_grade: number | null;
  created_at: string;
}

export interface Task {
  id: number;
  user_id: string;
  module_id: number;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
  module?: Module;
}

export interface CalendarEvent {
  id: number;
  user_id: string;
  module_id: number | null;
  title: string;
  kind: EventKind;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  recurrence: Recurrence;
  recurrence_until: string;
  notes: string;
  module?: Module;
}

export interface TimeLog {
  id: number;
  user_id: string;
  module_id: number;
  start_ts: number;
  end_ts: number;
  seconds: number;
  kind: "study" | "pomodoro";
  note: string;
  created_at: string;
  module?: Module;
}

export interface Topic {
  id: number;
  user_id: string;
  module_id: number;
  title: string;
  knowledge_level: number;
  notes: string;
  task_id: number | null;
  last_reviewed: string;
  sr_easiness: number;
  sr_interval: number;
  sr_repetitions: number;
  sr_next_review: string;
  created_at: string;
  updated_at: string;
  module?: Module;
}

export interface Grade {
  id: number;
  user_id: string;
  module_id: number;
  title: string;
  grade: number;
  max_grade: number;
  weight: number;
  grade_mode: GradeMode;
  date: string;
  notes: string;
  created_at: string;
  module?: Module;
}

export interface ScrapedData {
  id: number;
  user_id: string;
  module_id: number;
  data_type: DataType;
  title: string;
  body: string;
  weight: number;
  sort_order: number;
  checked: boolean;
  module?: Module;
}

export interface StundenplanEntry {
  id: number;
  user_id: string;
  day_of_week: number;
  time_from: string;
  time_to: string;
  subject: string;
  room: string;
  lecturer: string;
  color: string;
  module_id: number | null;
  notes: string;
  module?: Module;
}

export interface AppSetting {
  user_id: string;
  key: string;
  value: string;
}
