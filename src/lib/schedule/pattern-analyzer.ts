// ── Study Pattern Analyzer ───────────────────────────────────────────────────
// Learns from completed timer sessions to build a user behavior model.
// All pure functions — no side effects, no API calls.
//
// Feeds into:
//   - Decision Bridge (energy-aware slot scoring)
//   - Rescheduler (predicts likely completion)
//   - Weekly Review (trend detection, insights)
// ─────────────────────────────────────────────────────────────────────────────

import type { TimerSession, ScheduleBlock, SchedulePreferences } from "./types";
import { getSessionDurationMinutes, getBlockDurationMinutes } from "./types";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HourPattern {
  hour: number;       // 0-23
  score: number;      // 0-1 (composite of focus, energy, productivity)
  avgFocus: number;   // 1-5
  avgEnergy: number;  // 1-5
  sessions: number;
  avgMinutes: number;
}

export interface DayPattern {
  day: number;             // 0=Sunday, 6=Saturday
  avgMinutes: number;
  avgSessions: number;
  adherence: number;       // 0-1
  activeDays: number;      // How many times this day had study
  totalDays: number;       // How many of this day existed in period
}

export interface ModulePattern {
  moduleId: string;
  moduleName: string;
  avgDuration: number;     // minutes
  bestHour: number;        // 0-23
  avgFocus: number;
  totalSessions: number;
  totalMinutes: number;
  weeklyTarget: number;    // Suggested weekly minutes based on history
}

export interface AdherenceTrend {
  week: string;            // "2026-W14"
  planned: number;         // minutes
  actual: number;
  adherence: number;       // 0-1
}

export interface EnergyCurve {
  morning: number;         // avg energy 6-12
  afternoon: number;       // avg energy 12-18
  evening: number;         // avg energy 18-24
}

export interface StudyPatterns {
  // Time patterns
  bestHours: HourPattern[];
  worstHours: HourPattern[];
  allHours: HourPattern[];

  // Day patterns
  dayPatterns: DayPattern[];

  // Module patterns
  modulePatterns: ModulePattern[];

  // Duration patterns
  avgSessionMinutes: number;
  preferredDurationMinutes: number;
  longestProductiveSession: number;

  // Consistency
  currentStreakDays: number;
  longestStreakDays: number;
  avgWeeklyStudyMinutes: number;
  consistencyScore: number;

  // Adherence
  adherenceTrend: AdherenceTrend[];
  avgStartDelayMinutes: number;
  skipRate: number;

  // Energy
  energyCurve: EnergyCurve;

  // Meta
  totalSessionsAnalyzed: number;
  dataQuality: "insufficient" | "emerging" | "reliable" | "strong";
}

export interface PatternInsight {
  type: "peak_hours" | "weak_hours" | "duration_sweet_spot" | "consistency"
    | "module_affinity" | "day_preference" | "energy_mismatch" | "procrastination"
    | "streak" | "improvement" | "decline";
  severity: "info" | "positive" | "warning" | "critical";
  titleKey: string;        // i18n key
  descriptionKey: string;  // i18n key
  data: Record<string, any>;
}


// ── Core Analysis ─────────────────────────────────────────────────────────────

/**
 * Analyze all completed sessions to build a comprehensive study pattern profile.
 */
export function analyzeStudyPatterns(
  sessions: TimerSession[],
  blocks: ScheduleBlock[],
  dateRange: { start: string; end: string },
): StudyPatterns {
  const completed = sessions.filter(s =>
    s.status === "completed" &&
    s.started_at >= dateRange.start &&
    s.started_at <= dateRange.end
  );

  const totalDays = Math.max(1, daysBetween(dateRange.start, dateRange.end));

  return {
    ...analyzeHourPatterns(completed),
    dayPatterns: analyzeDayPatterns(completed, totalDays),
    modulePatterns: analyzeModulePatterns(completed),
    ...analyzeDurationPatterns(completed),
    ...analyzeConsistency(completed, dateRange),
    adherenceTrend: analyzeAdherenceTrend(blocks, completed, dateRange),
    ...analyzeProcrastination(blocks, completed),
    energyCurve: analyzeEnergyCurve(completed),
    totalSessionsAnalyzed: completed.length,
    dataQuality: getDataQuality(completed.length, totalDays),
  };
}


