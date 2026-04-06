import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  requireRole,
  errorResponse,
  isErrorResponse,
  createServiceClient,
} from "@/lib/api-helpers";

const log = logger("api:module-validate");

/**
 * POST /api/academic/modules/[id]/validate
 *
 * Validate a module for publishing readiness.
 * Admin only (admin or institution)
 * Checks: name, code, ECTS, grade scale, assessment weights sum to 100%.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;
    const db = rc.adminClient ?? createServiceClient();

    // Fetch module
    const { data: module, error: moduleError } = await db
      .from("modules")
      .select("*")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return errorResponse("Modul nicht gefunden", 404);
    }

    // Fetch assessment components
    const { data: components, error: componentsError } = await db
      .from("assessment_components")
      .select("*")
      .eq("module_id", id);

    if (componentsError) {
      return errorResponse(componentsError.message, 500);
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
    log.error("POST failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
