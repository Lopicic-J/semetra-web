/**
 * /api/semester-review — Semester Review Report
 *
 * GET: Generate comprehensive semester report with:
 *   - ECTS progress
 *   - GPA evolution
 *   - Total study hours
 *   - Top achievements
 *   - Best/weakest modules
 *   - Study patterns summary
 *   - Streak records
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ModuleResult {
  id: string;
  name: string;
  code: string | null;
  ects: number;
  status: string;
  grade: number | null;
  studyMinutes: number;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const semesterLabel = url.searchParams.get("semester"); // e.g. "HS2026"

  // Fetch all data in parallel
  const [modulesRes, gradesRes, timeLogsRes, achievementsRes, streaksRes, tasksRes] = await Promise.all([
    supabase.from("modules").select("id, name, code, ects, status, semester, target_grade").order("created_at"),
    supabase.from("grades").select("id, module_id, grade, weight, date"),
    supabase.from("time_logs").select("module_id, duration_seconds, started_at"),
    supabase.from("user_achievements")
      .select("achievement_id, unlocked_at, achievement_definitions(name, icon, tier, xp_reward)")
      .not("unlocked_at", "is", null)
      .order("unlocked_at", { ascending: false })
      .limit(10),
    supabase.from("time_logs")
      .select("started_at, duration_seconds")
      .order("started_at", { ascending: true }),
    supabase.from("tasks").select("id, status, module_id"),
  ]);

  const modules = modulesRes.data ?? [];
  const grades = gradesRes.data ?? [];
  const timeLogs = timeLogsRes.data ?? [];
  const achievements = achievementsRes.data ?? [];
  const allSessions = streaksRes.data ?? [];
  const tasks = tasksRes.data ?? [];

  // ── Module Results ──
  const moduleResults: ModuleResult[] = modules.map((m) => {
    const moduleGrades = grades.filter((g) => g.module_id === m.id);
    const avgGrade = moduleGrades.length > 0
      ? moduleGrades.reduce((s, g) => s + (g.grade ?? 0) * (g.weight ?? 1), 0) /
        moduleGrades.reduce((s, g) => s + (g.weight ?? 1), 0)
      : null;

    const studyMinutes = Math.round(
      timeLogs.filter((l) => l.module_id === m.id)
        .reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / 60
    );

    return {
      id: m.id,
      name: m.name,
      code: m.code,
      ects: m.ects ?? 0,
      status: m.status,
      grade: avgGrade ? Math.round(avgGrade * 100) / 100 : null,
      studyMinutes,
    };
  });

  // ── ECTS Progress ──
  const totalEcts = modules.reduce((s, m) => s + (m.ects ?? 0), 0);
  const earnedEcts = moduleResults
    .filter((m) => m.status === "completed" || (m.grade !== null && m.grade >= 4.0))
    .reduce((s, m) => s + m.ects, 0);

  // ── GPA ──
  const gradedModules = moduleResults.filter((m) => m.grade !== null);
  const gpa = gradedModules.length > 0
    ? Math.round(
        gradedModules.reduce((s, m) => s + m.grade! * m.ects, 0) /
        gradedModules.reduce((s, m) => s + m.ects, 0) * 100
      ) / 100
    : null;

  // ── Total Study Time ──
  const totalStudyMinutes = timeLogs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / 60;
  const totalStudyHours = Math.round(totalStudyMinutes / 60 * 10) / 10;

  // ── Best & Weakest Modules ──
  const sortedByGrade = [...gradedModules].sort((a, b) => (b.grade ?? 0) - (a.grade ?? 0));
  const bestModules = sortedByGrade.slice(0, 3);
  const weakestModules = [...sortedByGrade].reverse().slice(0, 3);

  // ── Most Studied Modules ──
  const sortedByTime = [...moduleResults].sort((a, b) => b.studyMinutes - a.studyMinutes);
  const mostStudied = sortedByTime.slice(0, 3);

  // ── Streak Record ──
  const STREAK_THRESHOLD = 15 * 60; // 15 min in seconds
  const studyDays = new Set<string>();
  for (const s of allSessions) {
    if ((s.duration_seconds ?? 0) >= STREAK_THRESHOLD) {
      studyDays.add(s.started_at.split("T")[0]);
    }
  }
  const sortedDays = [...studyDays].sort();
  let longestStreak = 0;
  let currentStreak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  // ── Tasks Summary ──
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // ── Achievements Summary ──
  const unlockedAchievements = achievements.map((a: any) => ({
    id: a.achievement_id,
    name: a.achievement_definitions?.name ?? a.achievement_id,
    icon: a.achievement_definitions?.icon ?? "",
    tier: a.achievement_definitions?.tier ?? "bronze",
    xp: a.achievement_definitions?.xp_reward ?? 0,
    unlockedAt: a.unlocked_at,
  }));

  // ── Total Study Days ──
  const totalStudyDays = studyDays.size;

  return NextResponse.json({
    semester: semesterLabel ?? "Aktuelles Semester",
    generatedAt: new Date().toISOString(),

    ects: {
      earned: earnedEcts,
      total: totalEcts,
      progressPercent: totalEcts > 0 ? Math.round((earnedEcts / totalEcts) * 100) : 0,
    },

    grades: {
      gpa,
      modulesGraded: gradedModules.length,
      modulesPassed: gradedModules.filter((m) => m.grade! >= 4.0).length,
      modulesFailed: gradedModules.filter((m) => m.grade! < 4.0).length,
      bestModules: bestModules.map((m) => ({ name: m.name, grade: m.grade })),
      weakestModules: weakestModules.map((m) => ({ name: m.name, grade: m.grade })),
    },

    studyTime: {
      totalHours: totalStudyHours,
      totalDays: totalStudyDays,
      averagePerDay: totalStudyDays > 0 ? Math.round(totalStudyMinutes / totalStudyDays) : 0,
      mostStudied: mostStudied.map((m) => ({
        name: m.name,
        hours: Math.round(m.studyMinutes / 60 * 10) / 10,
      })),
    },

    tasks: {
      total: totalTasks,
      completed: completedTasks,
      completionRate: taskCompletionRate,
    },

    streaks: {
      longestStreak,
      totalStudyDays,
    },

    achievements: {
      total: unlockedAchievements.length,
      recent: unlockedAchievements.slice(0, 5),
      totalXP: unlockedAchievements.reduce((s: number, a: any) => s + a.xp, 0),
    },

    modules: moduleResults,
  });
}