// ── Hour Patterns ─────────────────────────────────────────────────────────────

function analyzeHourPatterns(sessions: TimerSession[]): {
  bestHours: HourPattern[];
  worstHours: HourPattern[];
  allHours: HourPattern[];
} {
  const hourBuckets = new Array(24).fill(null).map(() => ({
    totalFocus: 0, totalEnergy: 0, totalMinutes: 0, count: 0,
  }));

  for (const s of sessions) {
    const hour = new Date(s.started_at).getHours();
    const mins = getSessionDurationMinutes(s);
    hourBuckets[hour].totalFocus += s.focus_rating ?? 3;
    hourBuckets[hour].totalEnergy += s.energy_level ?? 3;
    hourBuckets[hour].totalMinutes += mins;
    hourBuckets[hour].count++;
  }

  const allHours: HourPattern[] = hourBuckets
    .map((bucket, hour) => {
      if (bucket.count === 0) {
        return { hour, score: 0, avgFocus: 0, avgEnergy: 0, sessions: 0, avgMinutes: 0 };
      }
      const avgFocus = bucket.totalFocus / bucket.count;
      const avgEnergy = bucket.totalEnergy / bucket.count;
      const avgMinutes = bucket.totalMinutes / bucket.count;
      // Composite score: weighted (focus 40%, energy 30%, avg duration 30%)
      const score = (
        (avgFocus / 5) * 0.4 +
        (avgEnergy / 5) * 0.3 +
        Math.min(avgMinutes / 60, 1) * 0.3
      );
      return {
        hour,
        score: Math.round(score * 100) / 100,
        avgFocus: Math.round(avgFocus * 10) / 10,
        avgEnergy: Math.round(avgEnergy * 10) / 10,
        sessions: bucket.count,
        avgMinutes: Math.round(avgMinutes),
      };
    });

  const withData = allHours.filter(h => h.sessions >= 3);
  const sorted = [...withData].sort((a, b) => b.score - a.score);

  return {
    bestHours: sorted.slice(0, 3),
    worstHours: sorted.slice(-3).reverse(),
    allHours,
  };
}


// ── Day Patterns ──────────────────────────────────────────────────────────────

function analyzeDayPatterns(sessions: TimerSession[], totalDays: number): DayPattern[] {
  const dayBuckets = new Array(7).fill(null).map(() => ({
    totalMinutes: 0, sessionCount: 0, activeDays: new Set<string>(),
  }));

  for (const s of sessions) {
    const d = new Date(s.started_at);
    const day = d.getDay();
    const dateStr = d.toISOString().slice(0, 10);
    dayBuckets[day].totalMinutes += getSessionDurationMinutes(s);
    dayBuckets[day].sessionCount++;
    dayBuckets[day].activeDays.add(dateStr);
  }

  const weeksInPeriod = Math.max(1, Math.ceil(totalDays / 7));

  return dayBuckets.map((bucket, day) => ({
    day,
    avgMinutes: Math.round(bucket.totalMinutes / weeksInPeriod),
    avgSessions: Math.round((bucket.sessionCount / weeksInPeriod) * 10) / 10,
    adherence: bucket.activeDays.size / weeksInPeriod,
    activeDays: bucket.activeDays.size,
    totalDays: weeksInPeriod,
  }));
}


// ── Module Patterns ───────────────────────────────────────────────────────────

