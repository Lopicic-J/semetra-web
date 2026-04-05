import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncGradeToEngine, unsyncGradeFromEngine } from "@/lib/academic/grade-bridge";
import { logger } from "@/lib/logger";
import type { LegacyGradeInput } from "@/lib/academic/grade-bridge";
import type { CountryCode } from "@/lib/grading-systems";

const log = logger("api:grades");

/**
 * GET /api/grades
 *
 * Fetch all grades for the authenticated user. Includes module join.
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

    const { data, error } = await supabase
      .from("grades")
      .select("*, modules(name, color)")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ grades: data || [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grades
 *
 * Create a new grade with dual-write to Academic Engine.
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
    const {
      title,
      grade,
      weight,
      date,
      module_id,
      exam_id,
      exam_type,
      notes,
      ects_earned,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Titel ist erforderlich" },
        { status: 400 }
      );
    }

    // 1. Insert into legacy grades table
    const payload: Record<string, unknown> = {
      user_id: user.id,
      title,
      grade: grade !== undefined && grade !== "" ? parseFloat(grade) : null,
      weight: parseFloat(weight) || 1,
      date: date || null,
      module_id: module_id || null,
      exam_id: exam_id || null,
      exam_type: exam_type || null,
      notes: notes || null,
      ects_earned:
        ects_earned !== undefined && ects_earned !== ""
          ? parseFloat(ects_earned)
          : null,
    };

    const { data: gradeRow, error: insertErr } = await supabase
      .from("grades")
      .insert(payload)
      .select("*, modules(name, color)")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 2. Dual-write: sync to Academic Engine (fire-and-forget, non-blocking)
    let bridgeResult = null;
    if (gradeRow.grade !== null && gradeRow.module_id) {
      // Get user's country for normalization
      const { data: profile } = await supabase
        .from("profiles")
        .select("country")
        .eq("id", user.id)
        .single();

      const country = (profile?.country as CountryCode) || null;
      const input: LegacyGradeInput = {
        id: gradeRow.id,
        user_id: user.id,
        module_id: gradeRow.module_id,
        title: gradeRow.title,
        grade: gradeRow.grade,
        weight: gradeRow.weight,
        date: gradeRow.date,
        exam_type: gradeRow.exam_type,
        ects_earned: gradeRow.ects_earned,
      };

      bridgeResult = await syncGradeToEngine(supabase, input, country);
    }

    return NextResponse.json(
      {
        grade: gradeRow,
        bridge: bridgeResult,
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
 * PATCH /api/grades
 *
 * Update an existing grade with dual-write.
 * Body must include { id, ...fields }
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
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Grade-ID erforderlich" },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = {};
    if (fields.title !== undefined) payload.title = fields.title;
    if (fields.grade !== undefined)
      payload.grade =
        fields.grade !== "" ? parseFloat(fields.grade) : null;
    if (fields.weight !== undefined)
      payload.weight = parseFloat(fields.weight) || 1;
    if (fields.date !== undefined) payload.date = fields.date || null;
    if (fields.module_id !== undefined)
      payload.module_id = fields.module_id || null;
    if (fields.exam_id !== undefined)
      payload.exam_id = fields.exam_id || null;
    if (fields.exam_type !== undefined)
      payload.exam_type = fields.exam_type || null;
    if (fields.notes !== undefined) payload.notes = fields.notes || null;
    if (fields.ects_earned !== undefined)
      payload.ects_earned =
        fields.ects_earned !== "" ? parseFloat(fields.ects_earned) : null;

    const { data: gradeRow, error: updateErr } = await supabase
      .from("grades")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id) // ensure ownership
      .select("*, modules(name, color)")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Dual-write: re-sync to engine
    let bridgeResult = null;
    if (gradeRow.grade !== null && gradeRow.module_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("country")
        .eq("id", user.id)
        .single();

      const country = (profile?.country as CountryCode) || null;
      const input: LegacyGradeInput = {
        id: gradeRow.id,
        user_id: user.id,
        module_id: gradeRow.module_id,
        title: gradeRow.title,
        grade: gradeRow.grade,
        weight: gradeRow.weight,
        date: gradeRow.date,
        exam_type: gradeRow.exam_type,
        ects_earned: gradeRow.ects_earned,
      };

      bridgeResult = await syncGradeToEngine(supabase, input, country);
    }

    return NextResponse.json({ grade: gradeRow, bridge: bridgeResult });
  } catch (err: unknown) {
    log.error("PATCH failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/grades
 *
 * Delete a grade and clean up engine-side data.
 * Query param: ?id=<grade_id>
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Grade-ID erforderlich" },
        { status: 400 }
      );
    }

    // 1. Delete from legacy grades
    const { error: deleteErr } = await supabase
      .from("grades")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 2. Clean up engine-side
    const bridgeResult = await unsyncGradeFromEngine(supabase, id);

    return NextResponse.json({ deleted: true, bridge: bridgeResult });
  } catch (err: unknown) {
    log.error("DELETE failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
