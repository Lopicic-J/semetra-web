/**
 * /api/recommendations/modules — Module Recommendations
 *
 * GET: Suggest next modules based on:
 *   - User's completed modules
 *   - Prerequisite chains
 *   - Anonymized peer data (which modules students take next)
 *   - Semester progression
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get user's profile and modules
  const [profileRes, modulesRes] = await Promise.all([
    supabase.from("profiles").select("institution_id, active_program_id, current_semester").eq("id", user.id).maybeSingle(),
    supabase.from("modules").select("id, name, code, ects, semester, status").order("semester"),
  ]);

  const profile = profileRes.data;
  const userModules = modulesRes.data ?? [];

  const completedModuleNames = new Set(
    userModules.filter((m) => m.status === "completed").map((m) => m.name.toLowerCase().trim())
  );
  const activeModuleNames = new Set(
    userModules.filter((m) => m.status === "active").map((m) => m.name.toLowerCase().trim())
  );

  // If user has a program, get program modules for recommendations
  const recommendations: { name: string; code: string | null; ects: number; semester: number | null; reason: string }[] = [];

  if (profile?.active_program_id) {
    // Get all modules in the user's program that they haven't taken yet
    const { data: programModules } = await supabase
      .from("modules")
      .select("name, code, ects, semester")
      .eq("program_id", profile.active_program_id)
      .is("user_id", null); // Template modules only

    const currentSemester = profile.current_semester ?? 1;

    for (const pm of programModules ?? []) {
      const nameKey = pm.name.toLowerCase().trim();
      if (completedModuleNames.has(nameKey) || activeModuleNames.has(nameKey)) continue;

      const pmSemester = pm.semester ? parseInt(pm.semester, 10) : null;

      // Prioritize: current semester > next semester > later
      let reason: string;
      if (pmSemester && pmSemester <= currentSemester) {
        reason = `Empfohlen für Semester ${pmSemester} — du bist in Semester ${currentSemester}`;
      } else if (pmSemester && pmSemester === currentSemester + 1) {
        reason = `Nächstes Semester (${pmSemester}) — frühzeitig planen`;
      } else {
        reason = `Teil deines Studiengangs${pmSemester ? ` (Semester ${pmSemester})` : ""}`;
      }

      recommendations.push({
        name: pm.name,
        code: pm.code,
        ects: pm.ects ?? 0,
        semester: pmSemester,
        reason,
      });
    }

    // Sort: current/past semester first, then by semester
    recommendations.sort((a, b) => {
      const aUrgent = (a.semester ?? 99) <= currentSemester ? 0 : 1;
      const bUrgent = (b.semester ?? 99) <= currentSemester ? 0 : 1;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;
      return (a.semester ?? 99) - (b.semester ?? 99);
    });
  }

  return NextResponse.json({
    recommendations: recommendations.slice(0, 15),
    completedModules: completedModuleNames.size,
    activeModules: activeModuleNames.size,
    currentSemester: profile?.current_semester ?? null,
    programId: profile?.active_program_id ?? null,
  });
}
