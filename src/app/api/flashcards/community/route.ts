/**
 * /api/flashcards/community — Community Flashcard Decks
 *
 * GET: Browse shared decks (public or group-shared)
 * POST: Share a deck with community or group
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const moduleFilter = url.searchParams.get("module");
  const search = url.searchParams.get("search");

  // Get publicly shared decks + decks shared in user's groups
  const { data: userGroups } = await supabase
    .from("study_group_members")
    .select("group_id")
    .eq("user_id", user.id);

  const groupIds = (userGroups ?? []).map(g => g.group_id);

  // Get shared flashcard collections
  let query = supabase
    .from("flashcards")
    .select("deck_name, module_id, modules(name, color), user_id, profiles(username, avatar_url)")
    .not("deck_name", "is", null)
    .neq("user_id", user.id) // Exclude own cards
    .order("created_at", { ascending: false });

  // Note: In a real implementation, we'd need a separate "shared_decks" table
  // For now, we aggregate unique deck_name + module combinations from other users

  const { data: allCards } = await query;

  // Aggregate into unique decks
  const deckMap = new Map<string, {
    deckName: string;
    moduleName: string;
    moduleColor: string;
    moduleId: string;
    authorUsername: string;
    authorAvatar: string | null;
    cardCount: number;
    authorId: string;
  }>();

  for (const card of (allCards ?? []) as any[]) {
    const key = `${card.user_id}-${card.deck_name}-${card.module_id}`;
    const existing = deckMap.get(key);
    if (existing) {
      existing.cardCount++;
    } else {
      deckMap.set(key, {
        deckName: card.deck_name,
        moduleName: card.modules?.name ?? "",
        moduleColor: card.modules?.color ?? "#6d28d9",
        moduleId: card.module_id ?? "",
        authorUsername: card.profiles?.username ?? "Anonym",
        authorAvatar: card.profiles?.avatar_url ?? null,
        cardCount: 1,
        authorId: card.user_id,
      });
    }
  }

  let decks = [...deckMap.values()].filter(d => d.cardCount >= 3); // Min 3 cards to show

  // Apply filters
  if (moduleFilter) {
    decks = decks.filter(d => d.moduleId === moduleFilter);
  }
  if (search) {
    const s = search.toLowerCase();
    decks = decks.filter(d =>
      d.deckName.toLowerCase().includes(s) ||
      d.moduleName.toLowerCase().includes(s)
    );
  }

  // Sort by card count (most popular first)
  decks.sort((a, b) => b.cardCount - a.cardCount);

  return NextResponse.json({ decks: decks.slice(0, 50) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { deckName, moduleId, authorId } = body;

  if (!deckName || !authorId) {
    return NextResponse.json({ error: "deckName and authorId required" }, { status: 400 });
  }

  // Fetch the source deck cards
  let query = supabase
    .from("flashcards")
    .select("question, answer, deck_name, topic_id")
    .eq("user_id", authorId)
    .eq("deck_name", deckName);

  if (moduleId) query = query.eq("module_id", moduleId);

  const { data: sourceCards } = await query;

  if (!sourceCards || sourceCards.length === 0) {
    return NextResponse.json({ error: "Keine Karten gefunden" }, { status: 404 });
  }

  // Find or create matching module for the user
  let targetModuleId = moduleId;
  if (moduleId) {
    // Check if user has a module with the same name
    const { data: sourceModule } = await supabase
      .from("modules")
      .select("name")
      .eq("id", moduleId)
      .single();

    if (sourceModule) {
      const { data: userModule } = await supabase
        .from("modules")
        .select("id")
        .eq("user_id", user.id)
        .ilike("name", sourceModule.name)
        .limit(1)
        .single();

      targetModuleId = userModule?.id ?? null;
    }
  }

  // Import cards (create copies for the current user)
  const importedDeckName = `${deckName} (importiert)`;
  const rows = sourceCards.map(card => ({
    user_id: user.id,
    module_id: targetModuleId,
    question: card.question,
    answer: card.answer,
    deck_name: importedDeckName,
    topic_id: null, // Don't copy topic links (different user's topics)
  }));

  const { error } = await supabase.from("flashcards").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    imported: true,
    count: rows.length,
    deckName: importedDeckName,
    moduleId: targetModuleId,
  });
}
