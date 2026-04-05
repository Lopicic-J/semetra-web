import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("academic:report");

/**
 * GET /api/academic/semester-report?semester=<number>
 *
 * Generates a comprehensive semester report combining legacy + engine data:
 * - Module grades (from grades table)
 * - Enrollment statuses (from enrollments table)
 * - Component breakdowns (from attempts + component_results)
 * - ECTS earned, GPA, pass/fail counts
 * - Transfer credits
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get("semester");

    // Get user profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "full_name, university, study_program, country, institution_id, active_program_id, current_semester"
      )
      .eq("id", user.id)
      .single();

    // Get modules for the specified semester (or all)
    let modulesQuery = supabase
      .from("modules")
      .select("id, name, code, ects, semester, color, status")
      .eq("user_id", user.id);

    if (semester) {
      // Match by semester string pattern
      modulesQuery = modulesQuery.or(
        `semester.eq.${semester},semester.ilike.%${semester}%`
      );
    }

    const { data: modules } = await modulesQuery.order("name");

    // Get grades for these modules
    const moduleIds = (modules || []).map((m) => m.id);
    let grades: Record<string, unknown>[] = [];
    if (moduleIds.length > 0) {
      const { data: gradeData } = await supabase
        .from("grades")
        .select("*")
        .eq("user_id", user.id)
        .in("module_id", moduleIds)
        .order("date", { ascending: false });
      grades = gradeData || [];
    }

    // Get engine enrollments for these modules
    let enrollments: Record<string, unknown>[] = [];
    if (moduleIds.length > 0) {
      const { data: enrollmentData } = await supabase
        .from("enrollments")
        .select(
          `
          id, module_id, status, current_final_grade, current_grade_label,
          current_passed, credits_awarded, attempts_used,
          normalized_score_0_100, normalization_method,
          attempts(
            id, attempt_number, status, final_grade_value, passed,
            date_completed,
            component_results(id, component_id, grade_value, passed, weight_applied)
          )
        `
        )
        .eq("user_id", user.id)
        .in("module_id", moduleIds);
      enrollments = enrollmentData || [];
    }

    // Get transfer credits
    const { data: transfers } = await supabase
      .from("credit_awards")
      .select("*")
      .eq("user_id", user.id)
      .in("award_reason", ["transfer", "recognition", "exemption"]);

    // Build report
    const enrollmentMap = new Map<string, Record<string, unknown>>();
    for (const e of enrollments) {
      enrollmentMap.set(e.module_id as string, e);
    }

    const gradeMap = new Map<string, Record<string, unknown>[]>();
    for (const g of grades) {
      const mid = g.module_id as string;
      if (!gradeMap.has(mid)) gradeMap.set(mid, []);
      gradeMap.get(mid)!.push(g);
    }

    const moduleReports = (modules || []).map((mod) => {
      const modGrades = gradeMap.get(mod.id) || [];
      const enrollment = enrollmentMap.get(mod.id) || null;
      const bestGrade = modGrades.length > 0 ? modGrades[0] : null;

      return {
        module: mod,
        grades: modGrades,
        enrollment,
        bestGrade: bestGrade
          ? (bestGrade.grade as number | null)
          : (enrollment?.current_final_grade as number | null) || null,
        passed:
          enrollment?.current_passed ??
          (bestGrade?.grade != null ? true : null), // simplified
        ectsEarned:
          (enrollment?.credits_awarded as number) || (mod.ects as number) || 0,
        attempts: (enrollment?.attempts_used as number) || modGrades.length,
        normalizedScore:
          (enrollment?.normalized_score_0_100 as number) || null,
      };
    });

    // Aggregates
    const passedModules = moduleReports.filter((r) => r.passed === true);
    const totalEcts = passedModules.reduce(
      (sum, r) => sum + (r.ectsEarned || 0),
      0
    );
    const transferEcts = (transfers || []).reduce(
      (sum, t) =>
        sum +
        ((t.ects_equivalent as number) ||
          (t.credits_awarded_value as number) ||
          0),
      0
    );

    const gradedModules = moduleReports.filter((r) => r.bestGrade !== null);
    const gpa =
      gradedModules.length > 0
        ? gradedModules.reduce((sum, r) => sum + (r.bestGrade || 0), 0) /
          gradedModules.length
        : null;

    const normalizedAvg =
      moduleReports.filter((r) => r.normalizedScore !== null).length > 0
        ? moduleReports
            .filter((r) => r.normalizedScore !== null)
            .reduce((sum, r) => sum + (r.normalizedScore || 0), 0) /
          moduleReports.filter((r) => r.normalizedScore !== null).length
        : null;

    return NextResponse.json({
      profile: {
        name: profile?.full_name || "Student",
        university: profile?.university,
        program: profile?.study_program,
        country: profile?.country,
        semester: semester || profile?.current_semester,
      },
      modules: moduleReports,
      transfers: transfers || [],
      summary: {
        totalModules: moduleReports.length,
        passedModules: passedModules.length,
        failedModules: moduleReports.filter(
          (r) => r.passed === false
        ).length,
        totalEcts,
        transferEcts,
        combinedEcts: totalEcts + transferEcts,
        gpa: gpa ? Math.round(gpa * 100) / 100 : null,
        normalizedAvg: normalizedAvg
          ? Math.round(normalizedAvg * 10) / 10
          : null,
      },
    });
  } catch (err: unknown) {
    log.error("[semester-report GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
