/**
 * Cortex Engine — Integrity Monitor
 *
 * Runs 7 integrity checks on every Cortex cycle:
 * 1. DNA Freshness         — Letzter Snapshot > 7 Tage?
 * 2. Grade Bridge Sync     — grades ↔ enrollments Abweichung?
 * 3. Timer Orphans          — Aktive Sessions > 4h?
 * 4. Schedule Conflicts     — Überlappende Blöcke?
 * 5. Task Staleness         — Überfällige Tasks > 14 Tage?
 * 6. Streak Continuity      — Streak gefährdet?
 * 7. Pattern Currency       — study_patterns > 3 Tage alt?
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IntegrityReport,
  IntegrityIssue,
  CortexAction,
  CortexActionType,
  CortexConfig,
  EngineHealth,
  EngineName,
  IssueSeverity,
} from "./types";
import { randomUUID } from "crypto";

// ─── Helpers ──────────────────────────────────────────────────────

function issue(
  code: string,
  severity: IssueSeverity,
  engine: EngineName | "cross-engine",
  message: string,
  autoRepairable: boolean,
  detail?: Record<string, unknown>
): IntegrityIssue {
  return { code, severity, engine, message, detail, autoRepairable, repaired: false };
}

function action(
  type: CortexActionType,
  engine: EngineName | "cross-engine",
  description: string,
  autoExecuted: boolean,
  result: Record<string, unknown> = {}
): CortexAction {
  return {
    id: randomUUID(),
    type,
    engine,
    description,
    autoExecuted,
    executedAt: autoExecuted ? new Date().toISOString() : null,
    result,
  };
}

// ─── 1. DNA Freshness ─────────────────────────────────────────────

async function checkDnaFreshness(
  supabase: SupabaseClient,
  userId: string,
  engines: Record<EngineName, EngineHealth>,
  config: CortexConfig,
  issues: IntegrityIssue[],
  actions: CortexAction[]
): Promise<void> {
  const dna = engines.dna;
  if (dna.status === "healthy") return;

  const maxAge = config.staleness.dna; // 604800s = 7 days
  if (dna.dataAgeSeconds > maxAge) {
    const iss = issue(
      "DNA_STALE",
      dna.dataAgeSeconds > maxAge * 2 ? "error" : "warning",
      "dna",
      `Learning-DNA Snapshot ist ${formatAge(dna.dataAgeSeconds)} alt (Limit: ${formatAge(maxAge)})`,
      true
    );

    if (config.autoRepair) {
      // Trigger DNA recomputation via API
      try {
        const { error } = await supabase.functions.invoke("recompute-dna", {
          body: { user_id: userId },
        });
        if (!error) {
          iss.repaired = true;
          iss.repairedAt = new Date().toISOString();
          actions.push(action("recompute_dna", "dna", "Learning-DNA Neuberechnung angestossen", true));
        }
      } catch {
        // Fallback: just log the action as recommendation
        actions.push(action("recompute_dna", "dna", "Learning-DNA sollte neu berechnet werden", false));
      }
    } else {
      actions.push(action("recompute_dna", "dna", "Learning-DNA sollte neu berechnet werden", false));
    }

    issues.push(iss);
  }
}

// ─── 2. Grade Bridge Sync ─────────────────────────────────────────

async function checkGradeBridgeSync(
  supabase: SupabaseClient,
  userId: string,
  _engines: Record<EngineName, EngineHealth>,
  config: CortexConfig,
  issues: IntegrityIssue[],
  actions: CortexAction[]
): Promise<void> {
  // Get enrollments that have a current_final_grade
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, module_id, current_final_grade")
    .eq("user_id", userId)
    .not("current_final_grade", "is", null);

  if (!enrollments || enrollments.length === 0) return;

  // For each enrollment, check if the latest grade matches
  let desyncCount = 0;
  for (const enrollment of enrollments) {
    const { data: latestGrade } = await supabase
      .from("grades")
      .select("value")
      .eq("user_id", userId)
      .eq("module_id", enrollment.module_id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestGrade && latestGrade.value !== enrollment.current_final_grade) {
      desyncCount++;
    }
  }

  if (desyncCount > 0) {
    const severity: IssueSeverity = desyncCount > 3 ? "error" : "warning";
    const iss = issue(
      "GRADE_BRIDGE_DESYNC",
      severity,
      "academic",
      `${desyncCount} Modul(e) haben abweichende Noten zwischen grades und enrollments`,
      true,
      { desyncCount }
    );

    if (config.autoRepair) {
      // We can't call the Grade Bridge directly here, but we recommend the action
      actions.push(
        action(
          "sync_grades",
          "academic",
          `Grade Bridge Sync für ${desyncCount} Module anstossen`,
          false,
          { desyncCount }
        )
      );
    }

    issues.push(iss);
  }
}

// ─── 3. Timer Orphans ─────────────────────────────────────────────

async function checkTimerOrphans(
  supabase: SupabaseClient,
  userId: string,
  _engines: Record<EngineName, EngineHealth>,
  config: CortexConfig,
  issues: IntegrityIssue[],
  actions: CortexAction[]
): Promise<void> {
  const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000).toISOString();

  const { data: orphans } = await supabase
    .from("timer_sessions")
    .select("id, started_at, module_id")
    .eq("user_id", userId)
    .in("status", ["active", "paused"])
    .lt("started_at", fourHoursAgo);

  if (!orphans || orphans.length === 0) return;

  const iss = issue(
    "TIMER_ORPHANS",
    "warning",
    "streaks",
    `${orphans.length} verwaiste Timer-Session(s) gefunden (aktiv seit > 4h)`,
    true,
    { orphanIds: orphans.map((o) => o.id), count: orphans.length }
  );

  if (config.autoRepair) {
    // Auto-abandon orphaned sessions
    const now = new Date().toISOString();
    let abandoned = 0;

    for (const orphan of orphans) {
      const startTime = new Date(orphan.started_at).getTime();
      const duration = Math.round((Date.now() - startTime) / 1000);

      const { error } = await supabase
        .from("timer_sessions")
        .update({
          status: "abandoned",
          ended_at: now,
          actual_duration_seconds: duration,
          updated_at: now,
        })
        .eq("id", orphan.id)
        .eq("user_id", userId);

      if (!error) abandoned++;
    }

    if (abandoned > 0) {
      iss.repaired = true;
      iss.repairedAt = now;
      actions.push(
        action(
          "abandon_orphan_session",
          "streaks",
          `${abandoned} verwaiste Session(s) automatisch beendet`,
          true,
          { abandoned, total: orphans.length }
        )
      );
    }
  } else {
    actions.push(
      action(
        "abandon_orphan_session",
        "streaks",
        `${orphans.length} verwaiste Session(s) sollten beendet werden`,
        false,
        { count: orphans.length }
      )
    );
  }

  issues.push(iss);
}

// ─── 4. Schedule Conflicts ────────────────────────────────────────

async function checkScheduleConflicts(
  supabase: SupabaseClient,
  userId: string,
  _engines: Record<EngineName, EngineHealth>,
  _config: CortexConfig,
  issues: IntegrityIssue[],
  actions: CortexAction[]
): Promise<void> {
  // Get today's and tomorrow's schedule blocks
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(now);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 2);
  tomorrowEnd.setHours(0, 0, 0, 0);

  const { data: blocks } = await supabase
    .from("schedule_blocks")
    .select("id, title, start_time, end_time, block_type")
    .eq("user_id", userId)
    .gte("start_time", todayStart.toISOString())
    .lt("start_time", tomorrowEnd.toISOString())
    .order("start_time", { ascending: true });

  if (!blocks || blocks.length < 2) return;

  // Detect overlaps (simple O(n²) — n is small, max ~30 blocks/day)
  const conflicts: Array<{ blockA: string; blockB: string }> = [];

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      // Overlap if A.start < B.end AND B.start < A.end
      if (a.start_time < b.end_time && b.start_time < a.end_time) {
        conflicts.push({ blockA: a.id, blockB: b.id });
      }
    }
  }

  if (conflicts.length === 0) return;

  issues.push(
    issue(
      "SCHEDULE_CONFLICT",
      "warning",
      "schedule",
      `${conflicts.length} Zeitplan-Konflikt(e) in den nächsten 48h`,
      false,
      { conflicts: conflicts.length }
    )
  );

  actions.push(
    action(
      "resolve_schedule_conflict",
      "schedule",
      `${conflicts.length} überlappende Blöcke im Zeitplan erkannt`,
      false,
      { conflicts: conflicts.length }
    )
  );
}

// ─── 5. Task Staleness ────────────────────────────────────────────

async function checkTaskStaleness(
  supabase: SupabaseClient,
  userId: string,
  _engines: Record<EngineName, EngineHealth>,
  _config: CortexConfig,
  issues: IntegrityIssue[],
  actions: CortexAction[]
): Promise<void> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400 * 1000).toISOString();

  const { data: staleTasks, count } = await supabase
    .from("tasks")
    .select("id, title, due_date", { count: "exact", head: false })
    .eq("user_id", userId)
    .in("status", ["todo", "in_progress"])
    .lt("due_date", fourteenDaysAgo)
    .limit(5);

  if (!count || count === 0) return;

  issues.push(
    issue(
      "TASKS_OVERDUE",
      count > 5 ? "error" : "warning",
      "decision",
      `${count} Task(s) sind seit über 14 Tagen überfällig`,
      false,
      {
        count,
        examples: (staleTasks || []).map((t) => t.title).slice(0, 3),
      }
    )
  );

  actions.push(
    action(
      "nudge_overdue_tasks",
      "decision",
      `${count} überfällige Tasks benötigen Aufmerksamkeit`,
      false,
      { count }
    )
  );
}

// ─── 6. Streak Continuity ─────────────────────────────────────────

async function checkStreakContinuity(
  supabase: SupabaseClient,
  userId: string,
  engines: Record<EngineName, EngineHealth>,
  _config: CortexConfig,
  issues: IntegrityIssue[],
  actions: CortexAction[]
): Promise<void> {
  // Check if last completed session was > 20h ago (risk of losing daily streak)
  const streaks = engines.streaks;
  if (!streaks.lastComputed) return;

  const hoursSinceLastSession = streaks.dataAgeSeconds / 3600;

  // Between 20-24h = warning (still saveable today)
  // > 24h = streak likely broken
  if (hoursSinceLastSession >= 20 && hoursSinceLastSession < 24) {
    issues.push(
      issue(
        "STREAK_AT_RISK",
        "warning",
        "streaks",
        `Dein Streak ist gefährdet! Letzte Session vor ${Math.round(hoursSinceLastSession)}h — lerne heute noch um ihn zu halten.`,
        false
      )
    );

    actions.push(
      action(
        "nudge_streak_risk",
        "streaks",
        "Streak-Warnung: Heute noch eine Lernsession starten",
        false,
        { hoursSinceLastSession: Math.round(hoursSinceLastSession) }
      )
    );
  } else if (hoursSinceLastSession >= 24 && hoursSinceLastSession < 48) {
    issues.push(
      issue(
        "STREAK_BROKEN",
        "info",
        "streaks",
        `Dein Streak wurde unterbrochen (letzte Session vor ${Math.round(hoursSinceLastSession)}h). Starte heute eine neue Serie!`,
        false
      )
    );
  }
}

// ─── 7. Pattern Currency ──────────────────────────────────────────

async function checkPatternCurrency(
  supabase: SupabaseClient,
  userId: string,
  engines: Record<EngineName, EngineHealth>,
  config: CortexConfig,
  issues: IntegrityIssue[],
  actions: CortexAction[]
): Promise<void> {
  const patterns = engines.patterns;
  const maxAge = config.staleness.patterns; // 259200s = 3 days

  if (patterns.status === "healthy") return;

  if (patterns.dataAgeSeconds > maxAge) {
    const iss = issue(
      "PATTERNS_STALE",
      "warning",
      "patterns",
      `Lernmuster-Analyse ist ${formatAge(patterns.dataAgeSeconds)} alt — Neuberechnung empfohlen`,
      true
    );

    if (config.autoRepair) {
      actions.push(
        action(
          "refresh_patterns",
          "patterns",
          "Lernmuster-Analyse Neuberechnung angestossen",
          false
        )
      );
    }

    issues.push(iss);
  }
}

// ─── Format Helper ────────────────────────────────────────────────

function formatAge(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} Minuten`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} Stunden`;
  return `${Math.round(seconds / 86400)} Tage`;
}

// ─── Main: Run All Integrity Checks ───────────────────────────────

export async function runIntegrityChecks(
  supabase: SupabaseClient,
  userId: string,
  engines: Record<EngineName, EngineHealth>,
  config: CortexConfig
): Promise<{ integrity: IntegrityReport; actions: CortexAction[] }> {
  const start = Date.now();
  const issues: IntegrityIssue[] = [];
  const actions: CortexAction[] = [];

  // Run all 7 checks (some can run in parallel, but we keep it sequential
  // to stay within Supabase connection limits and for predictable ordering)
  await checkDnaFreshness(supabase, userId, engines, config, issues, actions);
  await checkGradeBridgeSync(supabase, userId, engines, config, issues, actions);
  await checkTimerOrphans(supabase, userId, engines, config, issues, actions);
  await checkScheduleConflicts(supabase, userId, engines, config, issues, actions);
  await checkTaskStaleness(supabase, userId, engines, config, issues, actions);
  await checkStreakContinuity(supabase, userId, engines, config, issues, actions);
  await checkPatternCurrency(supabase, userId, engines, config, issues, actions);

  // Respect max actions per cycle
  const trimmedActions = actions.slice(0, config.maxActionsPerCycle);

  const integrity: IntegrityReport = {
    checksRun: 7,
    issuesFound: issues.length,
    autoRepaired: issues.filter((i) => i.repaired).length,
    issues,
    duration: Date.now() - start,
  };

  return { integrity, actions: trimmedActions };
}