function analyzeModulePatterns(sessions: TimerSession[]): ModulePattern[] {
  const moduleMap = new Map<string, {
    name: string; totalMinutes: number; totalFocus: number; count: number;
    hourCounts: number[];
  }>();

  for (const s of sessions) {
    if (!s.module_id) continue;
    const entry = moduleMap.get(s.module_id) ?? {
      name: s.module?.name || "Unknown",
      totalMinutes: 0, totalFocus: 0, count: 0,
      hourCounts: new Array(24).fill(0),
    };
    entry.totalMinutes += getSessionDurationMinutes(s);
    entry.totalFocus += s.focus_rating ?? 3;
    entry.count++;
    entry.hourCounts[new Date(s.started_at).getHours()]++;
    moduleMap.set(s.module_id, entry);
  }

  return Array.from(moduleMap.entries()).map(([moduleId, data]) => {
    const bestHour = data.hourCounts.indexOf(Math.max(...data.hourCounts));
    return {
      moduleId,
      moduleName: data.name,
      avgDuration: Math.round(data.totalMinutes / data.count),
      bestHour,
      avgFocus: Math.round((data.totalFocus / data.count) * 10) / 10,
      totalSessions: data.count,
      totalMinutes: Math.round(data.totalMinutes),
      weeklyTarget: Math.round(data.totalMinutes / Math.max(1, data.count / 7) * 7 / 60) * 60,
    };
  }).sort((a, b) => b.totalMinutes - a.totalMinutes);
}


// ── Duration Patterns ─────────────────────────────────────────────────────────

function analyzeDurationPatterns(sessions: TimerSession[]): {
  avgSessionMinutes: number;
  preferredDurationMinutes: number;
  longestProductiveSession: number;
} {
  if (sessions.length === 0) {
    return { avgSessionMinutes: 0, preferredDurationMinutes: 45, longestProductiveSession: 0 };
  }

  const durations = sessions.map(s => getSessionDurationMinutes(s));
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

  // Mode: round to nearest 5, find most common
  const rounded = durations.map(d => Math.round(d / 5) * 5);
  const freqMap = new Map<number, number>();
  for (const d of rounded) {
    freqMap.set(d, (freqMap.get(d) ?? 0) + 1);
  }
  let preferred = 45;
  let maxFreq = 0;
  for (const [dur, freq] of freqMap) {
    if (freq > maxFreq) { maxFreq = freq; preferred = dur; }
  }

  // Longest productive session (focus >= 4)
  const productiveDurations = sessions
    .filter(s => (s.focus_rating ?? 3) >= 4)
    .map(s => getSessionDurationMinutes(s));
  const longest = productiveDurations.length > 0 ? Math.max(...productiveDurations) : 0;

  return {
    avgSessionMinutes: Math.round(avg),
    preferredDurationMinutes: preferred,
    longestProductiveSession: Math.round(longest),
  };
}


// ── Consistency ───────────────────────────────────────────────────────────────

