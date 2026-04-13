/**
 * Cortex Engine — Recommendation Tracker (C3.1)
 *
 * Trackt ob Cortex-Empfehlungen dem User angezeigt, befolgt
 * und erfolgreich waren. Liefert Daten für das Adaptive Weight System.
 *
 * Tabelle: cortex_recommendations
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrossEngineInsight, ProactiveAction } from "./types";

// ─── Types ────────────────────────────────────────────────────────

export interface RecommendationRecord {
  id: string;
  user_id: string;
  insight_type: string;
  action_type: string;
  title: string;
  presented_at: string;
  dismissed_at: string | null;
  executed_at: string | null;
  outcome_positive: boolean | null;
  feedback_score: number | null;
  metadata: Record<string, unknown>;
}

export interface RecommendationStats {
  total: number;
  presented: number;
  dismissed: number;
  executed: number;
  positiveOutcomes: number;
  negativeOutcomes: number;
  avgFeedbackScore: number | null;
  /** Acceptance rate = executed / (executed + dismissed) */
  acceptanceRate: number;
  /** Success rate = positive / (positive + negative) */
  successRate: number;
  /** Per insight type breakdown */
  byType: Record<string, {
    count: number;
    executed: number;
    dismissed: number;
    avgScore: number | null;
  }>;
}

// ─── Track Recommendation Presented ───────────────────────────────

export async function trackRecommendationPresented(
  supabase: SupabaseClient,
  userId: string,
  insight: CrossEngineInsight,
  action: ProactiveAction
): Promise<string | null> {
  const { data, error } = await supabase
    .from("cortex_recommendations")
    .insert({
      user_id: userId,
      insight_type: insight.type,
      action_type: action.type,
      title: action.title,
      presented_at: new Date().toISOString(),
      metadata: {
        insightId: insight.id,
        actionId: action.id,
        severity: insight.severity,
        engines: insight.engines,
        priority: action.priority,
      },
    })
    .select("id")
    .single();

  if (error) return null;
  return data.id;
}

// ─── Track Dismissed ──────────────────────────────────────────────

export async function trackRecommendationDismissed(
  supabase: SupabaseClient,
  userId: string,
  recommendationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("cortex_recommendations")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", recommendationId)
    .eq("user_id", userId);

  return !error;
}

// ─── Track Executed ───────────────────────────────────────────────

export async function trackRecommendationExecuted(
  supabase: SupabaseClient,
  userId: string,
  recommendationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("cortex_recommendations")
    .update({ executed_at: new Date().toISOString() })
    .eq("id", recommendationId)
    .eq("user_id", userId);

  return !error;
}

// ─── Track Outcome ────────────────────────────────────────────────

export async function trackRecommendationOutcome(
  supabase: SupabaseClient,
  userId: string,
  recommendationId: string,
  positive: boolean,
  feedbackScore?: number
): Promise<boolean> {
  const updates: Record<string, unknown> = {
    outcome_positive: positive,
  };
  if (feedbackScore !== undefined && feedbackScore >= 1 && feedbackScore <= 5) {
    updates.feedback_score = feedbackScore;
  }

  const { error } = await supabase
    .from("cortex_recommendations")
    .update(updates)
    .eq("id", recommendationId)
    .eq("user_id", userId);

  return !error;
}

// ─── Get Recommendation Stats ─────────────────────────────────────

export async function getRecommendationStats(
  supabase: SupabaseClient,
  userId: string,
  daysBack = 30
): Promise<RecommendationStats> {
  const since = new Date(Date.now() - daysBack * 86400 * 1000).toISOString();

  const { data: recs } = await supabase
    .from("cortex_recommendations")
    .select("*")
    .eq("user_id", userId)
    .gte("presented_at", since)
    .order("presented_at", { ascending: false });

  const records = (recs || []) as RecommendationRecord[];

  const dismissed = records.filter((r) => r.dismissed_at);
  const executed = records.filter((r) => r.executed_at);
  const withOutcome = records.filter((r) => r.outcome_positive !== null);
  const positive = withOutcome.filter((r) => r.outcome_positive);
  const negative = withOutcome.filter((r) => !r.outcome_positive);
  const withScore = records.filter((r) => r.feedback_score !== null);

  // Per-type breakdown
  const byType: RecommendationStats["byType"] = {};
  for (const rec of records) {
    const type = rec.insight_type;
    if (!byType[type]) {
      byType[type] = { count: 0, executed: 0, dismissed: 0, avgScore: null };
    }
    byType[type].count++;
    if (rec.executed_at) byType[type].executed++;
    if (rec.dismissed_at) byType[type].dismissed++;
  }

  // Calculate avg scores per type
  for (const type of Object.keys(byType)) {
    const typeRecs = records.filter((r) => r.insight_type === type && r.feedback_score !== null);
    if (typeRecs.length > 0) {
      byType[type].avgScore =
        typeRecs.reduce((sum, r) => sum + (r.feedback_score || 0), 0) / typeRecs.length;
    }
  }

  const decidedCount = executed.length + dismissed.length;
  const outcomeCount = positive.length + negative.length;

  return {
    total: records.length,
    presented: records.length,
    dismissed: dismissed.length,
    executed: executed.length,
    positiveOutcomes: positive.length,
    negativeOutcomes: negative.length,
    avgFeedbackScore:
      withScore.length > 0
        ? withScore.reduce((sum, r) => sum + (r.feedback_score || 0), 0) / withScore.length
        : null,
    acceptanceRate: decidedCount > 0 ? executed.length / decidedCount : 0,
    successRate: outcomeCount > 0 ? positive.length / outcomeCount : 0,
    byType,
  };
}

// ─── Get Recent Recommendations (for UI) ──────────────────────────

export async function getRecentRecommendations(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<RecommendationRecord[]> {
  const { data } = await supabase
    .from("cortex_recommendations")
    .select("*")
    .eq("user_id", userId)
    .order("presented_at", { ascending: false })
    .limit(limit);

  return (data || []) as RecommendationRecord[];
}
