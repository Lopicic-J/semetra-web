/**
 * /api/flashcards/import-shared — Copy a shared deck into user's collection
 *
 * POST: { shareId } → copies all cards from the shared deck
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shareId } = await req.json();
  if (!shareId) {
    return NextResponse.json({ error: "shareId required" }, { status: 400 });
  }

  // Get the share
  const { data: share } = await supabase
    .from("group_shares")
    .select("group_id, resource_name, resource_data")
    .eq("id", shareId)
    .eq("resource_type", "flashcard_deck")
    .single();

  if (!share) {
    return NextResponse.json({ error: "Shared deck not found" }, { status: 404 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", share.group_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not a group member" }, { status: 403 });
  }

  const data = share.resource_data as Record<string, unknown>;
  const cards = (data?.cards ?? []) as Array<{
    front: string;
    back: string;
    card_type: string;
    choices?: unknown;
    correct_answers?: unknown;
    tags?: unknown;
  }>;

  if (cards.length === 0) {
    return NextResponse.json({ error: "No cards in shared deck" }, { status: 400 });
  }

  const deckName = `${share.resource_name} (shared)`;

  const rows = cards.map((c) => ({
    user_id: user.id,
    deck_name: deckName,
    front: c.front,
    back: c.back,
    card_type: c.card_type || "basic",
    choices: c.choices ?? null,
    correct_answers: c.correct_answers ?? null,
    tags: c.tags ?? null,
    source: "user" as const,
    source_document: `Shared: ${share.resource_name}`,
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
  }));

  const { error: insertError } = await supabase.from("flashcards").insert(rows);

  if (insertError) {
    console.error("[import-shared] Error:", insertError);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    imported: rows.length,
    deckName,
  });
}
