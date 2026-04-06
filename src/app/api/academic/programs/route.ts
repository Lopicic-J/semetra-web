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
 * GET /api/academic/programs
 *
 * List programs with optional institution filter.
 * Accessible to all authenticated users.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const institutionId = searchParams.get("institution_id");

    let query = supabase.from("programs").select("*");

    if (institutionId) {
      query = query.eq("institution_id", institutionId);
    }

    const { data, error } = await query;

    if (error) {
      log.error("GET failed", { error });
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({ programs: data || [] });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}

/**
 * POST /api/academic/programs
 *
 * Create a new program.
 * Requires: admin or institution (for their own institution).
 */
export async function POST(req: NextRequest) {
  try {
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;
    const { supabase, user, userRole } = rc;
    const db = rc.adminClient ?? createServiceClient();

    const body = await req.json();
    const { name, degree_level, institution_id, faculty_id } = body;

    if (!name || !degree_level) {
      return errorResponse("Name und Studienabschluss sind erforderlich", 400);
    }

    const validDegreeLevels = [
      "short_cycle", "bachelor", "master", "phd", "diploma",
    ];
    if (!validDegreeLevels.includes(degree_level)) {
      return errorResponse("Ungültiger Studienabschluss", 400);
    }

    // Check institution permission
    if (institution_id) {
      if (!(await canManageInstitution(db, user.id, institution_id, userRole))) {
        return errorResponse("Keine Berechtigung für diese Institution", 403);
      }

      const { data: inst } = await db
        .from("institutions")
        .select("id")
        .eq("id", institution_id)
        .single();

      if (!inst) {
        return errorResponse("Institution nicht gefunden", 404);
      }
    }

    if (faculty_id) {
      const { data: fac } = await db
        .from("faculties")
        .select("id")
        .eq("id", faculty_id)
        .single();

      if (!fac) {
        return errorResponse("Fakultät nicht gefunden", 404);
      }
    }

    const { data, error } = await db
      .from("programs")
      .insert({
        name,
        degree_level,
        institution_id: institution_id || null,
        faculty_id: faculty_id || null,
        required_total_credits: body.required_total_credits || 180,
        duration_standard_terms: body.duration_standard_terms || null,
        thesis_required: body.thesis_required ?? false,
        internship_required: body.internship_required ?? false,
        final_exam_required: body.final_exam_required ?? false,
      })
      .select()
      .single();

    if (error) {
      log.error("POST insert failed", { error });
      return errorResponse(error.message, 500);
    }

    await logBuilderAction(db, user.id, "create", "program", data.id, name);

    // Auto-create default requirement groups for the new program
    const defaultGroups = getDefaultRequirementGroups(degree_level);
    if (defaultGroups.length > 0) {
      const groupInserts = defaultGroups.map((g, i) => ({
        program_id: data.id,
        name: g.name,
        group_type: g.group_type,
        rule_type: g.rule_type,
        min_credits_required: g.min_credits || null,
        sort_order: i,
      }));
      const { error: groupErr } = await db
        .from("program_requirement_groups")
        .insert(groupInserts);
      if (groupErr) {
        log.warn("Failed to create default requirement groups", { error: groupErr });
        // Non-fatal: program was already created
      }
    }

    return NextResponse.json({ program: data }, { status: 201 });
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}

/**
 * Default requirement group templates by degree level.
 * Auto-created when a new program is created.
 */
interface GroupTemplate {
  name: string;
  group_type: string;
  rule_type: string;
  min_credits?: number;
}

function getDefaultRequirementGroups(degreeLevel: string): GroupTemplate[] {
  const common: GroupTemplate[] = [
    {
      name: "Pflichtmodule",
      group_type: "compulsory",
      rule_type: "all_of",
    },
    {
      name: "Wahlpflichtmodule",
      group_type: "elective_required",
      rule_type: "choose_credits",
    },
    {
      name: "Wahlmodule",
      group_type: "elective_free",
      rule_type: "choose_credits",
    },
  ];

  switch (degreeLevel) {
    case "bachelor":
      return [
        ...common,
        {
          name: "Vertiefung / Schwerpunkt",
          group_type: "specialisation",
          rule_type: "choose_credits",
          min_credits: 30,
        },
        {
          name: "Bachelor-Thesis",
          group_type: "thesis",
          rule_type: "all_of",
          min_credits: 12,
        },
        {
          name: "Praktikum / Praxisprojekt",
          group_type: "internship",
          rule_type: "all_of",
        },
      ];

    case "master":
      return [
        ...common,
        {
          name: "Vertiefung / Schwerpunkt",
          group_type: "specialisation",
          rule_type: "choose_credits",
          min_credits: 30,
        },
        {
          name: "Master-Thesis",
          group_type: "thesis",
          rule_type: "all_of",
          min_credits: 30,
        },
      ];

    case "phd":
      return [
        {
          name: "Pflichtmodule",
          group_type: "compulsory",
          rule_type: "all_of",
        },
        {
          name: "Forschungsmodule",
          group_type: "elective_required",
          rule_type: "choose_credits",
        },
        {
          name: "Dissertation",
          group_type: "thesis",
          rule_type: "all_of",
        },
      ];

    case "diploma":
      return [
        ...common,
        {
          name: "Diplomarbeit",
          group_type: "thesis",
          rule_type: "all_of",
          min_credits: 15,
        },
      ];

    case "short_cycle":
      return [
        {
          name: "Pflichtmodule",
          group_type: "compulsory",
          rule_type: "all_of",
        },
        {
          name: "Wahlmodule",
          group_type: "elective_free",
          rule_type: "choose_credits",
        },
      ];

    default:
      return common;
  }
}
