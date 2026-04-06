import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  requireRole,
  canManageInstitution,
  logBuilderAction,
  errorResponse,
  isErrorResponse,
  createServiceClient,
} from "@/lib/api-helpers";

const log = logger("api:requirement-groups");

/**
 * DELETE /api/academic/programs/[id]/requirement-groups/[groupId]
 *
 * Delete a requirement group from a program.
 * Institution or admin only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  try {
    const { id, groupId } = await params;
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;
    const { user, userRole } = rc;
    const db = rc.adminClient ?? createServiceClient();

    // Verify group belongs to this program
    const { data: existing, error: existingError } = await db
      .from("program_requirement_groups")
      .select("id, program_id")
      .eq("id", groupId)
      .eq("program_id", id)
      .single();

    if (existingError || !existing) {
      return errorResponse("Anforderungsgruppe nicht gefunden", 404);
    }

    // Verify program and check institution permission
    const { data: program, error: programError } = await db
      .from("programs")
      .select("id, institution_id")
      .eq("id", id)
      .single();

    if (programError || !program) {
      return errorResponse("Studiengang nicht gefunden", 404);
    }

    if (!(await canManageInstitution(db, user.id, program.institution_id, userRole))) {
      return errorResponse("Keine Berechtigung für diese Institution", 403);
    }

    const { error } = await db
      .from("program_requirement_groups")
      .delete()
      .eq("id", groupId);

    if (error) {
      log.error("DELETE failed", { error });
      return errorResponse(error.message, 500);
    }

    await logBuilderAction(db, user.id, "delete", "requirement_group", groupId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    log.error("DELETE failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
