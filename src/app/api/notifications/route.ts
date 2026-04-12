/**
 * /api/notifications — Notification Center API
 *
 * GET    → Fetch user notifications (paginated, filterable)
 * POST   → Create notification(s) from automation events
 * PATCH  → Mark as read / dismiss (single or bulk)
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

const log = logger("api:notifications");

// ── GET: Fetch notifications ──────────────────────────────────
export async function GET(req: NextRequest) {
  return withErrorHandler("api:notifications", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const unreadOnly = searchParams.get("unread") === "true";
    const typeFilter = searchParams.get("type");

    // Count unread
    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .eq("is_dismissed", false);

    // Fetch notifications
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }
    if (typeFilter) {
      query = query.eq("type", typeFilter);
    }

    const { data: notifications, error } = await query;
    if (error) {
      log.error("Fetch failed", error);
      return errorResponse("Fehler beim Laden", 500);
    }

    return successResponse({
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
      hasMore: (notifications?.length || 0) === limit,
    });
  });
}

// ── POST: Create notification(s) ─────────────────────────────
export async function POST(req: NextRequest) {
  return withErrorHandler("api:notifications", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody(req);
    if (isErrorResponse(body)) return body;

    const items: Array<Record<string, unknown>> = Array.isArray(body)
      ? (body as Array<Record<string, unknown>>)
      : [body as Record<string, unknown>];

    const rows = items.map((item) => ({
      user_id: user.id,
      type: item.type as string,
      priority: (item.priority as string) || "normal",
      title: item.title as string,
      message: item.message as string,
      dedupe_key: (item.dedupe_key as string) || null,
      module_id: (item.module_id as string) || null,
      module_name: (item.module_name as string) || null,
      module_color: (item.module_color as string) || null,
      action_label: (item.action_label as string) || null,
      action_href: (item.action_href as string) || null,
      metadata: (item.metadata as Record<string, unknown>) || {},
    }));

    const { data, error } = await supabase
      .from("notifications")
      .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
      .select();

    if (error) {
      log.error("Create failed", error);
      return errorResponse("Fehler beim Erstellen", 500);
    }

    return successResponse({ created: data?.length || 0, notifications: data });
  });
}

// ── PATCH: Mark read / dismiss ────────────────────────────────
export async function PATCH(req: NextRequest) {
  return withErrorHandler("api:notifications", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<{ action: string; ids?: string[] }>(req);
    if (isErrorResponse(body)) return body;

    const { action, ids } = body;

    if (action === "mark_all_read") {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) return errorResponse("Fehler", 500);
      return successResponse({ ok: true });
    }

    if (action === "dismiss_all") {
      const { error } = await supabase
        .from("notifications")
        .update({ is_dismissed: true })
        .eq("user_id", user.id)
        .eq("is_dismissed", false);
      if (error) return errorResponse("Fehler", 500);
      return successResponse({ ok: true });
    }

    if (!ids || ids.length === 0) {
      return errorResponse("ids required", 400);
    }

    const updates: Record<string, boolean> = {};
    if (action === "mark_read") updates.is_read = true;
    if (action === "dismiss") updates.is_dismissed = true;

    const { error } = await supabase
      .from("notifications")
      .update(updates)
      .eq("user_id", user.id)
      .in("id", ids);

    if (error) return errorResponse("Fehler", 500);
    return successResponse({ ok: true, updated: ids.length });
  });
}
