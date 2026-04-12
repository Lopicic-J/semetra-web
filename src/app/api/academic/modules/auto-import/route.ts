import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

const log = logger("api:modules:auto-import");

/**
 * POST /api/academic/modules/auto-import
 *
 * Server-side auto-import of template modules for a student.
 * Uses service client to read templates (bypasses RLS) and
 * user client to write personal copies (respects RLS).
 *
 * Body: { isPro: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const isPro = body.isPro === true;
    const FREE_MODULE_LIMIT = 20; // fallback if gates not available server-side

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_program_id, current_semester, study_mode, institution_modules_loaded")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.institution_modules_loaded) {
      return NextResponse.json({ message: "Already loaded", imported: 0 });
    }

    if (!profile.active_program_id) {
      return NextResponse.json({ error: "No active program" }, { status: 400 });
    }

    const currentProgram = profile.active_program_id;
    const db = createServiceClient(); // bypasses RLS for reading templates

    // Step 1: Remove stale institution modules not matching current program
    const { data: staleModules } = await supabase
      .from("modules")
      .select("id")
      .eq("user_id", user.id)
      .eq("source", "institution")
      .neq("program_id", currentProgram);

    if (staleModules && staleModules.length > 0) {
      await supabase
        .from("modules")
        .delete()
        .in("id", staleModules.map((m: { id: string }) => m.id));
    }

    // Clean up legacy institution modules with NULL program_id
    await supabase
      .from("modules")
      .delete()
      .eq("user_id", user.id)
      .eq("source", "institution")
      .is("program_id", null);

    // Step 2: Read templates via service client (bypasses RLS)
    const { data: templates, error: tplErr } = await db
      .from("modules")
      .select("*")
      .eq("program_id", currentProgram)
      .is("user_id", null);

    if (tplErr) {
      log.error("Failed to fetch templates", { error: tplErr });
      return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
    }

    let importedCount = 0;

    if (templates && templates.length > 0) {
      // Check which templates the student doesn't already have
      const { data: existing } = await supabase
        .from("modules")
        .select("module_code, code")
        .eq("user_id", user.id)
        .eq("program_id", currentProgram);

      const existingCodes = new Set(
        (existing ?? []).map((m: any) => m.module_code ?? m.code).filter(Boolean)
      );

      const newTemplates = templates.filter((t: any) => {
        const tCode = t.module_code ?? t.code;
        return !tCode || !existingCodes.has(tCode);
      });

      if (newTemplates.length > 0) {
        const toImport = isPro ? newTemplates : newTemplates.slice(0, FREE_MODULE_LIMIT);
        const studentStudyMode = profile.study_mode || "full_time";
        const studentSemester = profile.current_semester || 1;

        const rows = toImport.map((t: any) => {
          const rawSemester = studentStudyMode === "part_time" && t.semester_part_time
            ? t.semester_part_time
            : t.semester;

          let semNum: number | null = null;
          if (rawSemester) {
            const num = parseInt(rawSemester.replace(/\D/g, ""), 10);
            if (!isNaN(num)) semNum = num;
          }

          const isCredited = semNum !== null && semNum < studentSemester;

          return {
            user_id: user.id,
            name: t.name,
            code: t.code,
            module_code: t.module_code,
            professor: t.professor,
            ects: t.ects,
            semester: rawSemester,
            semester_part_time: t.semester_part_time,
            module_type: t.module_type,
            color: t.color ?? "#6366f1",
            notes: t.notes,
            program_id: currentProgram,
            source: "institution" as const,
            status: isCredited ? "credited" : "planned",
            in_plan: true,
            language: t.language,
            delivery_mode: t.delivery_mode,
            description: t.description,
            ects_equivalent: t.ects_equivalent,
            is_compulsory: t.is_compulsory,
            term_type: t.term_type,
            default_term_number: t.default_term_number,
          };
        });

        // Insert via service client (user_id is set correctly)
        const { error: insertErr } = await db.from("modules").insert(rows);
        if (insertErr) {
          log.error("Failed to insert modules", { error: insertErr });
          return NextResponse.json({ error: "Failed to import modules" }, { status: 500 });
        }
        importedCount = rows.length;
      }
    }

    // Step 3: Mark as loaded
    await supabase
      .from("profiles")
      .update({ institution_modules_loaded: true })
      .eq("id", user.id);

    log.info("Auto-import complete", { userId: user.id, program: currentProgram, imported: importedCount });
    return NextResponse.json({ message: "OK", imported: importedCount });
  } catch (err) {
    log.error("Auto-import failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
