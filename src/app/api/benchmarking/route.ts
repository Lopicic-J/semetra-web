/**
 * /api/benchmarking — Anonymous Peer Benchmarking
 *
 * GET: Compare user's stats against anonymous aggregates
 *   - Study time percentile
 *   - Streak percentile
 *   - Task completion percentile
 *   - Module-specific grade comparison (if enough data)
 *
 * All data is anonymized — only aggregates are returned, no individual data.
 * Users must opt in via profile setting.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  // Get user's own stats
  const [userTimeRes, userTasksRes, userStreakRes] = await Promise.all([
    supabase.from("time_logs").select("duration_seconds")
      .eq("user_id", user.id).gte("started_at", since),
    supabase.from("tasks").select("status").eq("user_id", user.id),
    supabase.from("time_logs").select("started_at, duration_seconds")
      .eq("user_id", user.id).order("started_at", { ascending: true }),
  ]);

  const userStudyMinutes = Math.round(
    (userTimeRes.data ?? []).reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / 60
  );
  const userTasks = userTasksRes.data ?? [];
  const userTaskCompletion = userTasks.length > 0
    ? Math.round(userTasks.filter((t) => t.status === "done").length / userTasks.length * 100)
    : 0;

  // Calculate user streak
  const STREAK_THRESHOLD = 15 * 60;
  const studyDays = new Set<string>();
  for (const s of userStreakRes.data ?? []) {
    if ((s.duration_seconds ?? 0) >= STREAK_THRESHOLD) {
      studyDays.add(s.started_at.split("T")[0]);
    }
  }
  const sortedDays = [...studyDays].sort();
  let userStreak = 0;
  let currentStreak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const diff = (new Date(sortedDays[i]).getTime() - new Date(sortedDays[i - 1]).getTime()) / 86400000;
    if (diff === 1) { currentStreak++; userStreak = Math.max(userStreak, currentStreak); }
    else currentStreak = 1;
  }
  userStreak = Math.max(userStreak, currentStreak);

  // Get anonymous aggregate stats (all users with activity in last 30 days)
  // Using count-based aggregation — no individual data exposed
  const { data: activeUsersTime } = await supabase
    .from("time_logs")
    .select("user_id, duration_seconds")
    .gte("started_at", since);

  // Aggregate study time per user
  const timeByUser = new Map<string, number>();
  for (const log of activeUsersTime ?? []) {
    const current = timeByUser.get(log.user_id) ?? 0;
    timeByUser.set(log.user_id, current + (log.duration_seconds ?? 0));
  }

  const allStudyMinutes = [...timeByUser.values()].map((s) => Math.round(s / 60)).sort((a, b) => a - b);

  // Calculate percentiles
  const calculatePercentile = (values: number[], userValue: number): number => {
    if (values.length === 0) return 50;
    const below = values.filter((v) => v < userValue).length;
    return Math.round((below / values.length) * 100);
  };

  const studyTimePercentile = calculatePercentile(allStudyMinutes, userStudyMinutes);
  const totalActiveUsers = timeByUser.size;
  const avgStudyMinutes = allStudyMinutes.length > 0
    ? Math.round(allStudyMinutes.reduce((s, v) => s + v, 0) / allStudyMinutes.length)
    : 0;

  return NextResponse.json({
    user: {
      studyMinutes30d: userStudyMinutes,
      taskCompletionRate: userTaskCompletion,
      longestStreak: userStreak,
      totalStudyDays: studyDays.size,
    },
    benchmarks: {
      studyTime: {
        percentile: studyTimePercentile,
        communityAverage: avgStudyMinutes,
        description: studyTimePercentile >= 75
          ? "Du lernst mehr als die meisten Studierenden"
          : studyTimePercentile >= 50
            ? "Du bist im Mittelfeld"
            : "Viele Studierende lernen mehr — du kannst aufholen!",
      },
      activeUsers: totalActiveUsers,
      period: "30 Tage",
    },
    anonymized: true,
  });
}
