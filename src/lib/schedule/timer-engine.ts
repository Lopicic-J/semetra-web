// ── Timer Engine ─────────────────────────────────────────────────────────────
// Enhanced timer logic that connects to the Schedule Engine.
// Manages session lifecycle, pause tracking, block association, and
// provides the data layer (Layer 3) for plan-vs-reality analysis.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  TimerSession, SessionType, SessionStatus, ScheduleBlock,
  SchedulePreferences,
} from "./types";
import { DEFAULT_PREFERENCES } from "./types";

// ── Timer State Machine ─────────────────────────────────────────────────────

export interface TimerState {
  /** Current session (null if no timer running) */
  session: TimerSession | null;

  /** Running or not */
  isRunning: boolean;
  isPaused: boolean;

  /** Elapsed seconds (updates every tick) */
  elapsedSeconds: number;

  /** Effective seconds (minus pauses) */
  effectiveSeconds: number;

  /** Current pause duration if paused */
  currentPauseStart: number | null; // timestamp ms

  /** Pomodoro tracking */
  pomodoroCount: number;
  pomodorosUntilLongBreak: number;

  /** Target duration (for countdown mode) */
  targetSeconds: number | null;

  /** Mode */
  mode: "countdown" | "stopwatch";

  /** Block this session is linked to */
  linkedBlock: ScheduleBlock | null;
}

export const INITIAL_TIMER_STATE: TimerState = {
  session: null,
  isRunning: false,
  isPaused: false,
  elapsedSeconds: 0,
  effectiveSeconds: 0,
  currentPauseStart: null,
  pomodoroCount: 0,
  pomodorosUntilLongBreak: 4,
  targetSeconds: null,
  mode: "countdown",
  linkedBlock: null,
};

// ── Timer Actions ───────────────────────────────────────────────────────────

