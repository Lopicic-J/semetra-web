/**
 * Lern-DNA Analyzer — Builds comprehensive DNA profiles from study behavior
 *
 * Reads timer sessions, schedule blocks, tasks, and grades to compute
 * the 5 DNA dimensions:
 *   1. Consistency  — How regularly does the user study?
 *   2. Focus        — Session quality (ratings, completion, deep work ratio)
 *   3. Endurance    — Can they sustain long sessions? How many hours/week?
 *   4. Adaptability — Do they adjust after misses? Handle schedule changes?
 *   5. Planning     — Plan adherence, task completion rate, on-time behavior
 *
 * Output: DnaProfile + learnerType classification
 */

import type { DnaProfile } from "@/lib/decision/types";

// ── Input Types ──────────────────────────────────────────────────────────────

interface SessionData {
  duration_seconds: number;
  focus_rating: number | null;
  energy_level: number | null;
  session_type: string;
  alignment: string; // "within_plan" | "partial_overlap" | "unplanned" | "rescheduled"
  status: string;    // "completed" | "abandoned" | etc.
  started_at: string;
}

interface BlockData {
  planned_minutes: number;
  actual_minutes: number | null;
  date: string;
  was_rescheduled: boolean;
}

interface TaskData {
  status: string;
  due_date: string | null;
  completed_at: string | null;
}

interface RescheduleData {
  trigger: string;
  resolution: string;
  created_at: string;
}

// ── Learner Types ────────────────────────────────────────────────────────────

const LEARNER_TYPES = {
  marathonlaeufer: { de: "Marathonläufer", en: "Marathon Runner", minEndurance: 75, minConsistency: 70 },
  sprinter: { de: "Sprinter", en: "Sprinter", minFocus: 75, minEndurance: 30 },
  stratege: { de: "Stratege", en: "Strategist", minPlanning: 75, minAdaptability: 60 },
  anpasser: { de: "Anpasser", en: "Adapter", minAdaptability: 75 },
  entdecker: { de: "Entdecker", en: "Explorer", minAdaptability: 60, minFocus: 50 },
  einsteiger: { de: "Einsteiger", en: "Beginner" },
} as const;

// ── Core Analysis ────────────────────────────────────────────────────────────

/**
 * Compute a full DNA profile from raw study data.
 *
 * @param sessions  - Timer sessions from last 30 days
 * @param blocks    - Schedule blocks from last 30 days
 * @param tasks     - User's tasks (all time, but we focus on last 30d)
 * @param reschedules - Reschedule log entries from last 30 days
 */
export function computeDnaProfile(
  sessions: SessionData[],
  blocks: BlockData[],
  tasks: TaskData[],
  reschedules: RescheduleData[]
): DnaProfile {
  const consistencyScore = computeConsistency(sessions);
  const focusScore = computeFocus(sessions);
  const enduranceScore = computeEndurance(sessions);
  const adaptabilityScore = computeAdaptability(sessions, reschedules);
  const planningScore = computePlanning(sessions, blocks, tasks);

  const overallScore = Math.round(
    consistencyScore * 0.25 +
    focusScore * 0.20 +
    enduranceScore * 0.15 +
    adaptabilityScore * 0.15 +
    planningScore * 0.25
  );

  const learnerType = classifyLearner({
    consistencyScore,
    focusScore,
    enduranceScore,
    adaptabilityScore,
    planningScore,
    overallScore,
    learnerType: "",
  });

  return {
    consistencyScore,
    focusScore,
    enduranceScore,
    adaptabilityScore,
    planningScore,
    overallScore,
    learnerType,
  };
}

// ── Dimension Calculators ────────────────────────────────────────────────────

