// ── Schedule Engine ──────────────────────────────────────────────────────────
// Pure calculation functions for the Unified Time System.
// No side effects, no API calls — only transforms data into schedule intelligence.
//
// Connects:
//   Decision Engine (priorities) → Schedule Engine (time allocation) → Timer Engine (tracking)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ScheduleBlock, TimerSession, SchedulePreferences, FreeSlot,
  ScheduleDay, ScheduleWeek, DailyStats, ModuleBreakdown,
  ModuleScheduleStats, BlockType, BlockLayer, BlockStatus,
  SessionAlignment,
} from "./types";
import {
  DEFAULT_PREFERENCES, BLOCK_TYPE_META, getBlockDurationMinutes,
  getSessionDurationMinutes, isLearningBlock,
} from "./types";

// ── Constants ───────────────────────────────────────────────────────────────

const HOUR_MS = 3600000;
const MINUTE_MS = 60000;
const DAY_MS = 86400000;

/** Maximum study minutes per day (hard ceiling) */
const MAX_DAILY_STUDY_MINUTES = 480; // 8 hours absolute max

/** Minimum break between back-to-back study blocks */
const MIN_BREAK_BETWEEN_BLOCKS = 5; // minutes

/** Buffer before/after fixed events */
const FIXED_EVENT_BUFFER = 5; // minutes

// ── 1. Free Slot Detection ──────────────────────────────────────────────────

/**
 * Find all free time slots on a given date, respecting:
 * - User's wake/sleep times
 * - Existing Layer 1 & 2 blocks
 * - Active timer sessions
 * - Minimum slot duration
 */
export function findFreeSlots(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  preferences: SchedulePreferences,
  date: string, // YYYY-MM-DD
  minDurationMinutes: number = 15,
): FreeSlot[] {
  const prefs = preferences || DEFAULT_PREFERENCES;
  // Use available_from/until if set, otherwise fall back to wake/sleep
  const availFrom = prefs.available_from || prefs.wake_time;
  const availUntil = prefs.available_until || prefs.sleep_time;
  const dayStart = parseDateWithTime(date, availFrom);
  const dayEnd = parseDateWithTime(date, availUntil);

  // Collect all occupied intervals
  const occupied: Array<{ start: number; end: number }> = [];

  // Layer 1 & 2 blocks (not skipped/rescheduled)
  for (const block of blocks) {
    if (block.status === "skipped" || block.status === "rescheduled") continue;
    const blockDate = block.start_time.slice(0, 10);
    if (blockDate !== date) continue;

    const start = new Date(block.start_time).getTime();
    const end = new Date(block.end_time).getTime();

    // Add buffer around fixed events
    if (block.layer === 1) {
      occupied.push({
        start: start - FIXED_EVENT_BUFFER * MINUTE_MS,
        end: end + FIXED_EVENT_BUFFER * MINUTE_MS,
      });
    } else {
      occupied.push({ start, end });
    }
  }

  // Active/completed timer sessions (avoid double-booking)
  for (const session of sessions) {
    if (session.status === "abandoned") continue;
    const sessionDate = session.started_at.slice(0, 10);
    if (sessionDate !== date) continue;

    const start = new Date(session.started_at).getTime();
    const end = session.ended_at
      ? new Date(session.ended_at).getTime()
      : Date.now();
    occupied.push({ start, end });
  }

  // Sort by start time
  occupied.sort((a, b) => a.start - b.start);

  // Merge overlapping intervals
  const merged = mergeIntervals(occupied);

  // Find gaps
  const slots: FreeSlot[] = [];
  let cursor = dayStart;

  for (const interval of merged) {
    if (interval.start > cursor) {
      const gapMinutes = Math.floor((interval.start - cursor) / MINUTE_MS);
      if (gapMinutes >= minDurationMinutes) {
        slots.push({
          slot_start: new Date(cursor).toISOString(),
          slot_end: new Date(interval.start).toISOString(),
          duration_minutes: gapMinutes,
        });
      }
    }
    cursor = Math.max(cursor, interval.end);
  }

  // Final gap until sleep
  if (dayEnd > cursor) {
    const gapMinutes = Math.floor((dayEnd - cursor) / MINUTE_MS);
    if (gapMinutes >= minDurationMinutes) {
      slots.push({
        slot_start: new Date(cursor).toISOString(),
        slot_end: new Date(dayEnd).toISOString(),
        duration_minutes: gapMinutes,
      });
    }
  }

  return slots;
}


