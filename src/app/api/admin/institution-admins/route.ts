import { NextResponse } from "next/server";
import {
  requireRole,
  isErrorResponse,
  successResponse,
  errorResponse,
  parseBody,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

const log = logger("api:admin-institution-admins");

/**
 * GET /api/admin/institution-admins
 *
 * Returns all institution_admin assignments with user and institution details.
 * Includes user email/name and institution name.
 *
 * Requires admin role.
 */
export async function GET() {
  try {
    const rc = await requireRole(["admin"]);
    if (isErrorResponse(rc)) return rc;

    const db = rc.adminClient ?? rc.supabase;

    // Fetch assignments (use id as fallback sort if granted_at doesn't exist)
    const { data: assignments, error } = await db
      .from("institution_admins")
      .select("id, user_id, institution_id");

    if (error) {
      log.error("Failed to fetch institution admins", { error });
      return errorResponse(error.message, 500);
    }

    // Fetch profiles and institutions separately to avoid FK join issues
    const userIds = [...new Set((assignments || []).map((a: any) => a.user_id))];
    const instIds = [...new Set((assignments || []).map((a: any) => a.institution_id))];

    const [{ data: profiles }, { data: institutions }] = await Promise.all([
      userIds.length > 0
        ? db.from("profiles").select("id, email, full_name").in("id", userIds)
        : Promise.resolve({ data: [] }),
      instIds.length > 0
        ? db.from("institutions").select("id, name").in("id", instIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const instMap = new Map((institutions || []).map((i: any) => [i.id, i]));

    const formattedAssignments = (assignments || []).map((a: any) => {
      const profile = profileMap.get(a.user_id);
      const inst = instMap.get(a.institution_id);
      return {
        id: a.id,
        user_id: a.user_id,
        institution_id: a.institution_id,
        user_email: profile?.email ?? "",
        user_name: profile?.full_name ?? null,
        institution_name: inst?.name ?? "Unknown",
      };
    });

    return successResponse({
      assignments: formattedAssignments,
    });
  } catch (err: unknown) {
    log.error("GET /api/admin/institution-admins failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}

interface CreateInstitutionAdminBody {
  user_id: string;
  institution_id: string;
}

/**
 * POST /api/admin/institution-admins
 *
 * Creates a new institution_admin assignment.
 * Body: { user_id: string, institution_id: string }
 *
 * Requires admin role.
 */
export async function POST(request: Request) {
  try {
    const rc = await requireRole(["admin"]);
    if (isErrorResponse(rc)) return rc;

    const db = rc.adminClient ?? rc.supabase;
    const { user } = rc;

    const body = await parseBody<CreateInstitutionAdminBody>(request);
    if (isErrorResponse(body)) return body;

    const { user_id, institution_id } = body;

    // Verify user exists
    const { data: userExists } = await db
      .from("profiles")
      .select("id")
      .eq("id", user_id)
      .single();

    if (!userExists) {
      return errorResponse("User not found", 404);
    }

    // Verify institution exists
    const { data: institutionExists } = await db
      .from("institutions")
      .select("id")
      .eq("id", institution_id)
      .single();

    if (!institutionExists) {
      return errorResponse("Institution not found", 404);
    }

    // Check if assignment already exists
    const { data: existingAssignment } = await db
      .from("institution_admins")
      .select("id")
      .eq("user_id", user_id)
      .eq("institution_id", institution_id)
      .maybeSingle();

    if (existingAssignment) {
      return errorResponse("Assignment already exists", 409);
    }

    // Create the assignment
    const { data: newAssignment, error } = await db
      .from("institution_admins")
      .insert({ user_id, institution_id })
      .select()
      .single();

    if (error) {
      log.error("Failed to create institution admin", {
        error,
        user_id,
        institution_id,
      });
      return errorResponse(error.message, 500);
    }

    // Log the action
    try {
      await db.from("builder_audit_log").insert({
        user_id: user.id,
        action: "create",
        entity_type: "institution_admin",
        entity_id: newAssignment.id,
        entity_name: null,
        changes: { user_id, institution_id },
      });
    } catch (logErr) {
      log.warn("Failed to log action", logErr);
    }

    return successResponse(
      {
        success: true,
        assignment: newAssignment,
      },
      201
    );
  } catch (err: unknown) {
    log.error("POST /api/admin/institution-admins failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}

interface DeleteInstitutionAdminBody {
  user_id: string;
  institution_id: string;
}

/**
 * DELETE /api/admin/institution-admins
 *
 * Removes an institution_admin assignment.
 * Body: { user_id: string, institution_id: string }
 *
 * Requires admin role.
 */
export async function DELETE(request: Request) {
  try {
    const rc = await requireRole(["admin"]);
    if (isErrorResponse(rc)) return rc;

    const db = rc.adminClient ?? rc.supabase;
    const { user } = rc;

    const body = await parseBody<DeleteInstitutionAdminBody>(request);
    if (isErrorResponse(body)) return body;

    const { user_id, institution_id } = body;

    // Find and delete the assignment
    const { data: assignment } = await db
      .from("institution_admins")
      .select("id")
      .eq("user_id", user_id)
      .eq("institution_id", institution_id)
      .maybeSingle();

    if (!assignment) {
      return errorResponse("Assignment not found", 404);
    }

    const { error } = await db
      .from("institution_admins")
      .delete()
      .eq("user_id", user_id)
      .eq("institution_id", institution_id);

    if (error) {
      log.error("Failed to delete institution admin", {
        error,
        user_id,
        institution_id,
      });
      return errorResponse(error.message, 500);
    }

    // Log the action
    try {
      await db.from("builder_audit_log").insert({
        user_id: user.id,
        action: "delete",
        entity_type: "institution_admin",
        entity_id: assignment.id,
        entity_name: null,
        changes: { user_id, institution_id },
      });
    } catch (logErr) {
      log.warn("Failed to log action", logErr);
    }

    return successResponse({
      success: true,
      message: "Institution admin removed",
    });
  } catch (err: unknown) {
    log.error("DELETE /api/admin/institution-admins failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
