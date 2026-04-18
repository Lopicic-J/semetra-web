import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/achievements
 *
 * Returns all achievement definitions + user's progress/unlock status.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const [defsRes, userRes, profileRes] = await Promise.all([
      supabase.from("achievement_definitions").select("*").order("sort_order"),
      supabase.from("user_achievements").select("*").eq("user_id", user.id),
      supabase.from("profiles").select("xp_total, level").eq("id", user.id).maybeSingle(),
    ]);

    const definitions = defsRes.data ?? [];
    const userAchievements = userRes.data ?? [];
    const profile = profileRes.data ?? { xp_total: 0, level: 1 };

    // Merge definitions with user progress
    const merged = definitions.map(def => {
      const ua = userAchievements.find(u => u.achievement_id === def.id);
      return {
        ...def,
        unlocked: ua?.unlocked_at != null,
        unlocked_at: ua?.unlocked_at ?? null,
        progress: ua?.progress ?? 0,
      };
    });

    // Level XP thresholds: level N requires (N-1)^2 * 100 XP
    const currentLevelXp = (profile.level - 1) ** 2 * 100;
    const nextLevelXp = profile.level ** 2 * 100;

    return NextResponse.json({
      achievements: merged,
      xp: profile.xp_total,
      level: profile.level,
      currentLevelXp,
      nextLevelXp,
      unlockedCount: userAchievements.filter(u => u.unlocked_at).length,
      totalCount: definitions.length,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * POST /api/achievements
 *
 * Check and unlock achievements based on current user stats.
 * Called after relevant actions (grade saved, task completed, etc.)
 * Body: { check: "streak"|"grade"|"module"|"task"|"time"|"all" }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { check = "all" } = await req.json().catch(() => ({ check: "all" }));
    const unlocked: string[] = [];

    // Helper to try unlocking
    const tryUnlock = async (id: string, progress: number) => {
      const { data } = await supabase.rpc("unlock_achievement", {
        p_user_id: user!.id,
        p_achievement_id: id,
        p_progress: progress,
      });
      if (data === true) unlocked.push(id);
    };

    if (check === "all" || check === "grade") {
      const { count: gradeCount } = await supabase
        .from("grades").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      const gc = gradeCount ?? 0;
      if (gc >= 1) await tryUnlock("grade_first", gc);
      if (gc >= 10) await tryUnlock("grade_10", gc);

      // Check for top grade (6.0 in CH scale or 1.0 in DE/AT)
      const { data: topGrade } = await supabase
        .from("grades").select("value").eq("user_id", user.id)
        .or("value.gte.5.5,value.lte.1.5")
        .limit(1);
      if (topGrade && topGrade.length > 0) await tryUnlock("grade_top", 1);
    }

    if (check === "all" || check === "module") {
      const { count } = await supabase
        .from("modules").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("status", "completed");
      const mc = count ?? 0;
      if (mc >= 1) await tryUnlock("module_first", mc);
      if (mc >= 5) await tryUnlock("module_5", mc);
      if (mc >= 10) await tryUnlock("module_10", mc);
      if (mc >= 20) await tryUnlock("module_20", mc);
    }

    if (check === "all" || check === "task") {
      const { count } = await supabase
        .from("tasks").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("status", "done");
      const tc = count ?? 0;
      if (tc >= 1) await tryUnlock("task_first", tc);
      if (tc >= 10) await tryUnlock("task_10", tc);
      if (tc >= 50) await tryUnlock("task_50", tc);
      if (tc >= 100) await tryUnlock("task_100", tc);
    }

    if (check === "all" || check === "time") {
      const { data: timeSums } = await supabase
        .from("time_logs").select("duration_seconds").eq("user_id", user.id);
      const totalHours = (timeSums ?? []).reduce((s, t) => s + (t.duration_seconds ?? 0), 0) / 3600;
      if (totalHours >= 10) await tryUnlock("time_10h", Math.floor(totalHours));
      if (totalHours >= 50) await tryUnlock("time_50h", Math.floor(totalHours));
      if (totalHours >= 100) await tryUnlock("time_100h", Math.floor(totalHours));
      if (totalHours >= 500) await tryUnlock("time_500h", Math.floor(totalHours));
    }

    if (check === "all" || check === "learning") {
      const { count: flashCount } = await supabase
        .from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      const fc = flashCount ?? 0;
      if (fc >= 1) await tryUnlock("flash_first", fc);
      if (fc >= 100) await tryUnlock("flash_100", fc);
      if (fc >= 500) await tryUnlock("flash_500", fc);

      const { count: noteCount } = await supabase
        .from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      if ((noteCount ?? 0) >= 10) await tryUnlock("notes_10", noteCount ?? 0);
    }

    return NextResponse.json({ unlocked, count: unlocked.length });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
