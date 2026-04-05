import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

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
    const supabase = await createClient();

    // Fetch module
    const { data: module, error: moduleError } = await supabase
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
    const { data: components, error: componentsError } = await supabase
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

    // Validate that module exists
    const { data: existing, error: existingError } = await supabase
      .from("modules")
      .select("id, module_code, program_id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Modul nicht gefunden" },
        { status: 404 }
      );
    }

    // If module_code is being updated, check for duplicates
    if (body.module_code && body.module_code !== existing.module_code) {
      let duplicateQuery = supabase
        .from("modules")
        .select("id")
        .eq("module_code", body.module_code)
        .neq("id", id);

      if (existing.program_id) {
        duplicateQuery = duplicateQuery.eq("program_id", existing.program_id);
      }

      const { data: duplicates } = await duplicateQuery;

      if (duplicates && duplicates.length > 0) {
        return NextResponse.json(
          { error: "Ein Modul mit diesem Code existiert bereits" },
          { status: 422 }
        );
      }
    }

    // Validate program exists if provided
    if (body.program_id) {
      const { data: programExists, error: programError } = await supabase
        .from("programs")
        .select("id")
        .eq("id", body.program_id)
        .single();

      if (programError || !programExists) {
        return NextResponse.json(
          { error: "Studiengang nicht gefunden" },
          { status: 404 }
        );
      }
    }

    const { data, error } = await supabase
      .from("modules")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      log.error("PATCH update failed", { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ module: data });
  } catch (err: unknown) {
    log.error("PATCH failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
