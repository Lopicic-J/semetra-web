/**
 * Cortex Engine — Core
 *
 * The main orchestration cycle that:
 * 1. Collects health data from all engines
 * 2. Runs integrity checks
 * 3. Executes auto-repairs
 * 4. Produces a CortexState snapshot
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CortexState,
  CortexConfig,
  CortexAction,
  EngineHealth,
  EngineName,
  OverallHealth,
} from "./types";
import { DEFAULT_CORTEX_CONFIG } from "./types";
import { runIntegrityChecks } from "./integrity";

// ─── Engine Health Probes ──────────────────────────────────────────

async function probeDecisionEngine(
  supabase: SupabaseClient,
  userId: string,
  maxAge: number
): Promise<EngineHealth> {
  // Decision Engine health = do we have recent module intelligence?
  const { data } = await supabase
    .from("modules")
    .select("id, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  const lastComputed = data?.[0]?.updated_at ?? null;
  const age = lastComputed ? (Date.now() - new Date(lastComputed).getTime()) / 1000 : Infinity;

  // Also check: how many modules have grades?
  const { count: modulesWithGrades } = await supabase
    .from("grades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return buildHealth("decision", lastComputed, age, maxAge, {
    modulesWithGrades: modulesWithGrades ?? 0,
  });
}

async function probeScheduleEngine(
  supabase: SupabaseClient,
  userId: string,
  maxAge: number
): Promise<EngineHealth> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("schedule_blocks")
    .select("id, updated_at")
    .eq("user_id", userId)
    .gte("end_time", now)
    .order("updated_at", { ascending: false })
    .limit(1);

  const lastComputed = data?.[0]?.updated_at ?? null;
  const age = lastComputed ? (Date.now() - new Date(lastComputed).getTime()) / 1000 : Infinity;

  // Count active blocks today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("schedule_blocks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("start_time", todayStart.toISOString())
    .lte("start_time", now);

  return buildHealth("schedule", lastComputed, age, maxAge, {
    blocksToday: count ?? 0,
  });
}

async function probeAcademicEngine(
  supabase: SupabaseClient,
  userId: string,
  maxAge: number
): Promise<EngineHealth> {
  const { data } = await supabase
    .from("grades")
    .select("id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastComputed = data?.[0]?.created_at ?? null;
  const age = lastComputed ? (Date.now() - new Date(lastComputed).getTime()) / 1000 : Infinity;

  const { count: enrollmentCount } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return buildHealth("academic", lastComputed, age, maxAge, {
    enrollments: enrollmentCount ?? 0,
  });
}

async function probeDnaEngine(
  supabase: SupabaseClient,
  userId: string,
  maxAge: number
): Promise<EngineHealth> {
  const { data } = await supabase
    .from("learning_dna_snapshots")
    .select("id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastComputed = data?.[0]?.created_at ?? null;
  const age = lastComputed ? (Date.now() - new Date(lastComputed).getTime()) / 1000 : Infinity;

  return buildHealth("dna", lastComputed, age, maxAge, {});
}

async function probeStreaksEngine(
  supabase: SupabaseClient,
  userId: string,
  maxAge: number
): Promise<EngineHealth> {
  // Streaks are computed from time_logs — check last session
  const { data } = await supabase
    .from("timer_sessions")
    .select("id, ended_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("ended_at", { ascending: false })
    .limit(1);

  const lastComputed = data?.[0]?.ended_at ?? null;
  const age = lastComputed ? (Date.now() - new Date(lastComputed).getTime()) / 1000 : Infinity;

  return buildHealth("streaks", lastComputed, age, maxAge, {});
}

async function probePatternsEngine(
  supabase: SupabaseClient,
  userId: string,
  maxAge: number
): Promise<EngineHealth> {
  const { data } = await supabase
    .from("study_patterns")
    .select("id, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  const lastComputed = data?.[0]?.updated_at ?? null;
  const age = lastComputed ? (Date.now() - new Date(lastComputed).getTime()) / 1000 : Infinity;

  return buildHealth("patterns", lastComputed, age, maxAge, {});
}

// ─── Health Builder ────────────────────────────────────────────────

function buildHealth(
  name: EngineName,
  lastComputed: string | null,
  ageSeconds: number,
  maxAgeSeconds: number,
  metrics: Record<string, number>
): EngineHealth {
  const issues: string[] = [];
  let status: EngineHealth["status"] = "healthy";

  if (!lastComputed) {
    status = "degraded";
    issues.push("Keine Daten vorhanden — Engine wurde noch nie ausgeführt");
  } else if (ageSeconds > maxAgeSeconds * 3) {
    status = "critical";
    issues.push(`Daten sind seit ${formatDuration(ageSeconds)} veraltet (Limit: ${formatDuration(maxAgeSeconds)})`);
  } else if (ageSeconds > maxAgeSeconds) {
    status = "stale";
    issues.push(`Daten sind seit ${formatDuration(ageSeconds)} nicht aktualisiert`);
  }

  return {
    name,
    status,
    lastComputed,
    staleSince: ageSeconds > maxAgeSeconds ? new Date(Date.now() - (ageSeconds - maxAgeSeconds) * 1000).toISOString() : null,
    dataAgeSeconds: Math.round(ageSeconds),
    maxAgeSeconds,
    issues,
    metrics,
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

// ─── Overall Health ────────────────────────────────────────────────

function computeOverallHealth(engines: Record<EngineName, EngineHealth>): OverallHealth {
  const statuses = Object.values(engines).map((e) => e.status);
  if (statuses.some((s) => s === "critical")) return "critical";
  if (statuses.filter((s) => s === "degraded" || s === "stale").length >= 3) return "critical";
  if (statuses.some((s) => s === "degraded" || s === "stale")) return "degraded";
  return "healthy";
}

// ─── Main Cortex Cycle ─────────────────────────────────────────────

let cycleCounter = 0;

export async function runCortexCycle(
  supabase: SupabaseClient,
  userId: string,
  config: CortexConfig = DEFAULT_CORTEX_CONFIG
): Promise<CortexState> {
  const start = Date.now();
  cycleCounter += 1;

  // 1. Probe all engines in parallel
  const [decision, schedule, academic, dna, streaks, patterns] = await Promise.all([
    probeDecisionEngine(supabase, userId, config.staleness.decision),
    probeScheduleEngine(supabase, userId, config.staleness.schedule),
    probeAcademicEngine(supabase, userId, config.staleness.academic),
    probeDnaEngine(supabase, userId, config.staleness.dna),
    probeStreaksEngine(supabase, userId, config.staleness.streaks),
    probePatternsEngine(supabase, userId, config.staleness.patterns),
  ]);

  const engines: Record<EngineName, EngineHealth> = {
    decision, schedule, academic, dna, streaks, patterns,
  };

  // 2. Run integrity checks (with auto-repair)
  const { integrity, actions } = await runIntegrityChecks(
    supabase,
    userId,
    engines,
    config
  );

  // 3. Compute overall health
  const overallHealth = computeOverallHealth(engines);

  const state: CortexState = {
    userId,
    timestamp: new Date().toISOString(),
    overallHealth,
    engines,
    integrity,
    actions,
    cycleNumber: cycleCounter,
    cycleDuration: Date.now() - start,
  };

  return state;
}

/**
 * Persist a Cortex snapshot to the database.
 * Fire-and-forget — never throws.
 */
export async function persistCortexSnapshot(
  supabase: SupabaseClient,
  state: CortexState
): Promise<void> {
  try {
    await supabase.from("cortex_snapshots").insert({
      user_id: state.userId,
      overall_health: state.overallHealth,
      engines: state.engines,
      integrity_report: state.integrity,
      recommendations: state.actions,
    });

    // Persist individual actions
    if (state.actions.length > 0) {
      await supabase.from("cortex_actions").insert(
        state.actions.map((a) => ({
          user_id: state.userId,
          action_type: a.type,
          engine: a.engine,
          description: a.description,
          auto_executed: a.autoExecuted,
          result: a.result,
        }))
      );
    }
  } catch {
    // Silent — persistence is fire-and-forget
  }
}
