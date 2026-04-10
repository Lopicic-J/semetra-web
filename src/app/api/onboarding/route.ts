/**
 * Onboarding API
 *
 * POST /api/onboarding — Save onboarding responses and apply to preferences
 * GET  /api/onboarding — Check onboarding status
 *
 * Table `onboarding_responses` has a flat column structure (one row per user).
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

const log = logger("api:onboarding");

// ── GET: Check onboarding status ────────────────────────────────────────────
export async function GET() {
  return withErrorHandler("api:onboarding", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed, onboarding_completed_at")
      .eq("id", user.id)
      .single();

    const { data: responses } = await supabase
      .from("onboarding_responses")
      .select("completed_steps, is_complete")
      .eq("user_id", user.id)
      .maybeSingle();

    return successResponse({
      completed: profile?.onboarding_completed ?? false,
      completed_at: profile?.onboarding_completed_at ?? null,
      completed_steps: responses?.completed_steps ?? 0,
      is_complete: responses?.is_complete ?? false,
    });
  });
}

// ── POST: Save responses (flat columns) and optionally finalize ──────────────

// Allowed fields that map directly to onboarding_responses columns
const ALLOWED_FIELDS = [
  // Step 1: Goals
  "primary_goal", "weekly_study_target_hours",
  // Step 2: Schedule
  "typical_wake_time", "typical_sleep_time", "available_from", "available_until",
  "busy_days", "has_job", "job_hours_per_week",
  // Step 3: Energy
  "energy_morning", "energy_afternoon", "energy_evening",
  "preferred_session_length", "focus_challenge",
  // Step 4: Learning Style
  "learning_style", "prefers_group_study", "uses_flashcards", "uses_pomodoro", "uses_notes",
  // Step 5: Situation
  "semester_number", "modules_this_semester", "exam_anxiety_level",
  // Meta
  "completed_steps",
] as const;

interface OnboardingBody {
  /** Flat key-value pairs matching onboarding_responses columns */
  data: Record<string, unknown>;
  /** Current step number (1-5) */
  step: number;
  /** Set true on last step to finalize */
  finalize?: boolean;
}

export async function POST(req: NextRequest) {
  return withErrorHandler("api:onboarding", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<OnboardingBody>(req);
    if (isErrorResponse(body)) return body;

    const { data, step, finalize } = body;

    if (!data || typeof data !== "object") {
      return errorResponse("data Objekt ist erforderlich", 400);
    }
    if (!step || step < 1 || step > 5) {
      return errorResponse("step muss zwischen 1 und 5 sein", 400);
    }

    // Filter to allowed fields only
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in data) {
        updates[key] = data[key];
      }
    }

    // Track step progress
    updates.completed_steps = step;
    updates.updated_at = new Date().toISOString();

    if (finalize) {
      updates.is_complete = true;
      updates.completed_at = new Date().toISOString();
    }

    // Upsert (one row per user)
    const { error: upsertErr } = await supabase
      .from("onboarding_responses")
      .upsert(
        {
          user_id: user.id,
          ...updates,
        },
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      log.error("Onboarding upsert failed", upsertErr);
      return errorResponse("Antworten konnten nicht gespeichert werden: " + upsertErr.message, 500);
    }

    // If finalizing, apply to preferences
    if (finalize) {
      const { error: rpcErr } = await supabase.rpc(
        "apply_onboarding_to_preferences",
        { p_user_id: user.id }
      );

      if (rpcErr) {
        log.error("apply_onboarding_to_preferences failed", rpcErr);
        // Non-fatal: responses saved, preferences just not auto-applied
      }

      // Mark profile as onboarding completed
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileErr) {
        log.error("Profile onboarding update failed", profileErr);
      }

      log.info(`Onboarding completed for user ${user.id}`);
      return successResponse({ completed: true, message: "Onboarding abgeschlossen!" });
    }

    return successResponse({ saved_step: step });
  });
}
