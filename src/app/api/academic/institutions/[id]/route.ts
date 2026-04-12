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

const log = logger("api:institutions");

/**
 * GET /api/academic/institutions/[id]
 *
 * Get institution by ID with faculties and programs.
 * Accessible to all authenticated users (read-only).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = createServiceClient();

    const { data: institution, error: institutionError } = await db
      .from("institutions")
      .select("*")
      .eq("id", id)
      .single();

    if (institutionError) {
      if (institutionError.code === "PGRST116") {
        return errorResponse("Institution nicht gefunden", 404);
      }
      log.error("GET fetch failed", { error: institutionError });
      return errorResponse(institutionError.message, 500);
    }

    const { data: faculties } = await db
      .from("faculties")
      .select("*")
      .eq("institution_id", id);

    // Fetch all programs for this institution
    const { data: allPrograms } = await db
      .from("programs")
      .select("*")
      .eq("institution_id", id);

    // Count template modules per program (user_id IS NULL = templates)
    const programIds = (allPrograms || []).map((p: any) => p.id);
    let moduleCounts: Record<string, number> = {};
    if (programIds.length > 0) {
      const { data: modRows } = await db
        .from("modules")
        .select("program_id")
        .in("program_id", programIds)
        .is("user_id", null);
      for (const row of modRows || []) {
        moduleCounts[row.program_id] = (moduleCounts[row.program_id] || 0) + 1;
      }
    }

    // Merge counts into programs
    const programsWithCount = (allPrograms || []).map((prog: any) => ({
      ...prog,
      module_count: moduleCounts[prog.id] || 0,
    }));

    return NextResponse.json({
      institution,
      faculties: faculties || [],
      programs: programsWithCount,
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
 * PATCH /api/academic/institutions/[id]
 *
 * Update institution fields.
 * Requires: admin or institution for this institution.
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

    // Check institution-level permission
    if (!(await canManageInstitution(db, user.id, id, userRole))) {
      return errorResponse("Keine Berechtigung für diese Institution", 403);
    }

    const body = await req.json();

    // Verify institution exists
    const { data: existing, error: existingError } = await db
      .from("institutions")
      .select("id, name")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return errorResponse("Institution nicht gefunden", 404);
    }

    // Validate country code if provided
    if (body.country_code) {
      const { data: countryExists, error: countryError } = await db
        .from("country_systems")
        .select("country_code")
        .eq("country_code", body.country_code)
        .single();

      if (countryError || !countryExists) {
        return errorResponse("Ungültiger Ländercode", 400);
      }
    }

    // Whitelist allowed fields
    const allowedFields = [
      "name", "country_code", "institution_type", "official_language",
      "website", "academic_year_start_month",
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    const { data, error } = await db
      .from("institutions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      log.error("PATCH update failed", { error });
      return errorResponse(error.message, 500);
    }

    await logBuilderAction(
      db, user.id, "update", "institution", id,
      existing.name, updateData,
    );

    return NextResponse.json({ institution: data });
  } catch (err: unknown) {
    log.error("PATCH failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}

/**
 * DELETE /api/academic/institutions/[id]
 *
 * Delete institution. Admin only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const rc = await requireRole(["admin"]);
    if (isErrorResponse(rc)) return rc;
    const { user } = rc;
    const db = rc.adminClient ?? createServiceClient();

    const { data: existing, error: existingError } = await db
      .from("institutions")
      .select("id, name")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return errorResponse("Institution nicht gefunden", 404);
    }

    const { error } = await db
      .from("institutions")
      .delete()
      .eq("id", id);

    if (error) {
      log.error("DELETE failed", { error });
      return errorResponse(error.message, 500);
    }

    await logBuilderAction(
      db, user.id, "delete", "institution", id, existing.name,
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
