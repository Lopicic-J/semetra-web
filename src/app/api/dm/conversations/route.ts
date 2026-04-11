import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/dm/conversations
 * List all DM conversations for the current user (latest message per conversation).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    // Get all DMs involving the user, ordered by newest first
    const { data: messages, error } = await supabase
      .from("direct_messages")
      .select("id, sender_id, receiver_id, content, read_at, created_at, sender:profiles!direct_messages_sender_id_fkey(id, username, avatar_url, full_name), receiver:profiles!direct_messages_receiver_id_fkey(id, username, avatar_url, full_name)")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Group by conversation partner and take the latest message
    const conversationMap = new Map<string, {
      partnerId: string;
      partner: { id: string; username: string; avatar_url: string | null; full_name: string | null };
      lastMessage: { id: string; content: string; created_at: string; read_at: string | null; isMine: boolean };
      unreadCount: number;
    }>();

    for (const msg of messages ?? []) {
      const isMine = msg.sender_id === user.id;
      const partnerId = isMine ? msg.receiver_id : msg.sender_id;
      const partnerRaw = isMine ? msg.receiver : msg.sender;
      // Supabase FK joins may return array or object; normalize
      const partner = Array.isArray(partnerRaw) ? partnerRaw[0] : partnerRaw;

      if (!partner || !conversationMap.has(partnerId)) {
        if (!partner) continue;
        conversationMap.set(partnerId, {
          partnerId,
          partner: partner as unknown as { id: string; username: string; avatar_url: string | null; full_name: string | null },
          lastMessage: {
            id: msg.id,
            content: msg.content,
            created_at: msg.created_at,
            read_at: msg.read_at,
            isMine,
          },
          unreadCount: 0,
        });
      }

      // Count unread messages from others
      if (!isMine && !msg.read_at) {
        const conv = conversationMap.get(partnerId)!;
        conv.unreadCount++;
      }
    }

    const conversations = Array.from(conversationMap.values());

    return NextResponse.json({ conversations });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