function analyzeConsistency(
  sessions: TimerSession[],
  dateRange: { start: string; end: string },
): {
  currentStreakDays: number;
  longestStreakDays: number;
  avgWeeklyStudyMinutes: number;
  consistencyScore: number;
} {
  const totalDays = Math.max(1, daysBetween(dateRange.start, dateRange.end));
  const totalWeeks = Math.max(1, totalDays / 7);

  // Collect study dates
  const studyDates = new Set<string>();
  let totalMinutes = 0;
  for (const s of sessions) {
    studyDates.add(s.started_at.slice(0, 10));
    totalMinutes += getSessionDurationMinutes(s);
  }

  // Streak calculation
  const sortedDates = [...studyDates].sort().reverse();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Current streak: count from today backwards
  const today = new Date().toISOString().slice(0, 10);
  let cursor = today;
  while (studyDates.has(cursor)) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  // Longest streak: scan all dates
  const allDates = [...studyDates].sort();
  for (let i = 0; i < allDates.length; i++) {
    if (i === 0 || daysBetween(allDates[i - 1], allDates[i]) === 1) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  // Consistency: what % of days had study?
  const activeDaysRatio = studyDates.size / totalDays;
  // Also factor in regularity (std dev of daily minutes)
  const dailyMinutes = new Map<string, number>();
  for (const s of sessions) {
    const date = s.started_at.slice(0, 10);
    dailyMinutes.set(date, (dailyMinutes.get(date) ?? 0) + getSessionDurationMinutes(s));
  }
  const values = [...dailyMinutes.values()];
  const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const variance = values.length > 0
    ? values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    : 0;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1; // coefficient of variation
  const regularity = Math.max(0, 1 - cv); // Higher = more regular

  return {
    currentStreakDays: currentStreak,
    longestStreakDays: longestStreak,
    avgWeeklyStudyMinutes: Math.round(totalMinutes / totalWeeks),
    consistencyScore: Math.round((activeDaysRatio * 0.6 + regularity * 0.4) * 100) / 100,
  };
}


// ── Adherence Trend ───────────────────────────────────────────────────────────

function analyzeAdherenceTrend(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  dateRange: { start: string; end: string },
): AdherenceTrend[] {
  const trends: AdherenceTrend[] = [];
  const startDate = new Date(dateRange.start);

  // Walk back up to 4 weeks
  for (let w = 0; w < 4; w++) {
    const weekStart = getMonday(addDays(startDate.toISOString().slice(0, 10), -(w * 7)));
    const weekEnd = addDays(weekStart, 7);
    const weekLabel = getISOWeek(weekStart);

    const weekBlocks = blocks.filter(b =>
      b.layer === 2 && b.start_time >= weekStart && b.start_time < weekEnd && b.status !== "rescheduled"
    );
    const weekSessions = sessions.filter(s =>
      s.started_at >= weekStart && s.started_at < weekEnd
    );

    const planned = weekBlocks.reduce((sum, b) => sum + getBlockDurationMinutes(b), 0);
    const actual = weekSessions.reduce((sum, s) => sum + getSessionDurationMinutes(s), 0);

    trends.push({
      week: weekLabel,
      planned,
      actual,
      adherence: planned > 0 ? Math.round((actual / planned) * 100) / 100 : (actual > 0 ? 1 : 0),
    });
  }

  return trends.reverse(); // Oldest first
}


// ── Procrastination Detection ─────────────────────────────────────────────────

function analyzeProcrastination(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
): {
  avgStartDelayMinutes: number;
  skipRate: number;
} {
  const layer2Blocks = blocks.filter(b => b.layer === 2 && b.start_time < new Date().toISOString());
  if (layer2Blocks.length === 0) return { avgStartDelayMinutes: 0, skipRate: 0 };

  const delays: number[] = [];
  let skippedCount = 0;

  for (const block of layer2Blocks) {
    if (block.status === "skipped") {
      skippedCount++;
      continue;
    }

    // Find first session linked to this block
    const linkedSession = sessions.find(s =>
      s.schedule_block_id === block.id ||
      (s.module_id === block.module_id && block.module_id &&
       Math.abs(new Date(s.started_at).getTime() - new Date(block.start_time).getTime()) < 3600000)
    );

    if (linkedSession) {
      const delay = (new Date(linkedSession.started_at).getTime() - new Date(block.start_time).getTime()) / 60000;
      if (delay > 0 && delay < 120) { // Only count reasonable delays
        delays.push(delay);
      }
    } else if (block.status !== "completed") {
      skippedCount++;
    }
  }

  return {
    avgStartDelayMinutes: delays.length > 0
      ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
      : 0,
    skipRate: Math.round((skippedCount / layer2Blocks.length) * 100) / 100,
  };
}


// ── Energy Curve ──────────────────────────────────────────────────────────────

function analyzeEnergyCurve(sessions: TimerSession[]): EnergyCurve {
  const periods = { morning: { total: 0, count: 0 }, afternoon: { total: 0, count: 0 }, evening: { total: 0, count: 0 } };

  for (const s of sessions) {
    const hour = new Date(s.started_at).getHours();
    const energy = s.energy_level ?? 3;
    if (hour >= 6 && hour < 12) {
      periods.morning.total += energy;
      periods.morning.count++;
    } else if (hour >= 12 && hour < 18) {
      periods.afternoon.total += energy;
      periods.afternoon.count++;
    } else {
      periods.evening.total += energy;
      periods.evening.count++;
    }
  }

  return {
    morning: periods.morning.count > 0 ? Math.round((periods.morning.total / periods.morning.count) * 10) / 10 : 3,
    afternoon: periods.afternoon.count > 0 ? Math.round((periods.afternoon.total / periods.afternoon.count) * 10) / 10 : 3,
    evening: periods.evening.count > 0 ? Math.round((periods.evening.total / periods.evening.count) * 10) / 10 : 3,
  };
}


// ── Insight Generation ────────────────────────────────────────────────────────

/**
 * Generate actionable insights from study patterns.
 * Returns i18n-ready insight objects.
 */
export function generatePatternInsights(patterns: StudyPatterns): PatternInsight[] {
  const insights: PatternInsight[] = [];

  // Peak hours
  if (patterns.bestHours.length > 0 && patterns.bestHours[0].score > 0.6) {
    insights.push({
      type: "peak_hours",
      severity: "positive",
      titleKey: "insights.peak_hours.title",
      descriptionKey: "insights.peak_hours.desc",
      data: { hours: patterns.bestHours.map(h => h.hour), topScore: patterns.bestHours[0].score },
    });
  }

  // Weak hours warning
  if (patterns.worstHours.length > 0 && patterns.worstHours[0].score < 0.3 && patterns.worstHours[0].sessions >= 5) {
    insights.push({
      type: "weak_hours",
      severity: "warning",
      titleKey: "insights.weak_hours.title",
      descriptionKey: "insights.weak_hours.desc",
      data: { hours: patterns.worstHours.map(h => h.hour), lowScore: patterns.worstHours[0].score },
    });
  }

  // Duration sweet spot
  if (patterns.preferredDurationMinutes > 0) {
    insights.push({
      type: "duration_sweet_spot",
      severity: "info",
      titleKey: "insights.duration.title",
      descriptionKey: "insights.duration.desc",
      data: {
        preferred: patterns.preferredDurationMinutes,
        avg: patterns.avgSessionMinutes,
        longestProductive: patterns.longestProductiveSession,
      },
    });
  }

  // Consistency
  if (patterns.consistencyScore >= 0.7) {
    insights.push({
      type: "consistency",
      severity: "positive",
      titleKey: "insights.consistency.high.title",
      descriptionKey: "insights.consistency.high.desc",
      data: { score: patterns.consistencyScore, streak: patterns.currentStreakDays },
    });
  } else if (patterns.consistencyScore < 0.4 && patterns.totalSessionsAnalyzed >= 10) {
    insights.push({
      type: "consistency",
      severity: "warning",
      titleKey: "insights.consistency.low.title",
      descriptionKey: "insights.consistency.low.desc",
      data: { score: patterns.consistencyScore },
    });
  }

  // Streak celebration
  if (patterns.currentStreakDays >= 7) {
    insights.push({
      type: "streak",
      severity: "positive",
      titleKey: "insights.streak.title",
      descriptionKey: "insights.streak.desc",
      data: { days: patterns.currentStreakDays, longest: patterns.longestStreakDays },
    });
  }

  // Procrastination alert
  if (patterns.avgStartDelayMinutes > 15 && patterns.totalSessionsAnalyzed >= 10) {
    insights.push({
      type: "procrastination",
      severity: "warning",
      titleKey: "insights.procrastination.title",
      descriptionKey: "insights.procrastination.desc",
      data: { avgDelay: patterns.avgStartDelayMinutes, skipRate: patterns.skipRate },
    });
  }

  // Skip rate critical
  if (patterns.skipRate > 0.3 && patterns.totalSessionsAnalyzed >= 10) {
    insights.push({
      type: "procrastination",
      severity: "critical",
      titleKey: "insights.skip_rate.title",
      descriptionKey: "insights.skip_rate.desc",
      data: { skipRate: patterns.skipRate },
    });
  }

  // Adherence trend
  if (patterns.adherenceTrend.length >= 2) {
    const recent = patterns.adherenceTrend[patterns.adherenceTrend.length - 1];
    const prev = patterns.adherenceTrend[patterns.adherenceTrend.length - 2];
    if (recent.adherence > prev.adherence + 0.1) {
      insights.push({
        type: "improvement",
        severity: "positive",
        titleKey: "insights.adherence.improving.title",
        descriptionKey: "insights.adherence.improving.desc",
        data: { current: recent.adherence, previous: prev.adherence },
      });
    } else if (recent.adherence < prev.adherence - 0.15) {
      insights.push({
        type: "decline",
        severity: "warning",
        titleKey: "insights.adherence.declining.title",
        descriptionKey: "insights.adherence.declining.desc",
        data: { current: recent.adherence, previous: prev.adherence },
      });
    }
  }

  // Energy mismatch: study happening during low-energy hours
  const { morning, afternoon, evening } = patterns.energyCurve;
  const lowestPeriod = morning <= afternoon && morning <= evening ? "morning"
    : afternoon <= evening ? "afternoon" : "evening";
  const hourRange = lowestPeriod === "morning" ? [6, 12]
    : lowestPeriod === "afternoon" ? [12, 18] : [18, 24];
  const sessionsInLowPeriod = patterns.allHours
    .filter(h => h.hour >= hourRange[0] && h.hour < hourRange[1])
    .reduce((sum, h) => sum + h.sessions, 0);
  const totalSessions = patterns.allHours.reduce((sum, h) => sum + h.sessions, 0);

  if (totalSessions > 0 && sessionsInLowPeriod / totalSessions > 0.4) {
    insights.push({
      type: "energy_mismatch",
      severity: "warning",
      titleKey: "insights.energy_mismatch.title",
      descriptionKey: "insights.energy_mismatch.desc",
      data: { period: lowestPeriod, energy: patterns.energyCurve[lowestPeriod], percent: Math.round(sessionsInLowPeriod / totalSessions * 100) },
    });
  }

  return insights;
}


// ── Optimal Slot Scoring ──────────────────────────────────────────────────────

/**
 * Score a time slot based on learned patterns.
 * Used by the rescheduler and decision bridge to find the best time for a task.
 */
export function scoreSlotForTask(
  patterns: StudyPatterns,
  slotStart: string,
  slotDurationMinutes: number,
  moduleId?: string | null,
): number {
  const hour = new Date(slotStart).getHours();
  const day = new Date(slotStart).getDay();

  let score = 50; // Base score

  // Hour productivity match (+/- 20)
  const hourPattern = patterns.allHours.find(h => h.hour === hour);
  if (hourPattern && hourPattern.sessions > 0) {
    score += (hourPattern.score - 0.5) * 40; // -20 to +20
  }

  // Day preference (+/- 10)
  const dayPattern = patterns.dayPatterns.find(d => d.day === day);
  if (dayPattern) {
    score += (dayPattern.adherence - 0.5) * 20; // -10 to +10
  }

  // Duration match (+/- 10)
  const durationDiff = Math.abs(slotDurationMinutes - patterns.preferredDurationMinutes);
  score -= Math.min(10, durationDiff / 10);

  // Module-specific hour preference (+/- 15)
  if (moduleId) {
    const modPattern = patterns.modulePatterns.find(m => m.moduleId === moduleId);
    if (modPattern) {
      const hourDist = Math.abs(hour - modPattern.bestHour);
      score += Math.max(-15, 15 - hourDist * 5);
    }
  }

  // Energy curve match (+/- 10)
  let periodEnergy: number;
  if (hour >= 6 && hour < 12) periodEnergy = patterns.energyCurve.morning;
  else if (hour >= 12 && hour < 18) periodEnergy = patterns.energyCurve.afternoon;
  else periodEnergy = patterns.energyCurve.evening;
  score += (periodEnergy - 3) * 5; // -10 to +10

  return Math.max(0, Math.min(100, Math.round(score)));
}


// ── Data Quality Assessment ───────────────────────────────────────────────────

function getDataQuality(sessionCount: number, days: number): StudyPatterns["dataQuality"] {
  if (sessionCount < 5 || days < 3) return "insufficient";
  if (sessionCount < 15 || days < 7) return "emerging";
  if (sessionCount < 50 || days < 21) return "reliable";
  return "strong";
}


// ── Utility ───────────────────────────────────────────────────────────────────

function daysBetween(start: string, end: string): number {
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getMonday(date: string): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function getISOWeek(date: string): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNo = Math.round(((d.getTime() - yearStart.getTime()) / 86400000 - 3 + (yearStart.getDay() + 6) % 7) / 7) + 1;
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
