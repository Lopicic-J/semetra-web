/**
 * Semetra Grade-Bridge Service
 *
 * Dual-write layer: when a user saves a grade via the legacy system,
 * the bridge also creates/updates the corresponding enrollment + attempt
 * in the Academic Engine tables. This keeps both systems in sync during
 * the transition period.
 *
 * Flow:
 *   1. Legacy grade saved (grades table)
 *   2. Bridge looks up or creates enrollment for that module
 *   3. Bridge creates an attempt linked to the enrollment
 *   4. Enrollment status + final grade updated
 *
 * The bridge is called server-side from the grades API route.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { CountryCode } from "@/lib/grading-systems";

const log = logger("academic:grade-bridge");

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface LegacyGradeInput {
  id: string; // grade row id
  user_id: string;
  module_id: string | null;
  title: string;
  grade: number | null;
  weight: number;
  date: string | null;
  exam_type: string | null;
  ects_earned: number | null;
}

export interface BridgeResult {
  enrollment_id: string | null;
  attempt_id: string | null;
  synced: boolean;
  error?: string;
}

/* ─── Normalization helpers ──────────────────────────────────────────────── */

/** Map country code to a simple 0-100 normalization. */
function normalizeToPercent(
  grade: number,
  country: CountryCode | null
): { score: number; method: string; confidence: number } {
  if (!country)
    return { score: grade, method: "raw", confidence: 0.5 };

  switch (country) {
    // CH: 1 (worst) – 6 (best), pass at 4.0
    case "CH":
      return {
        score: Math.max(0, Math.min(100, ((grade - 1) / 5) * 100)),
        method: "linear_ch_1_6",
        confidence: 0.95,
      };
    // DE/AT: 1 (best) – 5 (worst), pass at 4.0
    case "DE":
    case "AT":
      return {
        score: Math.max(0, Math.min(100, ((5 - grade) / 4) * 100)),
        method: "linear_de_1_5",
        confidence: 0.95,
      };
    // UK/US: percentage or 0-100
    case "UK":
    case "US":
      return {
        score: Math.max(0, Math.min(100, grade)),
        method: "direct_percent",
        confidence: 0.9,
      };
    // FR/BE: 0-20, pass at 10
    case "FR":
    case "BE":
      return {
        score: Math.max(0, Math.min(100, (grade / 20) * 100)),
        method: "linear_fr_0_20",
        confidence: 0.95,
      };
    // IT: 18-30, pass at 18
    case "IT":
      return {
        score: Math.max(0, Math.min(100, ((grade - 18) / 12) * 100)),
        method: "linear_it_18_30",
        confidence: 0.9,
      };
    // NL: 1-10, pass at 5.5
    case "NL":
      return {
        score: Math.max(0, Math.min(100, ((grade - 1) / 9) * 100)),
        method: "linear_nl_1_10",
        confidence: 0.9,
      };
    // ES: 0-10, pass at 5
    case "ES":
      return {
        score: Math.max(0, Math.min(100, (grade / 10) * 100)),
        method: "linear_es_0_10",
        confidence: 0.9,
      };
    // SE/DK/FI/NO/CZ/PL/PT: approximate
    default:
      return {
        score: Math.max(0, Math.min(100, grade)),
        method: "fallback_raw",
        confidence: 0.5,
      };
  }
}

/** Determine if grade is passing for a given country. */
function isPassing(grade: number, country: CountryCode | null): boolean {
  if (!country) return grade >= 50; // fallback for percentage

  switch (country) {
    case "CH":
      return grade >= 4.0;
    case "DE":
    case "AT":
      return grade <= 4.0;
    case "UK":
    case "US":
      return grade >= 40;
    case "FR":
    case "BE":
      return grade >= 10;
    case "IT":
      return grade >= 18;
    case "NL":
      return grade >= 5.5;
    case "ES":
      return grade >= 5;
    default:
      return grade >= 50;
  }
}

/* ─── Bridge Core ────────────────────────────────────────────────────────── */