// ── 2. Plan vs. Reality Analysis ────────────────────────────────────────────

export interface PlanVsReality {
  blockId: string;
  blockTitle: string;
  blockType: BlockType;
  moduleId: string | null;
  moduleName: string | null;
  plannedStart: string;
  plannedEnd: string;
  plannedMinutes: number;
  actualSessions: Array<{
    sessionId: string;
    start: string;
    end: string;
    effectiveMinutes: number;
    alignment: SessionAlignment;
  }>;
  totalActualMinutes: number;
  totalEffectiveMinutes: number;
  adherencePercent: number;  // 0-100+
  status: "not_started" | "partial" | "completed" | "exceeded" | "skipped";
}

/**
 * Compute plan vs. reality for all Layer 2 blocks on a given day.
 * Matches timer sessions to their planned blocks.
 */
export function computePlanVsReality(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  date: string,
): PlanVsReality[] {
  const dayBlocks = blocks.filter(b =>
    b.layer === 2 &&
    b.start_time.slice(0, 10) === date &&
    b.status !== "rescheduled"
  );

  const daySessions = sessions.filter(s =>
    s.started_at.slice(0, 10) === date &&
    s.status === "completed"
  );

  return dayBlocks.map(block => {
    const blockStart = new Date(block.start_time).getTime();
    const blockEnd = new Date(block.end_time).getTime();
    const plannedMinutes = Math.round((blockEnd - blockStart) / MINUTE_MS);

    // Find matching sessions
    const matchingSessions = daySessions.filter(s => {
      // Direct link
      if (s.schedule_block_id === block.id) return true;
      // Time overlap with same module
      if (s.module_id === block.module_id && block.module_id) {
        const sStart = new Date(s.started_at).getTime();
        const sEnd = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
        return hasOverlap(blockStart, blockEnd, sStart, sEnd);
      }
      return false;
    });

    const actualSessions = matchingSessions.map(s => {
      const sStart = new Date(s.started_at).getTime();
      const sEnd = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();

      // Determine alignment
      let alignment: SessionAlignment = s.alignment || "unplanned";
      if (s.schedule_block_id === block.id) {
        alignment = "within_plan";
      } else if (hasOverlap(blockStart, blockEnd, sStart, sEnd)) {
        alignment = "partial_overlap";
      }

      return {
        sessionId: s.id,
        start: s.started_at,
        end: s.ended_at || new Date().toISOString(),
        effectiveMinutes: getSessionDurationMinutes(s),
        alignment,
      };
    });

    const totalActualMinutes = actualSessions.reduce((sum, s) => sum + s.effectiveMinutes, 0);
    const totalEffectiveMinutes = matchingSessions.reduce((sum, s) =>
      sum + (s.effective_seconds ? Math.round(s.effective_seconds / 60) : getSessionDurationMinutes(s)), 0);

    const adherence = plannedMinutes > 0
      ? Math.round((totalEffectiveMinutes / plannedMinutes) * 100)
      : (totalEffectiveMinutes > 0 ? 100 : 0);

    let status: PlanVsReality["status"];
    if (block.status === "skipped") status = "skipped";
    else if (adherence >= 110) status = "exceeded";
    else if (adherence >= 80) status = "completed";
    else if (adherence > 0) status = "partial";
    else status = "not_started";

    return {
      blockId: block.id,
      blockTitle: block.title,
      blockType: block.block_type,
      moduleId: block.module_id,
      moduleName: block.module?.name || null,
      plannedStart: block.start_time,
      plannedEnd: block.end_time,
      plannedMinutes,
      actualSessions,
      totalActualMinutes,
      totalEffectiveMinutes,
      adherencePercent: adherence,
      status,
    };
  });
}


// ── 3. Build Schedule Day ───────────────────────────────────────────────────

/**
 * Assemble a complete ScheduleDay with all layers, free slots, and stats.
 */
export function buildScheduleDay(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  preferences: SchedulePreferences,
  date: string,
  existingStats?: DailyStats | null,
): ScheduleDay {
  const dayBlocks = blocks.filter(b => b.start_time.slice(0, 10) === date);
  const daySessions = sessions.filter(s => s.started_at.slice(0, 10) === date);
  const freeSlots = findFreeSlots(blocks, sessions, preferences, date, preferences.min_study_block_minutes);

  // Compute stats if not provided
  const stats = existingStats || computeDayStats(dayBlocks, daySessions, date);

  return { date, blocks: dayBlocks, sessions: daySessions, freeSlots, stats };
}


