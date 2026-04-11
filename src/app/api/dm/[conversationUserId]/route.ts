import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/dm/[conversationUserId]
 * Get messages in a conversation with a specific user.
 * Query: ?limit=50&offset=0
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationUserId: string }> }
) {
  try {
    const { conversationUserId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    // Fetch messages between the two users
    const { data: messages, error } = await supabase
      .from("direct_messages")
      .select("id, sender_id, receiver_id, content, read_at, created_at, sender:profiles!direct_messages_sender_id_fkey(id, username, avatar_url)")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${conversationUserId}),and(sender_id.eq.${conversationUserId},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Mark unread messages from the other user as read
    await supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", conversationUserId)
      .eq("receiver_id", user.id)
      .is("read_at", null);

    // Get partner profile
    const { data: partner } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, full_name")
      .eq("id", conversationUserId)
      .single();

    return NextResponse.json({ messages: messages ?? [], partner });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * POST /api/dm/[conversationUserId]
 * Send a direct message to a user.
 * Body: { content: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationUserId: string }> }
) {
  try {
    const { conversationUserId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { content } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: "Nachricht darf nicht leer sein" }, { status: 400 });
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: "Nachricht zu lang (max. 5000 Zeichen)" }, { status: 400 });
    }

    // Verify they are friends
    const { data: friendship } = await supabase
      .from("friendships")
      .select("id, status")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${conversationUserId}),and(requester_id.eq.${conversationUserId},addressee_id.eq.${user.id})`
      )
      .eq("status", "accepted")
      .maybeSingle();

    if (!friendship) {
      return NextResponse.json({ error: "Du kannst nur Freunden Nachrichten senden" }, { status: 403 });
    }

    const { data: message, error } = await supabase
      .from("direct_messages")
      .insert({
        sender_id: user.id,
        receiver_id: conversationUserId,
        content: content.trim(),
      })
      .select("id, sender_id, receiver_id, content, created_at, sender:profiles!direct_messages_sender_id_fkey(id, username, avatar_url)")
      .single();

    if (error) throw error;

    return NextResponse.json({ message }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