export type TimerAction =
  | { type: "START"; sessionType: SessionType; targetMinutes?: number; block?: ScheduleBlock; moduleId?: string; taskId?: string; topicId?: string; examId?: string; energyLevel?: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP"; focusRating?: number; note?: string }
  | { type: "ABANDON" }
  | { type: "TICK" }
  | { type: "SET_MODE"; mode: "countdown" | "stopwatch" }
  | { type: "SET_TARGET"; minutes: number }
  | { type: "RESET_POMODORO" }
  | { type: "HYDRATE"; state: Partial<TimerState> };

// ── Timer Reducer (Pure) ────────────────────────────────────────────────────

/**
 * Pure reducer for timer state transitions.
 * Returns [newState, sideEffect?] — side effects are handled by the hook.
 */
export function timerReducer(
  state: TimerState,
  action: TimerAction,
  preferences: SchedulePreferences = DEFAULT_PREFERENCES,
): [TimerState, TimerSideEffect | null] {
  switch (action.type) {

    case "START": {
      if (state.isRunning) return [state, null]; // Already running

      const now = new Date();
      const targetMinutes = action.targetMinutes
        || (action.sessionType === "pomodoro" ? preferences.pomodoro_focus_minutes : null);

      const session: TimerSession = {
        id: crypto.randomUUID(),
        user_id: "",  // Set by hook
        session_type: action.sessionType,
        started_at: now.toISOString(),
        ended_at: null,
        planned_duration_minutes: targetMinutes || null,
        actual_duration_seconds: null,
        effective_seconds: null,
        pause_count: 0,
        total_pause_seconds: 0,
        module_id: action.moduleId || action.block?.module_id || null,
        task_id: action.taskId || action.block?.task_id || null,
        topic_id: action.topicId || action.block?.topic_id || null,
        exam_id: action.examId || action.block?.exam_id || null,
        schedule_block_id: action.block?.id || null,
        focus_rating: null,
        energy_level: action.energyLevel || null,
        note: null,
        alignment: action.block ? "within_plan" : "unplanned",
        status: "active",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      return [{
        ...state,
        session,
        isRunning: true,
        isPaused: false,
        elapsedSeconds: 0,
        effectiveSeconds: 0,
        currentPauseStart: null,
        targetSeconds: targetMinutes ? targetMinutes * 60 : null,
        mode: targetMinutes ? "countdown" : "stopwatch",
        linkedBlock: action.block || null,
      }, { type: "SESSION_CREATED", session }];
    }

    case "PAUSE": {
      if (!state.isRunning || state.isPaused) return [state, null];

      return [{
        ...state,
        isPaused: true,
        currentPauseStart: Date.now(),
      }, { type: "SESSION_PAUSED" }];
    }

    case "RESUME": {
      if (!state.isRunning || !state.isPaused) return [state, null];

      const pauseDuration = state.currentPauseStart
        ? Math.round((Date.now() - state.currentPauseStart) / 1000)
        : 0;

      const updatedSession = state.session ? {
        ...state.session,
        pause_count: state.session.pause_count + 1,
        total_pause_seconds: state.session.total_pause_seconds + pauseDuration,
        status: "active" as SessionStatus,
      } : null;

      return [{
        ...state,
        session: updatedSession,
        isPaused: false,
        currentPauseStart: null,
      }, { type: "SESSION_RESUMED" }];
    }

    case "STOP": {
      if (!state.session) return [state, null];

      const now = new Date();
      const actualDuration = state.elapsedSeconds;

      // Calculate final pause if currently paused
      let finalPauseSeconds = state.session.total_pause_seconds;
      if (state.isPaused && state.currentPauseStart) {
        finalPauseSeconds += Math.round((Date.now() - state.currentPauseStart) / 1000);
      }

      const effectiveDuration = Math.max(0, actualDuration - finalPauseSeconds);

      const completedSession: TimerSession = {
        ...state.session,
        ended_at: now.toISOString(),
        actual_duration_seconds: actualDuration,
        effective_seconds: effectiveDuration,
        total_pause_seconds: finalPauseSeconds,
        focus_rating: action.focusRating || null,
        note: action.note || state.session.note,
        status: "completed",
        updated_at: now.toISOString(),
      };

      const isPomodoro = state.session.session_type === "pomodoro";
      const newPomodoroCount = isPomodoro ? state.pomodoroCount + 1 : state.pomodoroCount;

      return [{
        ...INITIAL_TIMER_STATE,
        pomodoroCount: newPomodoroCount,
        pomodorosUntilLongBreak: isPomodoro
          ? (newPomodoroCount % preferences.pomodoro_sessions_before_long === 0 ? 0 : preferences.pomodoro_sessions_before_long - (newPomodoroCount % preferences.pomodoro_sessions_before_long))
          : state.pomodorosUntilLongBreak,
      }, {
        type: "SESSION_COMPLETED",
        session: completedSession,
        suggestBreak: isPomodoro,
        longBreak: isPomodoro && newPomodoroCount % preferences.pomodoro_sessions_before_long === 0,
      }];
    }

    case "ABANDON": {
      if (!state.session) return [state, null];

      const abandonedSession: TimerSession = {
        ...state.session,
        ended_at: new Date().toISOString(),
        actual_duration_seconds: state.elapsedSeconds,
        effective_seconds: Math.max(0, state.effectiveSeconds),
        status: "abandoned",
        updated_at: new Date().toISOString(),
      };

      return [INITIAL_TIMER_STATE, { type: "SESSION_ABANDONED", session: abandonedSession }];
    }

    case "TICK": {
      if (!state.isRunning || !state.session) return [state, null];

      const now = Date.now();
      const startTime = new Date(state.session.started_at).getTime();
      const totalElapsed = Math.floor((now - startTime) / 1000);

      // Calculate effective time (minus pauses including current)
      let totalPause = state.session.total_pause_seconds;
      if (state.isPaused && state.currentPauseStart) {
        totalPause += Math.round((now - state.currentPauseStart) / 1000);
      }
      const effective = Math.max(0, totalElapsed - totalPause);

      // Check if countdown reached target
      const targetReached = state.targetSeconds !== null && effective >= state.targetSeconds;

      if (targetReached) {
        return timerReducer(
          { ...state, elapsedSeconds: totalElapsed, effectiveSeconds: effective },
          { type: "STOP" },
          preferences,
        );
      }

      return [{
        ...state,
        elapsedSeconds: totalElapsed,
        effectiveSeconds: effective,
      }, null];
    }

    case "SET_MODE":
      return [{ ...state, mode: action.mode }, null];

    case "SET_TARGET":
      return [{ ...state, targetSeconds: action.minutes * 60 }, null];

    case "RESET_POMODORO":
      return [{ ...state, pomodoroCount: 0, pomodorosUntilLongBreak: preferences.pomodoro_sessions_before_long }, null];

    case "HYDRATE":
      return [{ ...state, ...action.state }, null];

    default:
      return [state, null];
  }
}

// ── Side Effects ────────────────────────────────────────────────────────────

export type TimerSideEffect =
  | { type: "SESSION_CREATED"; session: TimerSession }
  | { type: "SESSION_PAUSED" }
  | { type: "SESSION_RESUMED" }
  | { type: "SESSION_COMPLETED"; session: TimerSession; suggestBreak: boolean; longBreak: boolean }
  | { type: "SESSION_ABANDONED"; session: TimerSession };

// ── Formatting Helpers ──────────────────────────────────────────────────────

/**
 * Format seconds as HH:MM:SS or MM:SS
 */
export function formatTimerDisplay(seconds: number, showHours = false): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0 || showHours) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Format countdown display (remaining time)
 */
export function formatCountdown(targetSeconds: number, effectiveSeconds: number): string {
  const remaining = Math.max(0, targetSeconds - effectiveSeconds);
  return formatTimerDisplay(remaining);
}

/**
 * Get progress percentage (0-100) for countdown mode
 */
export function getTimerProgress(targetSeconds: number | null, effectiveSeconds: number): number {
  if (!targetSeconds || targetSeconds === 0) return 0;
  return Math.min(100, Math.round((effectiveSeconds / targetSeconds) * 100));
}

// ── Session Analysis ────────────────────────────────────────────────────────

export interface SessionSummary {
  totalSessions: number;
  totalMinutes: number;
  effectiveMinutes: number;
  avgFocusRating: number | null;
  avgEnergyLevel: number | null;
  avgSessionMinutes: number;
  longestSession: number;
  totalPauseMinutes: number;
  focusEfficiency: number;  // effective / total (0-1)
  pomodoroCount: number;
  byModule: Array<{ moduleId: string; moduleName: string; minutes: number; sessions: number }>;
  byHour: Array<{ hour: number; minutes: number }>;
  byType: Record<SessionType, number>;
}

/**
 * Analyze a collection of timer sessions for summary stats.
 */
export function analyzeTimerSessions(sessions: TimerSession[]): SessionSummary {
  const completed = sessions.filter(s => s.status === "completed");

  const totalMinutes = completed.reduce((sum, s) =>
    sum + (s.actual_duration_seconds ? s.actual_duration_seconds / 60 : 0), 0);
  const effectiveMinutes = completed.reduce((sum, s) =>
    sum + (s.effective_seconds ? s.effective_seconds / 60 : 0), 0);
  const totalPauseMinutes = completed.reduce((sum, s) =>
    sum + (s.total_pause_seconds || 0) / 60, 0);

  const focusRatings = completed.filter(s => s.focus_rating).map(s => s.focus_rating!);
  const energyLevels = completed.filter(s => s.energy_level).map(s => s.energy_level!);

  const sessionMinutes = completed.map(s => (s.effective_seconds || s.actual_duration_seconds || 0) / 60);

  // By module
  const moduleMap = new Map<string, { name: string; minutes: number; sessions: number }>();
  for (const s of completed) {
    if (!s.module_id) continue;
    const existing = moduleMap.get(s.module_id);
    const mins = (s.effective_seconds || s.actual_duration_seconds || 0) / 60;
    if (existing) {
      existing.minutes += mins;
      existing.sessions++;
    } else {
      moduleMap.set(s.module_id, { name: s.module?.name || "Unknown", minutes: mins, sessions: 1 });
    }
  }

  // By hour
  const hourMinutes = new Array(24).fill(0);
  for (const s of completed) {
    const hour = new Date(s.started_at).getHours();
    hourMinutes[hour] += (s.effective_seconds || s.actual_duration_seconds || 0) / 60;
  }

  // By type
  const byType: Record<string, number> = {};
  for (const s of completed) {
    byType[s.session_type] = (byType[s.session_type] || 0) + 1;
  }

  return {
    totalSessions: completed.length,
    totalMinutes: Math.round(totalMinutes),
    effectiveMinutes: Math.round(effectiveMinutes),
    avgFocusRating: focusRatings.length > 0 ? +(focusRatings.reduce((a, b) => a + b, 0) / focusRatings.length).toFixed(1) : null,
    avgEnergyLevel: energyLevels.length > 0 ? +(energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length).toFixed(1) : null,
    avgSessionMinutes: sessionMinutes.length > 0 ? Math.round(sessionMinutes.reduce((a, b) => a + b, 0) / sessionMinutes.length) : 0,
    longestSession: sessionMinutes.length > 0 ? Math.round(Math.max(...sessionMinutes)) : 0,
    totalPauseMinutes: Math.round(totalPauseMinutes),
    focusEfficiency: totalMinutes > 0 ? +(effectiveMinutes / totalMinutes).toFixed(2) : 0,
    pomodoroCount: completed.filter(s => s.session_type === "pomodoro").length,
    byModule: Array.from(moduleMap.entries()).map(([id, data]) => ({
      moduleId: id, moduleName: data.name, minutes: Math.round(data.minutes), sessions: data.sessions,
    })).sort((a, b) => b.minutes - a.minutes),
    byHour: hourMinutes.map((minutes, hour) => ({ hour, minutes: Math.round(minutes) })),
    byType: byType as Record<SessionType, number>,
  };
}

// ── Pomodoro Helpers ────────────────────────────────────────────────────────

/**
 * Determine the next pomodoro phase based on completed count.
 */
export function getNextPomodoroPhase(
  completedPomodoros: number,
  preferences: SchedulePreferences,
): { type: SessionType; minutes: number; label: string } {
  const beforeLong = preferences.pomodoro_sessions_before_long;

  if (completedPomodoros > 0 && completedPomodoros % beforeLong === 0) {
    return {
      type: "pomodoro",
      minutes: preferences.pomodoro_long_break,
      label: "long_break",
    };
  }

  if (completedPomodoros > 0) {
    return {
      type: "pomodoro",
      minutes: preferences.pomodoro_short_break,
      label: "short_break",
    };
  }

  return {
    type: "pomodoro",
    minutes: preferences.pomodoro_focus_minutes,
    label: "focus",
  };
}
