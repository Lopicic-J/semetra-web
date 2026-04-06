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

const log = logger("api:programs");

/**
 * GET /api/academic/programs/[id]
 *
 * Get program with requirement groups and modules.
 * Accessible to all authenticated users.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = createServiceClient();

    const { data: program, error: programError } = await db
      .from("programs")
      .select("*")
      .eq("id", id)
      .single();

    if (programError) {
      if (programError.code === "PGRST116") {
        return errorResponse("Studiengang nicht gefunden", 404);
      }
      log.error("GET fetch failed", { error: programError });
      return errorResponse(programError.message, 500);
    }

    const { data: requirementGroups } = await db
      .from("program_requirement_groups")
      .select("*")
      .eq("program_id", id);

    const { data: modules } = await db
      .from("modules")
      .select("*")
      .eq("program_id", id);

    return NextResponse.json({
      program,
      requirementGroups: requirementGroups || [],
      modules: modules || [],
    });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}

/**
 * PATCH /api/academic/programs/[id]
 *
 * Update program fields.
 * Requires: admin or institution for the program's institution.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;
    const { user, userRole } = rc;
    const db = rc.adminClient ?? createServiceClient();

    const body = await req.json();

    const { data: existing, error: existingError } = await db
      .from("programs")
      .select("id, name, institution_id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return errorResponse("Studiengang nicht gefunden", 404);
    }

    // Check institution permission
    if (existing.institution_id) {
      if (!(await canManageInstitution(db, user.id, existing.institution_id, userRole))) {
        return errorResponse("Keine Berechtigung für diese Institution", 403);
      }
    }

    if (body.degree_level) {
      const valid = ["short_cycle", "bachelor", "master", "phd", "diploma"];
      if (!valid.includes(body.degree_level)) {
        return errorResponse("Ungültiger Studienabschluss", 400);
      }
    }

    if (body.institution_id) {
      const { data: inst } = await db
        .from("institutions")
        .select("id")
        .eq("id", body.institution_id)
        .single();

      if (!inst) {
        return errorResponse("Institution nicht gefunden", 404);
      }
    }

    // Whitelist allowed fields
    const allowedFields = [
      "name", "degree_level", "institution_id", "faculty_id",
      "required_total_credits", "duration_standard_terms",
      "thesis_required", "internship_required", "final_exam_required",
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    const { data, error } = await db
      .from("programs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      log.error("PATCH update failed", { error });
      return errorResponse(error.message, 500);
    }

    await logBuilderAction(
      db, user.id, "update", "program", id,
      existing.name, updateData,
    );

    return NextResponse.json({ program: data });
  } catch (err: unknown) {
    log.error("PATCH failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}

/**
 * DELETE /api/academic/programs/[id]
 *
 * Delete program. Requires: admin or institution.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;
    const { user, userRole } = rc;
    const db = rc.adminClient ?? createServiceClient();

    const { data: existing, error: existingError } = await db
      .from("programs")
      .select("id, name, institution_id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return errorResponse("Studiengang nicht gefunden", 404);
    }

    if (existing.institution_id) {
      if (!(await canManageInstitution(db, user.id, existing.institution_id, userRole))) {
        return errorResponse("Keine Berechtigung für diese Institution", 403);
      }
    }

    const { error } = await db
      .from("programs")
      .delete()
      .eq("id", id);

    if (error) {
      log.error("DELETE failed", { error });
      return errorResponse(error.message, 500);
    }

    await logBuilderAction(
      db, user.id, "delete", "program", id, existing.name,
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    log.error("DELETE failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}