// ── 4. Build Schedule Week ──────────────────────────────────────────────────

/**
 * Assemble a complete ScheduleWeek with aggregated stats.
 */
export function buildScheduleWeek(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  preferences: SchedulePreferences,
  weekStartDate: string, // YYYY-MM-DD (Monday)
): ScheduleWeek {
  const days: ScheduleDay[] = [];
  let totalPlanned = 0;
  let totalActual = 0;
  let totalEffective = 0;
  const moduleMap = new Map<string, { name: string; planned: number; actual: number }>();
  let bestDay: { date: string; minutes: number } | null = null;
  let streak = 0;

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStartDate, i);
    const day = buildScheduleDay(blocks, sessions, preferences, date);
    days.push(day);

    if (day.stats) {
      totalPlanned += day.stats.planned_minutes;
      totalActual += day.stats.actual_minutes;
      totalEffective += day.stats.effective_minutes;

      if (!bestDay || day.stats.effective_minutes > bestDay.minutes) {
        bestDay = { date, minutes: day.stats.effective_minutes };
      }

      if (day.stats.actual_minutes > 0) {
        streak++;
      } else if (i <= todayIndex(weekStartDate)) {
        streak = 0; // Reset streak for past days with no study
      }

      // Aggregate module breakdown
      for (const mb of day.stats.module_breakdown) {
        const existing = moduleMap.get(mb.moduleId);
        if (existing) {
          existing.planned += mb.plannedMin;
          existing.actual += mb.actualMin;
        } else {
          moduleMap.set(mb.moduleId, { name: mb.moduleName, planned: mb.plannedMin, actual: mb.actualMin });
        }
      }
    }
  }

  const endDate = addDays(weekStartDate, 6);
  const overallAdherence = totalPlanned > 0
    ? Math.round((totalEffective / totalPlanned) * 100)
    : (totalEffective > 0 ? 100 : 0);

  const moduleBreakdown: ModuleBreakdown[] = Array.from(moduleMap.entries()).map(([id, data]) => ({
    moduleId: id,
    moduleName: data.name,
    plannedMin: data.planned,
    actualMin: data.actual,
  }));

  return {
    startDate: weekStartDate,
    endDate,
    days,
    weekStats: {
      totalPlannedMinutes: totalPlanned,
      totalActualMinutes: totalActual,
      totalEffectiveMinutes: totalEffective,
      overallAdherence,
      moduleBreakdown,
      mostProductiveDay: bestDay?.date || null,
      studyStreak: streak,
    },
  };
}


// ── 5. Module Schedule Stats ────────────────────────────────────────────────

/**
 * Calculate per-module schedule statistics for the module view.
 */
export function computeModuleScheduleStats(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  modules: Array<{ id: string; name: string; color: string; exam_date: string | null }>,
  weekStartDate: string,
): ModuleScheduleStats[] {
  const weekEnd = addDays(weekStartDate, 7);

  return modules.map(mod => {
    // This week's planned blocks
    const weekBlocks = blocks.filter(b =>
      b.module_id === mod.id &&
      b.layer === 2 &&
      b.start_time >= weekStartDate &&
      b.start_time < weekEnd &&
      b.status !== "rescheduled"
    );

    const plannedThisWeek = weekBlocks.reduce((sum, b) => sum + getBlockDurationMinutes(b), 0);

    // This week's actual sessions
    const weekSessions = sessions.filter(s =>
      s.module_id === mod.id &&
      s.started_at >= weekStartDate &&
      s.started_at < weekEnd &&
      s.status === "completed"
    );

    const actualThisWeek = weekSessions.reduce((sum, s) => sum + getSessionDurationMinutes(s), 0);

    // Last studied
    const allModuleSessions = sessions
      .filter(s => s.module_id === mod.id && s.status === "completed")
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    const lastStudied = allModuleSessions[0]?.started_at?.slice(0, 10) || null;

    // Exam
    const nextExam = mod.exam_date;
    const daysUntilExam = nextExam
      ? Math.ceil((new Date(nextExam).getTime() - Date.now()) / DAY_MS)
      : null;

    // Deficit
    const deficit = plannedThisWeek - actualThisWeek;

    // Trend (compare last 2 weeks)
    const prevWeekStart = addDays(weekStartDate, -7);
    const prevWeekSessions = sessions.filter(s =>
      s.module_id === mod.id &&
      s.started_at >= prevWeekStart &&
      s.started_at < weekStartDate &&
      s.status === "completed"
    );
    const prevWeekMinutes = prevWeekSessions.reduce((sum, s) => sum + getSessionDurationMinutes(s), 0);

    let trend: ModuleScheduleStats["trend"] = "stable";
    if (actualThisWeek > prevWeekMinutes * 1.2) trend = "improving";
    else if (actualThisWeek < prevWeekMinutes * 0.8) trend = "declining";

    return {
      moduleId: mod.id,
      moduleName: mod.name,
      moduleColor: mod.color,
      plannedThisWeek,
      actualThisWeek,
      lastStudied,
      nextExam,
      daysUntilExam,
      deficit,
      trend,
    };
  });
}


