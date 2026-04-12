/**
 * Engine Context Builder
 *
 * Collects the user's academic data from the Academic Engine and formats it
 * as a structured context block for the AI system prompt.
 *
 * Data sources:
 * - Profile (institution, program, semester)
 * - Student program (enrollment status, completion)
 * - Enrollments (modules, grades, normalized scores)
 * - Grades (legacy grades with module names)
 * - Upcoming exams/events (if available)
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface EngineContext {
  institutionName: string | null;
  programName: string | null;
  degreeLevel: string | null;
  currentSemester: number | null;
  country: string | null;
  totalCreditsRequired: number | null;
  creditsEarned: number;
  modulesTotal: number;
  modulesPassed: number;
  modulesFailed: number;
  averageGrade: number | null;
  normalizedAverage: number | null;
  completionPercent: number;
  gradeDetails: { module: string; grade: number | null; passed: boolean; ects: number }[];
  upcomingEvents: { title: string; date: string; type: string }[];
}

/**
 * Fetch the user's academic engine data for AI context injection.
 */
export async function buildEngineContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<EngineContext> {
  const ctx: EngineContext = {
    institutionName: null,
    programName: null,
    degreeLevel: null,
    currentSemester: null,
    country: null,
    totalCreditsRequired: null,
    creditsEarned: 0,
    modulesTotal: 0,
    modulesPassed: 0,
    modulesFailed: 0,
    averageGrade: null,
    normalizedAverage: null,
    completionPercent: 0,
    gradeDetails: [],
    upcomingEvents: [],
  };

  // 1. Profile + institution + program
  const { data: profile } = await supabase
    .from("profiles")
    .select("country, current_semester, institution_id, active_program_id")
    .eq("id", userId)
    .single();

  if (!profile) return ctx;

  ctx.country = profile.country;
  ctx.currentSemester = profile.current_semester;

  // Fetch institution name
  if (profile.institution_id) {
    const { data: inst } = await supabase
      .from("institutions")
      .select("name")
      .eq("id", profile.institution_id)
      .single();
    ctx.institutionName = inst?.name ?? null;
  }

  // Fetch program details
  if (profile.active_program_id) {
    const { data: prog } = await supabase
      .from("programs")
      .select("name, degree_level, required_total_credits")
      .eq("id", profile.active_program_id)
      .single();
    if (prog) {
      ctx.programName = prog.name;
      ctx.degreeLevel = prog.degree_level;
      ctx.totalCreditsRequired = prog.required_total_credits;
    }
  }

  // 2. Total modules count (independent of grades)
  const { count: totalModules } = await supabase
    .from("modules")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  ctx.modulesTotal = totalModules ?? 0;

  // 3. Grades with module info
  const { data: grades } = await supabase
    .from("grades")
    .select("grade, module_id, modules(name, ects)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (grades && grades.length > 0) {
    let gradeSum = 0;
    let gradeCount = 0;

    for (const g of grades) {
      const mod = g.modules as unknown as { name: string; ects: number } | null;
      const moduleName = mod?.name ?? "Unbekannt";
      const ects = mod?.ects ?? 0;
      const passed = g.grade != null && ctx.country === "CH"
        ? g.grade >= 4.0
        : ctx.country === "DE" || ctx.country === "AT"
        ? g.grade != null && g.grade <= 4.0
        : g.grade != null;

      ctx.gradeDetails.push({
        module: moduleName,
        grade: g.grade,
        passed,
        ects,
      });

      if (g.grade != null) {
        gradeSum += g.grade;
        gradeCount++;
      }
      if (passed) {
        ctx.modulesPassed++;
        ctx.creditsEarned += ects;
      } else if (g.grade != null) {
        ctx.modulesFailed++;
      }
    }

    ctx.averageGrade = gradeCount > 0 ? Math.round((gradeSum / gradeCount) * 100) / 100 : null;
  }

  // 4. Enrollments for normalized scores
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("normalized_score_0_100, status, credits_awarded")
    .eq("user_id", userId)
    .in("status", ["passed", "failed", "ongoing"]);

  if (enrollments && enrollments.length > 0) {
    const scores = enrollments
      .filter(e => e.normalized_score_0_100 != null)
      .map(e => e.normalized_score_0_100 as number);
    ctx.normalizedAverage = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
  }

  // 5. Completion percentage
  if (ctx.totalCreditsRequired && ctx.totalCreditsRequired > 0) {
    ctx.completionPercent = Math.min(100,
      Math.round((ctx.creditsEarned / ctx.totalCreditsRequired) * 100));
  }

  // 6. Upcoming events (next 30 days)
  const now = new Date().toISOString();
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await supabase
    .from("events")
    .select("title, date, type")
    .eq("user_id", userId)
    .gte("date", now)
    .lte("date", in30Days)
    .order("date", { ascending: true })
    .limit(10);

  if (events) {
    ctx.upcomingEvents = events.map(e => ({
      title: e.title,
      date: e.date,
      type: e.type ?? "event",
    }));
  }

  return ctx;
}

