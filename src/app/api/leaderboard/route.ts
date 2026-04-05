import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const log = logger("api:leaderboard");

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const scope = searchParams.get("scope") || "global";

    // For now, we only support global scope
    // Fetch top users by XP
    const { data: topUsers, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, xp_total, level")
      .gt("xp_total", 0)
      .order("xp_total", { ascending: false })
      .limit(limit);

    if (error) {
      log.error("[leaderboard] fetch error", error);
      return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
    }

    // Get current user's rank
    const { data: userRankData, error: rankError } = await supabase
      .rpc("get_user_rank", { user_id: user.id });

    if (rankError) {
      log.error("[leaderboard] rank error", rankError);
    }

    const userRank = userRankData?.[0]?.rank || null;

    // Get current user's profile for comparison
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, xp_total, level")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      leaderboard: topUsers || [],
      currentUser: userProfile,
      userRank: userRank,
      scope,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    log.error("[leaderboard] error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