// ── 6. Session Alignment Detection ──────────────────────────────────────────

/**
 * Determine how a timer session aligns with planned blocks.
 * Called when a session is completed to classify it.
 */
export function detectSessionAlignment(
  session: TimerSession,
  blocks: ScheduleBlock[],
): { alignment: SessionAlignment; matchedBlockId: string | null } {
  // Direct link already set
  if (session.schedule_block_id) {
    return { alignment: "within_plan", matchedBlockId: session.schedule_block_id };
  }

  const sStart = new Date(session.started_at).getTime();
  const sEnd = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();

  // Find overlapping Layer 2 blocks
  const candidates = blocks.filter(b => {
    if (b.layer !== 2) return false;
    if (b.status === "skipped" || b.status === "rescheduled") return false;
    const bStart = new Date(b.start_time).getTime();
    const bEnd = new Date(b.end_time).getTime();
    return hasOverlap(sStart, sEnd, bStart, bEnd);
  });

  if (candidates.length === 0) {
    return { alignment: "unplanned", matchedBlockId: null };
  }

  // Find best match (most overlap + same module)
  let bestMatch = candidates[0];
  let bestScore = 0;

  for (const block of candidates) {
    const bStart = new Date(block.start_time).getTime();
    const bEnd = new Date(block.end_time).getTime();
    const overlapStart = Math.max(sStart, bStart);
    const overlapEnd = Math.min(sEnd, bEnd);
    let score = (overlapEnd - overlapStart) / MINUTE_MS;

    // Bonus for matching module
    if (block.module_id && block.module_id === session.module_id) {
      score += 100;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = block;
    }
  }

  // Check if fully within the block
  const bStart = new Date(bestMatch.start_time).getTime();
  const bEnd = new Date(bestMatch.end_time).getTime();
  const fullyWithin = sStart >= bStart - 5 * MINUTE_MS && sEnd <= bEnd + 5 * MINUTE_MS;

  return {
    alignment: fullyWithin ? "within_plan" : "partial_overlap",
    matchedBlockId: bestMatch.id,
  };
}


// ── 7. Conflict Detection ───────────────────────────────────────────────────

export interface ScheduleConflict {
  blockA: ScheduleBlock;
  blockB: ScheduleBlock;
  overlapMinutes: number;
  severity: "warning" | "error"; // warning = soft overlap, error = hard conflict
}

/**
 * Detect overlapping blocks in a schedule.
 */
export function detectConflicts(blocks: ScheduleBlock[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const active = blocks
    .filter(b => b.status !== "skipped" && b.status !== "rescheduled")
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];

      const aStart = new Date(a.start_time).getTime();
      const aEnd = new Date(a.end_time).getTime();
      const bStart = new Date(b.start_time).getTime();
      const bEnd = new Date(b.end_time).getTime();

      if (bStart >= aEnd) break; // Sorted, no more overlaps possible

      if (hasOverlap(aStart, aEnd, bStart, bEnd)) {
        const overlapStart = Math.max(aStart, bStart);
        const overlapEnd = Math.min(aEnd, bEnd);
        const overlapMinutes = Math.round((overlapEnd - overlapStart) / MINUTE_MS);

        // Both Layer 1 = error, mixed = warning
        const severity = a.layer === 1 && b.layer === 1 ? "error" : "warning";

        conflicts.push({ blockA: a, blockB: b, overlapMinutes, severity });
      }
    }
  }

  return conflicts;
}


// ── 8. Schedule Density / Heatmap ───────────────────────────────────────────

export interface HourHeat {
  hour: number;      // 0-23
  intensity: number; // 0.0 - 1.0 (normalized study density)
  minutes: number;   // Actual study minutes in this hour
}

