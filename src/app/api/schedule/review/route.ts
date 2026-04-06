/**
 * Weekly Review API Route
 *
 * GET  /api/schedule/review                     → Current week review
 * GET  /api/schedule/review?week=YYYY-MM-DD     → Specific week (Monday)
 * GET  /api/schedule/review?list=true            → List all saved reviews
 *
 * POST /api/schedule/review { action: "generate", week: "YYYY-MM-DD" }  → Generate & save
 * PATCH /api/schedule/review { id, user_reflection, mood_rating }       → Update reflection
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
import { generateWeeklyReview } from "@/lib/schedule";
import type { ScheduleBlock, TimerSession, SchedulePreferences } from "@/lib/schedule";
import { DEFAULT_PREFERENCES } from "@/lib/schedule";

const log = logger("api:review");

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  if (isErrorResponse(auth)) return auth;
  const { supabase, user } = auth;

  const url = new URL(req.url);
  const listMode = url.searchParams.get("list") === "true";

  if (listMode) {
    const { data, error } = await supabase
      .from("weekly_reviews")
      .select("id, week_start, week_end, overall_adherence, sessions_completed, total_effective_minutes, is_read, mood_rating, created_at")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .limit(12);

    if (error) return errorResponse("Fehler beim Laden der Reviews", 500);
    return successResponse(data || []);
  }

  // Get specific or current week review
  const weekParam = url.searchParams.get("week");
  const weekStart = weekParam || getMonday(new Date().toISOString().slice(0, 10));

  // Check if saved review exists
  const { data: saved } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .single();

  if (saved) {
    return successResponse(saved);
  }

  // Generate on-the-fly
  const review = await generateReviewForWeek(supabase, user.id, weekStart);
  return successResponse(review);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  if (isErrorResponse(auth)) return auth;
  const { supabase, user } = auth;

  const body = await parseBody(req);
  if (isErrorResponse(body)) return body;

  if (body.action === "generate") {
    const weekStart = body.week || getMonday(new Date().toISOString().slice(0, 10));
    const weekEnd = addDays(weekStart, 6);

    const review = await generateReviewForWeek(supabase, user.id, weekStart);

    // Save to DB
    const { data, error } = await supabase
      .from("weekly_reviews")
      .upsert({
        user_id: user.id,
        week_start: weekStart,
        week_end: weekEnd,
        total_planned_minutes: review.metrics.totalPlannedMinutes,
        total_actual_minutes: review.metrics.totalActualMinutes,
        total_effective_minutes: review.metrics.totalEffectiveMinutes,
        overall_adherence: review.metrics.overallAdherence,
        sessions_completed: review.metrics.sessionsCompleted,
        blocks_completed: review.metrics.blocksCompleted,
        blocks_skipped: review.metrics.blocksSkipped,
        blocks_rescheduled: review.metrics.blocksRescheduled,
        module_stats: review.moduleStats,
        best_day: review.metrics.bestDay,
        best_hour: review.metrics.bestHour,
        avg_session_minutes: review.metrics.avgSessionMinutes,
        avg_focus_rating: review.metrics.avgFocusRating,
        avg_energy_level: review.metrics.avgEnergyLevel,
        vs_prev_week: review.vsPrevWeek,
        vs_4_week_avg: review.vs4WeekAvg,
        insights: review.insights,
        recommendations: review.recommendations,
        goals: review.goals,
      }, { onConflict: "user_id,week_start" })
      .select()
      .single();

    if (error) {
      log.error("Failed to save review", error);
      return errorResponse("Fehler beim Speichern des Reviews", 500);
    }

    log.info(`Weekly review generated for user ${user.id}, week ${weekStart}`);
    return successResponse({ ...data, _computed: review });
  }

  return errorResponse("Unbekannte Aktion", 400);
});

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  if (isErrorResponse(auth)) return auth;
  const { supabase, user } = auth;

  const body = await parseBody(req);
  if (isErrorResponse(body)) return body;

  if (!body.id) return errorResponse("Review-ID erforderlich", 400);

  const updates: Record<string, any> = {};
  if (body.user_reflection !== undefined) updates.user_reflection = body.user_reflection;
  if (body.mood_rating !== undefined) updates.mood_rating = body.mood_rating;
  if (body.is_read !== undefined) updates.is_read = body.is_read;

  if (Object.keys(updates).length === 0) {
    return errorResponse("Keine Änderungen angegeben", 400);
  }

  const { data, error } = await supabase
    .from("weekly_reviews")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return errorResponse("Fehler beim Aktualisieren", 500);
  return successResponse(data);
});


// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateReviewForWeek(supabase: any, userId: string, weekStart: string) {
  const weekEnd = addDays(weekStart, 6);
  const prevWeekStart = addDays(weekStart, -7);
  const fourWeekStart = addDays(weekStart, -28);

  // Fetch data in parallel
  const [
    { data: blocks },
    { data: sessions },
    { data: prevBlocks },
    { data: prevSessions },
    { data: fourWeekBlocksData },
    { data: fourWeekSessionsData },
    { data: prefsData },
  ] = await Promise.all([
    supabase.from("schedule_blocks")
      .select("*, module:modules(name, color, code)")
      .eq("user_id", userId)
      .gte("start_time", weekStart)
      .lte("start_time", weekEnd + "T23:59:59Z"),
    supabase.from("timer_sessions")
      .select("*, module:modules(name, color)")
      .eq("user_id", userId)
      .gte("started_at", weekStart)
      .lte("started_at", weekEnd + "T23:59:59Z"),
    supabase.from("schedule_blocks")
      .select("*, module:modules(name, color, code)")
      .eq("user_id", userId)
      .gte("start_time", prevWeekStart)
      .lt("start_time", weekStart),
    supabase.from("timer_sessions")
      .select("*, module:modules(name, color)")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("started_at", prevWeekStart)
      .lt("started_at", weekStart),
    supabase.from("schedule_blocks")
      .select("*, module:modules(name, color, code)")
      .eq("user_id", userId)
      .gte("start_time", fourWeekStart)
      .lt("start_time", weekStart),
    supabase.from("timer_sessions")
      .select("*, module:modules(name, color)")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("started_at", fourWeekStart)
      .lt("started_at", weekStart),
    supabase.from("user_schedule_preferences")
      .select("*")
      .eq("user_id", userId)
      .single(),
  ]);

  const prefs = prefsData || DEFAULT_PREFERENCES;

  return generateWeeklyReview(
    (blocks || []) as ScheduleBlock[],
    (sessions || []) as TimerSession[],
    prefs as SchedulePreferences,
    weekStart,
    (prevBlocks || []) as ScheduleBlock[],
    (prevSessions || []) as TimerSession[],
    (fourWeekBlocksData || []) as ScheduleBlock[],
    (fourWeekSessionsData || []) as TimerSession[],
  );
}

function getMonday(date: string): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
