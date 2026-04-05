import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("academic:credits");

/**
 * GET /api/academic/transfer-credits
 *
 * List all transfer credit / recognition entries for the current user.
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
      .from("credit_awards")
      .select("*")
      .eq("user_id", user.id)
      .order("awarded_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ credits: data || [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academic/transfer-credits
 *
 * Add a transfer credit / recognition.
 * Body: {
 *   module_id?: string,         — optional: link to existing module
 *   source_institution?: string, — where the credits come from
 *   source_module_name?: string,
 *   credits_value: number,       — ECTS or local credits
 *   ects_equivalent?: number,    — converted to ECTS
 *   grade_value?: number,        — optional: original grade
 *   award_reason: string,        — "transfer" | "recognition" | "exemption" | "prior_learning"
 *   notes?: string
 * }
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
      module_id,
      source_institution,
      source_module_name,
      credits_value,
      ects_equivalent,
      grade_value,
      award_reason,
      notes,
    } = body;

    if (!credits_value || credits_value <= 0) {
      return NextResponse.json(
        { error: "Credits-Wert muss groesser als 0 sein" },
        { status: 400 }
      );
    }

    const validReasons = [
      "transfer",
      "recognition",
      "exemption",
      "prior_learning",
      "passed_module",
    ];
    if (!award_reason || !validReasons.includes(award_reason)) {
      return NextResponse.json(
        { error: "Ungueltiger Anrechnungsgrund" },
        { status: 400 }
      );
    }

    // Insert credit award
    const { data: award, error: awardErr } = await supabase
      .from("credit_awards")
      .insert({
        user_id: user.id,
        module_id: module_id || null,
        credits_awarded_value: credits_value,
        ects_equivalent: ects_equivalent || credits_value,
        award_reason,
        awarded_at: new Date().toISOString(),
        notes: [
          source_institution && `Quelle: ${source_institution}`,
          source_module_name && `Modul: ${source_module_name}`,
          grade_value && `Note: ${grade_value}`,
          notes,
        ]
          .filter(Boolean)
          .join(" | ") || null,
      })
      .select()
      .single();

    if (awardErr) {
      log.error("[transfer-credits POST]", awardErr);
      return NextResponse.json({ error: awardErr.message }, { status: 500 });
    }

    // If linked to a module, also create/update an enrollment with "recognised" status
    if (module_id) {
      const { data: existing } = await supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", user.id)
        .eq("module_id", module_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("enrollments")
          .update({
            status: "recognised",
            credits_awarded: credits_value,
            current_passed: true,
            current_final_grade: grade_value || null,
          })
          .eq("id", existing.id);
      } else {
        // Get user's active program
        const { data: profile } = await supabase
          .from("profiles")
          .select("active_program_id")
          .eq("id", user.id)
          .single();

        await supabase.from("enrollments").insert({
          user_id: user.id,
          module_id,
          program_id: profile?.active_program_id || null,
          status: "recognised",
          credits_awarded: credits_value,
          current_passed: true,
          current_final_grade: grade_value || null,
        });
      }
    }

    return NextResponse.json({ credit: award }, { status: 201 });
  } catch (err: unknown) {
    log.error("[transfer-credits POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/academic/transfer-credits?id=<credit_award_id>
 *
 * Remove a transfer credit entry.
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
        { error: "Credit-Award ID erforderlich" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("credit_awards")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
