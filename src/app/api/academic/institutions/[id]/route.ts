import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/academic/institutions/[id]
 *
 * Get institution by ID with faculties and programs.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch institution
    const { data: institution, error: institutionError } = await supabase
      .from("institutions")
      .select("*")
      .eq("id", id)
      .single();

    if (institutionError) {
      if (institutionError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Institution nicht gefunden" },
          { status: 404 }
        );
      }
      console.error("[academic/institutions/[id] GET]", institutionError);
      return NextResponse.json({ error: institutionError.message }, { status: 500 });
    }

    // Fetch faculties
    const { data: faculties, error: facultiesError } = await supabase
      .from("faculties")
      .select("*")
      .eq("institution_id", id);

    if (facultiesError) {
      console.error("[academic/institutions/[id] GET faculties]", facultiesError);
      return NextResponse.json({ error: facultiesError.message }, { status: 500 });
    }

    // Fetch programs
    const { data: programs, error: programsError } = await supabase
      .from("programs")
      .select("*")
      .eq("institution_id", id);

    if (programsError) {
      console.error("[academic/institutions/[id] GET programs]", programsError);
      return NextResponse.json({ error: programsError.message }, { status: 500 });
    }

    return NextResponse.json({
      institution,
      faculties: faculties || [],
      programs: programs || [],
    });
  } catch (err: unknown) {
    console.error("[academic/institutions/[id] GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/academic/institutions/[id]
 *
 * Update institution fields.
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

    // Validate that institution exists
    const { data: existing, error: existingError } = await supabase
      .from("institutions")
      .select("id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Institution nicht gefunden" },
        { status: 404 }
      );
    }

    // If country_code is being updated, validate it exists
    if (body.country_code) {
      const { data: countryExists, error: countryError } = await supabase
        .from("country_systems")
        .select("country_code")
        .eq("country_code", body.country_code)
        .single();

      if (countryError || !countryExists) {
        return NextResponse.json(
          { error: "Ungültiger Ländercode" },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from("institutions")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[academic/institutions/[id] PATCH]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ institution: data });
  } catch (err: unknown) {
    console.error("[academic/institutions/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/academic/institutions/[id]
 *
 * Delete institution (cascades to faculties, programs, modules, etc.).
 */
export async function DELETE(
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

    // Verify institution exists
    const { data: existing, error: existingError } = await supabase
      .from("institutions")
      .select("id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Institution nicht gefunden" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("institutions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[academic/institutions/[id] DELETE]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    console.error("[academic/institutions/[id] DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
