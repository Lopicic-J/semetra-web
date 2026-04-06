/**
 * Schedule Engine API Route
 *
 * Manages schedule blocks (Layer 1 & 2) and provides computed schedule views.
 *
 * GET  /api/schedule                           → Today's schedule (all layers)
 * GET  /api/schedule?date=YYYY-MM-DD           → Specific day schedule
 * GET  /api/schedule?week=YYYY-MM-DD           → Week schedule (Monday start)
 * GET  /api/schedule?view=free-slots&date=...  → Free time slots
 * GET  /api/schedule?view=conflicts            → Schedule conflicts
 * GET  /api/schedule?view=modules&week=...     → Per-module schedule stats
 * GET  /api/schedule?view=heatmap&from=...&to= → Study heatmap
 * GET  /api/schedule?view=plan-vs-reality&date → Plan vs. reality for a day
 * GET  /api/schedule?view=budget&date=...      → Daily study budget
 *
 * POST /api/schedule                           → Create a schedule block
 * POST /api/schedule { action: "import" }      → Import stundenplan to schedule
 * POST /api/schedule { action: "auto-plan" }   → Auto-generate from Decision Engine
 *
 * PATCH /api/schedule/:id                      → Update a block
 * DELETE /api/schedule/:id                     → Delete a block
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
  findFreeSlots,
  buildScheduleDay,
  buildScheduleWeek,
  computeModuleScheduleStats,
  detectConflicts,
  computeStudyHeatmap,
  computePlanVsReality,
  computeDailyBudget,
  expandRecurringBlocks,
  DEFAULT_PREFERENCES,
} from "@/lib/schedule";
import type {
  ScheduleBlock,
  TimerSession,
  SchedulePreferences,
} from "@/lib/schedule";

const log = logger("api:schedule");

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  return withErrorHandler("api:schedule", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const url = req.nextUrl;
    const view = url.searchParams.get("view");
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const week = url.searchParams.get("week");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    // Fetch user preferences
    const preferences = await getPreferences(supabase, user.id);

    // Determine date range
    let startDate: string;
    let endDate: string;

    if (week) {
      startDate = week;
      endDate = addDays(week, 6);
    } else {
      startDate = from || date;
      endDate = to || date;
    }

    // Fetch blocks and sessions for the range
    const [blocksResult, sessionsResult] = await Promise.all([
      supabase
        .from("schedule_blocks")
        .select("*, module:modules(name, color, code)")
        .eq("user_id", user.id)
        .gte("start_time", `${startDate}T00:00:00`)
        .lte("start_time", `${endDate}T23:59:59`)
        .order("start_time"),
      supabase
        .from("timer_sessions")
        .select("*, module:modules(name, color)")
        .eq("user_id", user.id)
        .gte("started_at", `${startDate}T00:00:00`)
        .lte("started_at", `${endDate}T23:59:59`)
        .order("started_at"),
    ]);

    const blocks: ScheduleBlock[] = blocksResult.data || [];
    const sessions: TimerSession[] = sessionsResult.data || [];

    // Expand recurring blocks
    const expandedBlocks = expandRecurringBlocks(blocks, startDate, endDate);

    // Route by view
    switch (view) {
      case "free-slots": {
        const slots = findFreeSlots(expandedBlocks, sessions, preferences, date);
        return successResponse({ date, slots });
      }

      case "conflicts": {
        const conflicts = detectConflicts(expandedBlocks);
        return successResponse({ conflicts });
      }

      case "modules": {
        const weekStart = week || getMonday(date);
        const { data: modules } = await supabase
          .from("modules")
          .select("id, name, color, exam_date")
          .eq("user_id", user.id)
          .eq("status", "active");

        const stats = computeModuleScheduleStats(
          expandedBlocks, sessions, modules || [], weekStart,
        );
        return successResponse({ weekStart, modules: stats });
      }

      case "heatmap": {
        // For heatmap, fetch wider session range
        const heatFrom = from || addDays(date, -30);
        const heatTo = to || date;
        const { data: heatSessions } = await supabase
          .from("timer_sessions")
          .select("started_at, actual_duration_seconds, effective_seconds, status")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .gte("started_at", `${heatFrom}T00:00:00`)
          .lte("started_at", `${heatTo}T23:59:59`);

        const heatmap = computeStudyHeatmap(
          (heatSessions || []) as TimerSession[],
          heatFrom, heatTo,
        );
        return successResponse({ from: heatFrom, to: heatTo, heatmap });
      }

      case "plan-vs-reality": {
        const pvr = computePlanVsReality(expandedBlocks, sessions, date);
        return successResponse({ date, planVsReality: pvr });
      }

      case "budget": {
        const budget = computeDailyBudget(expandedBlocks, sessions, preferences, date);
        return successResponse(budget);
      }

      default: {
        // Default: full schedule view
        if (week) {
          const scheduleWeek = buildScheduleWeek(expandedBlocks, sessions, preferences, week);
          return successResponse(scheduleWeek);
        }

        const scheduleDay = buildScheduleDay(expandedBlocks, sessions, preferences, date);
        return successResponse(scheduleDay);
      }
    }
  });
}

// ── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  return withErrorHandler("api:schedule", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<Record<string, unknown>>(req);
    if (isErrorResponse(body)) return body;

    const action = body.action as string | undefined;

    // ── Import stundenplan ──────────────────────────────────────────────
    if (action === "import") {
      const { data, error } = await supabase.rpc("import_stundenplan_to_schedule", {
        p_user_id: user.id,
      });

      if (error) {
        log.error("Stundenplan import failed", error);
        return errorResponse("Import fehlgeschlagen: " + error.message, 500);
      }

      return successResponse({ imported: data, message: `${data} Einträge importiert` });
    }

    // ── Auto-plan from Decision Engine ──────────────────────────────────
    if (action === "auto-plan") {
      const date = (body.date as string) || new Date().toISOString().slice(0, 10);

      // Get Decision Engine state
      const decisionUrl = new URL("/api/decision", req.url);
      const decisionRes = await fetch(decisionUrl, {
        headers: { cookie: req.headers.get("cookie") || "" },
      });

      if (!decisionRes.ok) {
        return errorResponse("Decision Engine nicht verfügbar", 500);
      }

      const decisionState = await decisionRes.json();

      // Get current blocks and preferences
      const preferences = await getPreferences(supabase, user.id);
      const { data: existingBlocks } = await supabase
        .from("schedule_blocks")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_time", `${date}T00:00:00`)
        .lte("start_time", `${date}T23:59:59`);

      const { data: existingSessions } = await supabase
        .from("timer_sessions")
        .select("*")
        .eq("user_id", user.id)
        .gte("started_at", `${date}T00:00:00`)
        .lte("started_at", `${date}T23:59:59`);

      const freeSlots = findFreeSlots(
        existingBlocks || [], existingSessions || [], preferences, date,
      );

      // Bridge Decision Engine → Schedule blocks
      const { bridgeDecisionToSchedule } = await import("@/lib/schedule/decision-bridge");
      const result = bridgeDecisionToSchedule(
        decisionState.today,
        decisionState.moduleRankings || [],
        freeSlots,
        preferences,
      );

      // Remove old auto-planned blocks for this day
      await supabase
        .from("schedule_blocks")
        .delete()
        .eq("user_id", user.id)
        .eq("source", "decision_engine")
        .gte("start_time", `${date}T00:00:00`)
        .lte("start_time", `${date}T23:59:59`);

      // Insert new blocks
      if (result.blocks.length > 0) {
        const blocksToInsert = result.blocks.map(b => ({
          ...b,
          user_id: user.id,
        }));

        const { error } = await supabase
          .from("schedule_blocks")
          .insert(blocksToInsert);

        if (error) {
          log.error("Auto-plan insert failed", error);
          return errorResponse("Auto-Plan fehlgeschlagen: " + error.message, 500);
        }
      }

      return successResponse({
        scheduled: result.blocks.length,
        totalMinutes: result.totalMinutesScheduled,
        unscheduled: result.unscheduled.length,
        warnings: result.warnings,
      }, 201);
    }

    // ── Create single block ─────────────────────────────────────────────
    const {
      block_type, start_time, end_time, title,
      module_id, task_id, topic_id, exam_id, study_plan_id,
      description, color, icon, priority, recurrence, recurrence_end,
      estimated_minutes, is_locked, source,
    } = body;

    if (!block_type || !start_time || !end_time || !title) {
      return errorResponse("block_type, start_time, end_time und title sind Pflichtfelder", 400);
    }

    // Determine layer from block type
    const layerMap: Record<string, number> = {
      lecture: 1, exercise: 1, lab: 1, seminar: 1, exam: 1, deadline: 1,
      work: 1, appointment: 1, commute: 1,
      study: 2, review: 2, exam_prep: 2, flashcards: 2, deep_work: 2, group_study: 2,
      break: 2, free: 2,
    };

    const layer = layerMap[block_type as string] || 2;

    const { data, error } = await supabase
      .from("schedule_blocks")
      .insert({
        user_id: user.id,
        block_type, layer, start_time, end_time, title,
        module_id: module_id || null,
        task_id: task_id || null,
        topic_id: topic_id || null,
        exam_id: exam_id || null,
        study_plan_id: study_plan_id || null,
        description: description || null,
        color: color || null,
        icon: icon || null,
        priority: priority || "medium",
        recurrence: recurrence || null,
        recurrence_end: recurrence_end || null,
        estimated_minutes: estimated_minutes || null,
        is_locked: is_locked || false,
        source: source || "manual",
      })
      .select()
      .single();

    if (error) {
      log.error("Block creation failed", error);
      return errorResponse("Block konnte nicht erstellt werden: " + error.message, 500);
    }

    return successResponse(data, 201);
  });
}

// ── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  return withErrorHandler("api:schedule", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<Record<string, unknown>>(req);
    if (isErrorResponse(body)) return body;

    const id = body.id as string;
    if (!id) return errorResponse("Block-ID fehlt", 400);

    // Build update object (only provided fields)
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const allowedFields = [
      "block_type", "start_time", "end_time", "title", "description",
      "color", "icon", "priority", "status", "completion_percent",
      "module_id", "task_id", "topic_id", "exam_id", "study_plan_id",
      "recurrence", "recurrence_end", "estimated_minutes", "is_locked",
      "reschedule_reason",
    ];

    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    // Handle rescheduling
    if (body.status === "rescheduled" && body.new_start_time && body.new_end_time) {
      // Create new block as replacement
      const { data: original } = await supabase
        .from("schedule_blocks")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (original) {
        await supabase.from("schedule_blocks").insert({
          ...original,
          id: undefined,
          start_time: body.new_start_time,
          end_time: body.new_end_time,
          status: "scheduled",
          original_block_id: id,
          reschedule_reason: body.reschedule_reason || "Manuell verschoben",
          source: "manual",
          created_at: undefined,
          updated_at: undefined,
        });
      }
    }

    const { data, error } = await supabase
      .from("schedule_blocks")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      log.error("Block update failed", error);
      return errorResponse("Update fehlgeschlagen: " + error.message, 500);
    }

    // Update daily stats when block status changes (non-critical)
    if (body.status) {
      try {
        const blockDate = data.start_time.slice(0, 10);
        await supabase.rpc("update_daily_schedule_stats", {
          p_user_id: user.id,
          p_date: blockDate,
        });
      } catch { /* non-critical */ }
    }

    return successResponse(data);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  return withErrorHandler("api:schedule", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const url = req.nextUrl;
    const id = url.searchParams.get("id");
    if (!id) return errorResponse("Block-ID fehlt", 400);

    const { error } = await supabase
      .from("schedule_blocks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      log.error("Block deletion failed", error);
      return errorResponse("Löschen fehlgeschlagen: " + error.message, 500);
    }

    return successResponse({ deleted: true });
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getPreferences(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createClient> extends Promise<infer T> ? T : never,
  userId: string,
): Promise<SchedulePreferences> {
  const { data } = await supabase
    .from("user_schedule_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  return data || { ...DEFAULT_PREFERENCES, user_id: userId };
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getMonday(date: string): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}
