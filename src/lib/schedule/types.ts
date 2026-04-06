// ── Schedule Engine Types ────────────────────────────────────────────────────
// The Unified Time System's complete type system

// ── Block Types ─────────────────────────────────────────────────────────────

export type BlockType =
  // Layer 1: Fixed Academic
  | "lecture" | "exercise" | "lab" | "seminar" | "exam" | "deadline"
  // Layer 1: Fixed Personal
  | "work" | "appointment" | "commute"
  // Layer 2: Planned Learning
  | "study" | "review" | "exam_prep" | "flashcards" | "deep_work" | "group_study"
  // Utility
  | "break" | "free";

export type BlockLayer = 1 | 2;

export type BlockStatus = "scheduled" | "in_progress" | "completed" | "skipped" | "rescheduled";

export type BlockSource = "manual" | "auto_plan" | "stundenplan_import" | "stundenplan_sync" | "calendar_sync" | "study_plan" | "decision_engine";

export type BlockPriority = "low" | "medium" | "high" | "critical";

export type Recurrence = "daily" | "weekly" | "biweekly" | "monthly" | null;

export interface ScheduleBlock {
  id: string;
  user_id: string;
  block_type: BlockType;
  layer: BlockLayer;
  start_time: string;  // ISO 8601
  end_time: string;
  recurrence: Recurrence;
  recurrence_end: string | null;
  module_id: string | null;
  task_id: string | null;
  topic_id: string | null;
  exam_id: string | null;
  study_plan_id: string | null;
  title: string;
  description: string | null;
  color: string;
  icon: string | null;
  priority: BlockPriority;
  status: BlockStatus;
  completion_percent: number;
  original_block_id: string | null;
  reschedule_reason: string | null;
  estimated_minutes: number | null;
  is_locked: boolean;
  source: BlockSource;
  stundenplan_id: string | null;
  event_id: string | null;
  study_plan_item_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data (optional)
  module?: { name: string; color: string; code: string | null };
  timer_sessions?: TimerSession[];
}

// ── Timer Session Types ─────────────────────────────────────────────────────

export type SessionType = "focus" | "pomodoro" | "deep_work" | "review" | "flashcards" | "free";

export type SessionStatus = "active" | "paused" | "completed" | "abandoned";

export type SessionAlignment = "within_plan" | "partial_overlap" | "unplanned" | "rescheduled";

export interface TimerSession {
  id: string;
  user_id: string;
  session_type: SessionType;
  started_at: string;
  ended_at: string | null;
  planned_duration_minutes: number | null;
  actual_duration_seconds: number | null;
  effective_seconds: number | null;
  pause_count: number;
  total_pause_seconds: number;
  module_id: string | null;
  task_id: string | null;
  topic_id: string | null;
  exam_id: string | null;
  schedule_block_id: string | null;
  focus_rating: number | null;
  energy_level: number | null;
  note: string | null;
  alignment: SessionAlignment;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  module?: { name: string; color: string };
  schedule_block?: { title: string; block_type: BlockType };
}

// ── Preferences ─────────────────────────────────────────────────────────────

export interface SchedulePreferences {
  user_id: string;
  wake_time: string;       // "HH:MM"
  sleep_time: string;
  min_study_block_minutes: number;
  max_study_block_minutes: number;
  preferred_break_minutes: number;
  max_daily_study_minutes: number;
  energy_morning: number;    // 1-5
  energy_afternoon: number;
  energy_evening: number;
  prefer_consistent_times: boolean;
  allow_weekend_study: boolean;
  weekend_max_minutes: number;
  auto_plan_enabled: boolean;
  auto_reschedule_missed: boolean;
  pomodoro_focus_minutes: number;
  pomodoro_short_break: number;
  pomodoro_long_break: number;
  pomodoro_sessions_before_long: number;
}

export const DEFAULT_PREFERENCES: SchedulePreferences = {
  user_id: "",
  wake_time: "07:00",
  sleep_time: "23:00",
  min_study_block_minutes: 25,
  max_study_block_minutes: 90,
  preferred_break_minutes: 10,
  max_daily_study_minutes: 360,
  energy_morning: 3,
  energy_afternoon: 3,
  energy_evening: 3,
  prefer_consistent_times: true,
  allow_weekend_study: true,
  weekend_max_minutes: 240,
  auto_plan_enabled: false,
  auto_reschedule_missed: true,
  pomodoro_focus_minutes: 25,
  pomodoro_short_break: 5,
  pomodoro_long_break: 15,
  pomodoro_sessions_before_long: 4,
};

// ── Daily Stats ─────────────────────────────────────────────────────────────

export interface DailyStats {
  user_id: string;
  date: string;
  planned_blocks: number;
  planned_minutes: number;
  completed_sessions: number;
  actual_minutes: number;
  effective_minutes: number;
  adherence_percent: number;
  blocks_completed: number;
  blocks_skipped: number;
  blocks_rescheduled: number;
  module_breakdown: ModuleBreakdown[];
  most_productive_hour: number | null;
  avg_session_minutes: number | null;
  longest_session_minutes: number | null;
}

