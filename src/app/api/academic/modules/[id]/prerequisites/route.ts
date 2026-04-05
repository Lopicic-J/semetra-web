import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/academic/modules/[id]/prerequisites
 *
 * List prerequisites for a module.
 * Prerequisites are stored as JSON in the modules.prerequisites_json field.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch module with prerequisites
    const { data: module, error: moduleError } = await supabase
      .from("modules")
      .select("id, name, prerequisites_json")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return NextResponse.json(
        { error: "Modul nicht gefunden" },
        { status: 404 }
      );
    }

    // Parse prerequisites_json (default to empty array)
    const prerequisites = module.prerequisites_json || [];

    return NextResponse.json({
      module: {
        id: module.id,
        name: module.name,
      },
      prerequisites,
    });
  } catch (err: unknown) {
    console.error("[academic/modules/[id]/prerequisites GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academic/modules/[id]/prerequisites
 *
 * Add a prerequisite to a module.
 * Body:
 *   - prerequisite_module_id: uuid of the prerequisite module
 *   - requirement_type: 'must_pass' | 'min_grade' (optional, default 'must_pass')
 *   - min_grade_value: numeric (optional, only if requirement_type is 'min_grade')
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

    // Verify module exists
    const { data: module, error: moduleError } = await supabase
      .from("modules")
      .select("id, prerequisites_json")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return NextResponse.json(
        { error: "Modul nicht gefunden" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { prerequisite_module_id, requirement_type, min_grade_value } = body;

    // Validate required fields
    if (!prerequisite_module_id) {
      return NextResponse.json(
        { error: "Voraussetzungsmodul-ID ist erforderlich" },
        { status: 400 }
      );
    }

    // Verify prerequisite module exists
    const { data: prerequisiteModule, error: prerequisiteError } = await supabase
      .from("modules")
      .select("id")
      .eq("id", prerequisite_module_id)
      .single();

    if (prerequisiteError || !prerequisiteModule) {
      return NextResponse.json(
        { error: "Voraussetzungsmodul nicht gefunden" },
        { status: 404 }
      );
    }

    // Don't allow circular prerequisites
    if (prerequisite_module_id === id) {
      return NextResponse.json(
        { error: "Ein Modul kann nicht seine eigene Voraussetzung sein" },
        { status: 400 }
      );
    }

    // Validate requirement_type if provided
    const validRequirementTypes = ["must_pass", "min_grade"];
    const reqType = requirement_type || "must_pass";
    if (!validRequirementTypes.includes(reqType)) {
      return NextResponse.json(
        { error: "Ungültiger Anforderungstyp" },
        { status: 400 }
      );
    }

    // Build new prerequisite object
    const newPrerequisite = {
      module_id: prerequisite_module_id,
      requirement_type: reqType,
      min_grade_value: reqType === "min_grade" ? min_grade_value : null,
      added_at: new Date().toISOString(),
    };

    // Get current prerequisites
    let prerequisites = module.prerequisites_json || [];
    if (!Array.isArray(prerequisites)) {
      prerequisites = [];
    }

    // Check if prerequisite already exists
    const exists = prerequisites.some(
      (p: any) => p.module_id === prerequisite_module_id
    );
    if (exists) {
      return NextResponse.json(
        { error: "Diese Voraussetzung existiert bereits" },
        { status: 422 }
      );
    }

    // Add new prerequisite
    prerequisites.push(newPrerequisite);

    // Update module
    const { data: updated, error: updateError } = await supabase
      .from("modules")
      .update({ prerequisites_json: prerequisites })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[academic/modules/[id]/prerequisites POST]", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      module: updated,
      prerequisite: newPrerequisite,
      prerequisites: updated.prerequisites_json,
    }, { status: 201 });
  } catch (err: unknown) {
    console.error("[academic/modules/[id]/prerequisites POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
