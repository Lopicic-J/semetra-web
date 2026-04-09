// ── Schedule Engine — Public API ─────────────────────────────────────────────
// Unified Time System: Schedule Engine + Timer Engine
//
// Architecture:
//   Decision Engine → "WHAT to study" (priorities, risks, actions)
//   Schedule Engine → "WHEN to study" (time slots, blocks, planning)
//   Timer Engine   → "WHAT WAS DONE" (tracking, sessions, reality)
//
// All three engines feed each other in a continuous loop.
// ─────────────────────────────────────────────────────────────────────────────

// Types
export type {
  ScheduleBlock, TimerSession, SchedulePreferences, FreeSlot,
  ScheduleDay, ScheduleWeek, DailyStats, ModuleBreakdown,
  ModuleScheduleStats, BlockType, BlockLayer, BlockStatus,
  BlockSource, BlockPriority, Recurrence, SessionType,
  SessionStatus, SessionAlignment, ScheduleViewMode,
} from "./types";

export {
  DEFAULT_PREFERENCES, BLOCK_TYPE_META,
  isFixedBlock, isLearningBlock,
  getBlockDurationMinutes, getSessionDurationMinutes,
} from "./types";

// Schedule Engine (pure calculation)
export {
  findFreeSlots,
  computePlanVsReality,
  buildScheduleDay,
  buildScheduleWeek,
  computeModuleScheduleStats,
  detectSessionAlignment,
  detectConflicts,
  computeStudyHeatmap,
  expandRecurringBlocks,
  computeDailyBudget,
} from "./engine";

export type {
  PlanVsReality,
  ScheduleConflict,
  DailyBudget,
  HourHeat,
} from "./engine";

// Timer Engine (state machine)
export {
  timerReducer,
  INITIAL_TIMER_STATE,
  formatTimerDisplay,
  formatCountdown,
  getTimerProgress,
  analyzeTimerSessions,
  getNextPomodoroPhase,
} from "./timer-engine";

export type {
  TimerState,
  TimerAction,
  TimerSideEffect,
  SessionSummary,
} from "./timer-engine";

// Decision Engine Bridge
export { bridgeDecisionToSchedule } from "./decision-bridge";

// Pattern Analyzer (Phase 7)
export {
  analyzeStudyPatterns,
  generatePatternInsights,
  scoreSlotForTask,
} from "./pattern-analyzer";

export type {
  StudyPatterns,
  PatternInsight,
  HourPattern,
  DayPattern,
  ModulePattern,
  AdherenceTrend,
  EnergyCurve,
} from "./pattern-analyzer";

// Adaptive Rescheduler (Phase 7)
export {
  generateRescheduleProposals,
  detectBlocksNeedingReschedule,
  optimizeDaySchedule,
} from "./rescheduler";

export type {
  RescheduleProposal,
  RescheduleResult,
  RescheduleOptions,
  RescheduleTrigger,
  RescheduleResolution,
} from "./rescheduler";

// Weekly Review (Phase 7)
export { generateWeeklyReview } from "./weekly-review";

export type {
  WeeklyReview,
  WeeklyMetrics,
  ModuleWeekStats,
  WeekComparison,
  ReviewInsight,
  Recommendation,
  WeeklyGoal,
  WeeklyHighlight,
} from "./weekly-review";
