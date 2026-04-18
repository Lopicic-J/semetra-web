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
 * POST /api/schedule { action: "auto-fill" }   → Fill free slots with prioritized study
 * POST /api/schedule { action: "auto-rescue" } → Rescue missed blocks into future slots
 * POST /api/schedule { action: "exam-plan" }   → Generate exam prep study plan
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

    // ── Import stundenplan (legacy) ───────────────────────────────────
    if (action === "import") {
      // Redirect to new sync logic
      body.action = "sync-stundenplan";
    }

    // ── Sync stundenplan → schedule_blocks (smart upsert) ──────────
    if (action === "sync-stundenplan" || body.action === "sync-stundenplan") {
      // 1. Fetch all stundenplan entries
      const { data: entries, error: fetchErr } = await supabase
        .from("stundenplan")
        .select("*")
        .eq("user_id", user.id);

      if (fetchErr) {
        log.error("Stundenplan fetch failed", fetchErr);
        return errorResponse("Sync fehlgeschlagen: " + fetchErr.message, 500);
      }

      // 2. Fetch existing synced blocks
      const { data: existingBlocks } = await supabase
        .from("schedule_blocks")
        .select("id, stundenplan_id, start_time, end_time")
        .eq("user_id", user.id)
        .eq("source", "stundenplan_sync")
        .eq("layer", 1);

      const existingMap = new Map(
        (existingBlocks || [])
          .filter(b => b.stundenplan_id)
          .map(b => [b.stundenplan_id!, b])
      );

      // Also check old 'stundenplan_import' blocks
      const { data: legacyBlocks } = await supabase
        .from("schedule_blocks")
        .select("id, stundenplan_id, start_time, end_time")
        .eq("user_id", user.id)
        .eq("source", "stundenplan_import")
        .eq("layer", 1);

      for (const lb of (legacyBlocks || [])) {
        if (lb.stundenplan_id && !existingMap.has(lb.stundenplan_id)) {
          existingMap.set(lb.stundenplan_id, lb);
        }
      }

      // 3. Calculate Monday of current week
      const today = new Date();
      const dow = today.getDay();
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);

      const dayOffsetMap: Record<string, number> = {
        Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4, Sa: 5,
      };

      let created = 0;
      let updated = 0;
      let deleted = 0;

      const activeStundenplanIds = new Set<string>();

      for (const entry of (entries || [])) {
        const dayOffset = dayOffsetMap[entry.day];
        if (dayOffset === undefined) continue;

        activeStundenplanIds.add(entry.id);

        const targetDate = new Date(monday);
        targetDate.setDate(monday.getDate() + dayOffset);

        const [sh, sm] = (entry.time_start as string).split(":").map(Number);
        const [eh, em] = (entry.time_end as string).split(":").map(Number);

        const startTime = new Date(targetDate);
        startTime.setHours(sh, sm, 0, 0);
        const endTime = new Date(targetDate);
        endTime.setHours(eh, em, 0, 0);

        const existing = existingMap.get(entry.id);
        if (existing) {
          // UPDATE: Stundenplan entry was moved → update schedule_block
          const existingStart = new Date(existing.start_time);
          const existingEnd = new Date(existing.end_time);
          if (existingStart.getTime() !== startTime.getTime() || existingEnd.getTime() !== endTime.getTime()) {
            await supabase
              .from("schedule_blocks")
              .update({
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                title: entry.title,
                color: entry.color,
                module_id: entry.module_id,
                source: "stundenplan_sync",
              })
              .eq("id", existing.id);
            updated++;
          }
        } else {
          // INSERT: New stundenplan entry → create schedule_block
          await supabase.from("schedule_blocks").insert({
            user_id: user.id,
            block_type: "lecture",
            layer: 1,
            title: entry.title,
            color: entry.color,
            module_id: entry.module_id,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            recurrence: "weekly",
            source: "stundenplan_sync",
            stundenplan_id: entry.id,
            status: "scheduled",
            priority: "medium",
          });
          created++;
        }
      }

      // 4. Delete orphaned schedule_blocks (stundenplan entry was deleted)
      for (const [spId, block] of existingMap) {
        if (!activeStundenplanIds.has(spId)) {
          await supabase.from("schedule_blocks").delete().eq("id", block.id);
          deleted++;
        }
      }

      return successResponse({
        created, updated, deleted,
        message: `Sync: ${created} erstellt, ${updated} aktualisiert, ${deleted} entfernt`,
      });
    }

    // ── Auto-fill free slots with prioritized study ──────────────────────
    if (action === "auto-fill") {
      const date = (body.date as string) || new Date().toISOString().slice(0, 10);

      const { data, error } = await supabase.rpc("auto_fill_free_slots", {
        p_user_id: user.id,
        p_date: date,
      });

      if (error) {
        log.error("Auto-fill failed", error);
        return errorResponse("Auto-Fill fehlgeschlagen: " + error.message, 500);
      }

      return successResponse(data || { created: 0 });
    }

    // ── Auto-rescue missed blocks ──────────────────────────────────────
    if (action === "auto-rescue") {
      const lookAheadDays = (body.look_ahead_days as number) || 3;

      const { data, error } = await supabase.rpc("auto_rescue_missed_blocks", {
        p_user_id: user.id,
        p_look_ahead_days: lookAheadDays,
      });

      if (error) {
        log.error("Auto-rescue failed", error);
        return errorResponse("Auto-Rescue fehlgeschlagen: " + error.message, 500);
      }

      return successResponse(data || { rescued: 0, dropped: 0, kept_pending: 0 });
    }

    // ── Compute exam study plan ────────────────────────────────────────
    if (action === "exam-plan") {
      const horizonDays = (body.horizon_days as number) || 30;

      const { data, error } = await supabase.rpc("compute_exam_study_plan", {
        p_user_id: user.id,
        p_horizon_days: horizonDays,
      });

      if (error) {
        log.error("Exam plan generation failed", error);
        return errorResponse("Prüfungsplan-Generierung fehlgeschlagen: " + error.message, 500);
      }

      return successResponse(data || { exams_planned: 0, blocks_created: 0 });
    }

    // ── Auto-plan: Intelligent Daily Planning ─────────────────────────
    // Combines: Decision Engine + Flashcard Reviews + Task Deadlines
    if (action === "auto-plan") {
      const date = (body.date as string) || new Date().toISOString().slice(0, 10);
      const now = new Date();

      // Parallel data fetching for speed
      const [
        decisionRes,
        preferences,
        blocksRes,
        sessionsRes,
        flashcardsRes,
        tasksRes,
        examsRes,
      ] = await Promise.all([
        // 1. Decision Engine state
        fetch(new URL("/api/decision", req.url), {
          headers: { cookie: req.headers.get("cookie") || "" },
        }),
        // 2. User preferences
        getPreferences(supabase, user.id),
        // 3. Existing blocks for the day
        supabase.from("schedule_blocks").select("*")
          .eq("user_id", user.id)
          .gte("start_time", `${date}T00:00:00`)
          .lte("start_time", `${date}T23:59:59`),
        // 4. Existing sessions for the day
        supabase.from("timer_sessions").select("*")
          .eq("user_id", user.id)
          .gte("started_at", `${date}T00:00:00`)
          .lte("started_at", `${date}T23:59:59`),
        // 5. Due flashcards grouped by module
        supabase.from("flashcards")
          .select("id, module_id, modules!inner(name, color)")
          .eq("user_id", user.id)
          .or(`next_review.is.null,next_review.lte.${now.toISOString()}`),
        // 6. Tasks with upcoming deadlines (next 3 days)
        supabase.from("tasks")
          .select("id, title, due_date, priority, estimated_minutes, module_id, modules(name, color)")
          .eq("user_id", user.id)
          .in("status", ["todo", "in_progress"])
          .not("due_date", "is", null)
          .lte("due_date", new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10))
          .order("due_date", { ascending: true }),
        // 7. Upcoming exams (next 14 days)
        supabase.from("events")
          .select("id, title, date, module_id, modules(name, color)")
          .eq("user_id", user.id)
          .eq("type", "exam")
          .gte("date", date)
          .lte("date", new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10))
          .order("date", { ascending: true }),
      ]);

      // Process Decision Engine
      let bridgeBlocks: any[] = [];
      let bridgeWarnings: string[] = [];
      let bridgeUnscheduled = 0;

      const existingBlocks = blocksRes.data || [];
      const existingSessions = sessionsRes.data || [];

      const freeSlots = findFreeSlots(
        existingBlocks, existingSessions, preferences, date,
      );

      if (decisionRes.ok) {
        const decisionState = await decisionRes.json();
        if (decisionState.today?.actions?.length > 0) {
          const { bridgeDecisionToSchedule } = await import("@/lib/schedule/decision-bridge");
          const result = bridgeDecisionToSchedule(
            decisionState.today,
            decisionState.moduleRankings || [],
            freeSlots,
            preferences,
          );
          bridgeBlocks = result.blocks;
          bridgeWarnings = result.warnings;
          bridgeUnscheduled = result.unscheduled.length;
        }
      }

      // ── Supplementary blocks (fill remaining gaps) ──────────────────

      // Recalculate free slots after bridge blocks
      const allBlocks = [...existingBlocks, ...bridgeBlocks.map(b => ({
        ...b, id: "temp-" + Math.random(), user_id: user.id,
      }))];
      const remainingSlots = findFreeSlots(allBlocks, existingSessions, preferences, date);

      const supplementaryBlocks: any[] = [];

      // ── Flashcard review blocks ──────────────────────────────────────
      const dueCards = flashcardsRes.data || [];
      if (dueCards.length > 0 && remainingSlots.length > 0) {
        // Group by module
        const moduleCards = new Map<string, { count: number; name: string; color: string }>();
        for (const card of dueCards) {
          const mid = card.module_id;
          if (!mid) continue;
          const existing = moduleCards.get(mid);
          const mod = card.modules as any;
          if (existing) {
            existing.count++;
          } else {
            moduleCards.set(mid, { count: 1, name: mod?.name || "Flashcards", color: mod?.color || "#6d28d9" });
          }
        }

        // Create one flashcard block per module (max 3, ~2min per card, min 10min)
        let fcBlocksCreated = 0;
        for (const [moduleId, info] of moduleCards) {
          if (fcBlocksCreated >= 3) break;
          const estimatedMinutes = Math.max(10, Math.min(30, Math.round(info.count * 1.5)));

          // Find a slot
          const slot = remainingSlots.find(s => s.duration_minutes >= estimatedMinutes + 5);
          if (!slot) continue;

          const blockStart = new Date(new Date(slot.slot_start).getTime() + 5 * 60000);
          const blockEnd = new Date(blockStart.getTime() + estimatedMinutes * 60000);

          supplementaryBlocks.push({
            block_type: "flashcards",
            layer: 2,
            start_time: blockStart.toISOString(),
            end_time: blockEnd.toISOString(),
            module_id: moduleId,
            title: `${info.count} Karten fällig · ${info.name}`,
            description: `${info.count} Flashcards zur Wiederholung fällig (Spaced Repetition)`,
            color: info.color,
            priority: info.count >= 20 ? "high" : "medium",
            status: "scheduled",
            estimated_minutes: estimatedMinutes,
            source: "decision_engine",
            is_locked: false,
            recurrence: null, recurrence_end: null,
            task_id: null, topic_id: null, exam_id: null,
            study_plan_id: null, stundenplan_id: null, event_id: null,
            study_plan_item_id: null, original_block_id: null,
            reschedule_reason: null, completion_percent: 0,
            icon: "zap",
          });

          // Consume slot capacity
          slot.slot_start = blockEnd.toISOString();
          slot.duration_minutes -= (estimatedMinutes + 5);
          fcBlocksCreated++;
        }
      }

      // ── Task deadline blocks ─────────────────────────────────────────
      const dueTasks = tasksRes.data || [];
      if (dueTasks.length > 0) {
        const updatedSlots = remainingSlots.filter(s => s.duration_minutes >= 30);
        let taskBlocksCreated = 0;

        for (const task of dueTasks) {
          if (taskBlocksCreated >= 3) break;
          const dueDate = new Date(task.due_date);
          const daysLeft = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / 86400000));
          const estimatedMinutes = task.estimated_minutes || (daysLeft <= 1 ? 60 : 45);

          const slot = updatedSlots.find(s => s.duration_minutes >= estimatedMinutes + 5);
          if (!slot) continue;

          const blockStart = new Date(new Date(slot.slot_start).getTime() + 5 * 60000);
          const blockEnd = new Date(blockStart.getTime() + estimatedMinutes * 60000);
          const mod = task.modules as any;

          supplementaryBlocks.push({
            block_type: "study",
            layer: 2,
            start_time: blockStart.toISOString(),
            end_time: blockEnd.toISOString(),
            module_id: task.module_id,
            task_id: task.id,
            title: `📋 ${task.title}${daysLeft <= 1 ? " ⚠️" : ""}`,
            description: `Deadline: ${dueDate.toLocaleDateString("de-CH")} (${daysLeft === 0 ? "Heute!" : daysLeft === 1 ? "Morgen" : `in ${daysLeft} Tagen`})`,
            color: mod?.color || "#ef4444",
            priority: daysLeft <= 1 ? "critical" : daysLeft <= 2 ? "high" : "medium",
            status: "scheduled",
            estimated_minutes: estimatedMinutes,
            source: "decision_engine",
            is_locked: false,
            recurrence: null, recurrence_end: null,
            topic_id: null, exam_id: null,
            study_plan_id: null, stundenplan_id: null, event_id: null,
            study_plan_item_id: null, original_block_id: null,
            reschedule_reason: null, completion_percent: 0,
          });

          slot.slot_start = blockEnd.toISOString();
          slot.duration_minutes -= (estimatedMinutes + 5);
          taskBlocksCreated++;
        }
      }

      // ── Wellness modulation ──────────────────────────────────────────
      // If wellness score is low, reduce block durations to prevent burnout
      let wellnessModifier = 1.0;
      try {
        const wellnessUrl = new URL("/api/wellness?days=7", req.url);
        const wellnessRes = await fetch(wellnessUrl, {
          headers: { cookie: req.headers.get("cookie") || "" },
        });
        if (wellnessRes.ok) {
          const wellnessData = await wellnessRes.json();
          const score = wellnessData.analysis?.balanceScore ?? 70;
          if (score < 30) {
            wellnessModifier = 0.6; // Recovery mode: 40% less
            bridgeWarnings.push("⚡ Recovery-Modus: Kürzere Blöcke wegen niedriger Energie");
          } else if (score < 50) {
            wellnessModifier = 0.8; // Light mode: 20% less
            bridgeWarnings.push("💡 Leichterer Tag: Wellness-Score unter 50");
          }
        }
      } catch { /* Non-critical */ }

      // Apply wellness modifier to all blocks
      const allNewBlocks = [...bridgeBlocks, ...supplementaryBlocks].map(b => {
        if (wellnessModifier < 1.0 && b.block_type !== "break" && b.estimated_minutes) {
          const reduced = Math.max(15, Math.round(b.estimated_minutes * wellnessModifier));
          const startMs = new Date(b.start_time).getTime();
          return {
            ...b,
            estimated_minutes: reduced,
            end_time: new Date(startMs + reduced * 60000).toISOString(),
          };
        }
        return b;
      });

      // Remove old auto-planned blocks for this day
      await supabase
        .from("schedule_blocks")
        .delete()
        .eq("user_id", user.id)
        .eq("source", "decision_engine")
        .gte("start_time", `${date}T00:00:00`)
        .lte("start_time", `${date}T23:59:59`);

      // Insert all new blocks
      if (allNewBlocks.length > 0) {
        const blocksToInsert = allNewBlocks.map(b => ({
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

      const totalMinutes = allNewBlocks.reduce((sum, b) => sum + (b.estimated_minutes || 0), 0);
      const dueCardCount = (flashcardsRes.data || []).length;
      const taskCount = dueTasks.length;
      const examCount = (examsRes.data || []).length;

      return successResponse({
        scheduled: allNewBlocks.length,
        totalMinutes,
        unscheduled: bridgeUnscheduled,
        warnings: bridgeWarnings,
        context: {
          flashcardsDue: dueCardCount,
          tasksWithDeadline: taskCount,
          upcomingExams: examCount,
          bridgeBlocks: bridgeBlocks.length,
          flashcardBlocks: supplementaryBlocks.filter(b => b.block_type === "flashcards").length,
          taskBlocks: supplementaryBlocks.filter(b => b.task_id).length,
        },
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