function computeConsistency(sessions: SessionData[]): number {
  if (sessions.length < 3) return 10;

  // Count unique study days
  const studyDays = new Set(
    sessions.map((s) => s.started_at.slice(0, 10))
  );
  const totalDays = 30;
  const activeDayRatio = studyDays.size / totalDays;

  // Check for gaps > 3 days
  const sortedDays = [...studyDays].sort();
  let maxGap = 0;
  for (let i = 1; i < sortedDays.length; i++) {
    const gap = (new Date(sortedDays[i]).getTime() - new Date(sortedDays[i - 1]).getTime()) / 86400000;
    maxGap = Math.max(maxGap, gap);
  }
  const gapPenalty = Math.min(30, maxGap * 3); // Penalty for long gaps

  // Session regularity (std deviation of daily session counts)
  const dayCounts: Record<string, number> = {};
  for (const s of sessions) {
    const day = s.started_at.slice(0, 10);
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }
  const counts = Object.values(dayCounts);
  const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((sum, c) => sum + (c - avgCount) ** 2, 0) / counts.length;
  const regularity = Math.max(0, 100 - Math.sqrt(variance) * 20);

  const raw = activeDayRatio * 50 + regularity * 0.3 - gapPenalty;
  return clamp(Math.round(raw));
}

function computeFocus(sessions: SessionData[]): number {
  if (sessions.length < 3) return 10;

  const completed = sessions.filter((s) => s.status === "completed");
  const completionRate = completed.length / sessions.length;

  // Average focus rating (1-5 → 0-100)
  const rated = sessions.filter((s) => s.focus_rating != null);
  const avgFocus = rated.length > 0
    ? rated.reduce((sum, s) => sum + (s.focus_rating ?? 3), 0) / rated.length
    : 3;
  const focusNorm = ((avgFocus - 1) / 4) * 100;

  // Deep work ratio (focus/deep_work sessions vs total)
  const deepSessions = sessions.filter(
    (s) => s.session_type === "focus" || s.session_type === "deep_work"
  );
  const deepRatio = deepSessions.length / sessions.length;

  // Abandonment penalty
  const abandoned = sessions.filter((s) => s.status === "abandoned").length;
  const abandonRate = abandoned / sessions.length;

  const raw = completionRate * 35 + focusNorm * 0.35 + deepRatio * 20 - abandonRate * 20;
  return clamp(Math.round(raw));
}

function computeEndurance(sessions: SessionData[]): number {
  if (sessions.length < 3) return 10;

  const durations = sessions
    .filter((s) => s.status === "completed")
    .map((s) => s.duration_seconds / 60);

  if (durations.length === 0) return 10;

  const avgMinutes = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxMinutes = Math.max(...durations);
  const totalWeeklyMinutes = durations.reduce((a, b) => a + b, 0) / 4.3; // ~30 days / 7

  // Score based on session length capability
  const durationScore = Math.min(40, avgMinutes * 0.8); // 50 min avg → 40 pts

  // Long session bonus
  const longSessionBonus = maxMinutes > 90 ? 15 : maxMinutes > 60 ? 10 : maxMinutes > 45 ? 5 : 0;

  // Weekly volume
  const volumeScore = Math.min(30, totalWeeklyMinutes / 10); // 300 min/week → 30 pts

  // Energy sustainability (avg energy in sessions > 45 min)
  const longSessions = sessions.filter(
    (s) => s.duration_seconds > 2700 && s.energy_level != null
  );
  const avgLongEnergy = longSessions.length > 0
    ? longSessions.reduce((sum, s) => sum + (s.energy_level ?? 3), 0) / longSessions.length
    : 3;
  const energySustain = ((avgLongEnergy - 1) / 4) * 15;

  const raw = durationScore + longSessionBonus + volumeScore + energySustain;
  return clamp(Math.round(raw));
}

