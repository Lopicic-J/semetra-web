import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { migrateUserGrades } from "@/lib/academic/grade-bridge";
import type { CountryCode } from "@/lib/grading-systems";
import { logger } from "@/lib/logger";

const log = logger("api:grades-migrate");

/**
 * POST /api/grades/migrate
 *
 * Lazy migration: sync all existing legacy grades for the current user
 * into the Academic Engine (enrollments + attempts).
 * Safe to call multiple times — already-synced grades are skipped.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Get user's country for normalization
    const { data: profile } = await supabase
      .from("profiles")
      .select("country")
      .eq("id", user.id)
      .single();

    const country = (profile?.country as CountryCode) || null;

    const result = await migrateUserGrades(supabase, user.id, country);

    return NextResponse.json({
      migrated: result.migrated,
      errors: result.errors,
      message:
        result.errors > 0
          ? `${result.migrated} Noten migriert, ${result.errors} Fehler`
          : `${result.migrated} Noten erfolgreich migriert`,
    });
  } catch (err: unknown) {
    log.error("POST migration failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
