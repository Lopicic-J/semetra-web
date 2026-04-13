/**
 * Cortex Engine — Learning Curve Tracker (C3.3)
 *
 * Berechnet pro Modul eine individuelle Lernkurve basierend auf:
 * - Flashcard-Review-Ergebnisse (SR-Performance)
 * - Prüfungsergebnisse
 * - Investierte Lernzeit
 * - Selbsteinschätzung
 *
 * Liefert: Aktuelles Wissensniveau, Projektion, empfohlene tägliche Minuten,
 * Vergessensrate und optimales Review-Intervall.
 *
 * Tabelle: module_learning_curves
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────

export type DataPointSource =
  | "flashcard_review"
  | "exam_result"
  | "time_spent"
  | "self_assessment";

export interface LearningDataPoint {
  date: string;
  knowledgeEstimate: number; // 0-100
  source: DataPointSource;
  detail?: string;
}

export interface ModuleLearningCurve {
  moduleId: string;
  moduleName?: string;
  dataPoints: LearningDataPoint[];
  currentKnowledge: number;            // 0-100
  projectedExamKnowledge: number;      // Bei aktuellem Tempo
  requiredDailyMinutes: number;        // Um Ziel (80%) zu erreichen
  forgettingRate: number;              // 0-1, Anteil pro Tag vergessen
  optimalReviewInterval: number;       // Tage
  trend: "improving" | "stable" | "declining";
  lastUpdated: string;
}

// ─── Constants ────────────────────────────────────────────────────

const DEFAULT_FORGETTING_RATE = 0.1;   // 10% pro Tag ohne Review
const KNOWLEDGE_TARGET = 80;           // Ziel-Wissensniveau
const MIN_DATA_POINTS = 3;

// ─── Calculate Learning Curve for a Module ────────────────────────

export async function calculateModuleLearningCurve(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string
): Promise<ModuleLearningCurve> {
  const dataPoints: LearningDataPoint[] = [];
  const now = new Date();

  // 1. Flashcard review data
  const { data: flashcards } = await supabase
    .from("flashcards")
    .select("id, next_review, sr_interval, sr_easiness, updated_at")
    .eq("user_id", userId)
    .eq("module_id", moduleId);

  if (flashcards && flashcards.length > 0) {
    // Estimate knowledge from SR metrics
    const totalCards = flashcards.length;
    const masteredCards = flashcards.filter(
      (c) => c.sr_interval && c.sr_interval > 7
    ).length;
    const dueCards = flashcards.filter(
      (c) => c.next_review && new Date(c.next_review) <= now
    ).length;

    const srKnowledge = totalCards > 0
      ? Math.round(((masteredCards / totalCards) * 70 + ((totalCards - dueCards) / totalCards) * 30))
      : 0;

    dataPoints.push({
      date: now.toISOString(),
      knowledgeEstimate: Math.min(100, srKnowledge),
      source: "flashcard_review",
      detail: `${masteredCards}/${totalCards} gemeistert, ${dueCards} fällig`,
    });
  }

  // 2. Exam results
  const { data: grades } = await supabase
    .from("grades")
    .select("value, date")
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .order("date", { ascending: true });

  if (grades) {
    for (const grade of grades) {
      if (grade.value == null) continue;
      // Swiss grading: 1-6, 4 = pass. Map to 0-100
      const knowledge = Math.round(Math.max(0, Math.min(100, ((grade.value - 1) / 5) * 100)));
      dataPoints.push({
        date: grade.date,
        knowledgeEstimate: knowledge,
        source: "exam_result",
        detail: `Note: ${grade.value}`,
      });
    }
  }

  // 3. Time spent (proxy for knowledge gain)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000).toISOString();
  const { data: sessions } = await supabase
    .from("timer_sessions")
    .select("started_at, actual_duration_seconds, focus_rating")
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .eq("status", "completed")
    .gte("started_at", thirtyDaysAgo)
    .order("started_at", { ascending: true });

  if (sessions && sessions.length > 0) {
    // Group by week, estimate knowledge gain from study time
    const weeklyHours = new Map<string, { hours: number; avgFocus: number; count: number }>();

    for (const sess of sessions) {
      const weekKey = getWeekKey(new Date(sess.started_at));
      const existing = weeklyHours.get(weekKey) || { hours: 0, avgFocus: 0, count: 0 };
      existing.hours += (sess.actual_duration_seconds || 0) / 3600;
      existing.avgFocus += sess.focus_rating || 3;
      existing.count++;
      weeklyHours.set(weekKey, existing);
    }

    // Convert weekly study hours to knowledge estimate
    // Heuristic: 10h/week high-focus study ≈ +15% knowledge
    for (const [weekKey, data] of weeklyHours) {
      const avgFocus = data.count > 0 ? data.avgFocus / data.count : 3;
      const effectiveHours = data.hours * (avgFocus / 5);
      const knowledgeGain = Math.min(20, effectiveHours * 1.5);

      dataPoints.push({
        date: weekKey + "T12:00:00Z",
        knowledgeEstimate: Math.round(knowledgeGain + 30), // Base 30 + gain
        source: "time_spent",
        detail: `${data.hours.toFixed(1)}h, Fokus Ø${avgFocus.toFixed(1)}`,
      });
    }
  }

  // Sort data points by date
  dataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate current knowledge (weighted recent data more)
  const currentKnowledge = calculateCurrentKnowledge(dataPoints);

  // Calculate forgetting rate from data
  const forgettingRate = estimateForgettingRate(dataPoints);

  // Calculate optimal review interval
  const optimalReviewInterval = Math.max(1, Math.round(1 / Math.max(0.01, forgettingRate)));

  // Project exam knowledge (assume exam in 14 days)
  const projectedExamKnowledge = projectKnowledge(
    currentKnowledge,
    forgettingRate,
    14,
    (sessions?.length || 0) > 0
  );

  // Calculate required daily minutes to reach target
  const requiredDailyMinutes = calculateRequiredMinutes(
    currentKnowledge,
    KNOWLEDGE_TARGET,
    forgettingRate,
    14
  );

  // Determine trend
  const trend = determineTrend(dataPoints);

  // Get module name
  const { data: mod } = await supabase
    .from("modules")
    .select("name")
    .eq("id", moduleId)
    .maybeSingle();

  const curve: ModuleLearningCurve = {
    moduleId,
    moduleName: mod?.name || undefined,
    dataPoints,
    currentKnowledge,
    projectedExamKnowledge,
    requiredDailyMinutes,
    forgettingRate,
    optimalReviewInterval,
    trend,
    lastUpdated: now.toISOString(),
  };

  // Persist to DB
  await persistLearningCurve(supabase, userId, curve);

  return curve;
}

// ─── Get All Module Curves ────────────────────────────────────────

export async function getAllLearningCurves(
  supabase: SupabaseClient,
  userId: string
): Promise<ModuleLearningCurve[]> {
  const { data: modules } = await supabase
    .from("modules")
    .select("id, name")
    .eq("user_id", userId);

  if (!modules || modules.length === 0) return [];

  const curves: ModuleLearningCurve[] = [];
  for (const mod of modules) {
    try {
      const curve = await calculateModuleLearningCurve(supabase, userId, mod.id);
      curves.push(curve);
    } catch {
      // Skip modules that fail
    }
  }

  return curves;
}

// ─── Get Cached Curve (from DB) ───────────────────────────────────

export async function getCachedLearningCurve(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string
): Promise<ModuleLearningCurve | null> {
  const { data } = await supabase
    .from("module_learning_curves")
    .select("*")
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (!data) return null;

  return {
    moduleId: data.module_id,
    dataPoints: (data.data_points as LearningDataPoint[]) || [],
    currentKnowledge: Number(data.current_knowledge) || 0,
    projectedExamKnowledge: 0,
    requiredDailyMinutes: 0,
    forgettingRate: Number(data.forgetting_rate) || DEFAULT_FORGETTING_RATE,
    optimalReviewInterval: Math.max(1, Math.round(1 / Math.max(0.01, Number(data.forgetting_rate) || DEFAULT_FORGETTING_RATE))),
    trend: "stable",
    lastUpdated: data.updated_at,
  };
}

// ─── Persist Learning Curve ───────────────────────────────────────

async function persistLearningCurve(
  supabase: SupabaseClient,
  userId: string,
  curve: ModuleLearningCurve
): Promise<void> {
  await supabase.from("module_learning_curves").upsert(
    {
      user_id: userId,
      module_id: curve.moduleId,
      data_points: curve.dataPoints,
      current_knowledge: curve.currentKnowledge,
      forgetting_rate: curve.forgettingRate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,module_id" }
  );
}

// ─── Internal Helpers ─────────────────────────────────────────────

function calculateCurrentKnowledge(dataPoints: LearningDataPoint[]): number {
  if (dataPoints.length === 0) return 0;

  // Weighted average: recent points have more weight
  const now = Date.now();
  let weightedSum = 0;
  let totalWeight = 0;

  for (const dp of dataPoints) {
    const ageMs = now - new Date(dp.date).getTime();
    const ageDays = ageMs / 86400000;

    // Source weights: exam > flashcard > time
    const sourceWeight =
      dp.source === "exam_result" ? 3 :
      dp.source === "flashcard_review" ? 2.5 :
      dp.source === "self_assessment" ? 1.5 : 1;

    // Recency weight: exponential decay
    const recencyWeight = Math.exp(-ageDays / 14);

    const weight = sourceWeight * recencyWeight;
    weightedSum += dp.knowledgeEstimate * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

function estimateForgettingRate(dataPoints: LearningDataPoint[]): number {
  if (dataPoints.length < MIN_DATA_POINTS) return DEFAULT_FORGETTING_RATE;

  // Look for consecutive data points where knowledge decreased
  let totalDecay = 0;
  let decayCount = 0;

  for (let i = 1; i < dataPoints.length; i++) {
    const prev = dataPoints[i - 1];
    const curr = dataPoints[i];
    const daysBetween =
      (new Date(curr.date).getTime() - new Date(prev.date).getTime()) / 86400000;

    if (daysBetween > 0 && curr.knowledgeEstimate < prev.knowledgeEstimate) {
      const decayPerDay = (prev.knowledgeEstimate - curr.knowledgeEstimate) / 100 / daysBetween;
      totalDecay += decayPerDay;
      decayCount++;
    }
  }

  if (decayCount === 0) return DEFAULT_FORGETTING_RATE * 0.5; // Less forgetting than average
  return Math.min(0.3, totalDecay / decayCount); // Cap at 30%/day
}

function projectKnowledge(
  currentKnowledge: number,
  forgettingRate: number,
  daysAhead: number,
  hasActiveSessions: boolean
): number {
  if (!hasActiveSessions) {
    // Pure decay without study
    return Math.round(currentKnowledge * Math.pow(1 - forgettingRate, daysAhead));
  }

  // Assume continued study at current pace offsets some decay
  const studyOffset = forgettingRate * 0.6; // Study offsets ~60% of forgetting
  const netRate = Math.max(0, forgettingRate - studyOffset);
  return Math.round(currentKnowledge * Math.pow(1 - netRate, daysAhead));
}

function calculateRequiredMinutes(
  currentKnowledge: number,
  targetKnowledge: number,
  forgettingRate: number,
  daysRemaining: number
): number {
  if (currentKnowledge >= targetKnowledge) return 0;
  if (daysRemaining <= 0) return 120; // Max suggestion

  const knowledgeGap = targetKnowledge - currentKnowledge;
  // Heuristic: 1 effective hour ≈ 1.5% knowledge gain, adjusted for forgetting
  const effectiveGainPerHour = 1.5 * (1 - forgettingRate);
  const totalHoursNeeded = knowledgeGap / Math.max(0.1, effectiveGainPerHour);
  const dailyMinutes = (totalHoursNeeded * 60) / daysRemaining;

  return Math.min(120, Math.max(15, Math.round(dailyMinutes)));
}

function determineTrend(dataPoints: LearningDataPoint[]): "improving" | "stable" | "declining" {
  if (dataPoints.length < 3) return "stable";

  const recent = dataPoints.slice(-3);
  const older = dataPoints.slice(-6, -3);

  if (older.length === 0) return "stable";

  const recentAvg = recent.reduce((s, p) => s + p.knowledgeEstimate, 0) / recent.length;
  const olderAvg = older.reduce((s, p) => s + p.knowledgeEstimate, 0) / older.length;

  const diff = recentAvg - olderAvg;
  if (diff > 5) return "improving";
  if (diff < -5) return "declining";
  return "stable";
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
  return d.toISOString().slice(0, 10);
}
