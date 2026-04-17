// ── Database types matching the Supabase schema (001 + 002 migrations) ────────

export type TaskStatus   = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type ModuleStatus = "planned" | "active" | "completed" | "paused" | "credited";
export type StudyMode = "full_time" | "part_time";
export type StudyModeAvailable = "full_time" | "part_time" | "both";
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
  // Academic fields (migration 032)
  credit_scheme_id: string | null;
  grade_scale_id: string | null;
  pass_policy_id: string | null;
  retake_policy_id: string | null;
  rounding_policy_id: string | null;
  program_id: string | null;
  requirement_group_id: string | null;
  term_type: string | null;
  default_term_number: number | null;
  is_compulsory: boolean;
  is_repeatable: boolean;
  attendance_required: boolean;
  language: string | null;
  delivery_mode: string;
  prerequisites_json: string[];
  description: string | null;
  module_code: string | null;
  ects_equivalent: number | null;
  semester_part_time: string | null;
  // Source tracking (migration 056)
  source: "institution" | "manual";
  studiengang_id: string | null;
  hidden_at: string | null;
  // Module intelligence (migration 088)
  exam_format: string | null;
  textbook: string | null;
  lecture_rhythm: string | null;
  learning_recommendation: string | null;
  learning_type: "theory" | "math" | "programming" | "language" | "project" | "mixed";
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
  module_id: string | null; // Added in migration 050
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
  task_id: string | null;
  knowledge_id: string | null;
  deck_name: string;
  front: string;
  back: string;
  card_type: "basic" | "cloze" | "mc";
  source: "user" | "ai";
  source_document: string | null;
  tags: string[];
  choices: string[] | null;
  correct_answers: string[] | null;  // MC: multiple correct answers (null = single correct = back)
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  streak: number;
  total_reviews: number;
  correct_count: number;
  next_review: string | null;
  last_reviewed: string | null;
  last_quality: number | null;   // 0-3: last rating given (0=fail, 1=hard, 2=good, 3=perfect)
  created_at: string;
  updated_at: string;
  module?: Module;
  task?: Task;
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
  text_color: string | null;
  icon: string | null;
  image_url: string | null;
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

// ── Academic Builder Types (migrations 032–038) ─────────────────────────────

export interface Institution {
  id: string;
  name: string;
  code: string | null;
  country_code: string;
  institution_type: string;
  official_language: string | null;
  academic_year_start_month: number;
  default_credit_scheme_id: string | null;
  default_grade_scale_id: string | null;
  default_rounding_policy_id: string | null;
  default_pass_policy_id: string | null;
  default_retake_policy_id: string | null;
  default_classification_scheme_id: string | null;
  default_gpa_scheme_id: string | null;
  timezone: string | null;
  website: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Faculty {
  id: string;
  institution_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  institution_id: string | null;
  faculty_id: string | null;
  code: string | null;
  name: string;
  degree_level: string;
  required_total_credits: number;
  credit_scheme_id: string | null;
  ects_total: number | null;
  ects_equivalent_total: number | null;
  duration_standard_terms: number;
  classification_scheme_id: string | null;
  gpa_scheme_id: string | null;
  completion_rules: Record<string, unknown>;
  thesis_required: boolean;
  internship_required: boolean;
  final_exam_required: boolean;
  is_active: boolean;
  status: string;
  study_mode_available: StudyModeAvailable;
  duration_terms_part_time: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RequirementGroup {
  id: string;
  program_id: string;
  parent_group_id: string | null;
  name: string;
  group_type: string;
  rule_type: string;
  min_credits_required: number | null;
  min_modules_required: number | null;
  max_modules_counted: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssessmentComponent {
  id: string;
  module_id: string;
  name: string;
  component_type: string;
  weight_percent: number;
  grade_scale_id: string | null;
  pass_policy_id: string | null;
  min_pass_required: boolean;
  min_grade: number | null;
  contributes_to_final: boolean;
  mandatory_to_pass: boolean;
  sequence_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModulePrerequisite {
  id: string;
  module_id: string;
  prerequisite_module_id: string;
  prerequisite_type: string;
  notes: string | null;
  created_at: string;
}

export interface AcademicTerm {
  id: string;
  user_id: string;
  institution_id: string | null;
  academic_year_label: string;
  term_type: string;
  term_number: number;
  term_label: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  module_id: string;
  program_id: string | null;
  academic_year: string | null;
  term_id: string | null;
  status: string;
  attempts_used: number;
  current_final_grade: number | null;
  current_grade_label: string | null;
  current_passed: boolean | null;
  credits_awarded: number;
  local_grade_value: number | null;
  local_grade_label: string | null;
  normalized_score_0_100: number | null;
  created_at: string;
  updated_at: string;
}

export interface StudentProgram {
  id: string;
  user_id: string;
  program_id: string;
  institution_id: string | null;
  enrollment_date: string | null;
  expected_graduation: string | null;
  status: string;
  matriculation_number: string | null;
  specialisation: string | null;
  study_mode: StudyMode;
  created_at: string;
  updated_at: string;
}
