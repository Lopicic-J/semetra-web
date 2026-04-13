/**
 * /api/flashcards/share — Share flashcard decks within groups
 *
 * POST: Share a deck to a group (copies cards for all members)
 * GET:  List shared decks available in user's groups
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface CardRow { front: string; back: string; card_type: string; choices: unknown; correct_answers: unknown; tags: unknown }
interface MembershipRow { group_id: string }
interface ShareRow { id: string; group_id: string; shared_by: string; resource_name: string; resource_data: Record<string, unknown>; created_at: string }
interface GroupRow { id: string; name: string }

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deckName, groupId } = await req.json();
  if (!deckName || !groupId) {
    return NextResponse.json({ error: "deckName and groupId required" }, { status: 400 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not a group member" }, { status: 403 });
  }

  // Get the deck cards
  const { data: cardsRaw } = await supabase
    .from("flashcards")
    .select("front, back, card_type, choices, correct_answers, tags")
    .eq("user_id", user.id)
    .eq("deck_name", deckName);

  const cards = (cardsRaw ?? []) as CardRow[];
  if (cards.length === 0) {
    return NextResponse.json({ error: "Deck not found or empty" }, { status: 404 });
  }

  // Get user profile for attribution
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name")
    .eq("id", user.id)
    .single();

  const sharedBy = profile?.username || profile?.full_name || "Anonym";

  // Store as a group share resource
  const { error: shareError } = await supabase.from("group_shares").insert({
    group_id: groupId,
    shared_by: user.id,
    resource_type: "flashcard_deck",
    resource_name: deckName,
    resource_data: {
      cards: cards.map((c: CardRow) => ({
        front: c.front,
        back: c.back,
        card_type: c.card_type,
        choices: c.choices,
        correct_answers: c.correct_answers,
        tags: c.tags,
      })),
      sharedBy,
      cardCount: cards.length,
    },
  });

  if (shareError) {
    console.error("[flashcard-share] Error:", shareError);
    return NextResponse.json({ error: "Share failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    cardCount: cards.length,
    deckName,
  });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get user's group IDs
  const { data: membershipsRaw } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);

  const memberships = (membershipsRaw ?? []) as MembershipRow[];
  if (memberships.length === 0) {
    return NextResponse.json({ decks: [] });
  }

  const groupIds = memberships.map((m: MembershipRow) => m.group_id);

  // Get shared flashcard decks
  const { data: sharesRaw } = await supabase
    .from("group_shares")
    .select("id, group_id, shared_by, resource_name, resource_data, created_at")
    .eq("resource_type", "flashcard_deck")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false })
    .limit(50);
  const shares = (sharesRaw ?? []) as ShareRow[];

  // Get group names
  const { data: groupsRaw } = await supabase
    .from("groups")
    .select("id, name")
    .in("id", groupIds);
  const groups = (groupsRaw ?? []) as GroupRow[];

  const groupMap = new Map(groups.map((g: GroupRow) => [g.id, g.name]));

  const decks = shares.map((s: ShareRow) => ({
    id: s.id,
    deckName: s.resource_name,
    groupId: s.group_id,
    groupName: groupMap.get(s.group_id) ?? "—",
    sharedBy: s.resource_data?.sharedBy ?? "Anonym",
    cardCount: s.resource_data?.cardCount ?? 0,
    createdAt: s.created_at,
    isOwn: s.shared_by === user.id,
  }));

  return NextResponse.json({ decks });
}
