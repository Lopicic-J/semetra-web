import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/academic/institutions
 *
 * List institutions with optional country filter.
 * Query params:
 *   - country: ISO country code (optional, e.g., 'CH', 'DE')
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const country = searchParams.get("country");

    let query = supabase.from("institutions").select("*");

    if (country) {
      query = query.eq("country_code", country);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[academic/institutions GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ institutions: data || [] });
  } catch (err: unknown) {
    console.error("[academic/institutions GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academic/institutions
 *
 * Create a new institution.
 * Required fields: name, country_code
 * Optional fields: institution_type, official_language, academic_year_start_month, etc.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { name, country_code, institution_type, official_language } = body;

    // Validate required fields
    if (!name || !country_code) {
      return NextResponse.json(
        { error: "Name und Ländercode sind erforderlich" },
        { status: 400 }
      );
    }

    // Validate country code exists
    const { data: countryExists, error: countryError } = await supabase
      .from("country_systems")
      .select("country_code")
      .eq("country_code", country_code)
      .single();

    if (countryError || !countryExists) {
      return NextResponse.json(
        { error: "Ungültiger Ländercode" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("institutions")
      .insert({
        name,
        country_code,
        institution_type: institution_type || "university",
        official_language: official_language || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[academic/institutions POST]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ institution: data }, { status: 201 });
  } catch (err: unknown) {
    console.error("[academic/institutions POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
