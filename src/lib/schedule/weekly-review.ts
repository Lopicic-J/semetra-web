// ── Weekly Review Engine ─────────────────────────────────────────────────────
// Generates comprehensive weekly performance reviews with insights and
// actionable recommendations. Pure functions, no side effects.
//
// Produces:
//   - Quantitative snapshot (planned vs actual, adherence, streaks)
//   - Module-level breakdown with trends
//   - Pattern-based insights (what went well, what needs attention)
//   - Concrete recommendations for next week
//   - Goal tracking (weekly targets vs actuals)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ScheduleBlock, TimerSession, SchedulePreferences, DailyStats,
} from "./types";
import { getBlockDurationMinutes, getSessionDurationMinutes, isLearningBlock } from "./types";
import { buildScheduleWeek, computePlanVsReality } from "./engine";
import type { StudyPatterns, PatternInsight } from "./pattern-analyzer";
import { analyzeStudyPatterns, generatePatternInsights } from "./pattern-analyzer";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WeeklyReview {
  weekStart: string;   // YYYY-MM-DD (Monday)
  weekEnd: string;     // YYYY-MM-DD (Sunday)

  // Core metrics
  metrics: WeeklyMetrics;

  // Module breakdown
  moduleStats: ModuleWeekStats[];

  // Comparisons
  vsPrevWeek: WeekComparison;
  vs4WeekAvg: WeekComparison;

  // Insights & recommendations
  insights: ReviewInsight[];
  recommendations: Recommendation[];

  // Goals
  goals: WeeklyGoal[];

  // Highlights
  highlights: WeeklyHighlight[];
}

export interface WeeklyMetrics {
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  totalEffectiveMinutes: number;
  overallAdherence: number;       // 0-1
  sessionsCompleted: number;
  blocksCompleted: number;
  blocksSkipped: number;
  blocksRescheduled: number;
  bestDay: string | null;
  bestHour: number | null;
  avgSessionMinutes: number | null;
  avgFocusRating: number | null;
  avgEnergyLevel: number | null;
  studyDays: number;              // How many days had any study
  focusEfficiency: number;        // effective/actual
}

export interface ModuleWeekStats {
  moduleId: string;
  moduleName: string;
  moduleColor: string;
  plannedMinutes: number;
  actualMinutes: number;
  adherence: number;
  sessions: number;
  avgFocus: number;
  trend: "improving" | "stable" | "declining";
  daysUntilExam: number | null;
}

export interface WeekComparison {
  plannedDelta: number;           // minutes change
  actualDelta: number;
  adherenceDelta: number;         // percentage point change
  trendDirection: "up" | "flat" | "down";
}

export interface ReviewInsight {
  type: "achievement" | "pattern" | "warning" | "tip";
  severity: "positive" | "info" | "warning" | "critical";
  titleKey: string;
  descriptionKey: string;
  data: Record<string, any>;
}

export interface Recommendation {
  type: "schedule" | "focus" | "rest" | "module" | "habit";
  priority: "high" | "medium" | "low";
  actionKey: string;
  reasonKey: string;
  data: Record<string, any>;
}

export interface WeeklyGoal {
  type: "study_hours" | "adherence" | "streak" | "module_coverage" | "focus";
  target: number;
  actual: number;
  achieved: boolean;
  label: string;
}

export interface WeeklyHighlight {
  type: "best_session" | "longest_streak" | "most_focused" | "biggest_improvement" | "perfect_day";
  titleKey: string;
  data: Record<string, any>;
}


// ── Main Generator ────────────────────────────────────────────────────────────

/**
 * Generate a complete weekly review for the given week.
 */
