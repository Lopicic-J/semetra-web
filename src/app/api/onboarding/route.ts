/**
 * Onboarding API
 *
 * POST /api/onboarding — Save onboarding responses and apply to preferences
 * GET  /api/onboarding — Check onboarding status
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

    // Also check if there are existing responses
    const { data: responses } = await supabase
      .from("onboarding_responses")
      .select("step, completed_at")
      .eq("user_id", user.id)
      .order("step", { ascending: true });

    return successResponse({
      completed: profile?.onboarding_completed ?? false,
      completed_at: profile?.onboarding_completed_at ?? null,
      steps: responses ?? [],
    });
  });
}

// ── POST: Save responses and apply to preferences ───────────────────────────

interface OnboardingStep {
  step: number;
  step_name: string;
  responses: Record<string, unknown>;
}

interface OnboardingBody {
  steps: OnboardingStep[];
  finalize?: boolean; // Set to true on last step to trigger preference application
}

export async function POST(req: NextRequest) {
  return withErrorHandler("api:onboarding", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<OnboardingBody>(req);
    if (isErrorResponse(body)) return body;

    const { steps, finalize } = body;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return errorResponse("steps[] ist erforderlich", 400);
    }

    // Validate each step
    for (const step of steps) {
      if (!step.step || !step.step_name || !step.responses) {
        return errorResponse("Jeder Step braucht step, step_name und responses", 400);
      }
      if (step.step < 1 || step.step > 5) {
        return errorResponse("step muss zwischen 1 und 5 sein", 400);
      }
    }

    // Upsert each step's responses
    for (const step of steps) {
      const { error: upsertErr } = await supabase
        .from("onboarding_responses")
        .upsert(
          {
            user_id: user.id,
            step: step.step,
            step_name: step.step_name,
            responses: step.responses,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,step" }
        );

      if (upsertErr) {
        log.error(`Step ${step.step} upsert failed`, upsertErr);
        return errorResponse(`Schritt ${step.step} konnte nicht gespeichert werden: ${upsertErr.message}`, 500);
      }
    }

    // If finalizing (all steps done), apply to preferences
    if (finalize) {
      // Call the DB function that converts onboarding answers to preferences
      const { error: rpcErr } = await supabase.rpc(
        "apply_onboarding_to_preferences",
        { p_user_id: user.id }
      );

      if (rpcErr) {
        log.error("apply_onboarding_to_preferences failed", rpcErr);
        return errorResponse(
          "Onboarding-Antworten gespeichert, aber Preferences konnten nicht angewendet werden: " + rpcErr.message,
          500
        );
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

    return successResponse({ saved: steps.map((s) => s.step) });
  });
}
