/**
 * Study Patterns API Route
 *
 * GET  /api/schedule/patterns                → Full pattern analysis (30 days default)
 * GET  /api/schedule/patterns?days=60        → Custom analysis window
 * GET  /api/schedule/patterns?view=hours     → Hourly distribution only
 * GET  /api/schedule/patterns?view=modules   → Module patterns only
 * GET  /api/schedule/patterns?view=insights  → Pattern insights only
 *
 * POST /api/schedule/patterns { action: "refresh" } → Force-refresh stored patterns
 */

import { NextRequest } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  errorResponse,
  successResponse,
  parseBody,
  withErrorHandler,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import {
  analyzeStudyPatterns,
  generatePatternInsights,
} from "@/lib/schedule";
import type { ScheduleBlock, TimerSession } from "@/lib/schedule";

const log = logger("api:patterns");

export async function GET(req: NextRequest) {
  return withErrorHandler("api:patterns", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") || "30", 10);
    const view = url.searchParams.get("view");

    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = addDays(endDate, -days);

    // Fetch sessions
    const { data: sessions, error: sessErr } = await supabase
      .from("timer_sessions")
      .select("*, module:modules(name, color)")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", startDate)
      .order("started_at", { ascending: false });

    if (sessErr) {
      log.error("Failed to fetch sessions", sessErr);
      return errorResponse("Fehler beim Laden der Sessions", 500);
    }

    // Fetch blocks
    const { data: blocks, error: blockErr } = await supabase
      .from("schedule_blocks")
      .select("*, module:modules(name, color, code)")
      .eq("user_id", user.id)
      .gte("start_time", startDate)
      .order("start_time", { ascending: false });

    if (blockErr) {
      log.error("Failed to fetch blocks", blockErr);
      return errorResponse("Fehler beim Laden der Blöcke", 500);
    }

    const patterns = analyzeStudyPatterns(
      (sessions || []) as TimerSession[],
      (blocks || []) as ScheduleBlock[],
      { start: startDate, end: endDate },
    );

    // Return specific view if requested
    if (view === "hours") {
      return successResponse({
        bestHours: patterns.bestHours,
        worstHours: patterns.worstHours,
        allHours: patterns.allHours,
        energyCurve: patterns.energyCurve,
      });
    }

    if (view === "modules") {
      return successResponse({ modulePatterns: patterns.modulePatterns });
    }

    if (view === "insights") {
      const insights = generatePatternInsights(patterns);
      return successResponse({ insights, dataQuality: patterns.dataQuality });
    }

    return successResponse(patterns);
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandler("api:patterns", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody(req);
    if (isErrorResponse(body)) return body;

    if (body.action === "refresh") {
      // Re-analyze and store in study_patterns table
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = addDays(endDate, -30);

      const { data: sessions } = await supabase
        .from("timer_sessions")
        .select("*, module:modules(name, color)")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("started_at", startDate);

      const { data: blocks } = await supabase
        .from("schedule_blocks")
        .select("*, module:modules(name, color, code)")
        .eq("user_id", user.id)
        .gte("start_time", startDate);

      const patterns = analyzeStudyPatterns(
        (sessions || []) as TimerSession[],
        (blocks || []) as ScheduleBlock[],
        { start: startDate, end: endDate },
      );

      // Upsert into study_patterns
      const { error } = await supabase
        .from("study_patterns")
        .upsert({
          user_id: user.id,
          best_hours: patterns.bestHours,
          worst_hours: patterns.worstHours,
          avg_session_minutes: patterns.avgSessionMinutes,
          preferred_duration_minutes: patterns.preferredDurationMinutes,
          longest_productive_session: patterns.longestProductiveSession,
          module_patterns: Object.fromEntries(
            patterns.modulePatterns.map(m => [m.moduleId, m])
          ),
          day_patterns: patterns.dayPatterns,
          current_streak_days: patterns.currentStreakDays,
          longest_streak_days: patterns.longestStreakDays,
          avg_weekly_study_minutes: patterns.avgWeeklyStudyMinutes,
          consistency_score: patterns.consistencyScore,
          adherence_trend: patterns.adherenceTrend,
          avg_start_delay_minutes: patterns.avgStartDelayMinutes,
          skip_rate: patterns.skipRate,
          energy_curve: patterns.energyCurve,
          total_sessions_analyzed: patterns.totalSessionsAnalyzed,
          last_analyzed_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) {
        log.error("Failed to store patterns", error);
        return errorResponse("Fehler beim Speichern der Muster", 500);
      }

      log.info(`Patterns refreshed for user ${user.id}: ${patterns.totalSessionsAnalyzed} sessions analyzed`);
      return successResponse({ refreshed: true, patterns });
    }

    return errorResponse("Unbekannte Aktion", 400);
  });
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
