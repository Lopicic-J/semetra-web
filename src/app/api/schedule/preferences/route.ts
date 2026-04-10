/**
 * Schedule Preferences API
 *
 * GET  /api/schedule/preferences  → Get user's schedule preferences
 * PUT  /api/schedule/preferences  → Update preferences (upsert)
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
import { DEFAULT_PREFERENCES } from "@/lib/schedule";

const log = logger("api:schedule:preferences");

export async function GET(req: NextRequest) {
  return withErrorHandler("api:schedule:preferences", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const { data } = await supabase
      .from("user_schedule_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return successResponse(data || { ...DEFAULT_PREFERENCES, user_id: user.id });
  });
}

export async function PUT(req: NextRequest) {
  return withErrorHandler("api:schedule:preferences", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<Record<string, unknown>>(req);
    if (isErrorResponse(body)) return body;

    // Validate time fields
    const timeFields = ["wake_time", "sleep_time", "available_from", "available_until"];
    for (const tf of timeFields) {
      if (body[tf] && !/^\d{2}:\d{2}$/.test(body[tf] as string)) {
        return errorResponse(`${tf} muss im Format HH:MM sein`, 400);
      }
    }

    // Validate energy levels
    for (const field of ["energy_morning", "energy_afternoon", "energy_evening"]) {
      if (field in body) {
        const val = body[field] as number;
        if (val < 1 || val > 5) return errorResponse(`${field} muss zwischen 1 und 5 sein`, 400);
      }
    }

    const allowedFields = [
      "wake_time", "sleep_time",
      "available_from", "available_until",
      "min_study_block_minutes", "max_study_block_minutes",
      "preferred_break_minutes", "max_daily_study_minutes",
      "energy_morning", "energy_afternoon", "energy_evening",
      "prefer_consistent_times", "allow_weekend_study", "weekend_max_minutes",
      "auto_plan_enabled", "auto_reschedule_missed",
      "auto_sync_stundenplan", "auto_fill_gaps",
      "exam_prep_start_days_before", "exam_prep_min_hours", "exam_prep_daily_max_minutes",
      "pomodoro_focus_minutes", "pomodoro_short_break",
      "pomodoro_long_break", "pomodoro_sessions_before_long",
    ];

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    const { data, error } = await supabase
      .from("user_schedule_preferences")
      .upsert({
        user_id: user.id,
        ...updates,
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      log.error("Preferences update failed", error);
      return errorResponse("Einstellungen konnten nicht gespeichert werden: " + error.message, 500);
    }

    return successResponse(data);
  });
}
