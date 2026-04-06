/**
 * Timer Sessions API Route
 *
 * Manages Layer 3 — actual timer session tracking with full lifecycle.
 * Bridges the gap between planned blocks and real study behavior.
 *
 * GET  /api/timer-sessions                        → Recent sessions (last 50)
 * GET  /api/timer-sessions?date=YYYY-MM-DD        → Sessions for a specific day
 * GET  /api/timer-sessions?from=...&to=...        → Date range
 * GET  /api/timer-sessions?module=ID              → Sessions for a module
 * GET  /api/timer-sessions?active=true            → Currently active session
 * GET  /api/timer-sessions?view=summary&from=&to= → Session summary/analytics
 *
 * POST /api/timer-sessions                        → Start a new session
 * POST /api/timer-sessions { action: "assign" }   → Assign session to block/module post-hoc
 *
 * PATCH /api/timer-sessions                       → Update session (pause, resume, complete, abandon)
 *
 * DELETE /api/timer-sessions?id=...               → Delete a session
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
import { analyzeTimerSessions, detectSessionAlignment } from "@/lib/schedule";
import type { TimerSession, ScheduleBlock } from "@/lib/schedule";

const log = logger("api:timer-sessions");

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  return withErrorHandler("api:timer-sessions", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const url = req.nextUrl;
    const date = url.searchParams.get("date");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const moduleId = url.searchParams.get("module");
    const active = url.searchParams.get("active");
    const view = url.searchParams.get("view");

    // Active session
    if (active === "true") {
      const { data } = await supabase
        .from("timer_sessions")
        .select("*, module:modules(name, color), schedule_block:schedule_blocks(title, block_type)")
        .eq("user_id", user.id)
        .in("status", ["active", "paused"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return successResponse({ session: data });
    }

    // Summary view
    if (view === "summary") {
      const summaryFrom = from || addDays(new Date().toISOString().slice(0, 10), -30);
      const summaryTo = to || new Date().toISOString().slice(0, 10);

      const { data: sessions } = await supabase
        .from("timer_sessions")
        .select("*, module:modules(name, color)")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("started_at", `${summaryFrom}T00:00:00`)
        .lte("started_at", `${summaryTo}T23:59:59`)
        .order("started_at");

      const summary = analyzeTimerSessions((sessions || []) as TimerSession[]);
      return successResponse({ from: summaryFrom, to: summaryTo, summary });
    }

    // Build query
    let query = supabase
      .from("timer_sessions")
      .select("*, module:modules(name, color), schedule_block:schedule_blocks(title, block_type)")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });

    if (date) {
      query = query
        .gte("started_at", `${date}T00:00:00`)
        .lte("started_at", `${date}T23:59:59`);
    } else if (from && to) {
      query = query
        .gte("started_at", `${from}T00:00:00`)
        .lte("started_at", `${to}T23:59:59`);
    } else {
      query = query.limit(50);
    }

    if (moduleId) {
      query = query.eq("module_id", moduleId);
    }

    const { data, error } = await query;

    if (error) {
      log.error("Session query failed", error);
      return errorResponse("Abfrage fehlgeschlagen: " + error.message, 500);
    }

    return successResponse({ sessions: data || [] });
  });
}

// ── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  return withErrorHandler("api:timer-sessions", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<Record<string, unknown>>(req);
    if (isErrorResponse(body)) return body;

    // ── Post-hoc assignment ─────────────────────────────────────────────
    if (body.action === "assign") {
      const sessionId = body.session_id as string;
      const blockId = body.block_id as string | undefined;
      const moduleId = body.module_id as string | undefined;
      const taskId = body.task_id as string | undefined;
      const topicId = body.topic_id as string | undefined;

      if (!sessionId) return errorResponse("session_id fehlt", 400);

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (blockId) updates.schedule_block_id = blockId;
      if (moduleId) updates.module_id = moduleId;
      if (taskId) updates.task_id = taskId;
      if (topicId) updates.topic_id = topicId;

      // Recalculate alignment if block is assigned
      if (blockId) {
        updates.alignment = "within_plan";
      }

      const { data, error } = await supabase
        .from("timer_sessions")
        .update(updates)
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        log.error("Session assignment failed", error);
        return errorResponse("Zuordnung fehlgeschlagen: " + error.message, 500);
      }

      return successResponse(data);
    }

    // ── Start new session ───────────────────────────────────────────────
    // Check for existing active session
    const { data: existing } = await supabase
      .from("timer_sessions")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["active", "paused"])
      .limit(1)
      .maybeSingle();

    if (existing) {
      return errorResponse("Es läuft bereits eine aktive Session. Bitte beende sie zuerst.", 409);
    }

    const {
      session_type = "focus",
      module_id, task_id, topic_id, exam_id,
      schedule_block_id,
      planned_duration_minutes,
      energy_level,
    } = body;

    // Determine alignment
    let alignment = "unplanned";
    if (schedule_block_id) {
      alignment = "within_plan";
      // Mark block as in_progress
      await supabase
        .from("schedule_blocks")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", schedule_block_id)
        .eq("user_id", user.id);
    }

    const { data, error } = await supabase
      .from("timer_sessions")
      .insert({
        user_id: user.id,
        session_type,
        started_at: new Date().toISOString(),
        module_id: module_id || null,
        task_id: task_id || null,
        topic_id: topic_id || null,
        exam_id: exam_id || null,
        schedule_block_id: schedule_block_id || null,
        planned_duration_minutes: planned_duration_minutes || null,
        energy_level: energy_level || null,
        alignment,
        status: "active",
      })
      .select("*, module:modules(name, color)")
      .single();

    if (error) {
      log.error("Session start failed", error);
      return errorResponse("Session konnte nicht gestartet werden: " + error.message, 500);
    }

    log.info(`Timer session started: ${data.id} (${session_type})`);
    return successResponse(data, 201);
  });
}

// ── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  return withErrorHandler("api:timer-sessions", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<Record<string, unknown>>(req);
    if (isErrorResponse(body)) return body;

    const id = body.id as string;
    if (!id) return errorResponse("Session-ID fehlt", 400);

    // Get current session
    const { data: session } = await supabase
      .from("timer_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!session) return errorResponse("Session nicht gefunden", 404);

    const status = body.status as string | undefined;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    // ── Pause ──────────────────────────────────────────────────────────
    if (status === "paused" && session.status === "active") {
      updates.status = "paused";
      updates.pause_count = (session.pause_count || 0) + 1;
    }

    // ── Resume ─────────────────────────────────────────────────────────
    else if (status === "active" && session.status === "paused") {
      updates.status = "active";
      // Pause duration is tracked client-side and sent on completion
    }

    // ── Complete ───────────────────────────────────────────────────────
    else if (status === "completed") {
      const now = new Date();
      const startTime = new Date(session.started_at);
      const actualDuration = Math.round((now.getTime() - startTime.getTime()) / 1000);
      const totalPause = (body.total_pause_seconds as number) || session.total_pause_seconds || 0;
      const effective = Math.max(0, actualDuration - totalPause);

      updates.status = "completed";
      updates.ended_at = now.toISOString();
      updates.actual_duration_seconds = actualDuration;
      updates.effective_seconds = effective;
      updates.total_pause_seconds = totalPause;

      if (body.focus_rating) updates.focus_rating = body.focus_rating;
      if (body.note) updates.note = body.note;

      // Detect alignment if not already linked to a block
      if (!session.schedule_block_id) {
        const { data: dayBlocks } = await supabase
          .from("schedule_blocks")
          .select("*")
          .eq("user_id", user.id)
          .gte("start_time", `${session.started_at.slice(0, 10)}T00:00:00`)
          .lte("start_time", `${session.started_at.slice(0, 10)}T23:59:59`);

        const alignmentResult = detectSessionAlignment(
          { ...session, ...updates } as TimerSession,
          (dayBlocks || []) as ScheduleBlock[],
        );
        updates.alignment = alignmentResult.alignment;
        if (alignmentResult.matchedBlockId) {
          updates.schedule_block_id = alignmentResult.matchedBlockId;
        }
      }

      // The trigger (timer_session_completed) handles:
      // - Inserting backward-compatible time_log
      // - Updating linked schedule_block completion

      // Update daily stats (non-critical, fire-and-forget)
      try {
        const sessionDate = session.started_at.slice(0, 10);
        await supabase.rpc("update_daily_schedule_stats", {
          p_user_id: user.id,
          p_date: sessionDate,
        });
      } catch { /* non-critical */ }

      log.info(`Timer session completed: ${id} (${effective}s effective)`);
    }

    // ── Abandon ────────────────────────────────────────────────────────
    else if (status === "abandoned") {
      const now = new Date();
      const startTime = new Date(session.started_at);
      const actualDuration = Math.round((now.getTime() - startTime.getTime()) / 1000);

      updates.status = "abandoned";
      updates.ended_at = now.toISOString();
      updates.actual_duration_seconds = actualDuration;

      log.info(`Timer session abandoned: ${id}`);
    }

    // ── Generic updates ────────────────────────────────────────────────
    else {
      const allowedUpdates = ["note", "focus_rating", "energy_level", "module_id", "task_id", "topic_id"];
      for (const field of allowedUpdates) {
        if (field in body) updates[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from("timer_sessions")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, module:modules(name, color)")
      .single();

    if (error) {
      log.error("Session update failed", error);
      return errorResponse("Update fehlgeschlagen: " + error.message, 500);
    }

    return successResponse(data);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  return withErrorHandler("api:timer-sessions", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return errorResponse("Session-ID fehlt", 400);

    const { error } = await supabase
      .from("timer_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      log.error("Session deletion failed", error);
      return errorResponse("Löschen fehlgeschlagen: " + error.message, 500);
    }

    return successResponse({ deleted: true });
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
