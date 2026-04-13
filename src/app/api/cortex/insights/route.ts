/**
 * Cortex Insights API
 *
 * GET   /api/cortex/insights       — Aktuelle Insights (max 10, priorisiert)
 * PATCH /api/cortex/insights       — Insight verwerfen oder Aktion ausführen
 */

import { NextRequest } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  errorResponse,
  successResponse,
  withErrorHandler,
  parseBody,
} from "@/lib/api-helpers";
import { runCortexCycle } from "@/lib/cortex/core";
import { generateInsights } from "@/lib/cortex/analyzer";
import { generateActions } from "@/lib/cortex/actions";

// ── GET — Current Insights ───────────────────────────────────────

export async function GET(_req: NextRequest) {
  return withErrorHandler("api:cortex:insights", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const state = await runCortexCycle(supabase, user.id);
    const insights = await generateInsights(supabase, user.id, state);
    const actions = generateActions(insights);

    return successResponse({
      insights,
      actions,
      meta: {
        total: insights.length,
        critical: insights.filter((i) => i.severity === "critical").length,
        actionable: actions.filter((a) => a.autoExecutable).length,
        generatedAt: new Date().toISOString(),
      },
    });
  });
}

// ── PATCH — Dismiss / Execute ────────────────────────────────────

export async function PATCH(req: NextRequest) {
  return withErrorHandler("api:cortex:insights", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<{
      insightId: string;
      action: "dismiss" | "execute";
    }>(req);
    if (isErrorResponse(body)) return body;

    const { insightId, action } = body;

    if (!insightId || !action) {
      return errorResponse("insightId und action sind erforderlich", 400);
    }

    if (action === "dismiss") {
      // Log the dismissal
      await supabase.from("cortex_actions").insert({
        user_id: user.id,
        action_type: "insight_dismissed",
        engine: "cross-engine",
        description: `Insight ${insightId} verworfen`,
        auto_executed: false,
        result: { insightId, dismissed: true },
      });

      return successResponse({ dismissed: true, insightId });
    }

    if (action === "execute") {
      // Log the execution request
      await supabase.from("cortex_actions").insert({
        user_id: user.id,
        action_type: "insight_executed",
        engine: "cross-engine",
        description: `Aktion für Insight ${insightId} ausgeführt`,
        auto_executed: false,
        result: { insightId, executed: true },
      });

      return successResponse({ executed: true, insightId });
    }

    return errorResponse("Ungültige Aktion. Erlaubt: dismiss, execute", 400);
  });
}
