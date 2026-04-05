import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ActivityEvent {
  id: string;
  type: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  details: Record<string, unknown>;
}

/**
 * GET /api/groups/[id]/activity
 *
 * Fetch activity feed for a group (last 50 events).
 * Activity types: member_joined, member_left, resource_shared, resource_unshared, group_updated
 * Query params: limit (default 50)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    // Verify membership
    const { data: membership } = await supabase
      .from("study_group_members")
      .select("id")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .single();

    if (!membership) return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    // Fetch member join/leave events
    const { data: memberEvents } = await supabase
      .from("study_group_members")
      .select("id, user_id, joined_at, role, profiles(username, avatar_url)")
      .eq("group_id", id)
      .order("joined_at", { ascending: false })
      .limit(limit);

    // Fetch shared resource events
    const { data: shareEvents } = await supabase
      .from("group_shares")
      .select("id, shared_by, created_at, resource_type, resource_id, profiles!shared_by(username, avatar_url)")
      .eq("group_id", id)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Combine and sort events
    const events: ActivityEvent[] = [];

    if (memberEvents) {
      memberEvents.forEach(m => {
        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        events.push({
          id: `member-${m.id}`,
          type: "member_joined",
          user_id: m.user_id,
          username: profile?.username || "Unbekannt",
          avatar_url: profile?.avatar_url || null,
          created_at: m.joined_at,
          details: { role: m.role },
        });
      });
    }

    if (shareEvents) {
      shareEvents.forEach(s => {
        const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
        events.push({
          id: `share-${s.id}`,
          type: "resource_shared",
          user_id: s.shared_by,
          username: profile?.username || "Unbekannt",
          avatar_url: profile?.avatar_url || null,
          created_at: s.created_at,
          details: { resource_type: s.resource_type, resource_id: s.resource_id },
        });
      });
    }

    // Sort by created_at descending and limit
    events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const result = events.slice(0, limit);

    return NextResponse.json({ activities: result });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
