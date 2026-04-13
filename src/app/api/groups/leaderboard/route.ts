/**
 * /api/groups/leaderboard — Group leaderboard endpoint
 *
 * Returns anonymized or named rankings for a specific group.
 * Metrics: study_hours (last 7 days), current_streak, total_sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface MemberRow { user_id: string; role: string }
interface ProfileRow { id: string; username: string | null; full_name: string | null; avatar_url: string | null }
interface TimeLogRow { user_id: string; duration: number }
interface StreakRow { user_id: string; current_streak: number; longest_streak: number }

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groupId = req.nextUrl.searchParams.get("group_id");
  if (!groupId) return NextResponse.json({ error: "group_id required" }, { status: 400 });

  // Verify user is member of this group
  const { data: membership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  // Get all group members
  const { data: membersRaw } = await supabase
    .from("group_members")
    .select("user_id, role")
    .eq("group_id", groupId);

  const members = (membersRaw ?? []) as MemberRow[];
  if (members.length === 0) {
    return NextResponse.json({ leaderboard: [] });
  }

  const memberIds = members.map((m: MemberRow) => m.user_id);

  // Get profiles (for display names)
  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", memberIds);
  const profiles = (profilesRaw ?? []) as ProfileRow[];

  // Get study time for last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: timeLogsRaw } = await supabase
    .from("time_logs")
    .select("user_id, duration")
    .in("user_id", memberIds)
    .gte("date", weekAgo.toISOString().slice(0, 10));
  const timeLogs = (timeLogsRaw ?? []) as TimeLogRow[];

  // Get streaks
  const { data: streaksRaw } = await supabase
    .from("streaks")
    .select("user_id, current_streak, longest_streak")
    .in("user_id", memberIds);
  const streakData = (streaksRaw ?? []) as StreakRow[];

  // Aggregate
  const leaderboard = memberIds.map((uid: string) => {
    const profile = profiles.find((p: ProfileRow) => p.id === uid);
    const logs = timeLogs.filter((l: TimeLogRow) => l.user_id === uid);
    const streak = streakData.find((s: StreakRow) => s.user_id === uid);

    const totalMinutes = logs.reduce((sum: number, l: TimeLogRow) => sum + (l.duration ?? 0), 0);

    return {
      userId: uid,
      isMe: uid === user.id,
      displayName:
        profile?.username || profile?.full_name?.split(" ")[0] || "Anonym",
      avatarUrl: profile?.avatar_url ?? null,
      studyMinutes7d: totalMinutes,
      studyHours7d: Math.round((totalMinutes / 60) * 10) / 10,
      currentStreak: streak?.current_streak ?? 0,
      longestStreak: streak?.longest_streak ?? 0,
      sessions7d: logs.length,
    };
  });

  // Sort by study hours descending
  leaderboard.sort((a: { studyMinutes7d: number }, b: { studyMinutes7d: number }) => b.studyMinutes7d - a.studyMinutes7d);

  // Add rank
  const ranked = leaderboard.map((entry: typeof leaderboard[0], i: number) => ({
    ...entry,
    rank: i + 1,
  }));

  return NextResponse.json({ leaderboard: ranked });
}
