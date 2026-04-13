/**
 * Cortex Engine — Adaptive Weight System (C3.2)
 *
 * Passt die Gewichtungen der Engines dynamisch an, basierend auf:
 * - Welche Insights werden befolgt vs. verworfen?
 * - Welche Engines liefern die besten Vorhersagen?
 * - User-Feedback (1-5 Sterne)
 *
 * Tabelle: cortex_weights
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EngineName } from "./types";
import { getRecommendationStats } from "./feedback";

// ─── Types ────────────────────────────────────────────────────────

export interface CortexWeights {
  decision: number;
  schedule: number;
  dna: number;
  patterns: number;
  streaks: number;
  academic: number;
}

export interface WeightRecord {
  user_id: string;
  weights: CortexWeights;
  adjustment_history: WeightAdjustment[];
  updated_at: string;
}

export interface WeightAdjustment {
  date: string;
  reason: string;
  changes: Partial<CortexWeights>;
  previousWeights: CortexWeights;
}

export const DEFAULT_WEIGHTS: CortexWeights = {
  decision: 0.25,
  schedule: 0.20,
  dna: 0.20,
  patterns: 0.15,
  streaks: 0.10,
  academic: 0.10,
};

// ─── Insight → Engine Mapping ─────────────────────────────────────

const INSIGHT_ENGINE_MAP: Record<string, EngineName[]> = {
  planning_execution_gap: ["dna", "schedule"],
  burnout_risk: ["streaks", "dna"],
  exam_underprep: ["academic", "schedule"],
  module_neglect: ["academic", "streaks"],
  grade_trajectory_alert: ["academic", "decision"],
  optimal_time_unused: ["patterns", "schedule"],
  streak_momentum: ["streaks", "dna"],
  knowledge_decay: ["academic", "patterns"],
  schedule_overload: ["schedule", "dna"],
  quick_win_available: ["decision"],
};

// ─── Get Current Weights ──────────────────────────────────────────

export async function getUserWeights(
  supabase: SupabaseClient,
  userId: string
): Promise<CortexWeights> {
  const { data } = await supabase
    .from("cortex_weights")
    .select("weights")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.weights) {
    return data.weights as CortexWeights;
  }

  // Initialize with defaults
  await supabase.from("cortex_weights").upsert({
    user_id: userId,
    weights: DEFAULT_WEIGHTS,
    adjustment_history: [],
    updated_at: new Date().toISOString(),
  });

  return { ...DEFAULT_WEIGHTS };
}

// ─── Recalculate Weights ──────────────────────────────────────────

/**
 * Adjusts weights based on recommendation stats from the last 30 days.
 *
 * Logic:
 * - Insights from engines that get executed (not dismissed) → weight increases
 * - Insights from engines that get dismissed → weight decreases slightly
 * - Positive outcomes → stronger increase
 * - Negative outcomes → decrease
 *
 * Weights are always normalized to sum to 1.0.
 * Maximum change per adjustment: ±0.05
 */
export async function recalculateWeights(
  supabase: SupabaseClient,
  userId: string
): Promise<CortexWeights> {
  const currentWeights = await getUserWeights(supabase, userId);
  const stats = await getRecommendationStats(supabase, userId, 30);

  if (stats.total < 5) {
    // Not enough data to adjust
    return currentWeights;
  }

  const newWeights = { ...currentWeights };
  const changes: Partial<CortexWeights> = {};
  const MAX_DELTA = 0.05;
  const MIN_WEIGHT = 0.05;
  const MAX_WEIGHT = 0.40;

  // Calculate per-engine signals
  for (const [insightType, typeStats] of Object.entries(stats.byType)) {
    const engines = INSIGHT_ENGINE_MAP[insightType];
    if (!engines || typeStats.count < 2) continue;

    const executionRate = typeStats.executed / typeStats.count;
    const dismissalRate = typeStats.dismissed / typeStats.count;

    // Signal: positive if executed > dismissed, negative otherwise
    const signal = executionRate - dismissalRate * 0.5;

    for (const engine of engines) {
      const delta = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, signal * 0.03));

      if (Math.abs(delta) > 0.001) {
        newWeights[engine] = Math.max(
          MIN_WEIGHT,
          Math.min(MAX_WEIGHT, newWeights[engine] + delta)
        );
        changes[engine] = (changes[engine] || 0) + delta;
      }
    }
  }

  // Boost based on overall feedback score
  if (stats.avgFeedbackScore !== null) {
    const feedbackSignal = (stats.avgFeedbackScore - 3) / 10; // [-0.2, +0.2]
    // Apply small global adjustment — engines with high weight get more boost
    for (const engine of Object.keys(newWeights) as EngineName[]) {
      const boost = feedbackSignal * newWeights[engine] * 0.1;
      newWeights[engine] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, newWeights[engine] + boost));
    }
  }

  // Normalize to sum = 1.0
  const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(newWeights) as EngineName[]) {
    newWeights[key] = Math.round((newWeights[key] / sum) * 1000) / 1000;
  }

  // Ensure exact sum of 1.0 after rounding
  const roundedSum = Object.values(newWeights).reduce((a, b) => a + b, 0);
  if (roundedSum !== 1) {
    // Adjust the largest weight to compensate
    const largestEngine = (Object.keys(newWeights) as EngineName[]).reduce(
      (a, b) => (newWeights[a] > newWeights[b] ? a : b)
    );
    newWeights[largestEngine] += Math.round((1 - roundedSum) * 1000) / 1000;
  }

  // Only persist if there were actual changes
  const hasChanges = Object.values(changes).some((c) => c !== undefined && Math.abs(c) > 0.001);

  if (hasChanges) {
    // Get existing history
    const { data: existing } = await supabase
      .from("cortex_weights")
      .select("adjustment_history")
      .eq("user_id", userId)
      .maybeSingle();

    const history: WeightAdjustment[] = (existing?.adjustment_history as WeightAdjustment[]) || [];

    // Keep last 20 adjustments
    history.push({
      date: new Date().toISOString(),
      reason: `Auto-Adjustment basierend auf ${stats.total} Empfehlungen (${stats.executed} ausgeführt, ${stats.dismissed} verworfen)`,
      changes,
      previousWeights: currentWeights,
    });

    const trimmedHistory = history.slice(-20);

    await supabase.from("cortex_weights").upsert({
      user_id: userId,
      weights: newWeights,
      adjustment_history: trimmedHistory,
      updated_at: new Date().toISOString(),
    });
  }

  return newWeights;
}

// ─── Get Weight History ───────────────────────────────────────────

export async function getWeightHistory(
  supabase: SupabaseClient,
  userId: string
): Promise<WeightAdjustment[]> {
  const { data } = await supabase
    .from("cortex_weights")
    .select("adjustment_history")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.adjustment_history as WeightAdjustment[]) || [];
}

// ─── Apply Weights to Insights (for prioritization) ───────────────

export function applyWeightsToInsights(
  weights: CortexWeights,
  insightType: string
): number {
  const engines = INSIGHT_ENGINE_MAP[insightType];
  if (!engines) return 1.0;

  // Weighted average of involved engines
  const totalWeight = engines.reduce((sum, e) => sum + (weights[e] || 0), 0);
  return totalWeight / engines.length;
}
