import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/academic/programs/[id]/requirement-groups
 *
 * List requirement groups for a program.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify program exists
    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id")
      .eq("id", id)
      .single();

    if (programError || !program) {
      return NextResponse.json(
        { error: "Studiengang nicht gefunden" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("program_requirement_groups")
      .select("*")
      .eq("program_id", id)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[academic/programs/[id]/requirement-groups GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requirementGroups: data || [] });
  } catch (err: unknown) {
    console.error("[academic/programs/[id]/requirement-groups GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academic/programs/[id]/requirement-groups
 *
 * Create a new requirement group for a program.
 * Required fields: name, group_type
 * Optional fields: min_credits_required, min_modules_required, etc.
 */
export async function POST(
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

    // Verify program exists
    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id")
      .eq("id", id)
      .single();

    if (programError || !program) {
      return NextResponse.json(
        { error: "Studiengang nicht gefunden" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, group_type, min_credits_required, min_modules_required } = body;

    // Validate required fields
    if (!name || !group_type) {
      return NextResponse.json(
        { error: "Name und Gruppentyp sind erforderlich" },
        { status: 400 }
      );
    }

    // Validate group_type
    const validGroupTypes = [
      "compulsory",
      "elective_required",
      "elective_free",
      "specialisation",
      "minor",
      "thesis",
      "internship",
    ];
    if (!validGroupTypes.includes(group_type)) {
      return NextResponse.json(
        { error: "Ungültiger Gruppentyp" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("program_requirement_groups")
      .insert({
        program_id: id,
        name,
        group_type,
        min_credits_required: min_credits_required || null,
        min_modules_required: min_modules_required || null,
        rule_type: body.rule_type || "all_of",
      })
      .select()
      .single();

    if (error) {
      console.error("[academic/programs/[id]/requirement-groups POST]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requirementGroup: data }, { status: 201 });
  } catch (err: unknown) {
    console.error("[academic/programs/[id]/requirement-groups POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
