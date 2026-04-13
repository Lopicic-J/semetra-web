/**
 * /api/flashcards/import-anki — Import Anki .apkg files
 *
 * .apkg files are ZIP archives containing a SQLite database (collection.anki2)
 * with notes and cards. We extract the front/back fields from notes.
 *
 * Since we can't run SQLite in Edge/Node easily, we parse the .apkg
 * by extracting it as ZIP and reading the SQLite db with sql.js.
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// sql.js will be loaded dynamically
let initSqlJs: (() => Promise<{ Database: new (data: Uint8Array) => SqlJsDatabase }>) | null = null;

interface SqlJsDatabase {
  exec: (sql: string) => Array<{ columns: string[]; values: unknown[][] }>;
  close: () => void;
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
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

    // Read the file as ArrayBuffer
    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    // .apkg is a ZIP file — we need to find collection.anki2 (or collection.anki21)
    // Use a simple approach: try to parse with sql.js directly (works for .anki2 format)
    // or extract from ZIP

    let cards: Array<{ front: string; back: string }> = [];

    try {
      // Try to dynamically import sql.js
      const sqlJsModule = await import("sql.js");
      const SQL = await sqlJsModule.default();

      // Try to decompress ZIP and find the SQLite database
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
      const db = new SQL.Database(dbData);

      // Anki stores notes in the `notes` table with `flds` column (fields separated by \x1f)
      // and models in `col` table's `models` JSON field
      try {
        const results = db.exec("SELECT flds FROM notes");
        if (results.length > 0) {
          for (const row of results[0].values) {
            const fields = String(row[0]).split("\x1f");
            if (fields.length >= 2) {
              const front = stripHtml(fields[0]).trim();
              const back = stripHtml(fields[1]).trim();
              if (front && back) {
                cards.push({ front, back });
              }
            }
          }
        }
      } finally {
        db.close();
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

/**
 * Strip HTML tags from Anki field content
 */
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
