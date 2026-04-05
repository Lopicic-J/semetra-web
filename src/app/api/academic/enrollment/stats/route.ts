import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("api:enrollment-stats");

/**
 * GET /api/academic/enrollment/stats
 *
 * Returns aggregated statistics from the Academic Engine for the current user:
 * - Total enrollments, passed count, total credits awarded
 * - Average normalized score (0-100)
 * - Completion percentage (based on active program)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Fetch all enrollments for this user
    const { data: enrollments, error } = await supabase
      .from("enrollments")
      .select(
        "id, status, credits_awarded, normalized_score_0_100, current_passed"
      )
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const all = enrollments || [];
    const enrollmentCount = all.length;
    const passedCount = all.filter(
      (e) => e.status === "passed" || e.current_passed === true
    ).length;
    const totalCredits = all.reduce(
      (sum, e) => sum + (e.credits_awarded || 0),
      0
    );

    // Average normalized score (only graded enrollments with scores)
    const scoredEnrollments = all.filter(
      (e) => e.normalized_score_0_100 !== null && e.normalized_score_0_100 > 0
    );
    const averageNormalized =
      scoredEnrollments.length > 0
        ? scoredEnrollments.reduce(
            (sum, e) => sum + (e.normalized_score_0_100 || 0),
            0
          ) / scoredEnrollments.length
        : null;

    // Completion percentage based on active program
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_program_id")
      .eq("id", user.id)
      .single();

    let completionPct = 0;
    if (profile?.active_program_id) {
      const { data: program } = await supabase
        .from("programs")
        .select("required_total_credits")
        .eq("id", profile.active_program_id)
        .single();

      const required = program?.required_total_credits || 180;
      completionPct =
        required > 0
          ? Math.min(100, Math.round((totalCredits / required) * 100))
          : 0;
    }

    return NextResponse.json({
      enrollmentCount,
      passedCount,
      totalCredits,
      averageNormalized: averageNormalized
        ? Math.round(averageNormalized * 10) / 10
        : null,
      completionPct,
    });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