export function generateWeeklyReview(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  preferences: SchedulePreferences,
  weekStart: string,
  prevWeekBlocks?: ScheduleBlock[],
  prevWeekSessions?: TimerSession[],
  fourWeekBlocks?: ScheduleBlock[],
  fourWeekSessions?: TimerSession[],
): WeeklyReview {
  const weekEnd = addDays(weekStart, 6);

  // Filter to this week
  const weekBlocks = blocks.filter(b =>
    b.start_time >= weekStart && b.start_time <= weekEnd + "T23:59:59Z"
  );
  const weekSessions = sessions.filter(s =>
    s.started_at >= weekStart && s.started_at <= weekEnd + "T23:59:59Z" &&
    s.status === "completed"
  );

  const metrics = computeWeeklyMetrics(weekBlocks, weekSessions, weekStart);
  const moduleStats = computeModuleWeekStats(weekBlocks, weekSessions, weekStart, prevWeekSessions);
  const vsPrevWeek = computeWeekComparison(
    metrics, prevWeekBlocks, prevWeekSessions, weekStart
  );
  const vs4WeekAvg = compute4WeekComparison(
    metrics, fourWeekBlocks, fourWeekSessions, weekStart
  );

  const patterns = analyzeStudyPatterns(sessions, blocks, { start: weekStart, end: weekEnd });
  const patternInsights = generatePatternInsights(patterns);

  const insights = generateReviewInsights(metrics, moduleStats, vsPrevWeek, patternInsights);
  const recommendations = generateRecommendations(metrics, moduleStats, patterns, preferences);
  const goals = evaluateWeeklyGoals(metrics, moduleStats, preferences);
  const highlights = findWeeklyHighlights(weekSessions, weekBlocks, weekStart);

  return {
    weekStart,
    weekEnd,
    metrics,
    moduleStats,
    vsPrevWeek,
    vs4WeekAvg,
    insights,
    recommendations,
    goals,
    highlights,
  };
}


// ── Metrics ───────────────────────────────────────────────────────────────────

function computeWeeklyMetrics(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  weekStart: string,
): WeeklyMetrics {
  const layer2 = blocks.filter(b => b.layer === 2 && isLearningBlock(b.block_type));

  const totalPlanned = layer2
    .filter(b => b.status !== "rescheduled")
    .reduce((sum, b) => sum + getBlockDurationMinutes(b), 0);

  const totalActual = sessions.reduce((sum, s) =>
    sum + (s.actual_duration_seconds ? s.actual_duration_seconds / 60 : getSessionDurationMinutes(s)), 0
  );

  const totalEffective = sessions.reduce((sum, s) =>
    sum + (s.effective_seconds ? s.effective_seconds / 60 : getSessionDurationMinutes(s)), 0
  );

  const blocksCompleted = layer2.filter(b => b.status === "completed").length;
  const blocksSkipped = layer2.filter(b => b.status === "skipped").length;
  const blocksRescheduled = layer2.filter(b => b.status === "rescheduled").length;

  // Best day
  const dayMinutes = new Map<string, number>();
  for (const s of sessions) {
    const date = s.started_at.slice(0, 10);
    dayMinutes.set(date, (dayMinutes.get(date) ?? 0) + getSessionDurationMinutes(s));
  }
  let bestDay: string | null = null;
  let bestDayMins = 0;
  for (const [date, mins] of dayMinutes) {
    if (mins > bestDayMins) { bestDayMins = mins; bestDay = date; }
  }

  // Best hour
  const hourMinutes = new Array(24).fill(0);
  for (const s of sessions) {
    const h = new Date(s.started_at).getHours();
    hourMinutes[h] += getSessionDurationMinutes(s);
  }
  const maxHourIdx = hourMinutes.indexOf(Math.max(...hourMinutes));
  const bestHour = hourMinutes[maxHourIdx] > 0 ? maxHourIdx : null;

  // Averages
  const focusRatings = sessions.filter(s => s.focus_rating != null).map(s => s.focus_rating!);
  const energyLevels = sessions.filter(s => s.energy_level != null).map(s => s.energy_level!);
  const sessionDurations = sessions.map(s => getSessionDurationMinutes(s));

  return {
    totalPlannedMinutes: Math.round(totalPlanned),
    totalActualMinutes: Math.round(totalActual),
    totalEffectiveMinutes: Math.round(totalEffective),
    overallAdherence: totalPlanned > 0
      ? Math.round((totalEffective / totalPlanned) * 100) / 100
      : (totalEffective > 0 ? 1 : 0),
    sessionsCompleted: sessions.length,
    blocksCompleted,
    blocksSkipped,
    blocksRescheduled,
    bestDay,
    bestHour,
    avgSessionMinutes: sessionDurations.length > 0
      ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length)
      : null,
    avgFocusRating: focusRatings.length > 0
      ? Math.round(focusRatings.reduce((a, b) => a + b, 0) / focusRatings.length * 10) / 10
      : null,
    avgEnergyLevel: energyLevels.length > 0
      ? Math.round(energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length * 10) / 10
      : null,
    studyDays: dayMinutes.size,
    focusEfficiency: totalActual > 0
      ? Math.round((totalEffective / totalActual) * 100) / 100
      : 0,
  };
}


