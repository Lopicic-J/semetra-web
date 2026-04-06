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
 * GET /api/academic/programs/[id]/requirement-groups
 *
 * List requirement groups for a program.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = createServiceClient();

    // Verify program exists
    const { data: program, error: programError } = await db
      .from("programs")
      .select("id")
      .eq("id", id)
      .single();

    if (programError || !program) {
      return errorResponse("Studiengang nicht gefunden", 404);
    }

    const { data, error } = await db
      .from("program_requirement_groups")
      .select("*")
      .eq("program_id", id)
      .order("sort_order", { ascending: true });

    if (error) {
      log.error("GET failed", { error });
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({ requirementGroups: data || [] });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}

/**
 * POST /api/academic/programs/[id]/requirement-groups
 *
 * Create a new requirement group for a program.
 * Institution or admin only.
 * Required fields: name, group_type
 * Optional fields: min_credits_required, min_modules_required, etc.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;
    const { user, userRole } = rc;
    const db = rc.adminClient ?? createServiceClient();

    // Verify program exists
    const { data: program, error: programError } = await db
      .from("programs")
      .select("id, institution_id")
      .eq("id", id)
      .single();

    if (programError || !program) {
      return errorResponse("Studiengang nicht gefunden", 404);
    }

    // Check institution permission
    if (!(await canManageInstitution(db, user.id, program.institution_id, userRole))) {
      return errorResponse("Keine Berechtigung für diese Institution", 403);
    }

    const body = await req.json();
    const { name, group_type, min_credits_required, min_modules_required } = body;

    // Validate required fields
    if (!name || !group_type) {
      return errorResponse("Name und Gruppentyp sind erforderlich", 400);
    }

    // Validate group_type
    const validGroupTypes = [
      "compulsory",
      "elective_required",
      "elective_free",
      "specialisation",
      "minor",
      "thesis",
      "internship",
    ];
    if (!validGroupTypes.includes(group_type)) {
      return errorResponse("Ungültiger Gruppentyp", 400);
    }

    const { data, error } = await db
      .from("program_requirement_groups")
      .insert({
        program_id: id,
        name,
        group_type,
        min_credits_required: min_credits_required || null,
        min_modules_required: min_modules_required || null,
        rule_type: body.rule_type || "all_of",
      })
      .select()
      .single();

    if (error) {
      log.error("POST insert failed", { error });
      return errorResponse(error.message, 500);
    }

    await logBuilderAction(db, user.id, "create", "requirement_group", data.id, name);

    return NextResponse.json({ requirementGroup: data }, { status: 201 });
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
