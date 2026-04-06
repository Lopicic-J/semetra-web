import { NextRequest, NextResponse } from "next/server";
import {
  requireRole,
  requireAuth,
  isErrorResponse,
  successResponse,
  errorResponse,
  parseBody,
  type UserRole,
  type VerificationStatus,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

const log = logger("api:verification");

/**
 * GET /api/admin/verification?status=pending
 *
 * List users pending verification.
 * Query params:
 *   - status: filter by verification_status (default: "pending")
 *   - role: filter by user_role
 *
 * Requires admin role.
 *
 * Note: No document preview — verification is based on email domain
 * or manual admin decision.
 */
export async function GET(request: NextRequest) {
  try {
    const rc = await requireRole(["admin"]);
    if (isErrorResponse(rc)) return rc;

    const db = rc.adminClient ?? rc.db;
    const status = request.nextUrl.searchParams.get("status") || "pending";
    const role = request.nextUrl.searchParams.get("role");

    let query = db
      .from("profiles")
      .select("id, email, full_name, username, user_role, verification_status, verification_submitted_at, verification_note, verified_email_domain, university, created_at")
      .eq("verification_status", status)
      .order("verification_submitted_at", { ascending: true, nullsFirst: false });

    if (role) {
      query = query.eq("user_role", role);
    }

    const { data: users, error } = await query;

    if (error) {
      log.error("Failed to fetch verification queue", { error });
      return errorResponse(error.message, 500);
    }

    return successResponse({ users: users || [] });
  } catch (err: unknown) {
    log.error("GET /api/admin/verification failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}

interface VerificationAction {
  user_id: string;
  action: "approve" | "reject";
  note?: string;
}

/**
 * PATCH /api/admin/verification
 *
 * Approve or reject a user's verification.
 * Body: { user_id: string, action: "approve" | "reject", note?: string }
 *
 * Requires admin role.
 */
export async function PATCH(request: Request) {
  try {
    const rc = await requireRole(["admin"]);
    if (isErrorResponse(rc)) return rc;

    const db = rc.adminClient ?? rc.supabase;
    const { user } = rc;

    const body = await parseBody<VerificationAction>(request);
    if (isErrorResponse(body)) return body;

    const { user_id, action, note } = body;

    if (!user_id || !["approve", "reject"].includes(action)) {
      return errorResponse("user_id und action (approve/reject) sind erforderlich", 400);
    }

    // Check that target user actually has pending verification
    const { data: target } = await db
      .from("profiles")
      .select("verification_status, user_role, email")
      .eq("id", user_id)
      .single();

    if (!target) {
      return errorResponse("User nicht gefunden", 404);
    }

    if (target.verification_status !== "pending") {
      return errorResponse(`User hat keinen ausstehenden Verifizierungsantrag (Status: ${target.verification_status})`, 400);
    }

    const newStatus: VerificationStatus = action === "approve" ? "verified" : "rejected";

    const { error } = await db
      .from("profiles")
      .update({
        verification_status: newStatus,
        verification_reviewed_at: new Date().toISOString(),
        verification_reviewed_by: user.id,
        verification_note: action === "reject"
          ? (note || "Verwende deine Hochschul-Email für automatische Verifizierung.")
          : null,
      })
      .eq("id", user_id);

    if (error) {
      log.error("Failed to update verification", { error, user_id, action });
      return errorResponse(error.message, 500);
    }

    // Log the action
    try {
      await db.from("builder_audit_log").insert({
        user_id: user.id,
        action: `verification_${action}`,
        entity_type: "user",
        entity_id: user_id,
        entity_name: target.email,
        changes: { verification_status: newStatus, note },
      });
    } catch (logErr) {
      log.warn("Failed to log verification action", logErr);
    }

    return successResponse({
      success: true,
      message: action === "approve"
        ? "Verifizierung genehmigt"
        : "Verifizierung abgelehnt",
    });
  } catch (err: unknown) {
    log.error("PATCH /api/admin/verification failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}
