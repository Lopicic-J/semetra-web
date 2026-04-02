import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * POST /api/flashcards/generate
 *
 * Accepts a document (text content) and generates flashcards using Claude.
 * Requires authentication via Supabase auth token.
 *
 * Body: { text: string, module_id?: string, deck_name?: string, filename?: string }
 * Returns: { cards: Array<{ front: string, back: string }> }
 */
export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI nicht konfiguriert" }, { status: 500 });
  }

  // Auth check
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  // KI-Features sind Beta — free für alle User
  // Wird zu Pro hochgestuft wenn echter Mehrwert vorhanden

  const body = await req.json();
  const { text, module_id, deck_name, filename } = body as {
    text: string;
    module_id?: string;
    deck_name?: string;
    filename?: string;
  };

  if (!text || text.length < 50) {
    return NextResponse.json({ error: "Text zu kurz (min. 50 Zeichen)" }, { status: 400 });
  }

  // Truncate very long texts
  const maxChars = 12000;
  const truncated = text.length > maxChars ? text.slice(0, maxChars) + "\n[...]" : text;

  try {
    // Call Claude API
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: `Du bist ein Lernassistent für Schweizer FH-Studierende. Erstelle Karteikarten aus dem gegebenen Text.

Regeln:
- Erstelle 10-25 Karteikarten je nach Textlänge und Inhalt
- Jede Karte hat eine klare Frage (front) und eine präzise Antwort (back)
- Fragen sollen das Verständnis testen, nicht nur Fakten abfragen
- Verwende einfache, klare Sprache (Deutsch)
- Mische verschiedene Fragetypen: Definition, Vergleich, Anwendung, Erklärung
- Antworte NUR mit einem JSON-Array, kein anderer Text

Ausgabeformat (STRIKT JSON):
[{"front": "Was ist X?", "back": "X ist..."}, ...]`,
        messages: [
          {
            role: "user",
            content: `Erstelle Karteikarten aus folgendem Text:\n\n${truncated}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Claude API error:", err);
      return NextResponse.json({ error: "KI-Fehler" }, { status: 502 });
    }

    const data = await res.json();
    const content = data.content?.[0]?.text ?? "";

    // Parse JSON from response (handle markdown code blocks)
    let cardsJson: Array<{ front: string; back: string }>;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      cardsJson = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Claude response:", content);
      return NextResponse.json({ error: "KI-Antwort konnte nicht verarbeitet werden" }, { status: 502 });
    }

    if (!Array.isArray(cardsJson) || cardsJson.length === 0) {
      return NextResponse.json({ error: "Keine Karteikarten generiert" }, { status: 502 });
    }

    // Insert into Supabase
    const rows = cardsJson.map((c) => ({
      user_id: user.id,
      module_id: module_id || null,
      deck_name: deck_name || filename || "KI-generiert",
      front: c.front,
      back: c.back,
      source: "ai",
      source_document: filename || "Dokument",
    }));

    const { error: insertError } = await supabase.from("flashcards").insert(rows);
    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
    }

    return NextResponse.json({
      cards: cardsJson,
      count: cardsJson.length,
      message: `${cardsJson.length} Karteikarten erstellt`,
    });
  } catch (err) {
    console.error("Generate flashcards error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
