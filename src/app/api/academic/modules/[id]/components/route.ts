import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  requireAuth,
  canManageInstitution,
  logBuilderAction,
  errorResponse,
  isErrorResponse,
  createServiceClient,
  type UserRole,
} from "@/lib/api-helpers";

const log = logger("api:module-components");

/**
 * GET /api/academic/modules/[id]/components
 *
 * List assessment components for a module.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = createServiceClient();

    // Verify module exists
    const { data: module, error: moduleError } = await db
      .from("modules")
      .select("id")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return errorResponse("Modul nicht gefunden", 404);
    }

    const { data, error } = await db
      .from("assessment_components")
      .select("*")
      .eq("module_id", id)
      .order("sequence_order", { ascending: true });

    if (error) {
      log.error("GET failed", { error });
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({ components: data || [] });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}

/**
 * POST /api/academic/modules/[id]/components
 *
 * Create a new assessment component for a module.
 * Owner or institution/platform admin can create components.
 * Required fields: name, component_type, weight_percent
 * Optional fields: grade_scale_id, pass_policy_id, etc.
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

    // Verify module exists and get owner info
    const { data: module, error: moduleError } = await db
      .from("modules")
      .select("id, user_id, program_id, source")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return errorResponse("Modul nicht gefunden", 404);
    }

    // Check if this is a student's imported copy of an institution module
    // Students cannot add components to institution modules (read-only)
    if (module.source === "institution" && module.user_id !== null) {
      const isAdminRole = ["admin", "institution"].includes(userRole);
      if (!isAdminRole) {
        return errorResponse("Institutions-Module können nicht bearbeitet werden", 403);
      }
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
    const { name, component_type, weight_percent } = body;

    // Validate required fields
    if (!name || !component_type) {
      return errorResponse("Name und Komponententyp sind erforderlich", 400);
    }

    // Validate component_type
    const validComponentTypes = [
      "written_exam",
      "oral_exam",
      "project",
      "lab",
      "homework",
      "presentation",
      "participation",
      "thesis",
      "pass_fail_requirement",
    ];
    if (!validComponentTypes.includes(component_type)) {
      return errorResponse("Ungültiger Komponententyp", 400);
    }

    // Validate weight_percent is between 0 and 100
    const weightValue = weight_percent || 100;
    if (weightValue < 0 || weightValue > 100) {
      return errorResponse("Gewichtung muss zwischen 0 und 100 liegen", 400);
    }

    // Validate grade_scale exists if provided
    if (body.grade_scale_id) {
      const { data: gradeScaleExists, error: gradeScaleError } = await db
        .from("grade_scales")
        .select("id")
        .eq("id", body.grade_scale_id)
        .single();

      if (gradeScaleError || !gradeScaleExists) {
        return errorResponse("Notenskala nicht gefunden", 404);
      }
    }

    // Get next sequence_order
    const { data: maxComponent } = await db
      .from("assessment_components")
      .select("sequence_order")
      .eq("module_id", id)
      .order("sequence_order", { ascending: false })
      .limit(1);

    const nextSequenceOrder =
      (maxComponent && maxComponent[0]?.sequence_order) || 0 + 1;

    const { data, error } = await db
      .from("assessment_components")
      .insert({
        module_id: id,
        name,
        component_type,
        weight_percent: weightValue,
        grade_scale_id: body.grade_scale_id || null,
        pass_policy_id: body.pass_policy_id || null,
        min_pass_required: body.min_pass_required || false,
        mandatory_to_pass: body.mandatory_to_pass || false,
        sequence_order: nextSequenceOrder,
      })
      .select()
      .single();

    if (error) {
      log.error("POST insert failed", { error });
      return errorResponse(error.message, 500);
    }

    await logBuilderAction(db, user.id, "create", "assessment_component", data.id, name);

    return NextResponse.json({ component: data }, { status: 201 });
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
