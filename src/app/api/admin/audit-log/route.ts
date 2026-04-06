import { NextResponse } from "next/server";
import {
  requireRole,
  isErrorResponse,
  successResponse,
  errorResponse,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

const log = logger("api:admin-audit-log");

/**
 * GET /api/admin/audit-log?limit=50
 *
 * Returns recent builder audit log entries (default: last 50) with user information.
 * Includes user email and name joined from profiles.
 *
 * Requires admin role.
 */
export async function GET(request: Request) {
  try {
    const rc = await requireRole(["admin"]);
    if (isErrorResponse(rc)) return rc;

    const db = rc.adminClient ?? rc.supabase;

    // Get limit from query params (default 50)
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(parseInt(limitParam || "50", 10), 200); // Cap at 200

    // Fetch audit log entries
    const { data: entries, error } = await db
      .from("builder_audit_log")
      .select("id, user_id, action, entity_type, entity_id, entity_name, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      log.error("Failed to fetch audit log", { error });
      return errorResponse(error.message, 500);
    }

    // Fetch user profiles separately to avoid FK join issues
    const userIds = [...new Set((entries || []).map((e: any) => e.user_id))];
    const { data: profiles } = userIds.length > 0
      ? await db.from("profiles").select("id, email, full_name").in("id", userIds)
      : { data: [] };

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const formattedEntries = (entries || []).map((e: any) => {
      const profile = profileMap.get(e.user_id);
      return {
        id: e.id,
        user_id: e.user_id,
        action: e.action,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        entity_name: e.entity_name,
        created_at: e.created_at,
        user_email: profile?.email ?? "Unknown",
        user_name: profile?.full_name ?? null,
      };
    });

    return successResponse({
      entries: formattedEntries,
      count: formattedEntries.length,
    });
  } catch (err: unknown) {
    log.error("GET /api/admin/audit-log failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