/**
 * Format the engine context as a text block for the AI system prompt.
 */
export function formatEngineContextBlock(ctx: EngineContext): string {
  if (!ctx.programName && ctx.modulesTotal === 0) {
    return ""; // No academic data available
  }

  const lines: string[] = ["\n\n--- Student Academic Profile ---"];

  if (ctx.institutionName) {
    lines.push(`Institution: ${ctx.institutionName}`);
  }
  if (ctx.programName) {
    const degree = ctx.degreeLevel
      ? ` (${ctx.degreeLevel === "bachelor" ? "BSc" : ctx.degreeLevel === "master" ? "MSc" : ctx.degreeLevel})`
      : "";
    lines.push(`Program: ${ctx.programName}${degree}`);
  }
  if (ctx.currentSemester) {
    lines.push(`Current Semester: ${ctx.currentSemester}`);
  }
  if (ctx.country) {
    lines.push(`Country: ${ctx.country}`);
  }

  // Progress
  if (ctx.totalCreditsRequired) {
    lines.push(`\nProgress: ${ctx.creditsEarned}/${ctx.totalCreditsRequired} ECTS (${ctx.completionPercent}%)`);
  }
  if (ctx.modulesTotal > 0) {
    lines.push(`Modules: ${ctx.modulesPassed} passed, ${ctx.modulesFailed} failed, ${ctx.modulesTotal} total`);
  }
  if (ctx.averageGrade != null) {
    const scale = ctx.country === "CH" ? "(1-6, 4+ = pass)" :
      ctx.country === "DE" || ctx.country === "AT" ? "(1-5, 4.0- = pass)" : "";
    lines.push(`Average Grade: ${ctx.averageGrade} ${scale}`);
  }
  if (ctx.normalizedAverage != null) {
    lines.push(`Normalized Score: ${ctx.normalizedAverage}/100`);
  }

  // Grade details (top 15)
  if (ctx.gradeDetails.length > 0) {
    lines.push("\nRecent Grades:");
    for (const g of ctx.gradeDetails.slice(0, 15)) {
      const status = g.passed ? "✓" : g.grade != null ? "✗" : "—";
      const gradeStr = g.grade != null ? g.grade.toString() : "pending";
      lines.push(`  ${status} ${g.module}: ${gradeStr} (${g.ects} ECTS)`);
    }
  }

  // Upcoming events
  if (ctx.upcomingEvents.length > 0) {
    lines.push("\nUpcoming Events (next 30 days):");
    for (const e of ctx.upcomingEvents) {
      const dateStr = new Date(e.date).toLocaleDateString("de-CH");
      lines.push(`  • ${dateStr}: ${e.title} (${e.type})`);
    }
  }

  lines.push("--- End of Academic Profile ---");
  return lines.join("\n");
}
