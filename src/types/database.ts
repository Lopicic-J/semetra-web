// ── Database types matching the Supabase schema (001 + 002 migrations) ────────

export type TaskStatus   = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type ModuleStatus = "planned" | "active" | "completed" | "paused";
export type ModuleType   = "pflicht" | "wahl" | "vertiefung";
export type DataType     = "objective" | "content_section" | "assessment";

export interface Module {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  professor: string | null;
  ects: number | null;
  semester: string | null;
  day: string | null;
  time_start: string | null;
  time_end: string | null;
  room: string | null;
  color: string;
  notes: string | null;
  // Extended fields (migration 002)
  link: string | null;
  status: string;
  exam_date: string | null;
  weighting: number;
  github_link: string | null;
  sharepoint_link: string | null;
  literature_links: string | null;
  notes_link: string | null;
  module_type: string;
  in_plan: boolean;
  target_grade: number | null;
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
  exam_id: string | null;
  topic_id: string | null;
  task_id: string | null;
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
  knowledge_level: number;
  last_reviewed: string | null;
  sr_easiness: number;
  sr_interval: number;
  sr_repetitions: number;
  sr_next_review: string | null;
  task_id: string | null;
  exam_id: string | null;
  updated_at: string;
  created_at: string;
}

export interface Grade {
  id: string;
  user_id: string;
  module_id: string | null;
  exam_id: string | null;
  title: string;
  grade: number | null;
  ects_earned: number | null;
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
  kw: number | null;
  semester: string | null;
  created_at: string;
}

export interface ModuleScrapedData {
  id: string;
  user_id: string;
  module_id: string | null;
  data_type: string; // 'objective' | 'content_section' | 'assessment'
  title: string;
  body: string | null;
  weight: number;
  sort_order: number;
  checked: boolean;
  created_at: string;
}

export interface Studiengang {
  id: string;
  name: string;
  fh: string;
  country: string;
  abschluss: string;
  semester_count: number;
  ects_total: number;
  modules_json: StudiengangModuleTemplate[] | null;
  created_at: string;
}

export interface StudiengangModuleTemplate {
  name: string;
  code: string;
  ects: number;
  semester: string;
  module_type: string;
  color: string;
}

export interface Flashcard {
  id: string;
  user_id: string;
  module_id: string | null;
  exam_id: string | null;
  knowledge_id: string | null;
  deck_name: string;
  front: string;
  back: string;
  source: "user" | "ai";
  source_document: string | null;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string | null;
  last_reviewed: string | null;
  created_at: string;
  updated_at: string;
  module?: Module;
}

export interface TaskAttachment {
  id: string;
  user_id: string;
  task_id: string;
  kind: "link" | "file";
  label: string;
  url: string;
  file_type: string | null;
  file_size: number;
  storage_path: string | null;
  created_at: string;
}

export interface ExamAttachment {
  id: string;
  user_id: string;
  exam_id: string;
  kind: "link" | "file" | "note";
  label: string;
  url: string;
  content: string | null;
  file_type: string | null;
  file_size: number;
  storage_path: string | null;
  created_at: string;
}

export interface AppSetting {
  user_id: string;
  key: string;
  value: string;
}

export interface MindMap {
  id: string;
  user_id: string;
  title: string;
  module_id: string | null;
  exam_id: string | null;
  task_id: string | null;
  layout_mode: "tree" | "free";
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  kind: "link" | "file" | "pdf" | "image" | "video" | "other";
  url: string;
  file_type: string | null;
  file_size: number;
  storage_path: string | null;
  module_id: string | null;
  exam_id: string | null;
  task_id: string | null;
  tags: string[];
  color: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  module?: Module;
}

export type NoteStatus = "draft" | "in_progress" | "done";

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  module_id: string | null;
  exam_id: string | null;
  task_id: string | null;
  category_id: string | null;
  status: NoteStatus;
  color: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  module?: Module;
}

export interface NoteChecklistItem {
  id: string;
  user_id: string;
  note_id: string;
  content: string;
  checked: boolean;
  sort_order: number;
  created_at: string;
}

export type BrainstormTechnique =
  | "freeform"
  | "scamper"
  | "pro_contra"
  | "starbursting"
  | "brainwriting"
  | "reverse"
  | "minddump";

export interface BrainstormSession {
  id: string;
  user_id: string;
  title: string;
  module_id: string | null;
  exam_id: string | null;
  task_id: string | null;
  technique: BrainstormTechnique;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface BrainstormIdea {
  id: string;
  user_id: string;
  session_id: string;
  content: string;
  category: string;
  color: string;
  pos_x: number;
  pos_y: number;
  votes: number;
  sort_order: number;
  indent_level: number;
  notes: string;
  priority: string;
  created_at: string;
}

export interface MindMapNode {
  id: string;
  user_id: string;
  mindmap_id: string;
  parent_id: string | null;
  label: string;
  notes: string | null;
  color: string;
  icon: string | null;
  pos_x: number;
  pos_y: number;
  collapsed: boolean;
  sort_order: number;
  links: { label: string; url: string }[];
  created_at: string;
}

// ── Math Room ─────────────────────────────────────────────────────────────────

export type MathTool = "calculator" | "equations" | "matrices" | "plotter" | "statistics" | "units" | "formulas";

export type FormulaCategory =
  | "allgemein"
  | "analysis"
  | "lineare_algebra"
  | "statistik"
  | "physik"
  | "trigonometrie"
  | "finanzen"
  | "informatik";

export interface MathHistory {
  id: string;
  user_id: string;
  tool: MathTool;
  expression: string;
  result: string;
  label: string | null;
  module_id: string | null;
  exam_id: string | null;
  pinned: boolean;
  created_at: string;
  module?: Module;
}

export interface MathFormula {
  id: string;
  user_id: string;
  title: string;
  formula: string;
  category: FormulaCategory;
  description: string;
  module_id: string | null;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
  module?: Module;
}
