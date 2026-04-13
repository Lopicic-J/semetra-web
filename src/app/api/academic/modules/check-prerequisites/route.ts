import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/academic/modules/check-prerequisites
 *
 * Checks if a student can enroll in a module based on prerequisites.
 * Returns { eligible, errors, warnings, unmetPrerequisites[] }.
 *
 * Body: { module_id: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { module_id } = await req.json();
    if (!module_id) {
      return NextResponse.json({ error: "module_id ist erforderlich" }, { status: 400 });
    }

    // 1. Fetch module and its prerequisites
    const { data: mod } = await supabase
      .from("modules")
      .select("id, name, status, prerequisites_json")
      .eq("id", module_id)
      .eq("user_id", user.id)
      .single();

    if (!mod) {
      return NextResponse.json({ error: "Modul nicht gefunden" }, { status: 404 });
    }

    // Parse prerequisites from JSON field
    const prerequisites: Array<{
      moduleId: string;
      moduleName?: string;
      type: "required" | "recommended";
    }> = Array.isArray(mod.prerequisites_json) ? mod.prerequisites_json : [];

    // No prerequisites → always eligible
    if (prerequisites.length === 0) {
      return NextResponse.json({
        eligible: true,
        errors: [],
        warnings: [],
        unmetPrerequisites: [],
      });
    }

    // 2. Fetch all passed modules for this user (grade >= 4.0 CH or status = passed)
    const { data: grades } = await supabase
      .from("grades")
      .select("module_id, grade")
      .eq("user_id", user.id);

    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("module_id, status, current_final_grade")
      .eq("user_id", user.id);

    // Build set of passed module IDs
    const passedModules = new Set<string>();

    // From grades table: CH grading = pass at 4.0
    if (grades) {
      for (const g of grades) {
        if (g.module_id && g.grade >= 4.0) {
          passedModules.add(g.module_id);
        }
      }
    }
    // From enrollments: explicit passed status
    if (enrollments) {
      for (const e of enrollments) {
        if (e.module_id && (e.status === "passed" || (e.current_final_grade && e.current_final_grade >= 4.0))) {
          passedModules.add(e.module_id);
        }
      }
    }

    // 3. Check each prerequisite
    const errors: Array<{ code: string; message: string; moduleId: string; moduleName?: string }> = [];
    const warnings: Array<{ code: string; message: string; moduleId: string; moduleName?: string }> = [];
    const unmetPrerequisites: Array<{ moduleId: string; moduleName?: string; type: string }> = [];

    for (const prereq of prerequisites) {
      if (!passedModules.has(prereq.moduleId)) {
        unmetPrerequisites.push({
          moduleId: prereq.moduleId,
          moduleName: prereq.moduleName,
          type: prereq.type,
        });

        if (prereq.type === "required") {
          errors.push({
            code: "PREREQUISITE_NOT_MET",
            message: `Voraussetzung nicht erfüllt: ${prereq.moduleName || prereq.moduleId}`,
            moduleId: prereq.moduleId,
            moduleName: prereq.moduleName,
          });
        } else {
          warnings.push({
            code: "RECOMMENDED_NOT_MET",
            message: `Empfohlene Voraussetzung nicht erfüllt: ${prereq.moduleName || prereq.moduleId}`,
            moduleId: prereq.moduleId,
            moduleName: prereq.moduleName,
          });
        }
      }
    }

    const eligible = errors.length === 0;

    return NextResponse.json({
      eligible,
      errors,
      warnings,
      unmetPrerequisites,
      passedModuleCount: passedModules.size,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
