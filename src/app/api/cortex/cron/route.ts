/**
 * Cortex Cron Job
 *
 * GET /api/cortex/cron — Runs the Cortex cycle for all active users.
 *
 * Designed to be called by Vercel Cron (every 15 minutes).
 * Secured via CRON_SECRET header to prevent unauthorized access.
 *
 * vercel.json config:
 * { "crons": [{ "path": "/api/cortex/cron", "schedule": "every 15 min" }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runCortexCycle, persistCortexSnapshot } from "@/lib/cortex/core";
import { logger } from "@/lib/logger";

const log = logger("cortex:cron");

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role env vars");
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  try {
    const supabase = getServiceClient();

    // Get active users (users who had activity in the last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
    const { data: activeUsers } = await supabase
      .from("profiles")
      .select("id")
      .gte("updated_at", sevenDaysAgo)
      .limit(100); // Process max 100 users per cron run

    if (!activeUsers || activeUsers.length === 0) {
      return NextResponse.json({
        status: "ok",
        message: "No active users to process",
        duration: Date.now() - start,
      });
    }

    log.info(`Cortex cron: processing ${activeUsers.length} active users`);

    const results: Array<{
      userId: string;
      health: string;
      issues: number;
      repaired: number;
      duration: number;
    }> = [];

    // Process users sequentially to avoid overwhelming Supabase
    for (const profile of activeUsers) {
      try {
        const state = await runCortexCycle(supabase, profile.id);
        await persistCortexSnapshot(supabase, state);

        results.push({
          userId: profile.id,
          health: state.overallHealth,
          issues: state.integrity.issuesFound,
          repaired: state.integrity.autoRepaired,
          duration: state.cycleDuration,
        });

        // Generate notifications for critical issues
        if (state.overallHealth === "critical") {
          await supabase.from("notifications").insert({
            user_id: profile.id,
            type: "cortex_alert",
            title: "Cortex: Kritischer Zustand erkannt",
            message: `${state.integrity.issuesFound} Problem(e) erkannt, ${state.integrity.autoRepaired} automatisch repariert.`,
            is_read: false,
            is_dismissed: false,
          });
        }
      } catch (err) {
        log.error(`Cortex cron failed for user ${profile.id}`, err);
        results.push({
          userId: profile.id,
          health: "error",
          issues: -1,
          repaired: 0,
          duration: 0,
        });
      }
    }

    const totalDuration = Date.now() - start;
    const summary = {
      status: "ok",
      processed: results.length,
      healthy: results.filter((r) => r.health === "healthy").length,
      degraded: results.filter((r) => r.health === "degraded").length,
      critical: results.filter((r) => r.health === "critical").length,
      errors: results.filter((r) => r.health === "error").length,
      totalIssues: results.reduce((sum, r) => sum + Math.max(0, r.issues), 0),
      totalRepaired: results.reduce((sum, r) => sum + r.repaired, 0),
      duration: totalDuration,
    };

    log.info("Cortex cron complete", summary);

    return NextResponse.json(summary, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    log.error("Cortex cron fatal error", err);
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
        duration: Date.now() - start,
      },
      { status: 500 }
    );
  }
}
