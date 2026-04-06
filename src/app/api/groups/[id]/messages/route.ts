import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface MessageData {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  reply_to: string | null;
  edited_at: string | null;
  created_at: string;
  username: string;
  avatar_url: string | null;
}

/**
 * GET /api/groups/[id]/messages
 *
 * Fetch messages with pagination (limit/offset).
 * Query params: limit (default 50, max 100), offset (default 0)
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
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);

    const { data: messages, error } = await supabase
      .from("group_messages")
      .select("id, group_id, user_id, content, reply_to, edited_at, created_at, profiles(username, avatar_url)")
      .eq("group_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = (messages || []).map((m: any) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return {
        id: m.id,
        group_id: m.group_id,
        user_id: m.user_id,
        content: m.content,
        reply_to: m.reply_to,
        edited_at: m.edited_at,
        created_at: m.created_at,
        username: profile?.username || "Unbekannt",
        avatar_url: profile?.avatar_url || null,
      } as MessageData;
    });

    // Reverse to get chronological order
    result.reverse();

    return NextResponse.json({ messages: result });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * POST /api/groups/[id]/messages
 *
 * Send a message to the group.
 * Body: { content, reply_to? }
 */
export async function POST(
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

    const { content, reply_to } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content erforderlich" }, { status: 400 });
    }

    const trimmed = content.trim();
    if (trimmed.length === 0 || trimmed.length > 2000) {
      return NextResponse.json({ error: "Nachricht muss zwischen 1 und 2000 Zeichen sein" }, { status: 400 });
    }

    const { data: message, error } = await supabase
      .from("group_messages")
      .insert({
        group_id: id,
        user_id: user.id,
        content: trimmed,
        reply_to: reply_to || null,
      })
      .select("id, group_id, user_id, content, reply_to, edited_at, created_at, profiles(username, avatar_url)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const profile = Array.isArray(message.profiles) ? message.profiles[0] : message.profiles;
    const result: MessageData = {
      id: message.id,
      group_id: message.group_id,
      user_id: message.user_id,
      content: message.content,
      reply_to: message.reply_to,
      edited_at: message.edited_at,
      created_at: message.created_at,
      username: profile?.username || "Unbekannt",
      avatar_url: profile?.avatar_url || null,
    };

    return NextResponse.json({ message: result });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