/**
 * Sync a legacy grade to the Academic Engine.
 * Called after a grade is inserted or updated in the `grades` table.
 */
export async function syncGradeToEngine(
  supabase: SupabaseClient,
  input: LegacyGradeInput,
  country: CountryCode | null
): Promise<BridgeResult> {
  // Skip if no module — can't create enrollment without module
  if (!input.module_id) {
    return { enrollment_id: null, attempt_id: null, synced: false, error: "no_module" };
  }

  // Skip if no grade value — e.g. ECTS-only entry
  if (input.grade === null || input.grade === undefined) {
    return { enrollment_id: null, attempt_id: null, synced: false, error: "no_grade" };
  }

  try {
    // 1. Get user's active program (if enrolled)
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_program_id")
      .eq("id", input.user_id)
      .single();

    const programId = profile?.active_program_id || null;

    // 2. Find or create enrollment for this user + module
    let enrollmentId: string | null = null;

    const { data: existing } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", input.user_id)
      .eq("module_id", input.module_id)
      .maybeSingle();

    if (existing) {
      enrollmentId = existing.id;
    } else {
      // Create new enrollment
      const { data: created, error: createErr } = await supabase
        .from("enrollments")
        .insert({
          user_id: input.user_id,
          module_id: input.module_id,
          program_id: programId,
          status: "ongoing",
          attempts_used: 0,
        })
        .select("id")
        .single();

      if (createErr) {
        log.error("create enrollment", createErr);
        return { enrollment_id: null, attempt_id: null, synced: false, error: createErr.message };
      }
      enrollmentId = created.id;
    }

    // 3. Normalize the grade
    const norm = normalizeToPercent(input.grade, country);
    const passed = isPassing(input.grade, country);

    // 4. Create or update attempt
    // Check if there's already an attempt linked to this grade (via notes field)
    const gradeRef = `legacy_grade:${input.id}`;
    const { data: existingAttempt } = await supabase
      .from("attempts")
      .select("id, attempt_number")
      .eq("enrollment_id", enrollmentId)
      .eq("notes", gradeRef)
      .maybeSingle();

    let attemptId: string | null = null;

    if (existingAttempt) {
      // Update existing attempt
      const { error: updateErr } = await supabase
        .from("attempts")
        .update({
          final_grade_value: input.grade,
          final_grade_label: input.title,
          passed,
          date_completed: input.date || null,
          status: "graded",
          credits_awarded: passed ? (input.ects_earned || 0) : 0,
        })
        .eq("id", existingAttempt.id);

      if (updateErr) {
        log.error("update attempt", updateErr);
        return { enrollment_id: enrollmentId, attempt_id: null, synced: false, error: updateErr.message };
      }
      attemptId = existingAttempt.id;
    } else {
      // Get next attempt number
      const { count } = await supabase
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("enrollment_id", enrollmentId);

      const attemptNumber = (count || 0) + 1;

      const { data: newAttempt, error: attemptErr } = await supabase
        .from("attempts")
        .insert({
          enrollment_id: enrollmentId,
          attempt_number: attemptNumber,
          date_completed: input.date || null,
          status: "graded",
          final_grade_value: input.grade,
          final_grade_label: input.title,
          passed,
          credits_awarded: passed ? (input.ects_earned || 0) : 0,
          counts_toward_record: true,
          notes: gradeRef, // link back to legacy grade
        })
        .select("id")
        .single();

      if (attemptErr) {
        log.error("create attempt", attemptErr);
        return { enrollment_id: enrollmentId, attempt_id: null, synced: false, error: attemptErr.message };
      }
      attemptId = newAttempt.id;
    }

    // 5. Update enrollment with current best grade
    const { data: allAttempts } = await supabase
      .from("attempts")
      .select("final_grade_value, passed, credits_awarded")
      .eq("enrollment_id", enrollmentId)
      .eq("status", "graded")
      .eq("counts_toward_record", true)
      .order("final_grade_value", { ascending: false }); // best first for CH/UK/US

    // For now use the latest graded attempt as the "current" grade
    // (In Phase 4 we'll use the retake policy from the engine)
    const latestGrade = input.grade;
    const totalAttempts = allAttempts?.length || 1;
    const totalCredits = passed ? (input.ects_earned || 0) : 0;

    const { error: enrollUpdateErr } = await supabase
      .from("enrollments")
      .update({
        current_final_grade: latestGrade,
        current_grade_label: input.title,
        current_passed: passed,
        credits_awarded: totalCredits,
        attempts_used: totalAttempts,
        status: passed ? "passed" : "ongoing",
        // Normalization
        local_grade_value: input.grade,
        local_grade_label: input.title,
        normalized_score_0_100: norm.score,
        normalization_method: norm.method,
        conversion_confidence: norm.confidence,
      })
      .eq("id", enrollmentId);

    if (enrollUpdateErr) {
      log.error("update enrollment", enrollUpdateErr);
      return { enrollment_id: enrollmentId, attempt_id: attemptId, synced: false, error: enrollUpdateErr.message };
    }

    return { enrollment_id: enrollmentId, attempt_id: attemptId, synced: true };
  } catch (err: unknown) {
    log.error("unexpected", err);
    return {
      enrollment_id: null,
      attempt_id: null,
      synced: false,
      error: err instanceof Error ? err.message : "Unexpected error",
    };
  }
}

