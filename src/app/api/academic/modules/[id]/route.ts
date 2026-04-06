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

const log = logger("api:modules");

/**
 * GET /api/academic/modules/[id]
 *
 * Get module with assessment components and prerequisites.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = createServiceClient();

    // Fetch module
    const { data: module, error: moduleError } = await db
      .from("modules")
      .select("*")
      .eq("id", id)
      .single();

    if (moduleError) {
      if (moduleError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Modul nicht gefunden" },
          { status: 404 }
        );
      }
      log.error("GET fetch failed", { error: moduleError });
      return NextResponse.json({ error: moduleError.message }, { status: 500 });
    }

    // Fetch assessment components
    const { data: components, error: componentsError } = await db
      .from("assessment_components")
      .select("*")
      .eq("module_id", id)
      .order("sequence_order", { ascending: true });

    if (componentsError) {
      log.error("GET components fetch failed", { error: componentsError });
      return NextResponse.json({ error: componentsError.message }, { status: 500 });
    }

    return NextResponse.json({
      module,
      components: components || [],
    });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/academic/modules/[id]
 *
 * Update module fields.
 * - Owner (user_id) can always update their own module
 * - Institution admins can update modules in their institution
 * - Platform admins can update any module
 */
export async function PATCH(
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

    const userRole =(profile?.user_role as UserRole) ?? "non_student";

    const rawBody = await req.json();

    // Only allow known module columns through (prevent Supabase errors from invalid fields)
    const ALLOWED_FIELDS = new Set([
      "name", "code", "module_code", "professor", "ects", "semester",
      "day", "time_start", "time_end", "room", "color", "notes",
      "module_type", "program_id", "requirement_group_id",
      "credit_scheme_id", "grade_scale_id", "pass_policy_id",
      "retake_policy_id", "rounding_policy_id",
      "term_type", "default_term_number", "is_compulsory",
      "is_repeatable", "max_retakes", "attendance_required", "language",
      "delivery_mode", "description", "learning_objectives",
      "module_contents", "remarks", "ects_equivalent",
      "prerequisites_json", "status", "in_plan",
      "link", "exam_date", "weighting", "github_link",
      "sharepoint_link", "literature_links", "notes_link",
      "target_grade", "source",
    ]);

    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawBody)) {
      if (ALLOWED_FIELDS.has(key)) {
        body[key] = value;
      }
    }

    if (Object.keys(body).length === 0) {
      return errorResponse("Keine gültigen Felder zum Aktualisieren", 400);
    }

    // Validate that module exists
    const { data: existing, error: existingError } = await db
      .from("modules")
      .select("id, module_code, program_id, user_id, source")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return errorResponse("Modul nicht gefunden", 404);
    }

    // Check if this is a student's imported copy of an institution module
    // Students cannot edit institution modules (read-only)
    if (existing.source === "institution" && existing.user_id !== null) {
      const isAdminRole = ["admin", "institution"].includes(userRole);
      if (!isAdminRole) {
        return errorResponse("Institutions-Module können nicht bearbeitet werden", 403);
      }
    }

    // Check permissions
    const isOwner = existing.user_id === user.id;
    const isAdmin = ["admin", "institution"].includes(userRole);

    if (!isOwner && isAdmin) {
      // For institution admins, check if they can manage the institution of the program
      if (userRole === "institution" && existing.program_id) {
        const { data: program } = await db
          .from("programs")
          .select("institution_id")
          .eq("id", existing.program_id)
          .single();

        if (program && !(await canManageInstitution(db, user.id, program.institution_id, userRole))) {
          return errorResponse("Keine Berechtigung zur Bearbeitung dieses Moduls", 403);
        }
      }
    } else if (!isOwner && !isAdmin) {
      return errorResponse("Keine Berechtigung zur Bearbeitung dieses Moduls", 403);
    }

    // If module_code is being updated, check for duplicates
    if (body.module_code && body.module_code !== existing.module_code) {
      let duplicateQuery = db
        .from("modules")
        .select("id")
        .eq("module_code", body.module_code)
        .neq("id", id);

      if (existing.program_id) {
        duplicateQuery = duplicateQuery.eq("program_id", existing.program_id);
      }

      const { data: duplicates } = await duplicateQuery;

      if (duplicates && duplicates.length > 0) {
        return errorResponse("Ein Modul mit diesem Code existiert bereits", 422);
      }
    }

    // Validate program exists if provided
    if (body.program_id) {
      const { data: programExists, error: programError } = await db
        .from("programs")
        .select("id")
        .eq("id", body.program_id)
        .single();

      if (programError || !programExists) {
        return errorResponse("Studiengang nicht gefunden", 404);
      }
    }

    const { data, error } = await db
      .from("modules")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      log.error("PATCH update failed", { error });
      return errorResponse(error.message, 500);
    }

    await logBuilderAction(db, user.id, "update", "module", data.id, data.name);

    return NextResponse.json({ module: data });
  } catch (err: unknown) {
    log.error("PATCH failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}

/**
 * DELETE /api/academic/modules/[id]
 *
 * Delete a template module from the builder.
 * - Platform admins can delete any template module
 * - Institution admins can delete modules in their institution's programs
 * - Module owners can delete their own personal modules
 * - Students CANNOT delete template modules (user_id IS NULL)
 */
export async function DELETE(
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

    const userRole =(profile?.user_role as UserRole) ?? "non_student";

    // Fetch the module
    const { data: existing, error: existingError } = await db
      .from("modules")
      .select("id, name, user_id, program_id, source")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return errorResponse("Modul nicht gefunden", 404);
    }

    // Check if this is a student's imported copy of an institution module
    // Students cannot delete institution modules (read-only)
    if (existing.source === "institution" && existing.user_id !== null) {
      const isAdminRole = ["admin", "institution"].includes(userRole);
      if (!isAdminRole) {
        return errorResponse("Institutions-Module können nicht bearbeitet werden", 403);
      }
    }

    // Permission checks
    const isOwner = existing.user_id === user.id;
    const isTemplate = existing.user_id === null;

    // Students can only delete their own personal modules
    if (userRole === "student" || userRole === "non_student") {
      if (!isOwner) {
        return errorResponse("Keine Berechtigung zum Löschen dieses Moduls", 403);
      }
    }

    // Template modules can only be deleted by admins
    if (isTemplate) {
      if (!["admin", "institution"].includes(userRole)) {
        return errorResponse("Nur Admins können Template-Module löschen", 403);
      }

      // Institution admins: verify they manage the institution
      if (userRole === "institution" && existing.program_id) {
        const { data: program } = await db
          .from("programs")
          .select("institution_id")
          .eq("id", existing.program_id)
          .single();

        if (program && !(await canManageInstitution(db, user.id, program.institution_id, userRole))) {
          return errorResponse("Keine Berechtigung für diese Institution", 403);
        }
      }
    }

    // Delete the module
    const { error: deleteError } = await db
      .from("modules")
      .delete()
      .eq("id", id);

    if (deleteError) {
      log.error("DELETE failed", { error: deleteError });
      return errorResponse(deleteError.message, 500);
    }

    await logBuilderAction(db, user.id, "delete", "module", id, existing.name);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    log.error("DELETE failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