function computeAdaptability(sessions: SessionData[], reschedules: RescheduleData[]): number {
  if (sessions.length < 3) return 10;

  // Rescheduled sessions that were actually completed
  const rescheduledSessions = sessions.filter((s) => s.alignment === "rescheduled");
  const rescheduledCompleted = rescheduledSessions.filter((s) => s.status === "completed");
  const rescheduleRecovery = rescheduledSessions.length > 0
    ? (rescheduledCompleted.length / rescheduledSessions.length) * 30
    : 15; // neutral if no reschedules

  // Unplanned sessions (student adapts and studies even without a plan)
  const unplanned = sessions.filter((s) => s.alignment === "unplanned");
  const unplannedBonus = Math.min(20, unplanned.length * 3);

  // Reschedule success rate (resolution != "dropped")
  const successfulReschedules = reschedules.filter(
    (r) => r.resolution !== "dropped" && r.resolution !== "pending"
  );
  const rescheduleSuccess = reschedules.length > 0
    ? (successfulReschedules.length / reschedules.length) * 30
    : 15;

  // Variety in session types
  const types = new Set(sessions.map((s) => s.session_type));
  const varietyBonus = Math.min(20, types.size * 5);

  const raw = rescheduleRecovery + unplannedBonus + rescheduleSuccess + varietyBonus;
  return clamp(Math.round(raw));
}

function computePlanning(sessions: SessionData[], blocks: BlockData[], tasks: TaskData[]): number {
  if (sessions.length < 3) return 10;

  // Plan adherence: sessions within_plan / total
  const withinPlan = sessions.filter(
    (s) => s.alignment === "within_plan" || s.alignment === "partial_overlap"
  );
  const adherence = (withinPlan.length / sessions.length) * 35;

  // Block completion rate
  const completedBlocks = blocks.filter((b) => {
    const actual = b.actual_minutes ?? 0;
    return actual >= b.planned_minutes * 0.7; // 70% = counts as completed
  });
  const blockCompletion = blocks.length > 0
    ? (completedBlocks.length / blocks.length) * 25
    : 10;

  // Task completion rate (last 30 days)
  const recentTasks = tasks.filter((t) => {
    if (!t.due_date) return false;
    const due = new Date(t.due_date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return due >= thirtyDaysAgo;
  });
  const completedTasks = recentTasks.filter((t) => t.status === "done");
  const taskRate = recentTasks.length > 0
    ? (completedTasks.length / recentTasks.length) * 25
    : 10;

  // On-time task completion (completed before due date)
  const onTime = completedTasks.filter((t) => {
    if (!t.completed_at || !t.due_date) return false;
    return new Date(t.completed_at) <= new Date(t.due_date);
  });
  const onTimeRate = completedTasks.length > 0
    ? (onTime.length / completedTasks.length) * 15
    : 5;

  const raw = adherence + blockCompletion + taskRate + onTimeRate;
  return clamp(Math.round(raw));
}

// ── Learner Classification ───────────────────────────────────────────────────

function classifyLearner(profile: DnaProfile): string {
  const { consistencyScore: c, focusScore: f, enduranceScore: e, adaptabilityScore: a, planningScore: p } = profile;

  if (e >= 75 && c >= 70) return "marathonlaeufer";
  if (f >= 75 && e < 50) return "sprinter";
  if (p >= 75 && a >= 60) return "stratege";
  if (a >= 75) return "anpasser";
  if (a >= 60 && f >= 50) return "entdecker";
  return "einsteiger";
}

/**
 * Get human-readable learner type info
 */
export function getLearnerTypeInfo(type: string): { de: string; en: string; description: string } {
  const descriptions: Record<string, string> = {
    marathonlaeufer: "Du lernst ausdauernd und regelmässig — dein grösster Vorteil ist Beständigkeit.",
    sprinter: "Du arbeitest intensiv in kurzen Schüben — hohe Fokus-Qualität, aber kürzere Sessions.",
    stratege: "Du planst voraus und hältst dich an deinen Plan — strukturiertes Lernen liegt dir.",
    anpasser: "Du passt dich flexibel an Änderungen an — auch bei Planabweichungen findest du Wege.",
    entdecker: "Du probierst verschiedene Lernansätze aus — Vielfalt hält dich motiviert.",
    einsteiger: "Du bist noch am Anfang — je mehr du lernst, desto klarer wird dein Profil.",
  };

  const info = LEARNER_TYPES[type as keyof typeof LEARNER_TYPES];
  return {
    de: info?.de ?? "Unbekannt",
    en: info?.en ?? "Unknown",
    description: descriptions[type] ?? "",
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
