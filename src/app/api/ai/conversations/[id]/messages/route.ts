import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("ai:messages");

/**
 * POST /api/ai/conversations/[id]/messages
 *
 * Add a message to a conversation.
 * Body: { role: "user" | "assistant", content: string, tokens_used?: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const conversationId = params.id;
    const body = await req.json();
    const { role, content, tokens_used } = body;

    if (!role || !content) {
      return NextResponse.json({ error: "role und content erforderlich" }, { status: 400 });
    }

    // Verify conversation ownership
    const { data: conv } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("id", conversationId)
      .single();

    if (!conv) {
      return NextResponse.json({ error: "Gespräch nicht gefunden" }, { status: 404 });
    }

    // Insert message
    const { data: message, error: msgErr } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        role,
        content,
        tokens_used: tokens_used || 0,
      })
      .select()
      .single();

    if (msgErr) {
      log.error("[messages POST]", msgErr);
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    // Update conversation metadata
    await supabase
      .from("chat_conversations")
      .update({
        message_count: (await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversationId)).count || 0,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Auto-title from first user message
        ...(role === "user" ? {
          title: content.slice(0, 60) + (content.length > 60 ? "…" : ""),
        } : {}),
      })
      .eq("id", conversationId);

    return NextResponse.json({ message }, { status: 201 });
  } catch (err: unknown) {
    log.error("[messages POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 },
    );
  }
}
