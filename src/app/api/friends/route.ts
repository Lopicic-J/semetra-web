import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/friends
 * List all friends & pending requests for the current user.
 * Query params: ?status=accepted|pending|all (default: all)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const status = req.nextUrl.searchParams.get("status") || "all";

    let query = supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status, created_at, updated_at, requester:profiles!friendships_requester_id_fkey(id, username, avatar_url, full_name), addressee:profiles!friendships_addressee_id_fkey(id, username, avatar_url, full_name)")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Transform: identify which side is the "friend" (the other person)
    const friendships = (data ?? []).map(f => {
      const isRequester = f.requester_id === user.id;
      return {
        id: f.id,
        status: f.status,
        created_at: f.created_at,
        updated_at: f.updated_at,
        direction: isRequester ? "outgoing" : "incoming",
        friend: isRequester ? f.addressee : f.requester,
      };
    });

    return NextResponse.json({ friendships });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * POST /api/friends
 * Send a friend request.
 * Body: { username: string } or { userId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const body = await req.json();
    let targetId = body.userId;

    // If username provided, look up the user
    if (!targetId && body.username) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", body.username.trim())
        .single();

      if (!profile) {
        return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
      }
      targetId = profile.id;
    }

    if (!targetId) {
      return NextResponse.json({ error: "userId oder username erforderlich" }, { status: 400 });
    }

    if (targetId === user.id) {
      return NextResponse.json({ error: "Du kannst dich nicht selbst als Freund hinzufügen" }, { status: 400 });
    }

    // Check if friendship already exists in either direction
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status, requester_id")
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${user.id})`)
      .maybeSingle();

    if (existing) {
      if (existing.status === "accepted") {
        return NextResponse.json({ error: "Ihr seid bereits befreundet" }, { status: 409 });
      }
      if (existing.status === "pending") {
        // If the other person already sent us a request, auto-accept
        if (existing.requester_id === targetId) {
          const { error: updateErr } = await supabase
            .from("friendships")
            .update({ status: "accepted", updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (updateErr) throw updateErr;
          return NextResponse.json({ message: "Freundschaftsanfrage angenommen!", status: "accepted" });
        }
        return NextResponse.json({ error: "Anfrage bereits gesendet" }, { status: 409 });
      }
      if (existing.status === "blocked") {
        return NextResponse.json({ error: "Aktion nicht möglich" }, { status: 403 });
      }
      // If declined, allow re-sending by updating
      if (existing.status === "declined") {
        const { error: updateErr } = await supabase
          .from("friendships")
          .update({ status: "pending", requester_id: user.id, addressee_id: targetId, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (updateErr) throw updateErr;
        return NextResponse.json({ message: "Freundschaftsanfrage erneut gesendet" });
      }
    }

    // Create new friendship request
    const { data: friendship, error } = await supabase
      .from("friendships")
      .insert({ requester_id: user.id, addressee_id: targetId, status: "pending" })
      .select("id, status, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ friendship, message: "Freundschaftsanfrage gesendet" }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
