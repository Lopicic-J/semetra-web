/**
 * Cortex API — Compact Health Check
 *
 * GET /api/cortex/health — Kompakter Health-Check (für Monitoring / Dashboard Widget)
 *
 * Returns a lightweight summary:
 * {
 *   overall: "healthy" | "degraded" | "critical",
 *   engines: { decision: "healthy", schedule: "stale", ... },
 *   issues: 3,
 *   lastCycle: "2026-04-13T10:00:00Z"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  withErrorHandler,
} from "@/lib/api-helpers";
import { runCortexCycle } from "@/lib/cortex/core";
import type { EngineName } from "@/lib/cortex/types";

export async function GET(_req: NextRequest) {
  return withErrorHandler("api:cortex:health", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const state = await runCortexCycle(supabase, user.id);

    // Compact summary
    const engineSummary: Record<string, string> = {};
    for (const [name, health] of Object.entries(state.engines)) {
      engineSummary[name] = health.status;
    }

    // Engine-specific staleness warnings
    const staleEngines = (Object.keys(state.engines) as EngineName[]).filter(
      (k) => state.engines[k].status !== "healthy"
    );

    return NextResponse.json(
      {
        overall: state.overallHealth,
        engines: engineSummary,
        issues: state.integrity.issuesFound,
        autoRepaired: state.integrity.autoRepaired,
        staleEngines,
        actions: state.actions.length,
        lastCycle: state.timestamp,
        cycleDuration: state.cycleDuration,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=120, stale-while-revalidate=60",
        },
      }
    );
  });
}
