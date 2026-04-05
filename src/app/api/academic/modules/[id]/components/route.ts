import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("api:module-components");

/**
 * GET /api/academic/modules/[id]/components
 *
 * List assessment components for a module.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify module exists
    const { data: module, error: moduleError } = await supabase
      .from("modules")
      .select("id")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return NextResponse.json(
        { error: "Modul nicht gefunden" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("assessment_components")
      .select("*")
      .eq("module_id", id)
      .order("sequence_order", { ascending: true });

    if (error) {
      log.error("GET failed", { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ components: data || [] });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academic/modules/[id]/components
 *
 * Create a new assessment component for a module.
 * Required fields: name, component_type, weight_percent
 * Optional fields: grade_scale_id, pass_policy_id, etc.
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
      .select("id")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return NextResponse.json(
        { error: "Modul nicht gefunden" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, component_type, weight_percent } = body;

    // Validate required fields
    if (!name || !component_type) {
      return NextResponse.json(
        { error: "Name und Komponententyp sind erforderlich" },
        { status: 400 }
      );
    }

    // Validate component_type
    const validComponentTypes = [
      "written_exam",
      "oral_exam",
      "project",
      "lab",
      "homework",
      "presentation",
      "participation",
      "thesis",
      "pass_fail_requirement",
    ];
    if (!validComponentTypes.includes(component_type)) {
      return NextResponse.json(
        { error: "Ungültiger Komponententyp" },
        { status: 400 }
      );
    }

    // Validate weight_percent is between 0 and 100
    const weightValue = weight_percent || 100;
    if (weightValue < 0 || weightValue > 100) {
      return NextResponse.json(
        { error: "Gewichtung muss zwischen 0 und 100 liegen" },
        { status: 400 }
      );
    }

    // Validate grade_scale exists if provided
    if (body.grade_scale_id) {
      const { data: gradeScaleExists, error: gradeScaleError } = await supabase
        .from("grade_scales")
        .select("id")
        .eq("id", body.grade_scale_id)
        .single();

      if (gradeScaleError || !gradeScaleExists) {
        return NextResponse.json(
          { error: "Notenskala nicht gefunden" },
          { status: 404 }
        );
      }
    }

    // Get next sequence_order
    const { data: maxComponent } = await supabase
      .from("assessment_components")
      .select("sequence_order")
      .eq("module_id", id)
      .order("sequence_order", { ascending: false })
      .limit(1);

    const nextSequenceOrder =
      (maxComponent && maxComponent[0]?.sequence_order) || 0 + 1;

    const { data, error } = await supabase
      .from("assessment_components")
      .insert({
        module_id: id,
        name,
        component_type,
        weight_percent: weightValue,
        grade_scale_id: body.grade_scale_id || null,
        pass_policy_id: body.pass_policy_id || null,
        min_pass_required: body.min_pass_required || false,
        mandatory_to_pass: body.mandatory_to_pass || false,
        sequence_order: nextSequenceOrder,
      })
      .select()
      .single();

    if (error) {
      log.error("POST insert failed", { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ component: data }, { status: 201 });
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
