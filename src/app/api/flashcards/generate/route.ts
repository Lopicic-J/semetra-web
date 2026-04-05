import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const log = logger("api:flashcards");

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
  if (!ANTHROPIC_API_KEY || !SUPABASE_SERVICE_KEY) {
    log.error("Missing env vars", { hasAnthropicKey: !!ANTHROPIC_API_KEY, hasServiceKey: !!SUPABASE_SERVICE_KEY });
    return NextResponse.json({ error: "KI-Service nicht konfiguriert. Bitte ANTHROPIC_API_KEY und SUPABASE_SERVICE_ROLE_KEY in .env.local setzen." }, { status: 500 });
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

  // ── AI Usage Check (server-side metering, weight=3 for flashcard generation) ──
  const { checkAndIncrementAiUsage } = await import("@/lib/ai-usage");
  const aiCheck = await checkAndIncrementAiUsage(user.id, "flashcards_generate");
  if (!aiCheck.allowed) {
    const msg = aiCheck.addonCredits === 0
      ? "KI-Kontingent aufgebraucht. Kaufe ein Add-on für weitere Requests."
      : "KI-Kontingent aufgebraucht.";
    return NextResponse.json({ error: msg, usage: aiCheck }, { status: 429 });
  }

  const body = await req.json();
  const { text, module_id, deck_name, filename, language = "de" } = body as {
    text: string;
    module_id?: string;
    deck_name?: string;
    filename?: string;
    language?: string;
  };

  if (!text || text.length < 50) {
    return NextResponse.json({ error: "Text too short (min. 50 characters)" }, { status: 400 });
  }

  const LANG_INSTRUCTIONS: Record<string, string> = {
    de: "Antworte auf Deutsch.", en: "Respond in English.", fr: "Réponds en français.",
    it: "Rispondi in italiano.", es: "Responde en español.", nl: "Antwoord in het Nederlands.",
  };
  const langInstr = LANG_INSTRUCTIONS[language] || LANG_INSTRUCTIONS.de;

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
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: `You are a study assistant for Swiss university students. Create flashcards from the given text. ${langInstr}

Rules:
- Create 10-25 flashcards depending on text length and content
- Each card has a clear question (front) and a precise answer (back)
- Questions should test understanding, not just recall facts
- Use simple, clear language in the requested language
- Mix different question types: definition, comparison, application, explanation
- Respond ONLY with a JSON array, no other text

Output format (STRICT JSON):
[{"front": "What is X?", "back": "X is..."}, ...]`,
        messages: [
          {
            role: "user",
            content: `Create flashcards from the following text:\n\n${truncated}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      log.error("Claude API error", err);
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
      log.error("Failed to parse Claude response", content);
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
      log.error("Insert error", insertError);
      return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
    }

    return NextResponse.json({
      cards: cardsJson,
      count: cardsJson.length,
      message: `${cardsJson.length} Karteikarten erstellt`,
    });
  } catch (err) {
    log.error("Generate flashcards error", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
