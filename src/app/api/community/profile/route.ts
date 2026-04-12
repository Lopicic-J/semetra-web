import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/api-helpers";

/**
 * GET /api/community/profile?user_id=...
 *
 * Returns a public profile for a community member.
 * Only returns data the user has opted to share (community_visible = true).
 * Includes leaderboard rank, degree level, achievements, and study stats.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetId = req.nextUrl.searchParams.get("user_id");
  if (!targetId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const db = createServiceClient();

  // Get the target user's profile
  const { data: target, error } = await db
    .from("profiles")
    .select(`
      id, username, full_name, avatar_url,
      institution_id, active_program_id,
      current_semester, study_mode, user_role,
      language, plan, xp_total, level,
      online_status, community_visible,
      created_at
    `)
    .eq("id", targetId)
    .single();

  if (error || !target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Respect privacy — if community_visible is false and not the user themselves
  if (!target.community_visible && target.id !== user.id) {
    return NextResponse.json({ error: "Profile is private" }, { status: 403 });
  }

  // Get institution name
  let institutionName: string | null = null;
  if (target.institution_id) {
    const { data: inst } = await db
      .from("institutions")
      .select("name")
      .eq("id", target.institution_id)
      .single();
    institutionName = inst?.name ?? null;
  }

  // Get program with degree_level
  let programName: string | null = null;
  let degreeLevel: string | null = null;
  if (target.active_program_id) {
    const { data: prog } = await db
      .from("programs")
      .select("name, degree_level")
      .eq("id", target.active_program_id)
      .single();
    programName = prog?.name ?? null;
    degreeLevel = prog?.degree_level ?? null;
  }

  // Get leaderboard rank via RPC
  let rank: number | null = null;
  const { data: rankData } = await supabase
    .rpc("get_user_rank", { user_id: targetId });
  if (rankData?.[0]?.rank) {
    rank = rankData[0].rank;
  }

  // Get achievement count
  const { count: achievementCount } = await db
    .from("user_achievements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", targetId);

  // Get study stats: total study time, module count, streak
  const { data: timerStats } = await db
    .from("timer_sessions")
    .select("duration")
    .eq("user_id", targetId);

  const totalStudyMinutes = (timerStats || []).reduce(
    (sum: number, s: any) => sum + (s.duration || 0), 0
  );

  const { count: moduleCount } = await db
    .from("modules")
    .select("id", { count: "exact", head: true })
    .eq("user_id", targetId)
    .is("hidden_at", null);

  // Check friendship status
  let friendshipStatus: string | null = null;
  const { data: friendship } = await db
    .from("friends")
    .select("status, sender_id")
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${user.id})`)
    .maybeSingle();

  if (friendship) {
    friendshipStatus = friendship.status;
  }

  // Member since (formatted)
  const memberSince = target.created_at;

  return NextResponse.json({
    profile: {
      id: target.id,
      username: target.username,
      full_name: target.full_name,
      avatar_url: target.avatar_url,
      institution_name: institutionName,
      program_name: programName,
      degree_level: degreeLevel,
      current_semester: target.current_semester,
      study_mode: target.study_mode,
      user_role: target.user_role,
      language: target.language,
      plan: target.plan,
      xp_total: target.xp_total,
      level: target.level,
      online_status: target.online_status,
      member_since: memberSince,
    },
    stats: {
      rank,
      achievements: achievementCount ?? 0,
      total_study_hours: Math.round((totalStudyMinutes / 60) * 10) / 10,
      module_count: moduleCount ?? 0,
    },
    friendship_status: friendshipStatus,
  });
}
