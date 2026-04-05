import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("api:modules");

/**
 * GET /api/academic/modules
 *
 * List modules with optional program filter.
 * Query params:
 *   - program_id: Filter by program
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");

    let query = supabase.from("modules").select("*");

    if (programId) {
      query = query.eq("program_id", programId);
    }

    const { data, error } = await query;

    if (error) {
      log.error("GET failed", { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ modules: data || [] });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academic/modules
 *
 * Create a new module.
 * Required fields: name, module_code
 * Optional fields: program_id, description, credit amount, etc.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { name, module_code, program_id, description } = body;

    // Validate required fields
    if (!name || !module_code) {
      return NextResponse.json(
        { error: "Name und Modulcode sind erforderlich" },
        { status: 400 }
      );
    }

    // Validate program exists if provided
    if (program_id) {
      const { data: programExists, error: programError } = await supabase
        .from("programs")
        .select("id")
        .eq("id", program_id)
        .single();

      if (programError || !programExists) {
        return NextResponse.json(
          { error: "Studiengang nicht gefunden" },
          { status: 404 }
        );
      }
    }

    // Check for duplicate module code within same program
    let duplicateQuery = supabase
      .from("modules")
      .select("id")
      .eq("module_code", module_code);

    if (program_id) {
      duplicateQuery = duplicateQuery.eq("program_id", program_id);
    }

    const { data: existingModule } = await duplicateQuery;

    if (existingModule && existingModule.length > 0) {
      return NextResponse.json(
        { error: "Ein Modul mit diesem Code existiert bereits" },
        { status: 422 }
      );
    }

    const { data, error } = await supabase
      .from("modules")
      .insert({
        name,
        module_code,
        program_id: program_id || null,
        description: description || null,
        ects: body.ects || null,
        ects_equivalent: body.ects_equivalent || body.ects || null,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      log.error("POST insert failed", { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ module: data }, { status: 201 });
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
