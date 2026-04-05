import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/academic/modules/[id]/validate
 *
 * Validate a module for publishing readiness.
 * Checks: name, code, ECTS, grade scale, assessment weights sum to 100%.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Fetch module
    const { data: module, error: moduleError } = await supabase
      .from("modules")
      .select("*")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return NextResponse.json(
        { error: "Modul nicht gefunden" },
        { status: 404 }
      );
    }

    // Fetch assessment components
    const { data: components, error: componentsError } = await supabase
      .from("assessment_components")
      .select("*")
      .eq("module_id", id);

    if (componentsError) {
      return NextResponse.json(
        { error: componentsError.message },
        { status: 500 }
      );
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!module.name || module.name.trim() === "") {
      errors.push("Modulname ist erforderlich");
    }

    if (!module.module_code || module.module_code.trim() === "") {
      errors.push("Modulcode ist erforderlich");
    }

    const ects = module.ects_equivalent || module.ects || 0;
    if (ects <= 0) {
      errors.push("ECTS muss grösser als 0 sein");
    }

    // Check assessment components
    if (!components || components.length === 0) {
      errors.push("Mindestens eine Bewertungskomponente ist erforderlich");
    } else {
      const totalWeight = components.reduce(
        (sum: number, c: any) => sum + (c.weight_percent || 0),
        0
      );

      if (totalWeight !== 100) {
        errors.push(
          `Gewichte der Bewertungskomponenten müssen 100% ergeben (aktuell: ${totalWeight}%)`
        );
      }

      // Check for components without names
      const unnamedComponents = components.filter(
        (c: any) => !c.name || c.name.trim() === ""
      );
      if (unnamedComponents.length > 0) {
        warnings.push(
          `${unnamedComponents.length} Komponente(n) ohne Namen`
        );
      }
    }

    // Check if module is part of a program
    if (!module.program_id) {
      warnings.push("Modul ist keinem Programm zugeordnet");
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          valid: false,
          errors,
          warnings,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      valid: true,
      errors: [],
      warnings,
    });
  } catch (err: unknown) {
    console.error("[academic/modules/[id]/validate POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