/**
 * Calculate study intensity per hour for heatmap visualization.
 * Uses completed timer sessions over a given date range.
 */
export function computeStudyHeatmap(
  sessions: TimerSession[],
  startDate: string,
  endDate: string,
): HourHeat[] {
  const hourMinutes = new Array(24).fill(0);
  const dayCount = Math.max(1, daysBetween(startDate, endDate));

  const completed = sessions.filter(s =>
    s.status === "completed" &&
    s.started_at >= startDate &&
    s.started_at <= endDate
  );

  for (const session of completed) {
    const start = new Date(session.started_at);
    const durationMin = getSessionDurationMinutes(session);
    const startHour = start.getHours();
    const startMinute = start.getMinutes();

    // Distribute minutes across hours
    let remaining = durationMin;
    let currentHour = startHour;
    let minutesInCurrentHour = 60 - startMinute;

    while (remaining > 0 && currentHour < 24) {
      const chunk = Math.min(remaining, minutesInCurrentHour);
      hourMinutes[currentHour] += chunk;
      remaining -= chunk;
      currentHour++;
      minutesInCurrentHour = 60;
    }
  }

  // Average per day
  const avgMinutes = hourMinutes.map(m => m / dayCount);
  const maxMinutes = Math.max(...avgMinutes, 1);

  return avgMinutes.map((minutes, hour) => ({
    hour,
    intensity: minutes / maxMinutes,
    minutes: Math.round(minutes),
  }));
}


// ── 9. Recurring Block Expansion ────────────────────────────────────────────

/**
 * Expand recurring blocks into individual occurrences for a date range.
 * This allows the schedule to display weekly lectures etc.
 */
export function expandRecurringBlocks(
  blocks: ScheduleBlock[],
  startDate: string,
  endDate: string,
): ScheduleBlock[] {
  const result: ScheduleBlock[] = [];
  const rangeStart = new Date(startDate).getTime();
  const rangeEnd = new Date(endDate + "T23:59:59Z").getTime();

  for (const block of blocks) {
    if (!block.recurrence) {
      // Non-recurring: include if in range
      const bStart = new Date(block.start_time).getTime();
      if (bStart >= rangeStart && bStart <= rangeEnd) {
        result.push(block);
      }
      continue;
    }

    // Determine recurrence interval
    let intervalDays: number;
    switch (block.recurrence) {
      case "daily": intervalDays = 1; break;
      case "weekly": intervalDays = 7; break;
      case "biweekly": intervalDays = 14; break;
      case "monthly": intervalDays = 30; break; // Approximate
      default: continue;
    }

    const blockStart = new Date(block.start_time).getTime();
    const blockEnd = new Date(block.end_time).getTime();
    const duration = blockEnd - blockStart;
    const recurrenceEnd = block.recurrence_end
      ? new Date(block.recurrence_end + "T23:59:59Z").getTime()
      : rangeEnd;

    let cursor = blockStart;
    while (cursor <= Math.min(rangeEnd, recurrenceEnd)) {
      if (cursor >= rangeStart) {
        result.push({
          ...block,
          id: `${block.id}_${new Date(cursor).toISOString().slice(0, 10)}`,
          start_time: new Date(cursor).toISOString(),
          end_time: new Date(cursor + duration).toISOString(),
        });
      }
      cursor += intervalDays * DAY_MS;
    }
  }

  return result;
}


// ── 10. Study Time Budget ───────────────────────────────────────────────────

export interface DailyBudget {
  date: string;
  maxMinutes: number;
  plannedMinutes: number;
  actualMinutes: number;
  remainingMinutes: number;
  isWeekend: boolean;
  overBudget: boolean;
}

/**
 * Calculate remaining study budget for a day.
 */
export function computeDailyBudget(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  preferences: SchedulePreferences,
  date: string,
): DailyBudget {
  const dayOfWeek = new Date(date).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const maxMinutes = isWeekend
    ? Math.min(preferences.weekend_max_minutes, preferences.max_daily_study_minutes)
    : preferences.max_daily_study_minutes;

  const plannedMinutes = blocks
    .filter(b => b.start_time.slice(0, 10) === date && b.layer === 2 && isLearningBlock(b.block_type) && b.status !== "skipped")
    .reduce((sum, b) => sum + getBlockDurationMinutes(b), 0);

  const actualMinutes = sessions
    .filter(s => s.started_at.slice(0, 10) === date && s.status === "completed")
    .reduce((sum, s) => sum + getSessionDurationMinutes(s), 0);

  const remaining = Math.max(0, maxMinutes - Math.max(plannedMinutes, actualMinutes));

  return {
    date,
    maxMinutes,
    plannedMinutes,
    actualMinutes,
    remainingMinutes: remaining,
    isWeekend,
    overBudget: actualMinutes > maxMinutes,
  };
}


