/**
 * Preference Suggestions API
 *
 * POST /api/preferences/suggestions          — Generate new suggestions from pattern analysis
 * GET  /api/preferences/suggestions          — Get pending suggestions
 * PATCH /api/preferences/suggestions         — Accept or dismiss a suggestion
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

const log = logger("api:preferences:suggestions");

// ── GET: Fetch pending suggestions ──────────────────────────────────────────

export async function GET() {
  return withErrorHandler("api:preferences:suggestions", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const { data, error } = await supabase
      .from("preference_suggestions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      log.error("Failed to fetch suggestions", error);
      return errorResponse("Vorschläge konnten nicht geladen werden", 500);
    }

    return successResponse({ suggestions: data ?? [] });
  });
}

// ── POST: Generate new suggestions from patterns ────────────────────────────

export async function POST() {
  return withErrorHandler("api:preferences:suggestions", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    // Call the DB function that analyzes sessions and generates suggestions
    const { error: rpcErr } = await supabase.rpc(
      "generate_preference_suggestions",
      { p_user_id: user.id }
    );

    if (rpcErr) {
      log.error("generate_preference_suggestions failed", rpcErr);
      return errorResponse(
        "Vorschläge konnten nicht generiert werden: " + rpcErr.message,
        500
      );
    }

    // Fetch the newly generated suggestions
    const { data } = await supabase
      .from("preference_suggestions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    log.info(`Generated preference suggestions for user ${user.id}`);
    return successResponse({ suggestions: data ?? [] });
  });
}

// ── PATCH: Accept or dismiss a suggestion ───────────────────────────────────

interface PatchBody {
  suggestion_id: string;
  action: "accept" | "dismiss";
}

export async function PATCH(req: NextRequest) {
  return withErrorHandler("api:preferences:suggestions", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<PatchBody>(req);
    if (isErrorResponse(body)) return body;

    const { suggestion_id, action } = body;

    if (!suggestion_id || !action) {
      return errorResponse("suggestion_id und action sind erforderlich", 400);
    }

    if (!["accept", "dismiss"].includes(action)) {
      return errorResponse("action muss 'accept' oder 'dismiss' sein", 400);
    }

    // Verify the suggestion belongs to this user
    const { data: suggestion, error: fetchErr } = await supabase
      .from("preference_suggestions")
      .select("*")
      .eq("id", suggestion_id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !suggestion) {
      return errorResponse("Vorschlag nicht gefunden", 404);
    }

    if (action === "accept") {
      // Apply the suggested value to user preferences
      const field = suggestion.preference_key;
      const newValue = suggestion.suggested_value;

      const { error: updateErr } = await supabase
        .from("user_schedule_preferences")
        .upsert(
          {
            user_id: user.id,
            [field]: newValue,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (updateErr) {
        log.error("Failed to apply suggestion", updateErr);
        return errorResponse("Vorschlag konnte nicht angewendet werden", 500);
      }
    }

    // Update suggestion status
    const { error: statusErr } = await supabase
      .from("preference_suggestions")
      .update({
        status: action === "accept" ? "accepted" : "dismissed",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", suggestion_id);

    if (statusErr) {
      log.error("Failed to update suggestion status", statusErr);
    }

    return successResponse({
      suggestion_id,
      action,
      message: action === "accept" ? "Vorschlag angewendet" : "Vorschlag verworfen",
    });
  });
}
