import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  requireRole,
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
 * GET /api/academic/modules
 *
 * List modules with optional program filter.
 * Accessible to ALL authenticated users.
 * Query params:
 *   - program_id: Filter by program
 */
export async function GET(req: NextRequest) {
  try {
    const db = createServiceClient();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");

    let query = db.from("modules").select("*");

    if (programId) {
      query = query.eq("program_id", programId);
    }

    const { data, error } = await query;

    if (error) {
      log.error("GET failed", { error });
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({ modules: data || [] });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}

/**
 * POST /api/academic/modules
 *
 * Create a new module.
 * - platform_admin and institution_admin can create template modules with program_id
 * - Students can create personal modules (user_id = authenticated user)
 * Required fields: name, module_code
 * Optional fields: program_id, description, credit amount, etc.
 */
export async function POST(req: NextRequest) {
  try {
    // Get auth context (allows all authenticated users)
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase, user } = auth;
    const db = createServiceClient();

    // Check user's builder role
    const { data: profile } = await db
      .from("profiles")
      .select("user_role")
      .eq("id", user.id)
      .single();

    const userRole =(profile?.user_role as UserRole) ?? "non_student";

    const body = await req.json();
    const { name, module_code, program_id, description } = body;

    // Validate required fields
    if (!name || !module_code) {
      return errorResponse("Name und Modulcode sind erforderlich", 400);
    }

    // Check permissions for program modules
    if (program_id) {
      // Only admins can create program modules
      if (!["admin", "institution"].includes(userRole)) {
        return errorResponse("Keine Berechtigung zum Erstellen von Programmmodulen", 403);
      }

      const { data: program, error: programError } = await db
        .from("programs")
        .select("id, institution_id")
        .eq("id", program_id)
        .single();

      if (programError || !program) {
        return errorResponse("Studiengang nicht gefunden", 404);
      }

      // Institution admins can only create for their institution
      if (userRole === "institution") {
        if (!(await canManageInstitution(db, user.id, program.institution_id, userRole))) {
          return errorResponse("Keine Berechtigung für diese Institution", 403);
        }
      }
    }

    // Template modules (with program_id, created by admins) have user_id = NULL
    // so the auto-import trigger and student distribution can find them.
    // Personal modules (no program_id or created by students) have user_id = creator.
    const isTemplate = !!program_id && ["admin", "institution"].includes(userRole);

    // Check for duplicate module code
    if (isTemplate) {
      // Template: unique per program (user_id IS NULL)
      const { data: existingTemplate } = await db
        .from("modules")
        .select("id")
        .eq("module_code", module_code)
        .eq("program_id", program_id)
        .is("user_id", null);
      if (existingTemplate && existingTemplate.length > 0) {
        return errorResponse(
          `Ein Template-Modul mit dem Code "${module_code}" existiert bereits für diesen Studiengang.`,
          422
        );
      }
    } else {
      // Personal: unique per user
      const { data: existingModule } = await db
        .from("modules")
        .select("id")
        .eq("module_code", module_code)
        .eq("user_id", user.id);
      if (existingModule && existingModule.length > 0) {
        return errorResponse(
          `Ein Modul mit dem Code "${module_code}" existiert bereits. Bitte verwende einen anderen Code.`,
          422
        );
      }
    }

    // Build insert payload — core fields always, optional fields only if truthy
    const insertData: Record<string, unknown> = {
      name,
      module_code,
      code: module_code,
      program_id: program_id || null,
      description: description || null,
      ects: body.ects || null,
      ects_equivalent: body.ects_equivalent || body.ects || null,
      user_id: isTemplate ? null : user.id,
      source: isTemplate ? "institution" : "manual",
      status: "planned",
      in_plan: true,
      color: body.color || "#6366f1",
    };

    // Optional fields — only include if provided (avoids errors if column doesn't exist yet)
    const optionalFields: Record<string, unknown> = {
      learning_objectives: body.learning_objectives,
      module_contents: body.module_contents,
      remarks: body.remarks,
      professor: body.professor,
      language: body.language,
      delivery_mode: body.delivery_mode,
      semester: body.semester,
      term_type: body.term_type,
      day: body.day,
      time_start: body.time_start,
      time_end: body.time_end,
      room: body.room,
      grade_scale_id: body.grade_scale_id,
      pass_policy_id: body.pass_policy_id,
      retake_policy_id: body.retake_policy_id,
      rounding_policy_id: body.rounding_policy_id,
      module_type: body.module_type,
      requirement_group_id: body.requirement_group_id,
      max_retakes: body.max_retakes,
    };
    for (const [key, val] of Object.entries(optionalFields)) {
      if (val !== undefined && val !== null && val !== "") {
        insertData[key] = val;
      }
    }
    // Boolean fields — always include
    if (body.is_compulsory !== undefined) insertData.is_compulsory = body.is_compulsory;
    if (body.attendance_required !== undefined) insertData.attendance_required = body.attendance_required;
    if (body.is_repeatable !== undefined) insertData.is_repeatable = body.is_repeatable;

    const { data, error } = await db
      .from("modules")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      log.error("POST insert failed", { error });
      if (error.code === "23505") {
        return errorResponse(
          `Ein Modul mit dem Code "${module_code}" existiert bereits. Bitte verwende einen anderen Code.`,
          422
        );
      }
      return errorResponse(error.message, 500);
    }

    await logBuilderAction(db, user.id, "create", "module", data.id, name);

    return NextResponse.json({ module: data }, { status: 201 });
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