// ── Module Stats ──────────────────────────────────────────────────────────────

function computeModuleWeekStats(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  weekStart: string,
  prevWeekSessions?: TimerSession[],
): ModuleWeekStats[] {
  const moduleMap = new Map<string, {
    name: string; color: string; planned: number; actual: number;
    sessionCount: number; totalFocus: number; focusCount: number;
    examDate: string | null;
  }>();

  // Aggregate blocks
  for (const b of blocks) {
    if (b.layer !== 2 || !b.module_id || b.status === "rescheduled") continue;
    const entry = moduleMap.get(b.module_id) ?? {
      name: b.module?.name || "Unknown",
      color: b.module?.color || "#6d28d9",
      planned: 0, actual: 0, sessionCount: 0, totalFocus: 0, focusCount: 0,
      examDate: null,
    };
    entry.planned += getBlockDurationMinutes(b);
    if (b.block_type === "exam" || b.block_type === "exam_prep") {
      entry.examDate = b.start_time.slice(0, 10);
    }
    moduleMap.set(b.module_id, entry);
  }

  // Aggregate sessions
  for (const s of sessions) {
    if (!s.module_id) continue;
    const entry = moduleMap.get(s.module_id) ?? {
      name: s.module?.name || "Unknown",
      color: s.module?.color || "#6d28d9",
      planned: 0, actual: 0, sessionCount: 0, totalFocus: 0, focusCount: 0,
      examDate: null,
    };
    entry.actual += getSessionDurationMinutes(s);
    entry.sessionCount++;
    if (s.focus_rating != null) {
      entry.totalFocus += s.focus_rating;
      entry.focusCount++;
    }
    moduleMap.set(s.module_id, entry);
  }

  return Array.from(moduleMap.entries()).map(([moduleId, data]) => {
    // Trend vs prev week
    let trend: ModuleWeekStats["trend"] = "stable";
    if (prevWeekSessions) {
      const prevActual = prevWeekSessions
        .filter(s => s.module_id === moduleId && s.status === "completed")
        .reduce((sum, s) => sum + getSessionDurationMinutes(s), 0);
      if (data.actual > prevActual * 1.2) trend = "improving";
      else if (data.actual < prevActual * 0.8) trend = "declining";
    }

    const daysUntilExam = data.examDate
      ? Math.ceil((new Date(data.examDate).getTime() - Date.now()) / 86400000)
      : null;

    return {
      moduleId,
      moduleName: data.name,
      moduleColor: data.color,
      plannedMinutes: Math.round(data.planned),
      actualMinutes: Math.round(data.actual),
      adherence: data.planned > 0 ? Math.round((data.actual / data.planned) * 100) / 100 : (data.actual > 0 ? 1 : 0),
      sessions: data.sessionCount,
      avgFocus: data.focusCount > 0 ? Math.round((data.totalFocus / data.focusCount) * 10) / 10 : 0,
      trend,
      daysUntilExam,
    };
  }).sort((a, b) => b.actualMinutes - a.actualMinutes);
}


// ── Comparisons ───────────────────────────────────────────────────────────────

