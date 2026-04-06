import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  requireAuth,
  canManageInstitution,
  logBuilderAction,
  errorResponse,
  createServiceClient,
  type UserRole,
} from "@/lib/api-helpers";

const log = logger("api:module-prerequisites");

/**
 * GET /api/academic/modules/[id]/prerequisites
 *
 * List prerequisites for a module.
 * Prerequisites are stored as JSON in the modules.prerequisites_json field.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = createServiceClient();

    // Fetch module with prerequisites
    const { data: module, error: moduleError } = await db
      .from("modules")
      .select("id, name, prerequisites_json")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return errorResponse("Modul nicht gefunden", 404);
    }

    // Parse prerequisites_json (default to empty array)
    const prerequisites = module.prerequisites_json || [];

    return NextResponse.json({
      module: {
        id: module.id,
        name: module.name,
      },
      prerequisites,
    });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}

/**
 * POST /api/academic/modules/[id]/prerequisites
 *
 * Add a prerequisite to a module.
 * Owner or institution/platform admin can add prerequisites.
 * Body:
 *   - prerequisite_module_id: uuid of the prerequisite module
 *   - requirement_type: 'must_pass' | 'min_grade' (optional, default 'must_pass')
 *   - min_grade_value: numeric (optional, only if requirement_type is 'min_grade')
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;
    const db = createServiceClient();

    // Get user's builder role
    const { data: profile } = await db
      .from("profiles")
      .select("user_role")
      .eq("id", user.id)
      .single();

    const userRole = (profile?.user_role as UserRole) ?? "non_student";

    // Verify module exists
    const { data: module, error: moduleError } = await db
      .from("modules")
      .select("id, prerequisites_json, user_id, program_id")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return errorResponse("Modul nicht gefunden", 404);
    }

    // Check permissions: owner or admin
    const isOwner = module.user_id === user.id;
    const isAdmin = ["admin", "institution"].includes(userRole);

    if (!isOwner && isAdmin && userRole === "institution" && module.program_id) {
      const { data: program } = await db
        .from("programs")
        .select("institution_id")
        .eq("id", module.program_id)
        .single();

      if (program && !(await canManageInstitution(db, user.id, program.institution_id, userRole))) {
        return errorResponse("Keine Berechtigung zur Bearbeitung dieses Moduls", 403);
      }
    } else if (!isOwner && !isAdmin) {
      return errorResponse("Keine Berechtigung zur Bearbeitung dieses Moduls", 403);
    }

    const body = await req.json();
    const { prerequisite_module_id, requirement_type, min_grade_value } = body;

    // Validate required fields
    if (!prerequisite_module_id) {
      return errorResponse("Voraussetzungsmodul-ID ist erforderlich", 400);
    }

    // Verify prerequisite module exists
    const { data: prerequisiteModule, error: prerequisiteError } = await db
      .from("modules")
      .select("id")
      .eq("id", prerequisite_module_id)
      .single();

    if (prerequisiteError || !prerequisiteModule) {
      return errorResponse("Voraussetzungsmodul nicht gefunden", 404);
    }

    // Don't allow circular prerequisites
    if (prerequisite_module_id === id) {
      return errorResponse("Ein Modul kann nicht seine eigene Voraussetzung sein", 400);
    }

    // Validate requirement_type if provided
    const validRequirementTypes = ["must_pass", "min_grade"];
    const reqType = requirement_type || "must_pass";
    if (!validRequirementTypes.includes(reqType)) {
      return errorResponse("Ungültiger Anforderungstyp", 400);
    }

    // Build new prerequisite object
    const newPrerequisite = {
      module_id: prerequisite_module_id,
      requirement_type: reqType,
      min_grade_value: reqType === "min_grade" ? min_grade_value : null,
      added_at: new Date().toISOString(),
    };

    // Get current prerequisites
    let prerequisites = module.prerequisites_json || [];
    if (!Array.isArray(prerequisites)) {
      prerequisites = [];
    }

    // Check if prerequisite already exists
    const exists = prerequisites.some(
      (p: any) => p.module_id === prerequisite_module_id
    );
    if (exists) {
      return errorResponse("Diese Voraussetzung existiert bereits", 422);
    }

    // Add new prerequisite
    prerequisites.push(newPrerequisite);

    // Update module
    const { data: updated, error: updateError } = await db
      .from("modules")
      .update({ prerequisites_json: prerequisites })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      log.error("POST update failed", { error: updateError });
      return errorResponse(updateError.message, 500);
    }

    await logBuilderAction(db, user.id, "update", "module_prerequisites", id, `Added prerequisite ${prerequisite_module_id}`);

    return NextResponse.json({
      module: updated,
      prerequisite: newPrerequisite,
      prerequisites: updated.prerequisites_json,
    }, { status: 201 });
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
