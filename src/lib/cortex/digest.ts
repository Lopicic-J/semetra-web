/**
 * Cortex Engine — Weekly Digest (C3.4)
 *
 * Generiert einen wöchentlichen Bericht der Cortex-Aktivität:
 * - Was hat der Cortex diese Woche entdeckt?
 * - Welche Reparaturen wurden durchgeführt?
 * - Welche Empfehlungen wurden befolgt?
 * - Wie hat sich die Gesundheit verändert?
 * - Vorhersage für nächste Woche
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecommendationStats } from "./feedback";
import { getUserWeights } from "./weights";
import type { OverallHealth } from "./types";

// ─── Types ────────────────────────────────────────────────────────

export interface WeeklyDigest {
  userId: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;

  // Health evolution
  health: {
    current: OverallHealth;
    weekAgo: OverallHealth | null;
    trend: "improving" | "stable" | "declining";
  };

  // Activity summary
  activity: {
    cortexCycles: number;
    issuesDetected: number;
    autoRepaired: number;
    insightsGenerated: number;
  };

  // Recommendation performance
  recommendations: {
    presented: number;
    executed: number;
    dismissed: number;
    acceptanceRate: number;
    topInsightTypes: string[];
  };

  // Study metrics
  study: {
    totalHours: number;
    sessionsCount: number;
    avgFocusRating: number | null;
    avgEnergyLevel: number | null;
    modulesStudied: number;
  };

  // Key highlights (natural language)
  highlights: string[];

  // Prediction
  prediction: string;
}

// ─── Generate Weekly Digest ───────────────────────────────────────

export async function generateWeeklyDigest(
  supabase: SupabaseClient,
  userId: string
): Promise<WeeklyDigest> {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(now.getTime() - 7 * 86400 * 1000);
  weekStart.setHours(0, 0, 0, 0);

  const weekStartISO = weekStart.toISOString();
  const weekEndISO = weekEnd.toISOString();

  // Parallel data fetches
  const [
    snapshotsResult,
    actionsResult,
    recStats,
    sessionsResult,
    prevSnapshotResult,
    weights,
  ] = await Promise.all([
    // Cortex snapshots from this week
    supabase
      .from("cortex_snapshots")
      .select("overall_health, integrity_report, created_at")
      .eq("user_id", userId)
      .gte("created_at", weekStartISO)
      .lte("created_at", weekEndISO)
      .order("created_at", { ascending: false }),

    // Cortex actions from this week
    supabase
      .from("cortex_actions")
      .select("action_type, auto_executed, created_at")
      .eq("user_id", userId)
      .gte("created_at", weekStartISO)
      .lte("created_at", weekEndISO),

    // Recommendation stats
    getRecommendationStats(supabase, userId, 7),

    // Timer sessions from this week
    supabase
      .from("timer_sessions")
      .select("actual_duration_seconds, focus_rating, energy_level, module_id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("started_at", weekStartISO)
      .lte("started_at", weekEndISO),

    // Last week's latest snapshot (for comparison)
    supabase
      .from("cortex_snapshots")
      .select("overall_health")
      .eq("user_id", userId)
      .lt("created_at", weekStartISO)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    getUserWeights(supabase, userId),
  ]);

  const snapshots = snapshotsResult.data || [];
  const actions = actionsResult.data || [];
  const sessions = sessionsResult.data || [];

  // Health evolution
  const currentHealth: OverallHealth =
    (snapshots[0]?.overall_health as OverallHealth) || "healthy";
  const prevHealth = prevSnapshotResult.data?.overall_health as OverallHealth | null;

  const healthTrend = !prevHealth
    ? "stable" as const
    : currentHealth === "healthy" && prevHealth !== "healthy"
      ? "improving" as const
      : currentHealth !== "healthy" && prevHealth === "healthy"
        ? "declining" as const
        : "stable" as const;

  // Activity metrics
  const totalIssues = snapshots.reduce((sum, s) => {
    const report = s.integrity_report as { issuesFound?: number } | null;
    return sum + (report?.issuesFound || 0);
  }, 0);

  const totalRepaired = snapshots.reduce((sum, s) => {
    const report = s.integrity_report as { autoRepaired?: number } | null;
    return sum + (report?.autoRepaired || 0);
  }, 0);

  // Study metrics
  const totalSeconds = sessions.reduce(
    (sum, s) => sum + (s.actual_duration_seconds || 0), 0
  );
  const focusRatings = sessions.filter((s) => s.focus_rating);
  const energyLevels = sessions.filter((s) => s.energy_level);
  const moduleIds = new Set(sessions.map((s) => s.module_id).filter(Boolean));

  // Top insight types
  const topTypes = Object.entries(recStats.byType)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([type]) => type);

  // Generate highlights
  const highlights = generateHighlights(
    currentHealth,
    healthTrend,
    totalIssues,
    totalRepaired,
    recStats,
    sessions.length,
    totalSeconds / 3600
  );

  // Generate prediction
  const prediction = generatePrediction(
    currentHealth,
    healthTrend,
    recStats,
    sessions.length
  );

  return {
    userId,
    weekStart: weekStartISO,
    weekEnd: weekEndISO,
    generatedAt: now.toISOString(),
    health: {
      current: currentHealth,
      weekAgo: prevHealth,
      trend: healthTrend,
    },
    activity: {
      cortexCycles: snapshots.length,
      issuesDetected: totalIssues,
      autoRepaired: totalRepaired,
      insightsGenerated: actions.filter((a) => a.action_type !== "insight_dismissed").length,
    },
    recommendations: {
      presented: recStats.presented,
      executed: recStats.executed,
      dismissed: recStats.dismissed,
      acceptanceRate: recStats.acceptanceRate,
      topInsightTypes: topTypes,
    },
    study: {
      totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
      sessionsCount: sessions.length,
      avgFocusRating: focusRatings.length > 0
        ? Math.round(focusRatings.reduce((s, x) => s + x.focus_rating, 0) / focusRatings.length * 10) / 10
        : null,
      avgEnergyLevel: energyLevels.length > 0
        ? Math.round(energyLevels.reduce((s, x) => s + x.energy_level, 0) / energyLevels.length * 10) / 10
        : null,
      modulesStudied: moduleIds.size,
    },
    highlights,
    prediction,
  };
}

// ─── Highlight Generator ──────────────────────────────────────────

function generateHighlights(
  health: OverallHealth,
  trend: string,
  issues: number,
  repaired: number,
  recStats: Awaited<ReturnType<typeof getRecommendationStats>>,
  sessions: number,
  hours: number
): string[] {
  const highlights: string[] = [];

  // Health highlight
  if (health === "healthy") {
    highlights.push("Alle Systeme liefen diese Woche reibungslos.");
  } else if (trend === "improving") {
    highlights.push("Die System-Gesundheit hat sich diese Woche verbessert.");
  } else if (health === "critical") {
    highlights.push("Achtung: Kritische Probleme wurden diese Woche erkannt.");
  }

  // Repair highlight
  if (repaired > 0) {
    highlights.push(`${repaired} Problem${repaired > 1 ? "e" : ""} wurde${repaired > 1 ? "n" : ""} automatisch repariert.`);
  }

  // Study highlight
  if (sessions > 0) {
    highlights.push(`${sessions} Lernsessions mit insgesamt ${hours.toFixed(1)}h Studienzeit.`);
  } else {
    highlights.push("Keine Lernsessions diese Woche registriert.");
  }

  // Recommendation highlight
  if (recStats.executed > 0) {
    highlights.push(
      `${recStats.executed} von ${recStats.presented} Empfehlungen umgesetzt (${Math.round(recStats.acceptanceRate * 100)}% Akzeptanzrate).`
    );
  }

  return highlights;
}

// ─── Prediction Generator ─────────────────────────────────────────

function generatePrediction(
  health: OverallHealth,
  trend: string,
  recStats: Awaited<ReturnType<typeof getRecommendationStats>>,
  sessions: number
): string {
  if (health === "healthy" && sessions > 10 && recStats.acceptanceRate > 0.6) {
    return "Nächste Woche sieht gut aus. Halte dein Tempo bei und achte auf ausreichend Pausen.";
  }

  if (health === "critical" || trend === "declining") {
    return "Die Tendenz ist abnehmend. Fokussiere dich auf die kritischen Insights und reduziere gegebenenfalls das Pensum.";
  }

  if (sessions < 3) {
    return "Deine Aktivität war diese Woche niedrig. Versuche nächste Woche regelmässiger zu lernen — selbst kurze Sessions helfen.";
  }

  if (recStats.acceptanceRate < 0.3 && recStats.presented > 3) {
    return "Du hast viele Empfehlungen verworfen. Der Cortex passt sich an — nächste Woche werden die Vorschläge relevanter.";
  }

  return "Gute Basis für nächste Woche. Bleib am Ball und nutze die Cortex-Insights für gezielte Verbesserungen.";
}