function computeWeekComparison(
  current: WeeklyMetrics,
  prevBlocks?: ScheduleBlock[],
  prevSessions?: TimerSession[],
  weekStart?: string,
): WeekComparison {
  if (!prevBlocks || !prevSessions || !weekStart) {
    return { plannedDelta: 0, actualDelta: 0, adherenceDelta: 0, trendDirection: "flat" };
  }

  const prevPlanned = prevBlocks
    .filter(b => b.layer === 2 && isLearningBlock(b.block_type) && b.status !== "rescheduled")
    .reduce((sum, b) => sum + getBlockDurationMinutes(b), 0);
  const prevActual = prevSessions
    .filter(s => s.status === "completed")
    .reduce((sum, s) => sum + getSessionDurationMinutes(s), 0);
  const prevAdherence = prevPlanned > 0 ? prevActual / prevPlanned : 0;

  const plannedDelta = current.totalPlannedMinutes - prevPlanned;
  const actualDelta = current.totalActualMinutes - Math.round(prevActual);
  const adherenceDelta = Math.round((current.overallAdherence - prevAdherence) * 100) / 100;

  return {
    plannedDelta,
    actualDelta,
    adherenceDelta,
    trendDirection: actualDelta > 30 ? "up" : actualDelta < -30 ? "down" : "flat",
  };
}

function compute4WeekComparison(
  current: WeeklyMetrics,
  fourWeekBlocks?: ScheduleBlock[],
  fourWeekSessions?: TimerSession[],
  weekStart?: string,
): WeekComparison {
  if (!fourWeekBlocks || !fourWeekSessions) {
    return { plannedDelta: 0, actualDelta: 0, adherenceDelta: 0, trendDirection: "flat" };
  }

  const avgPlanned = fourWeekBlocks
    .filter(b => b.layer === 2 && isLearningBlock(b.block_type) && b.status !== "rescheduled")
    .reduce((sum, b) => sum + getBlockDurationMinutes(b), 0) / 4;
  const avgActual = fourWeekSessions
    .filter(s => s.status === "completed")
    .reduce((sum, s) => sum + getSessionDurationMinutes(s), 0) / 4;
  const avgAdherence = avgPlanned > 0 ? avgActual / avgPlanned : 0;

  return {
    plannedDelta: Math.round(current.totalPlannedMinutes - avgPlanned),
    actualDelta: Math.round(current.totalActualMinutes - avgActual),
    adherenceDelta: Math.round((current.overallAdherence - avgAdherence) * 100) / 100,
    trendDirection: current.totalActualMinutes > avgActual * 1.1 ? "up"
      : current.totalActualMinutes < avgActual * 0.9 ? "down" : "flat",
  };
}


// ── Insights ──────────────────────────────────────────────────────────────────

function generateReviewInsights(
  metrics: WeeklyMetrics,
  moduleStats: ModuleWeekStats[],
  vsPrevWeek: WeekComparison,
  patternInsights: PatternInsight[],
): ReviewInsight[] {
  const insights: ReviewInsight[] = [];

  // Achievements
  if (metrics.overallAdherence >= 0.9) {
    insights.push({
      type: "achievement", severity: "positive",
      titleKey: "review.insights.high_adherence.title",
      descriptionKey: "review.insights.high_adherence.desc",
      data: { adherence: Math.round(metrics.overallAdherence * 100) },
    });
  }

  if (metrics.studyDays >= 6) {
    insights.push({
      type: "achievement", severity: "positive",
      titleKey: "review.insights.study_streak.title",
      descriptionKey: "review.insights.study_streak.desc",
      data: { days: metrics.studyDays },
    });
  }

  // Warnings
  if (metrics.blocksSkipped > 3) {
    insights.push({
      type: "warning", severity: "warning",
      titleKey: "review.insights.many_skipped.title",
      descriptionKey: "review.insights.many_skipped.desc",
      data: { count: metrics.blocksSkipped },
    });
  }

  // Module-specific alerts
  for (const mod of moduleStats) {
    if (mod.daysUntilExam != null && mod.daysUntilExam <= 14 && mod.adherence < 0.6) {
      insights.push({
        type: "warning", severity: "critical",
        titleKey: "review.insights.exam_risk.title",
        descriptionKey: "review.insights.exam_risk.desc",
        data: { module: mod.moduleName, days: mod.daysUntilExam, adherence: Math.round(mod.adherence * 100) },
      });
    }
  }

  // Trend-based
  if (vsPrevWeek.trendDirection === "up") {
    insights.push({
      type: "pattern", severity: "positive",
      titleKey: "review.insights.improving.title",
      descriptionKey: "review.insights.improving.desc",
      data: { delta: vsPrevWeek.actualDelta },
    });
  } else if (vsPrevWeek.trendDirection === "down" && vsPrevWeek.actualDelta < -60) {
    insights.push({
      type: "pattern", severity: "warning",
      titleKey: "review.insights.declining.title",
      descriptionKey: "review.insights.declining.desc",
      data: { delta: Math.abs(vsPrevWeek.actualDelta) },
    });
  }

  // Focus efficiency
  if (metrics.focusEfficiency < 0.7 && metrics.sessionsCompleted >= 5) {
    insights.push({
      type: "tip", severity: "info",
      titleKey: "review.insights.low_efficiency.title",
      descriptionKey: "review.insights.low_efficiency.desc",
      data: { efficiency: Math.round(metrics.focusEfficiency * 100) },
    });
  }

  // Include relevant pattern insights
  for (const pi of patternInsights.slice(0, 3)) {
    insights.push({
      type: "pattern",
      severity: pi.severity === "critical" ? "critical" : pi.severity,
      titleKey: pi.titleKey,
      descriptionKey: pi.descriptionKey,
      data: pi.data,
    });
  }

  return insights;
}


