/**
 * Reschedule API Route
 *
 * GET  /api/schedule/reschedule?date=YYYY-MM-DD     → Detect missed/partial blocks
 * GET  /api/schedule/reschedule?view=log&limit=20   → Reschedule history
 * GET  /api/schedule/reschedule?view=optimize&date=  → Optimization proposals
 *
 * POST /api/schedule/reschedule { action: "auto", date }         → Auto-reschedule missed blocks
 * POST /api/schedule/reschedule { action: "apply", proposals }   → Apply specific proposals
 * POST /api/schedule/reschedule { action: "optimize", date }     → Apply day optimization
 * POST /api/schedule/reschedule { action: "manual", blockId, newStart, newEnd } → Manual reschedule
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
import {
  detectBlocksNeedingReschedule,
  generateRescheduleProposals,
  optimizeDaySchedule,
  analyzeStudyPatterns,
  DEFAULT_PREFERENCES,
} from "@/lib/schedule";
import type {
  ScheduleBlock,
  TimerSession,
  SchedulePreferences,
  RescheduleProposal,
  RescheduleTrigger,
} from "@/lib/schedule";

const log = logger("api:reschedule");

export async function GET(req: NextRequest) {
  return withErrorHandler("api:reschedule", async () => {
  const auth = await requireAuth();
  if (isErrorResponse(auth)) return auth;
  const { supabase, user } = auth;

  const url = new URL(req.url);
  const view = url.searchParams.get("view");
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);

  if (view === "log") {
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const { data, error } = await supabase
      .from("reschedule_log")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return errorResponse("Fehler beim Laden der Reschedule-Historie", 500);
    return successResponse(data || []);
  }

  // Load blocks, sessions, preferences for analysis
  const { blocks, sessions, preferences } = await loadScheduleData(supabase, user.id, date);

  if (view === "optimize") {
    const patterns = await loadPatterns(supabase, user.id, sessions, blocks);
    const proposals = optimizeDaySchedule(blocks, sessions, preferences, patterns, date);
    return successResponse({ proposals, date });
  }

  // Default: detect blocks needing reschedule
  const detected = detectBlocksNeedingReschedule(blocks, sessions, preferences, date);
  return successResponse({
    date,
    blocksNeedingReschedule: detected.map(d => ({
      block: d.block,
      trigger: d.trigger,
    })),
    count: detected.length,
  });
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandler("api:reschedule", async () => {
  const auth = await requireAuth();
  if (isErrorResponse(auth)) return auth;
  const { supabase, user } = auth;

  const body = await parseBody(req);
  if (isErrorResponse(body)) return body;

  const date = body.date || new Date().toISOString().slice(0, 10);

  if (body.action === "auto") {
    // Auto-detect and reschedule missed blocks
    const { blocks, sessions, preferences } = await loadScheduleData(supabase, user.id, date);
    const patterns = await loadPatterns(supabase, user.id, sessions, blocks);

    const detected = detectBlocksNeedingReschedule(blocks, sessions, preferences, date);
    if (detected.length === 0) {
      return successResponse({ rescheduled: 0, message: "Keine Blöcke zum Umplanen" });
    }

    const blocksToReschedule = detected.map(d => d.block);
    const trigger = detected[0].trigger;

    const result = generateRescheduleProposals(
      blocksToReschedule, trigger, blocks, sessions, preferences, patterns,
      { allowDrop: true, lookAheadDays: 3 },
    );

    // Apply proposals
    const applied = await applyProposals(supabase, user.id, result.proposals);

    log.info(`Auto-rescheduled ${applied} blocks for user ${user.id} on ${date}`);
    return successResponse({
      rescheduled: applied,
      dropped: result.droppedBlocks.length,
      warnings: result.warnings,
      totalMinutes: result.totalRescheduledMinutes,
    });
  }

  if (body.action === "apply") {
    // Apply specific proposals (from UI confirmation)
    if (!body.proposals || !Array.isArray(body.proposals)) {
      return errorResponse("Proposals-Array erforderlich", 400);
    }

    const applied = await applyProposals(supabase, user.id, body.proposals);
    return successResponse({ applied });
  }

  if (body.action === "optimize") {
    // Optimize day schedule based on patterns
    const { blocks, sessions, preferences } = await loadScheduleData(supabase, user.id, date);
    const patterns = await loadPatterns(supabase, user.id, sessions, blocks);

    const proposals = optimizeDaySchedule(blocks, sessions, preferences, patterns, date);
    if (proposals.length === 0) {
      return successResponse({ optimized: 0, message: "Zeitplan ist bereits optimal" });
    }

    const applied = await applyProposals(supabase, user.id, proposals);
    log.info(`Optimized ${applied} blocks for user ${user.id} on ${date}`);
    return successResponse({ optimized: applied, proposals });
  }

  if (body.action === "manual") {
    // Manual reschedule of a specific block
    const { blockId, newStart, newEnd, reason } = body;
    if (!blockId || !newStart || !newEnd) {
      return errorResponse("blockId, newStart und newEnd erforderlich", 400);
    }

    // Get original block
    const { data: original, error: fetchErr } = await supabase
      .from("schedule_blocks")
      .select("*")
      .eq("id", blockId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !original) return errorResponse("Block nicht gefunden", 404);

    // Mark original as rescheduled
    await supabase
      .from("schedule_blocks")
      .update({ status: "rescheduled", reschedule_reason: reason || "Manuell umgeplant" })
      .eq("id", blockId);

    // Create new block
    const { data: newBlock, error: createErr } = await supabase
      .from("schedule_blocks")
      .insert({
        user_id: user.id,
        block_type: original.block_type,
        layer: original.layer,
        start_time: newStart,
        end_time: newEnd,
        module_id: original.module_id,
        task_id: original.task_id,
        topic_id: original.topic_id,
        exam_id: original.exam_id,
        title: original.title,
        description: original.description,
        color: original.color,
        priority: original.priority,
        status: "scheduled",
        original_block_id: blockId,
        source: "manual",
        estimated_minutes: original.estimated_minutes,
      })
      .select()
      .single();

    if (createErr) return errorResponse("Fehler beim Erstellen des neuen Blocks", 500);

    // Log the reschedule
    await supabase.from("reschedule_log").insert({
      user_id: user.id,
      original_block_id: blockId,
      new_block_id: newBlock.id,
      trigger: "user_request",
      original_start: original.start_time,
      original_end: original.end_time,
      new_start: newStart,
      new_end: newEnd,
      resolution: "rescheduled",
      module_id: original.module_id,
      block_type: original.block_type,
      reason: reason || "Manuell umgeplant",
      auto_generated: false,
    });

    return successResponse({ original: blockId, newBlock });
  }

  return errorResponse("Unbekannte Aktion", 400);
  });
}


// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadScheduleData(supabase: any, userId: string, date: string) {
  const weekStart = addDays(date, -3);
  const weekEnd = addDays(date, 4);

  const [{ data: blocks }, { data: sessions }, { data: prefs }] = await Promise.all([
    supabase.from("schedule_blocks")
      .select("*, module:modules(name, color, code)")
      .eq("user_id", userId)
      .gte("start_time", weekStart)
      .lte("start_time", weekEnd + "T23:59:59Z"),
    supabase.from("timer_sessions")
      .select("*, module:modules(name, color)")
      .eq("user_id", userId)
      .gte("started_at", weekStart)
      .lte("started_at", weekEnd + "T23:59:59Z"),
    supabase.from("user_schedule_preferences")
      .select("*")
      .eq("user_id", userId)
      .single(),
  ]);

  return {
    blocks: (blocks || []) as ScheduleBlock[],
    sessions: (sessions || []) as TimerSession[],
    preferences: (prefs || DEFAULT_PREFERENCES) as SchedulePreferences,
  };
}

async function loadPatterns(
  supabase: any,
  userId: string,
  sessions: TimerSession[],
  blocks: ScheduleBlock[],
) {
  // Try stored patterns first
  const { data: stored } = await supabase
    .from("study_patterns")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (stored && stored.total_sessions_analyzed >= 5) {
    // Convert stored format to StudyPatterns
    return {
      bestHours: stored.best_hours || [],
      worstHours: stored.worst_hours || [],
      allHours: [],
      dayPatterns: stored.day_patterns || [],
      modulePatterns: Object.values(stored.module_patterns || {}),
      avgSessionMinutes: stored.avg_session_minutes,
      preferredDurationMinutes: stored.preferred_duration_minutes,
      longestProductiveSession: stored.longest_productive_session,
      currentStreakDays: stored.current_streak_days,
      longestStreakDays: stored.longest_streak_days,
      avgWeeklyStudyMinutes: stored.avg_weekly_study_minutes,
      consistencyScore: stored.consistency_score,
      adherenceTrend: stored.adherence_trend || [],
      avgStartDelayMinutes: stored.avg_start_delay_minutes,
      skipRate: stored.skip_rate,
      energyCurve: stored.energy_curve || { morning: 3, afternoon: 3, evening: 3 },
      totalSessionsAnalyzed: stored.total_sessions_analyzed,
      dataQuality: stored.total_sessions_analyzed >= 50 ? "strong"
        : stored.total_sessions_analyzed >= 15 ? "reliable"
        : stored.total_sessions_analyzed >= 5 ? "emerging"
        : "insufficient",
    } as any;
  }

  // Compute on the fly
  if (sessions.length < 5) return null;

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = addDays(endDate, -30);
  return analyzeStudyPatterns(sessions, blocks, { start: startDate, end: endDate });
}

async function applyProposals(
  supabase: any,
  userId: string,
  proposals: RescheduleProposal[],
): Promise<number> {
  let applied = 0;

  for (const proposal of proposals) {
    if (proposal.resolution === "dropped") {
      // Mark as skipped
      await supabase
        .from("schedule_blocks")
        .update({ status: "skipped" })
        .eq("id", proposal.originalBlock.id);

      await supabase.from("reschedule_log").insert({
        user_id: userId,
        original_block_id: proposal.originalBlock.id,
        trigger: proposal.trigger,
        original_start: proposal.originalBlock.start_time,
        original_end: proposal.originalBlock.end_time,
        resolution: "dropped",
        module_id: proposal.originalBlock.module_id,
        block_type: proposal.originalBlock.block_type,
        reason: proposal.reason,
        auto_generated: true,
      });
      applied++;
      continue;
    }

    if (proposal.resolution === "merged" && proposal.mergeTargetBlockId) {
      // Mark original as rescheduled
      await supabase
        .from("schedule_blocks")
        .update({ status: "rescheduled", reschedule_reason: "Zusammengeführt" })
        .eq("id", proposal.originalBlock.id);

      // Extend merge target
      await supabase
        .from("schedule_blocks")
        .update({ end_time: proposal.newEnd })
        .eq("id", proposal.mergeTargetBlockId);

      await supabase.from("reschedule_log").insert({
        user_id: userId,
        original_block_id: proposal.originalBlock.id,
        new_block_id: proposal.mergeTargetBlockId,
        trigger: proposal.trigger,
        original_start: proposal.originalBlock.start_time,
        original_end: proposal.originalBlock.end_time,
        new_start: proposal.newStart,
        new_end: proposal.newEnd,
        resolution: "merged",
        module_id: proposal.originalBlock.module_id,
        block_type: proposal.originalBlock.block_type,
        reason: proposal.reason,
        auto_generated: true,
      });
      applied++;
      continue;
    }

    if ((proposal.resolution === "rescheduled" || proposal.resolution === "shortened") && proposal.newStart && proposal.newEnd) {
      // Mark original as rescheduled
      await supabase
        .from("schedule_blocks")
        .update({ status: "rescheduled", reschedule_reason: proposal.reason })
        .eq("id", proposal.originalBlock.id);

      // Create new block
      const { data: newBlock } = await supabase
        .from("schedule_blocks")
        .insert({
          user_id: userId,
          block_type: proposal.originalBlock.block_type,
          layer: proposal.originalBlock.layer,
          start_time: proposal.newStart,
          end_time: proposal.newEnd,
          module_id: proposal.originalBlock.module_id,
          task_id: proposal.originalBlock.task_id,
          topic_id: proposal.originalBlock.topic_id,
          exam_id: proposal.originalBlock.exam_id,
          title: proposal.originalBlock.title,
          description: proposal.originalBlock.description,
          color: proposal.originalBlock.color,
          priority: proposal.originalBlock.priority,
          status: "scheduled",
          original_block_id: proposal.originalBlock.id,
          estimated_minutes: proposal.newDuration,
          source: "auto_plan",
        })
        .select()
        .single();

      await supabase.from("reschedule_log").insert({
        user_id: userId,
        original_block_id: proposal.originalBlock.id,
        new_block_id: newBlock?.id || null,
        trigger: proposal.trigger,
        original_start: proposal.originalBlock.start_time,
        original_end: proposal.originalBlock.end_time,
        new_start: proposal.newStart,
        new_end: proposal.newEnd,
        resolution: proposal.resolution,
        module_id: proposal.originalBlock.module_id,
        block_type: proposal.originalBlock.block_type,
        reason: proposal.reason,
        auto_generated: true,
      });
      applied++;
    }
  }

  return applied;
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
