import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("api:programs");

/**
 * GET /api/academic/programs/[id]
 *
 * Get program with requirement groups and modules.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch program
    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("*")
      .eq("id", id)
      .single();

    if (programError) {
      if (programError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Studiengang nicht gefunden" },
          { status: 404 }
        );
      }
      log.error("GET fetch failed", { error: programError });
      return NextResponse.json({ error: programError.message }, { status: 500 });
    }

    // Fetch requirement groups
    const { data: requirementGroups, error: groupsError } = await supabase
      .from("program_requirement_groups")
      .select("*")
      .eq("program_id", id);

    if (groupsError) {
      log.error("GET groups fetch failed", { error: groupsError });
      return NextResponse.json({ error: groupsError.message }, { status: 500 });
    }

    // Fetch modules
    const { data: modules, error: modulesError } = await supabase
      .from("modules")
      .select("*")
      .eq("program_id", id);

    if (modulesError) {
      log.error("GET modules fetch failed", { error: modulesError });
      return NextResponse.json({ error: modulesError.message }, { status: 500 });
    }

    return NextResponse.json({
      program,
      requirementGroups: requirementGroups || [],
      modules: modules || [],
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
 * PATCH /api/academic/programs/[id]
 *
 * Update program fields.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();

    // Validate that program exists
    const { data: existing, error: existingError } = await supabase
      .from("programs")
      .select("id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Studiengang nicht gefunden" },
        { status: 404 }
      );
    }

    // Validate degree_level if provided
    if (body.degree_level) {
      const validDegreeLevels = ["short_cycle", "bachelor", "master", "phd", "diploma"];
      if (!validDegreeLevels.includes(body.degree_level)) {
        return NextResponse.json(
          { error: "Ungültiger Studienabschluss" },
          { status: 400 }
        );
      }
    }

    // Validate institution exists if provided
    if (body.institution_id) {
      const { data: institutionExists, error: institutionError } = await supabase
        .from("institutions")
        .select("id")
        .eq("id", body.institution_id)
        .single();

      if (institutionError || !institutionExists) {
        return NextResponse.json(
          { error: "Institution nicht gefunden" },
          { status: 404 }
        );
      }
    }

    const { data, error } = await supabase
      .from("programs")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      log.error("PATCH update failed", { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ program: data });
  } catch (err: unknown) {
    log.error("PATCH failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
