import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("ai:conversation");

/**
 * GET /api/ai/conversations/[id]
 *
 * Get a conversation with all its messages.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = params;

    // Fetch conversation with explicit ownership check
    const { data: conversation, error: convErr } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json({ error: "Gespräch nicht gefunden" }, { status: 404 });
    }

    // Fetch messages
    const { data: messages, error: msgErr } = await supabase
      .from("chat_messages")
      .select("id, role, content, tokens_used, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (msgErr) {
      log.error("[conversation GET messages]", msgErr);
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    return NextResponse.json({ conversation, messages: messages || [] });
  } catch (err: unknown) {
    log.error("[conversation GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/ai/conversations/[id]
 *
 * Update conversation title.
 * Body: { title }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { title } = body;

    const { data, error } = await supabase
      .from("chat_conversations")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversation: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/ai/conversations/[id]
 *
 * Delete a conversation and all its messages.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 },
    );
  }
}