// ── 11. Compute Day Stats (client-side fallback) ────────────────────────────

function computeDayStats(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  date: string,
): DailyStats {
  const dayBlocks = blocks.filter(b => b.start_time.slice(0, 10) === date);
  const daySessions = sessions.filter(s => s.started_at.slice(0, 10) === date && s.status === "completed");
  const layer2 = dayBlocks.filter(b => b.layer === 2);

  const planned_blocks = layer2.length;
  const planned_minutes = layer2.reduce((sum, b) => sum + (b.estimated_minutes || getBlockDurationMinutes(b)), 0);

  const completed_sessions = daySessions.length;
  const actual_minutes = daySessions.reduce((sum, s) =>
    sum + (s.actual_duration_seconds ? Math.round(s.actual_duration_seconds / 60) : getSessionDurationMinutes(s)), 0);
  const effective_minutes = daySessions.reduce((sum, s) =>
    sum + (s.effective_seconds ? Math.round(s.effective_seconds / 60) : getSessionDurationMinutes(s)), 0);

  const blocks_completed = layer2.filter(b => b.status === "completed").length;
  const blocks_skipped = layer2.filter(b => b.status === "skipped").length;
  const blocks_rescheduled = layer2.filter(b => b.status === "rescheduled").length;

  const adherence_percent = planned_blocks > 0
    ? Math.min(100, Math.round((blocks_completed / planned_blocks) * 100))
    : (completed_sessions > 0 ? 100 : 0);

  // Module breakdown
  const moduleMap = new Map<string, { name: string; planned: number; actual: number }>();
  for (const block of layer2) {
    if (!block.module_id) continue;
    const existing = moduleMap.get(block.module_id);
    const mins = block.estimated_minutes || getBlockDurationMinutes(block);
    if (existing) {
      existing.planned += mins;
    } else {
      moduleMap.set(block.module_id, { name: block.module?.name || "Unknown", planned: mins, actual: 0 });
    }
  }
  for (const session of daySessions) {
    if (!session.module_id) continue;
    const existing = moduleMap.get(session.module_id);
    const mins = getSessionDurationMinutes(session);
    if (existing) {
      existing.actual += mins;
    } else {
      moduleMap.set(session.module_id, { name: session.module?.name || "Unknown", planned: 0, actual: mins });
    }
  }

  const module_breakdown: ModuleBreakdown[] = Array.from(moduleMap.entries()).map(([id, data]) => ({
    moduleId: id,
    moduleName: data.name,
    plannedMin: data.planned,
    actualMin: data.actual,
  }));

  // Most productive hour
  const hourMinutes = new Array(24).fill(0);
  for (const session of daySessions) {
    const hour = new Date(session.started_at).getHours();
    hourMinutes[hour] += getSessionDurationMinutes(session);
  }
  const maxHour = hourMinutes.indexOf(Math.max(...hourMinutes));
  const most_productive_hour = hourMinutes[maxHour] > 0 ? maxHour : null;

  const sessionDurations = daySessions.map(s => getSessionDurationMinutes(s));
  const avg_session_minutes = sessionDurations.length > 0
    ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length)
    : null;
  const longest_session_minutes = sessionDurations.length > 0
    ? Math.max(...sessionDurations)
    : null;

  return {
    user_id: "",
    date,
    planned_blocks,
    planned_minutes,
    completed_sessions,
    actual_minutes,
    effective_minutes,
    adherence_percent,
    blocks_completed,
    blocks_skipped,
    blocks_rescheduled,
    module_breakdown,
    most_productive_hour,
    avg_session_minutes,
    longest_session_minutes,
  };
}


// ── Utility Functions ───────────────────────────────────────────────────────

function parseDateWithTime(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime();
}

function mergeIntervals(intervals: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: typeof intervals = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push(sorted[i]);
    }
  }

  return merged;
}

function hasOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / DAY_MS);
}

function todayIndex(weekStartDate: string): number {
  const today = new Date().toISOString().slice(0, 10);
  return daysBetween(weekStartDate, today);
}
