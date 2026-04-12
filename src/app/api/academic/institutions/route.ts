import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  requireRole,
  logBuilderAction,
  errorResponse,
  isErrorResponse,
  createServiceClient,
} from "@/lib/api-helpers";

const log = logger("api:institutions");

/**
 * GET /api/academic/institutions
 *
 * List institutions with optional country filter.
 * Accessible to ALL authenticated users (students need to browse for enrollment).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const country = searchParams.get("country");

    // Fetch institutions with program count via left join
    let query = supabase
      .from("institutions")
      .select("*, programs(id)");

    if (country) {
      query = query.eq("country_code", country);
    }

    const { data, error } = await query;

    if (error) {
      log.error("GET failed", { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform: add program_count and remove nested programs array
    const institutions = (data || []).map((inst: any) => {
      const { programs, ...rest } = inst;
      return {
        ...rest,
        program_count: Array.isArray(programs) ? programs.length : 0,
      };
    });

    return NextResponse.json({ institutions });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}

/**
 * POST /api/academic/institutions
 *
 * Create a new institution. Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const rc = await requireRole(["admin"]);
    if (isErrorResponse(rc)) return rc;
    const { user } = rc;
    const db = rc.adminClient ?? createServiceClient();

    const body = await req.json();
    const { name, country_code, institution_type, official_language } = body;

    if (!name || !country_code) {
      return errorResponse("Name und Ländercode sind erforderlich", 400);
    }

    // Validate country code
    const { data: countryExists, error: countryError } = await db
      .from("country_systems")
      .select("country_code")
      .eq("country_code", country_code)
      .single();

    if (countryError || !countryExists) {
      return errorResponse("Ungültiger Ländercode", 400);
    }

    const { data, error } = await db
      .from("institutions")
      .insert({
        name,
        country_code,
        institution_type: institution_type || "university",
        official_language: official_language || null,
        website: body.website || null,
        academic_year_start_month: body.academic_year_start_month || 9,
      })
      .select()
      .single();

    if (error) {
      log.error("POST insert failed", { error });
      return errorResponse(error.message, 500);
    }

    await logBuilderAction(db, user.id, "create", "institution", data.id, name);

    return NextResponse.json({ institution: data }, { status: 201 });
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}