// ── Recommendations ───────────────────────────────────────────────────────────

function generateRecommendations(
  metrics: WeeklyMetrics,
  moduleStats: ModuleWeekStats[],
  patterns: StudyPatterns,
  preferences: SchedulePreferences,
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Study time optimization
  if (metrics.totalActualMinutes < metrics.totalPlannedMinutes * 0.6 && metrics.totalPlannedMinutes > 0) {
    recs.push({
      type: "schedule", priority: "high",
      actionKey: "review.rec.reduce_planned",
      reasonKey: "review.rec.reduce_planned.reason",
      data: {
        currentPlanned: metrics.totalPlannedMinutes,
        suggestedPlanned: Math.round(metrics.totalActualMinutes * 1.2),
      },
    });
  }

  // Module attention needed
  const neglectedModules = moduleStats.filter(m =>
    m.actualMinutes < m.plannedMinutes * 0.4 && m.plannedMinutes > 30
  );
  for (const mod of neglectedModules.slice(0, 2)) {
    recs.push({
      type: "module", priority: mod.daysUntilExam != null && mod.daysUntilExam <= 21 ? "high" : "medium",
      actionKey: "review.rec.module_attention",
      reasonKey: "review.rec.module_attention.reason",
      data: { module: mod.moduleName, deficit: mod.plannedMinutes - mod.actualMinutes },
    });
  }

  // Session duration optimization
  if (patterns.preferredDurationMinutes > 0 && patterns.preferredDurationMinutes !== preferences.pomodoro_focus_minutes) {
    recs.push({
      type: "focus", priority: "low",
      actionKey: "review.rec.adjust_duration",
      reasonKey: "review.rec.adjust_duration.reason",
      data: {
        current: preferences.pomodoro_focus_minutes,
        suggested: patterns.preferredDurationMinutes,
      },
    });
  }

  // Rest recommendation
  if (metrics.studyDays >= 7 || metrics.totalActualMinutes > preferences.max_daily_study_minutes * 6) {
    recs.push({
      type: "rest", priority: "medium",
      actionKey: "review.rec.take_break",
      reasonKey: "review.rec.take_break.reason",
      data: { studyDays: metrics.studyDays, totalHours: Math.round(metrics.totalActualMinutes / 60) },
    });
  }

  // Consistency habit
  if (patterns.consistencyScore < 0.5 && patterns.totalSessionsAnalyzed >= 10) {
    recs.push({
      type: "habit", priority: "high",
      actionKey: "review.rec.build_consistency",
      reasonKey: "review.rec.build_consistency.reason",
      data: { score: patterns.consistencyScore, suggestion: "same_time_daily" },
    });
  }

  // Peak hours utilization
  if (patterns.bestHours.length > 0) {
    recs.push({
      type: "schedule", priority: "medium",
      actionKey: "review.rec.use_peak_hours",
      reasonKey: "review.rec.use_peak_hours.reason",
      data: { hours: patterns.bestHours.map(h => h.hour) },
    });
  }

  return recs.sort((a, b) => {
    const pOrder = { high: 0, medium: 1, low: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });
}


// ── Goals ─────────────────────────────────────────────────────────────────────

function evaluateWeeklyGoals(
  metrics: WeeklyMetrics,
  moduleStats: ModuleWeekStats[],
  preferences: SchedulePreferences,
): WeeklyGoal[] {
  const goals: WeeklyGoal[] = [];

  // Study hours goal
  const weeklyTarget = preferences.max_daily_study_minutes * 5; // 5 weekdays
  goals.push({
    type: "study_hours",
    target: weeklyTarget,
    actual: metrics.totalEffectiveMinutes,
    achieved: metrics.totalEffectiveMinutes >= weeklyTarget * 0.8,
    label: "review.goals.study_hours",
  });

  // Adherence goal
  goals.push({
    type: "adherence",
    target: 80,
    actual: Math.round(metrics.overallAdherence * 100),
    achieved: metrics.overallAdherence >= 0.8,
    label: "review.goals.adherence",
  });

  // Study streak goal
  goals.push({
    type: "streak",
    target: 5,
    actual: metrics.studyDays,
    achieved: metrics.studyDays >= 5,
    label: "review.goals.streak",
  });

  // Module coverage goal
  const coveredModules = moduleStats.filter(m => m.actualMinutes >= 30).length;
  const totalModules = moduleStats.length;
  goals.push({
    type: "module_coverage",
    target: totalModules,
    actual: coveredModules,
    achieved: coveredModules >= totalModules * 0.7,
    label: "review.goals.module_coverage",
  });

  // Focus goal
  if (metrics.avgFocusRating != null) {
    goals.push({
      type: "focus",
      target: 4,
      actual: metrics.avgFocusRating,
      achieved: metrics.avgFocusRating >= 4,
      label: "review.goals.focus",
    });
  }

  return goals;
}


// ── Highlights ────────────────────────────────────────────────────────────────

function findWeeklyHighlights(
  sessions: TimerSession[],
  blocks: ScheduleBlock[],
  weekStart: string,
): WeeklyHighlight[] {
  const highlights: WeeklyHighlight[] = [];

  if (sessions.length === 0) return highlights;

  // Best session (highest focus * duration)
  let bestSession: TimerSession | null = null;
  let bestScore = 0;
  for (const s of sessions) {
    const score = (s.focus_rating ?? 3) * getSessionDurationMinutes(s);
    if (score > bestScore) { bestScore = score; bestSession = s; }
  }
  if (bestSession) {
    highlights.push({
      type: "best_session",
      titleKey: "review.highlights.best_session",
      data: {
        duration: getSessionDurationMinutes(bestSession),
        focus: bestSession.focus_rating,
        module: bestSession.module?.name,
      },
    });
  }

  // Most focused session
  const mostFocused = sessions
    .filter(s => s.focus_rating != null)
    .sort((a, b) => (b.focus_rating ?? 0) - (a.focus_rating ?? 0))[0];
  if (mostFocused && mostFocused.focus_rating === 5) {
    highlights.push({
      type: "most_focused",
      titleKey: "review.highlights.perfect_focus",
      data: { module: mostFocused.module?.name, duration: getSessionDurationMinutes(mostFocused) },
    });
  }

  // Perfect day (all planned blocks completed)
  for (let d = 0; d < 7; d++) {
    const date = addDays(weekStart, d);
    const dayBlocks = blocks.filter(b =>
      b.layer === 2 && b.start_time.slice(0, 10) === date && isLearningBlock(b.block_type)
    );
    if (dayBlocks.length >= 3 && dayBlocks.every(b => b.status === "completed")) {
      highlights.push({
        type: "perfect_day",
        titleKey: "review.highlights.perfect_day",
        data: { date, blocks: dayBlocks.length },
      });
      break; // Only first perfect day
    }
  }

  return highlights;
}


// ── Utility ───────────────────────────────────────────────────────────────────

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
