import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("api:attempts");

/**
 * GET /api/academic/enrollments/:enrollmentId/attempts
 *
 * List all attempts for an enrollment, including component results.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Verify ownership via enrollment
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id, user_id")
      .eq("id", enrollmentId)
      .eq("user_id", user.id)
      .single();

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment nicht gefunden" }, { status: 404 });
    }

    const { data: attempts, error } = await supabase
      .from("attempts")
      .select(
        `
        id, attempt_number, date_started, date_completed, status,
        final_grade_value, final_grade_label, passed, credits_awarded,
        counts_toward_record, notes, created_at,
        component_results(
          id, component_id, raw_score, grade_value, grade_label,
          passed, weight_applied, grader_notes
        )
      `
      )
      .eq("enrollment_id", enrollmentId)
      .order("attempt_number", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ attempts: attempts || [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academic/enrollments/:enrollmentId/attempts
 *
 * Create a new attempt with optional component results.
 * Body: {
 *   date_completed?, status?,
 *   final_grade_value?, final_grade_label?, passed?,
 *   credits_awarded?,
 *   component_results?: Array<{ component_id, raw_score?, grade_value?, grade_label?, passed?, weight_applied? }>
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Verify ownership
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id, user_id, attempts_used")
      .eq("id", enrollmentId)
      .eq("user_id", user.id)
      .single();

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment nicht gefunden" }, { status: 404 });
    }

    const body = await req.json();
    const attemptNumber = (enrollment.attempts_used || 0) + 1;

    // Create attempt
    const { data: attempt, error: attemptErr } = await supabase
      .from("attempts")
      .insert({
        enrollment_id: enrollmentId,
        attempt_number: attemptNumber,
        date_started: body.date_started || null,
        date_completed: body.date_completed || null,
        status: body.status || "in_progress",
        final_grade_value: body.final_grade_value ?? null,
        final_grade_label: body.final_grade_label || null,
        passed: body.passed ?? null,
        credits_awarded: body.credits_awarded || 0,
        counts_toward_record: body.counts_toward_record !== false,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (attemptErr) {
      return NextResponse.json({ error: attemptErr.message }, { status: 500 });
    }

    // Insert component results if provided
    let componentResults: unknown[] = [];
    if (body.component_results && Array.isArray(body.component_results)) {
      const rows = body.component_results.map(
        (cr: {
          component_id: string;
          raw_score?: number;
          grade_value?: number;
          grade_label?: string;
          passed?: boolean;
          weight_applied?: number;
          grader_notes?: string;
        }) => ({
          attempt_id: attempt.id,
          component_id: cr.component_id,
          raw_score: cr.raw_score ?? null,
          grade_value: cr.grade_value ?? null,
          grade_label: cr.grade_label || null,
          passed: cr.passed ?? null,
          weight_applied: cr.weight_applied ?? null,
          grader_notes: cr.grader_notes || null,
        })
      );

      const { data: crData, error: crErr } = await supabase
        .from("component_results")
        .insert(rows)
        .select();

      if (crErr) {
        log.error("POST component_results insert failed", { error: crErr });
      }
      componentResults = crData || [];
    }

    // Update enrollment attempts_used
    await supabase
      .from("enrollments")
      .update({ attempts_used: attemptNumber })
      .eq("id", enrollmentId);

    return NextResponse.json(
      { attempt: { ...attempt, component_results: componentResults } },
      { status: 201 }
    );
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
