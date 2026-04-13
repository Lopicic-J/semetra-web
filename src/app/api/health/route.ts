/**
 * /api/health — Application Health Check
 *
 * GET: Returns system health status for monitoring.
 *      Checks: Database connectivity, auth service, API responsiveness.
 *
 * Used by uptime monitors (UptimeRobot, Vercel cron, etc.)
 * Returns 200 if healthy, 503 if degraded.
 */

import { NextResponse } from "next/server";

// Lazy Supabase init (avoid build-time crash)
async function getServiceClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "down";
  latencyMs: number;
  detail?: string;
}

export async function GET() {
  const startTime = Date.now();
  const checks: HealthCheck[] = [];

  // 1. Database connectivity
  try {
    const dbStart = Date.now();
    const supabase = await getServiceClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    const latency = Date.now() - dbStart;

    checks.push({
      name: "database",
      status: error ? "degraded" : "healthy",
      latencyMs: latency,
      detail: error ? error.message : undefined,
    });
  } catch (err) {
    checks.push({
      name: "database",
      status: "down",
      latencyMs: Date.now() - startTime,
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }

  // 2. Auth service
  try {
    const authStart = Date.now();
    const supabase = await getServiceClient();
    const { error } = await supabase.auth.getSession();
    const latency = Date.now() - authStart;

    checks.push({
      name: "auth",
      status: error ? "degraded" : "healthy",
      latencyMs: latency,
      detail: error ? error.message : undefined,
    });
  } catch (err) {
    checks.push({
      name: "auth",
      status: "down",
      latencyMs: Date.now() - startTime,
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }

  // 3. Environment check
  const envCheck: HealthCheck = {
    name: "environment",
    status: "healthy",
    latencyMs: 0,
  };
  const requiredEnvs = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];
  const missingEnvs = requiredEnvs.filter((e) => !process.env[e]);
  if (missingEnvs.length > 0) {
    envCheck.status = "degraded";
    envCheck.detail = `Missing: ${missingEnvs.join(", ")}`;
  }
  checks.push(envCheck);

  // Overall status
  const hasDown = checks.some((c) => c.status === "down");
  const hasDegraded = checks.some((c) => c.status === "degraded");
  const overallStatus = hasDown ? "down" : hasDegraded ? "degraded" : "healthy";
  const totalLatency = Date.now() - startTime;

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    totalLatencyMs: totalLatency,
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
    checks,
    uptime: process.uptime ? Math.round(process.uptime()) : null,
  };

  return NextResponse.json(response, {
    status: overallStatus === "healthy" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
