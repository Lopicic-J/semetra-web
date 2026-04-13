/**
 * Cortex Engine — Type Definitions
 *
 * The Cortex is Semetra's central orchestration layer.
 * It monitors all engines, ensures data consistency,
 * and generates cross-engine intelligence.
 */

// ─── Engine Health ─────────────────────────────────────────────────

export type EngineStatus = "healthy" | "stale" | "degraded" | "critical";
export type OverallHealth = "healthy" | "degraded" | "critical";

export interface EngineHealth {
  name: string;
  status: EngineStatus;
  lastComputed: string | null;
  staleSince: string | null;
  dataAgeSeconds: number;         // Seconds since last computation
  maxAgeSeconds: number;          // Threshold before considered stale
  issues: string[];
  metrics: Record<string, number>; // Engine-specific metrics
}

export type EngineName =
  | "decision"
  | "schedule"
  | "academic"
  | "dna"
  | "streaks"
  | "patterns";

// ─── Integrity ─────────────────────────────────────────────────────

export type IssueSeverity = "info" | "warning" | "error" | "critical";

export interface IntegrityIssue {
  code: string;
  severity: IssueSeverity;
  engine: EngineName | "cross-engine";
  message: string;
  detail?: Record<string, unknown>;
  autoRepairable: boolean;
  repaired: boolean;
  repairedAt?: string;
}

export interface IntegrityReport {
  checksRun: number;
  issuesFound: number;
  autoRepaired: number;
  issues: IntegrityIssue[];
  duration: number; // ms
}

// ─── Cortex Actions ────────────────────────────────────────────────

export type CortexActionType =
  | "recompute_dna"
  | "sync_grades"
  | "abandon_orphan_session"
  | "refresh_patterns"
  | "nudge_streak_risk"
  | "nudge_overdue_tasks"
  | "nudge_stale_review"
  | "resolve_schedule_conflict"
  | "log_integrity_issue";

export interface CortexAction {
  id: string;
  type: CortexActionType;
  engine: EngineName | "cross-engine";
  description: string;
  autoExecuted: boolean;
  executedAt: string | null;
  result: Record<string, unknown>;
}

// ─── Cortex State ──────────────────────────────────────────────────

export interface CortexState {
  userId: string;
  timestamp: string;
  overallHealth: OverallHealth;
  engines: Record<EngineName, EngineHealth>;
  integrity: IntegrityReport;
  actions: CortexAction[];
  cycleNumber: number;
  cycleDuration: number; // ms
}

// ─── Cortex Config ─────────────────────────────────────────────────

export interface CortexConfig {
  /** Max age in seconds before an engine is considered stale */
  staleness: Record<EngineName, number>;
  /** Whether to auto-repair issues */
  autoRepair: boolean;
  /** Maximum actions per cycle */
  maxActionsPerCycle: number;
}

// ─── Cross-Engine Insights (C2) ───────────────────────────────────

export type InsightType =
  | "planning_execution_gap"
  | "burnout_risk"
  | "exam_underprep"
  | "module_neglect"
  | "grade_trajectory_alert"
  | "optimal_time_unused"
  | "streak_momentum"
  | "knowledge_decay"
  | "schedule_overload"
  | "quick_win_available";

export type InsightSeverity = "info" | "attention" | "warning" | "critical";

export interface Evidence {
  engine: EngineName | "cross-engine";
  metric: string;
  value: number | string;
  context?: string;
}

export interface CrossEngineInsight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  evidence: Evidence[];
  suggestion: string;
  actionHref?: string;
  engines: EngineName[];
  createdAt: string;
  expiresAt: string;
  dismissed: boolean;
}

// ─── Proactive Actions (C2) ──────────────────────────────────────

export type ProactiveActionType =
  | "create_study_block"
  | "reschedule_block"
  | "trigger_flashcard_review"
  | "adjust_study_target"
  | "recompute_dna"
  | "sync_grades"
  | "send_nudge"
  | "suggest_break"
  | "prioritize_module"
  | "generate_exam_plan";

export interface ProactiveAction {
  id: string;
  type: ProactiveActionType;
  priority: number;           // 0-100
  title: string;
  description: string;
  autoExecutable: boolean;
  executeFn?: string;          // API endpoint
  payload?: Record<string, unknown>;
  expiresAt: string;
  sourceInsight: string;       // Reference to insight ID
}

// ─── Extended Cortex State (C2) ──────────────────────────────────

export interface CortexStateV2 extends CortexState {
  insights: CrossEngineInsight[];
  proactiveActions: ProactiveAction[];
}

export const DEFAULT_CORTEX_CONFIG: CortexConfig = {
  staleness: {
    decision:  300,     // 5 min — cached, refreshes often
    schedule:  600,     // 10 min
    academic:  86400,   // 24h — grades change rarely
    dna:       604800,  // 7 days
    streaks:   3600,    // 1h
    patterns:  259200,  // 3 days
  },
  autoRepair: true,
  maxActionsPerCycle: 10,
};
