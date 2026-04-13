/**
 * Cortex API — Main Route
 *
 * GET  /api/cortex        — Voller Cortex-Zustand (cached 5min)
 * POST /api/cortex/cycle  — Manueller Cortex-Zyklus + Auto-Reparatur
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  errorResponse,
  successResponse,
  withErrorHandler,
} from "@/lib/api-helpers";
import { runCortexCycle, persistCortexSnapshot } from "@/lib/cortex/core";
import { generateInsights } from "@/lib/cortex/analyzer";
import { generateActions } from "@/lib/cortex/actions";

// In-memory cache per user (short-lived server process)
const cache = new Map<string, { state: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Build full state with insights ───────────────────────────────

async function buildFullState(supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>, user: { id: string }) {
  const state = await runCortexCycle(supabase, user.id);
  const insights = await generateInsights(supabase, user.id, state);
  const proactiveActions = generateActions(insights);

  return { ...state, insights, proactiveActions };
}

// ── GET — Full Cortex State ──────────────────────────────────────

export async function GET(_req: NextRequest) {
  return withErrorHandler("api:cortex", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    // Check cache
    const cached = cache.get(user.id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.state, {
        headers: {
          "X-Cortex-Cache": "HIT",
          "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
        },
      });
    }

    // Run fresh cycle with insights
    const fullState = await buildFullState(supabase, user);

    // Cache result
    cache.set(user.id, { state: fullState, timestamp: Date.now() });

    // Persist core state in background (fire-and-forget)
    persistCortexSnapshot(supabase, fullState);

    return NextResponse.json(fullState, {
      headers: {
        "X-Cortex-Cache": "MISS",
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
      },
    });
  });
}

// ── POST — Manual Cortex Cycle ───────────────────────────────────

export async function POST(_req: NextRequest) {
  return withErrorHandler("api:cortex", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    // Force fresh cycle with insights (ignore cache)
    const fullState = await buildFullState(supabase, user);

    // Update cache
    cache.set(user.id, { state: fullState, timestamp: Date.now() });

    // Persist
    await persistCortexSnapshot(supabase, fullState);

    return successResponse({
      ...fullState,
      _meta: { forced: true, persistedAt: new Date().toISOString() },
    });
  });
}
