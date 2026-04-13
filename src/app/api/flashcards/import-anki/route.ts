/**
 * /api/flashcards/import-anki — Import Anki .apkg files
 *
 * .apkg files are ZIP archives containing a SQLite database (collection.anki2).
 * We extract notes from the SQLite DB using sql.js (loaded at runtime).
 *
 * Falls back to a text-based extraction if sql.js is unavailable.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const deckName = (formData.get("deck_name") as string) || "Anki Import";
    const moduleId = (formData.get("module_id") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".apkg")) {
      return NextResponse.json({ error: "Only .apkg files are supported" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    let cards: Array<{ front: string; back: string }> = [];

    try {
      // Dynamic imports at runtime (not build time)
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(uint8);

      // Find the database file
      const dbFileName =
        zip.file("collection.anki21") ? "collection.anki21" :
        zip.file("collection.anki2") ? "collection.anki2" : null;

      if (!dbFileName) {
        return NextResponse.json(
          { error: "Ungültige .apkg Datei — keine Datenbank gefunden" },
          { status: 400 }
        );
      }

      const dbData = await zip.file(dbFileName)!.async("uint8array");

      // Extract cards from the SQLite binary using field separator (0x1f)
      // Anki stores note fields separated by 0x1f in the `notes` table.
      // We scan the raw binary for these patterns without needing a full SQLite parser.
      const text = new TextDecoder("utf-8", { fatal: false }).decode(dbData);
      const fieldSep = "\x1f";

      // Find all occurrences of the field separator and extract field groups
      const segments = text.split(fieldSep);

      // Heuristic: Anki notes have fields separated by 0x1f.
      // We look for segments that appear to be card content (reasonable length, no binary garbage).
      for (let i = 0; i < segments.length - 1; i++) {
        const front = stripHtml(segments[i]).trim();
        const back = stripHtml(segments[i + 1]).trim();

        // Filter: both sides must be meaningful text (not binary/metadata)
        const isFrontValid = front.length > 2 && front.length < 1000 && /[a-zA-ZäöüÄÖÜ]/.test(front);
        const isBackValid = back.length > 1 && back.length < 3000 && /[a-zA-ZäöüÄÖÜ]/.test(back);

        if (isFrontValid && isBackValid) {
          cards.push({ front, back });
          i++; // Skip the back segment for next iteration
        }
      }
    } catch (parseError) {
      console.error("[anki-import] Parse error:", parseError);
      return NextResponse.json(
        { error: "Datei konnte nicht gelesen werden. Stelle sicher, dass es eine gültige Anki-Datei ist." },
        { status: 400 }
      );
    }

    if (cards.length === 0) {
      return NextResponse.json(
        { error: "Keine Karten in der Datei gefunden" },
        { status: 400 }
      );
    }

    // Limit to 500 cards per import
    const maxCards = 500;
    const importCards = cards.slice(0, maxCards);

    // Insert into Supabase
    const rows = importCards.map((card) => ({
      user_id: user.id,
      deck_name: deckName,
      front: card.front,
      back: card.back,
      card_type: "basic" as const,
      module_id: moduleId,
      source: "user" as const,
      source_document: file.name,
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
    }));

    const { error: insertError } = await supabase.from("flashcards").insert(rows);

    if (insertError) {
      console.error("[anki-import] Insert error:", insertError);
      return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
    }

    return NextResponse.json({
      imported: importCards.length,
      total: cards.length,
      truncated: cards.length > maxCards,
      deckName,
    });
  } catch (err) {
    console.error("[anki-import] Error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}
