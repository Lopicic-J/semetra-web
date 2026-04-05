import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("api:programs");

/**
 * GET /api/academic/programs
 *
 * List programs with optional institution filter.
 * Query params:
 *   - institution_id: Filter by institution
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ programs: data || [] });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academic/programs
 *
 * Create a new program.
 * Required fields: name, degree_level
 * Optional fields: institution_id, faculty_id, required_total_credits, etc.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { name, degree_level, institution_id, faculty_id } = body;

    // Validate required fields
    if (!name || !degree_level) {
      return NextResponse.json(
        { error: "Name und Studienabschluss sind erforderlich" },
        { status: 400 }
      );
    }

    // Validate degree_level
    const validDegreeLevels = ["short_cycle", "bachelor", "master", "phd", "diploma"];
    if (!validDegreeLevels.includes(degree_level)) {
      return NextResponse.json(
        { error: "Ungültiger Studienabschluss" },
        { status: 400 }
      );
    }

    // Validate institution exists if provided
    if (institution_id) {
      const { data: institutionExists, error: institutionError } = await supabase
        .from("institutions")
        .select("id")
        .eq("id", institution_id)
        .single();

      if (institutionError || !institutionExists) {
        return NextResponse.json(
          { error: "Institution nicht gefunden" },
          { status: 404 }
        );
      }
    }

    // Validate faculty exists if provided
    if (faculty_id) {
      const { data: facultyExists, error: facultyError } = await supabase
        .from("faculties")
        .select("id")
        .eq("id", faculty_id)
        .single();

      if (facultyError || !facultyExists) {
        return NextResponse.json(
          { error: "Fakultät nicht gefunden" },
          { status: 404 }
        );
      }
    }

    const { data, error } = await supabase
      .from("programs")
      .insert({
        name,
        degree_level,
        institution_id: institution_id || null,
        faculty_id: faculty_id || null,
        required_total_credits: body.required_total_credits || 180,
      })
      .select()
      .single();

    if (error) {
      log.error("POST insert failed", { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ program: data }, { status: 201 });
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