/**
 * Remove the engine-side data when a legacy grade is deleted.
 */
export async function unsyncGradeFromEngine(
  supabase: SupabaseClient,
  gradeId: string
): Promise<{ synced: boolean; error?: string }> {
  try {
    const gradeRef = `legacy_grade:${gradeId}`;

    // Find the attempt linked to this grade
    const { data: attempt } = await supabase
      .from("attempts")
      .select("id, enrollment_id")
      .eq("notes", gradeRef)
      .maybeSingle();

    if (!attempt) {
      return { synced: true }; // nothing to clean up
    }

    // Delete the attempt
    await supabase.from("attempts").delete().eq("id", attempt.id);

    // Check if enrollment has remaining attempts
    const { count } = await supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_id", attempt.enrollment_id);

    if (!count || count === 0) {
      // No more attempts — reset enrollment to planned
      await supabase
        .from("enrollments")
        .update({
          status: "planned",
          current_final_grade: null,
          current_grade_label: null,
          current_passed: null,
          credits_awarded: 0,
          attempts_used: 0,
          local_grade_value: null,
          local_grade_label: null,
          normalized_score_0_100: null,
          normalization_method: null,
          conversion_confidence: null,
        })
        .eq("id", attempt.enrollment_id);
    }

    return { synced: true };
  } catch (err: unknown) {
    log.error("unsync error", err);
    return { synced: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

/**
 * Lazy migration: Sync ALL existing legacy grades for a user into the engine.
 * Called once when user first accesses engine-powered features.
 */
export async function migrateUserGrades(
  supabase: SupabaseClient,
  userId: string,
  country: CountryCode | null
): Promise<{ migrated: number; errors: number }> {
  const { data: grades } = await supabase
    .from("grades")
    .select("id, user_id, module_id, title, grade, weight, date, exam_type, ects_earned")
    .eq("user_id", userId)
    .not("module_id", "is", null) // only grades linked to modules
    .not("grade", "is", null); // only grades with values

  if (!grades || grades.length === 0) {
    return { migrated: 0, errors: 0 };
  }

  let migrated = 0;
  let errors = 0;

  for (const g of grades) {
    // Check if already synced
    const gradeRef = `legacy_grade:${g.id}`;
    const { data: existing } = await supabase
      .from("attempts")
      .select("id")
      .eq("notes", gradeRef)
      .maybeSingle();

    if (existing) {
      migrated++; // already synced, count as success
      continue;
    }

    const result = await syncGradeToEngine(supabase, g as LegacyGradeInput, country);
    if (result.synced) migrated++;
    else errors++;
  }

  return { migrated, errors };
}
