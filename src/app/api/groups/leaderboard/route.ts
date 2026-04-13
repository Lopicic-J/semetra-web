/**
 * /api/groups/leaderboard — Group leaderboard endpoint
 *
 * Returns anonymized or named rankings for a specific group.
 * Metrics: study_hours (last 7 days), current_streak, total_sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
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
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, role")
    .eq("group_id", groupId);

  if (!members || members.length === 0) {
    return NextResponse.json({ leaderboard: [] });
  }

  const memberIds = members.map((m) => m.user_id);

  // Get profiles (for display names)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", memberIds);

  // Get study time for last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: timeLogs } = await supabase
    .from("time_logs")
    .select("user_id, duration")
    .in("user_id", memberIds)
    .gte("date", weekAgo.toISOString().slice(0, 10));

  // Get streaks
  const { data: streaks } = await supabase
    .from("streaks")
    .select("user_id, current_streak, longest_streak")
    .in("user_id", memberIds);

  // Aggregate
  const leaderboard = memberIds.map((uid) => {
    const profile = profiles?.find((p) => p.id === uid);
    const logs = timeLogs?.filter((l) => l.user_id === uid) ?? [];
    const streak = streaks?.find((s) => s.user_id === uid);

    const totalMinutes = logs.reduce((sum, l) => sum + (l.duration ?? 0), 0);

    return {
      userId: uid,
      isMe: uid === user.id,
      displayName:
        profile?.username || profile?.full_name?.split(" ")[0] || "Anonym",
      avatarUrl: profile?.avatar_url,
      studyMinutes7d: totalMinutes,
      studyHours7d: Math.round((totalMinutes / 60) * 10) / 10,
      currentStreak: streak?.current_streak ?? 0,
      longestStreak: streak?.longest_streak ?? 0,
      sessions7d: logs.length,
    };
  });

  // Sort by study hours descending
  leaderboard.sort((a, b) => b.studyMinutes7d - a.studyMinutes7d);

  // Add rank
  const ranked = leaderboard.map((entry, i) => ({
    ...entry,
    rank: i + 1,
  }));

  return NextResponse.json({ leaderboard: ranked });
}
