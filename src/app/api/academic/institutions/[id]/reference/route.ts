import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  requireAuth,
  canManageInstitution,
  errorResponse,
  createServiceClient,
  type UserRole,
} from "@/lib/api-helpers";

const log = logger("api:institution-reference");

// Valid reference table names
const VALID_TABLES = new Set([
  "grade_scales",
  "pass_policies",
  "retake_policies",
  "rounding_policies",
]);

// Allowed insert/update fields per table
const TABLE_FIELDS: Record<string, string[]> = {
  grade_scales: [
    "code", "name", "country_code", "type", "min_value", "max_value",
    "pass_value", "step_size", "decimal_places", "higher_is_better",
    "supports_honours", "special_labels", "description",
  ],
  pass_policies: [
    "code", "name", "type", "min_grade_to_pass", "requires_all_components",
    "compensation_allowed", "description",
  ],
  retake_policies: [
    "code", "name", "max_attempts", "retake_if_passed", "grade_replacement",
    "description",
  ],
  rounding_policies: [
    "code", "name", "rounding_method", "decimal_places", "description",
  ],
};

/**
 * GET /api/academic/institutions/[id]/reference?table=grade_scales
 *
 * List all reference entries for a given institution (institution-specific custom entries).
 * Query params:
 *   - table (required): one of grade_scales, pass_policies, retake_policies, rounding_policies
 *   - include_global (optional): "true" to also include global (institution_id IS NULL) entries
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: institutionId } = await params;
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const db = createServiceClient();
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table");
    const includeGlobal = searchParams.get("include_global") === "true";

    if (!table || !VALID_TABLES.has(table)) {
      return errorResponse(
        `Ungültige Tabelle. Erlaubt: ${[...VALID_TABLES].join(", ")}`,
        400
      );
    }

    // Verify institution exists
    const { data: institution, error: instError } = await db
      .from("institutions")
      .select("id")
      .eq("id", institutionId)
      .single();

    if (instError || !institution) {
      return errorResponse("Institution nicht gefunden", 404);
    }

    let query;
    if (includeGlobal) {
      // Fetch both institution-specific AND global entries
      query = db
        .from(table)
        .select("*")
        .or(`institution_id.eq.${institutionId},institution_id.is.null`)
        .order("name");
    } else {
      // Only institution-specific entries
      query = db
        .from(table)
        .select("*")
        .eq("institution_id", institutionId)
        .order("name");
    }

    const { data, error } = await query;

    if (error) {
      log.error("GET reference data failed", { table, error });
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({ [table]: data || [] });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}

/**
 * POST /api/academic/institutions/[id]/reference
 *
 * Create a custom reference entry for an institution.
 * Body:
 *   - table (required): one of grade_scales, pass_policies, retake_policies, rounding_policies
 *   - data (required): object with the fields to insert
 *
 * Only institution_admin (for their own institution) and platform_admin can create.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: institutionId } = await params;
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;
    const db = createServiceClient();

    // Check user role
    const { data: profile } = await db
      .from("profiles")
      .select("user_role")
      .eq("id", user.id)
      .single();

    const userRole = (profile?.user_role as UserRole) ?? "non_student";

    // Only admins can create custom reference data
    if (!["admin", "institution"].includes(userRole)) {
      return errorResponse("Keine Berechtigung", 403);
    }

    // Institution admins: verify they manage this institution
    if (userRole === "institution") {
      if (!(await canManageInstitution(db, user.id, institutionId, userRole))) {
        return errorResponse("Keine Berechtigung für diese Institution", 403);
      }
    }

    const body = await req.json();
    const { table, data } = body;

    if (!table || !VALID_TABLES.has(table)) {
      return errorResponse(
        `Ungültige Tabelle. Erlaubt: ${[...VALID_TABLES].join(", ")}`,
        400
      );
    }

    if (!data || typeof data !== "object") {
      return errorResponse("Daten sind erforderlich", 400);
    }

    // Filter to allowed fields only
    const allowedFields = TABLE_FIELDS[table] || [];
    const insertData: Record<string, unknown> = {
      institution_id: institutionId,
    };

    for (const field of allowedFields) {
      if (data[field] !== undefined && data[field] !== "") {
        insertData[field] = data[field];
      }
    }

    // Require at minimum a name
    if (!insertData.name) {
      return errorResponse("Name ist erforderlich", 400);
    }

    // Auto-generate code if not provided
    if (!insertData.code) {
      const prefix = institutionId.substring(0, 8).toUpperCase();
      const namePart = (insertData.name as string)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_")
        .substring(0, 20);
      insertData.code = `INST_${prefix}_${namePart}`;
    }

    const { data: created, error } = await db
      .from(table)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      log.error("POST reference insert failed", { table, error });
      if (error.code === "23505") {
        return errorResponse("Ein Eintrag mit diesem Code existiert bereits", 422);
      }
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({ entry: created }, { status: 201 });
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}

/**
 * DELETE /api/academic/institutions/[id]/reference
 *
 * Delete a custom reference entry. Only institution-specific entries can be deleted.
 * Body:
 *   - table (required): one of grade_scales, pass_policies, retake_policies, rounding_policies
 *   - entry_id (required): the UUID of the entry to delete
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: institutionId } = await params;
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;
    const db = createServiceClient();

    // Check user role
    const { data: profile } = await db
      .from("profiles")
      .select("user_role")
      .eq("id", user.id)
      .single();

    const userRole = (profile?.user_role as UserRole) ?? "non_student";

    if (!["admin", "institution"].includes(userRole)) {
      return errorResponse("Keine Berechtigung", 403);
    }

    if (userRole === "institution") {
      if (!(await canManageInstitution(db, user.id, institutionId, userRole))) {
        return errorResponse("Keine Berechtigung für diese Institution", 403);
      }
    }

    const body = await req.json();
    const { table, entry_id } = body;

    if (!table || !VALID_TABLES.has(table)) {
      return errorResponse(
        `Ungültige Tabelle. Erlaubt: ${[...VALID_TABLES].join(", ")}`,
        400
      );
    }

    if (!entry_id) {
      return errorResponse("entry_id ist erforderlich", 400);
    }

    // Verify it's an institution-specific entry (not global)
    const { data: existing, error: checkError } = await db
      .from(table)
      .select("id, institution_id")
      .eq("id", entry_id)
      .single();

    if (checkError || !existing) {
      return errorResponse("Eintrag nicht gefunden", 404);
    }

    if (!existing.institution_id) {
      return errorResponse("System-Einträge können nicht gelöscht werden", 403);
    }

    if (existing.institution_id !== institutionId) {
      return errorResponse("Eintrag gehört nicht zu dieser Institution", 403);
    }

    const { error: deleteError } = await db
      .from(table)
      .delete()
      .eq("id", entry_id);

    if (deleteError) {
      log.error("DELETE reference failed", { table, error: deleteError });
      return errorResponse(deleteError.message, 500);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    log.error("DELETE failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