export interface ModuleBreakdown {
  moduleId: string;
  moduleName: string;
  plannedMin: number;
  actualMin: number;
}

// ── Free Slot ───────────────────────────────────────────────────────────────

export interface FreeSlot {
  slot_start: string;
  slot_end: string;
  duration_minutes: number;
}

// ── Schedule View ───────────────────────────────────────────────────────────

export type ScheduleViewMode = "day" | "week" | "module";

export interface ScheduleDay {
  date: string;  // YYYY-MM-DD
  blocks: ScheduleBlock[];
  sessions: TimerSession[];
  freeSlots: FreeSlot[];
  stats: DailyStats | null;
}

export interface ScheduleWeek {
  startDate: string;
  endDate: string;
  days: ScheduleDay[];
  weekStats: {
    totalPlannedMinutes: number;
    totalActualMinutes: number;
    totalEffectiveMinutes: number;
    overallAdherence: number;
    moduleBreakdown: ModuleBreakdown[];
    mostProductiveDay: string | null;
    studyStreak: number;
  };
}

// ── Module Schedule View ────────────────────────────────────────────────────

export interface ModuleScheduleStats {
  moduleId: string;
  moduleName: string;
  moduleColor: string;
  plannedThisWeek: number;     // minutes
  actualThisWeek: number;      // minutes
  lastStudied: string | null;  // ISO date
  nextExam: string | null;     // ISO date
  daysUntilExam: number | null;
  deficit: number;             // planned - actual (positive = behind)
  trend: "improving" | "stable" | "declining";
}

// ── Block Categories for UI ─────────────────────────────────────────────────

export const BLOCK_TYPE_META: Record<BlockType, {
  layer: BlockLayer;
  category: "academic" | "personal" | "learning" | "utility";
  defaultIcon: string;
  defaultColor: string;
}> = {
  lecture:     { layer: 1, category: "academic",  defaultIcon: "GraduationCap", defaultColor: "#2563eb" },
  exercise:   { layer: 1, category: "academic",  defaultIcon: "Dumbbell",      defaultColor: "#0891b2" },
  lab:        { layer: 1, category: "academic",  defaultIcon: "FlaskConical",  defaultColor: "#7c3aed" },
  seminar:    { layer: 1, category: "academic",  defaultIcon: "Users",         defaultColor: "#0d9488" },
  exam:       { layer: 1, category: "academic",  defaultIcon: "FileCheck",     defaultColor: "#dc2626" },
  deadline:   { layer: 1, category: "academic",  defaultIcon: "AlertTriangle", defaultColor: "#ea580c" },
  work:       { layer: 1, category: "personal",  defaultIcon: "Briefcase",     defaultColor: "#64748b" },
  appointment:{ layer: 1, category: "personal",  defaultIcon: "Calendar",      defaultColor: "#8b5cf6" },
  commute:    { layer: 1, category: "personal",  defaultIcon: "Bus",           defaultColor: "#94a3b8" },
  study:      { layer: 2, category: "learning",  defaultIcon: "BookOpen",      defaultColor: "#6d28d9" },
  review:     { layer: 2, category: "learning",  defaultIcon: "RefreshCw",     defaultColor: "#059669" },
  exam_prep:  { layer: 2, category: "learning",  defaultIcon: "Target",        defaultColor: "#dc2626" },
  flashcards: { layer: 2, category: "learning",  defaultIcon: "Layers",        defaultColor: "#d97706" },
  deep_work:  { layer: 2, category: "learning",  defaultIcon: "Brain",         defaultColor: "#7c3aed" },
  group_study:{ layer: 2, category: "learning",  defaultIcon: "Users",         defaultColor: "#0891b2" },
  break:      { layer: 2, category: "utility",   defaultIcon: "Coffee",        defaultColor: "#10b981" },
  free:       { layer: 2, category: "utility",   defaultIcon: "Clock",         defaultColor: "#94a3b8" },
};

// ── Utility ─────────────────────────────────────────────────────────────────

export function isFixedBlock(type: BlockType): boolean {
  return BLOCK_TYPE_META[type].layer === 1;
}

export function isLearningBlock(type: BlockType): boolean {
  return BLOCK_TYPE_META[type].category === "learning";
}

export function getBlockDurationMinutes(block: ScheduleBlock): number {
  const start = new Date(block.start_time).getTime();
  const end = new Date(block.end_time).getTime();
  return Math.round((end - start) / 60000);
}

export function getSessionDurationMinutes(session: TimerSession): number {
  if (session.effective_seconds != null) return Math.round(session.effective_seconds / 60);
  if (session.actual_duration_seconds != null) return Math.round(session.actual_duration_seconds / 60);
  if (session.ended_at) {
    return Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000);
  }
  return Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000);
}
