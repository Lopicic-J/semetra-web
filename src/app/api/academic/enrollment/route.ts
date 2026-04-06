import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("api:enrollment");

/**
 * GET /api/academic/enrollment
 *
 * Returns the current user's enrollment (student_programs + profile program link).
 * Includes institution and program details via joins.
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

    // Fetch profile with institution + program references
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "institution_id, active_program_id, current_semester, university, study_program"
      )
      .eq("id", user.id)
      .single();

    if (profileError) {
      log.error("GET profile failed", { error: profileError });
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    // Fetch all student_programs for this user (could have switched programs)
    const { data: enrollments, error: enrollError } = await supabase
      .from("student_programs")
      .select(
        `
        id, user_id, program_id, institution_id, status,
        enrollment_date, expected_graduation,
        created_at, updated_at,
        program:programs!program_id(id, name, degree_level, required_total_credits),
        institution:institutions!institution_id(id, name, country_code, institution_type)
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (enrollError) {
      log.error("GET enrollments failed", { error: enrollError });
      return NextResponse.json(
        { error: enrollError.message },
        { status: 500 }
      );
    }

    // Find the active enrollment (matching profile's active_program_id)
    const activeEnrollment =
      enrollments?.find(
        (e) =>
          e.program_id === profile.active_program_id && e.status === "active"
      ) || null;

    // Merge current_semester from profile into active enrollment
    // (current_semester lives on profiles, not student_programs)
    const active = activeEnrollment
      ? { ...activeEnrollment, current_semester: profile.current_semester }
      : null;

    return NextResponse.json({
      profile: {
        institution_id: profile.institution_id,
        active_program_id: profile.active_program_id,
        current_semester: profile.current_semester,
        university: profile.university,
        study_program: profile.study_program,
      },
      active,
      enrollments: enrollments || [],
    });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academic/enrollment
 *
 * Enroll user in a program. Updates profile (institution_id, active_program_id,
 * current_semester) which triggers sync_student_program() via the DB trigger.
 *
 * Body: { institution_id, program_id, current_semester? }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { institution_id, program_id, current_semester } = body;

    if (!institution_id || !program_id) {
      return NextResponse.json(
        { error: "Institution und Programm sind erforderlich" },
        { status: 400 }
      );
    }

    // Validate institution exists
    const { data: inst, error: instErr } = await supabase
      .from("institutions")
      .select("id, name")
      .eq("id", institution_id)
      .single();

    if (instErr || !inst) {
      return NextResponse.json(
        { error: "Institution nicht gefunden" },
        { status: 404 }
      );
    }

    // Validate program exists and belongs to institution
    const { data: prog, error: progErr } = await supabase
      .from("programs")
      .select("id, name, institution_id")
      .eq("id", program_id)
      .single();

    if (progErr || !prog) {
      return NextResponse.json(
        { error: "Studiengang nicht gefunden" },
        { status: 404 }
      );
    }

    if (prog.institution_id && prog.institution_id !== institution_id) {
      return NextResponse.json(
        { error: "Studiengang gehoert nicht zu dieser Institution" },
        { status: 400 }
      );
    }

    // Update profile — the DB trigger sync_student_program() handles student_programs
    // Reset institution_modules_loaded so the modules page re-imports for the new program
    const { data: updated, error: updateErr } = await supabase
      .from("profiles")
      .update({
        institution_id,
        active_program_id: program_id,
        current_semester: current_semester || 1,
        university: inst.name, // keep legacy field in sync
        study_program: prog.name, // keep legacy field in sync
        institution_modules_loaded: false, // triggers re-import on modules page
      })
      .eq("id", user.id)
      .select(
        "institution_id, active_program_id, current_semester, university, study_program"
      )
      .single();

    if (updateErr) {
      log.error("POST profile update failed", { error: updateErr });
      return NextResponse.json(
        { error: updateErr.message },
        { status: 500 }
      );
    }

    // Fetch the resulting student_programs entry (created/updated by trigger)
    const { data: enrollment } = await supabase
      .from("student_programs")
      .select(
        `
        id, user_id, program_id, institution_id, status,
        enrollment_date,
        program:programs!program_id(id, name, degree_level, required_total_credits),
        institution:institutions!institution_id(id, name, country_code)
      `
      )
      .eq("user_id", user.id)
      .eq("program_id", program_id)
      .single();

    return NextResponse.json(
      {
        profile: updated,
        enrollment: enrollment || null,
        message: "Einschreibung erfolgreich",
      },
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

/**
 * PATCH /api/academic/enrollment
 *
 * Update enrollment details (e.g. current_semester, switch program).
 * Body: { current_semester?, program_id?, institution_id? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.current_semester !== undefined) {
      updates.current_semester = body.current_semester;
    }
    if (body.institution_id !== undefined) {
      updates.institution_id = body.institution_id;
    }
    if (body.program_id !== undefined) {
      updates.active_program_id = body.program_id;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Keine Aenderungen angegeben" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select(
        "institution_id, active_program_id, current_semester, university, study_program"
      )
      .single();

    if (error) {
      log.error("PATCH failed", { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (err: unknown) {
    log.error("PATCH failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
