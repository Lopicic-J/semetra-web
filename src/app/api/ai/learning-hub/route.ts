/**
 * /api/ai/learning-hub — AI-Generated Module Learning Hub
 *
 * GET ?moduleId=<uuid>: Get cached learning hub content (or generate if missing)
 * POST: Force regenerate learning hub for a module
 *
 * Returns:
 * - overview: summary, prerequisites, learningGoals, realWorldUse
 * - topicGuide: ordered topic explanations with relevance + difficulty
 * - conceptCards: interactive cards with definition, example, application
 * - quickStart: top 3 priorities, recommended order, tips
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Vercel Pro: 60s timeout for AI generation
export const maxDuration = 60;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const moduleId = url.searchParams.get("moduleId");
  if (!moduleId) return NextResponse.json({ error: "moduleId required" }, { status: 400 });

  // Check cache first
  const { data: cached } = await supabase
    .from("learning_hub_cache")
    .select("*")
    .eq("user_id", user.id)
    .eq("module_id", moduleId)
    .single();

  if (cached) {
    return NextResponse.json({
      overview: cached.overview,
      topicGuide: cached.topic_guide,
      conceptCards: cached.concept_cards,
      quickStart: cached.quick_start,
      generatedAt: cached.generated_at,
      cached: true,
    });
  }

  // Not cached — generate fresh
  try {
    return await generateAndCache(supabase, user.id, moduleId);
  } catch (err) {
    console.error("[learning-hub] Uncaught error in generateAndCache:", err);
    return NextResponse.json({ error: `Interner Fehler: ${err instanceof Error ? err.message : "Unbekannt"}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { moduleId } = body;
  if (!moduleId) return NextResponse.json({ error: "moduleId required" }, { status: 400 });

  try {
    return await generateAndCache(supabase, user.id, moduleId);
  } catch (err) {
    console.error("[learning-hub] Uncaught error in generateAndCache:", err);
    return NextResponse.json({ error: `Interner Fehler: ${err instanceof Error ? err.message : "Unbekannt"}` }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateAndCache(supabase: any, userId: string, moduleId: string) {
  // Check for pre-configured template (institution modules)
  // Templates are stored per module_code so all students with the same module get identical content
  const { data: mod } = await supabase
    .from("modules")
    .select("name, code, ects")
    .eq("id", moduleId)
    .single();

  if (!mod) return NextResponse.json({ error: "Modul nicht gefunden" }, { status: 404 });

  // Look for pre-configured content by module code (shared across all users)
  if (mod.code) {
    const { data: template } = await supabase
      .from("learning_hub_templates")
      .select("overview, topic_guide, concept_cards, quick_start")
      .eq("module_code", mod.code)
      .single();

    if (template && (template.overview || template.topic_guide)) {
      // Cache the template for this user and return
      await supabase.from("learning_hub_cache").upsert({
        user_id: userId,
        module_id: moduleId,
        overview: template.overview,
        topic_guide: template.topic_guide,
        concept_cards: template.concept_cards,
        quick_start: template.quick_start,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,module_id" });

      return NextResponse.json({
        overview: template.overview,
        topicGuide: template.topic_guide,
        conceptCards: template.concept_cards,
        quickStart: template.quick_start,
        generatedAt: new Date().toISOString(),
        cached: false,
        template: true,
      });
    }
  }

  // No template found — generate via AI
  // Simple credit deduction (saves ~3 seconds vs full RPC)
  try {
    const month = new Date().toISOString().slice(0, 7);
    await supabase.from("ai_usage").upsert(
      { user_id: userId, month, used: 3 },
      { onConflict: "user_id,month" }
    );
  } catch {
    // Non-critical — don't block generation for credit tracking
  }

  const { data: topicsData } = await supabase
    .from("topics")
    .select("title")
    .eq("module_id", moduleId)
    .limit(20);

  const topics = topicsData ?? [];
  const topicList = topics.map((t: any) => t.title).join(", ");

  const systemPrompt = `Du bist ein Universitätsdozent. Erstelle eine Lernumgebung für "${mod.name}".
${topics.length > 0 ? `Topics: ${topicList}` : ""}

Erstelle eine umfassende Lernumgebung als JSON-Objekt mit diesen 4 Bereichen:

1. overview: summary (3-4 Sätze was das Fach ist und warum es wichtig ist), prerequisites (Array mit 3-4 Voraussetzungen), learningGoals (Array mit 4-5 Lernzielen), realWorldUse (2 Sätze Praxisbezug)
2. topicGuide: Array mit 8-10 Einträgen sortiert nach empfohlener Lernreihenfolge. Jeder Eintrag hat: title, explanation (2-3 Sätze verständliche Erklärung), relevance (warum wichtig), difficulty ("beginner" oder "intermediate" oder "advanced"), order (Nummer)
3. conceptCards: Array mit 6-8 Karten für die wichtigsten Konzepte. Jede Karte hat: title, definition (klare Definition), example (konkretes Alltagsbeispiel), application (wo angewendet), optional keyFormula (wichtige Formel)
4. quickStart: topThree (Array mit 3 Einträgen: title/why/howLong), recommendedOrder (Array mit Topic-Reihenfolge), tips (Array mit 3 konkreten Lerntipps)

Regeln:
- Erkläre alles so, dass ein Neuling es versteht
- Nutze Alltagsbeispiele und Analogien
- Antworte auf Deutsch
- KEIN Prüfungsbezug — nur allgemeines Fachverständnis
- Antworte NUR mit dem JSON-Objekt`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI nicht konfiguriert" }, { status: 500 });

    // Non-streaming call — simpler and more reliable than SSE parsing
    // Vercel Pro gives 60s timeout, pipeline takes ~30s
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: `Erstelle als JSON: {"overview":{"summary":"...","prerequisites":["..."],"learningGoals":["..."],"realWorldUse":"..."},"topicGuide":[{"title":"...","explanation":"...","difficulty":"beginner","order":1}],"conceptCards":[{"title":"...","definition":"...","example":"...","application":"..."}],"quickStart":{"topThree":[{"title":"...","why":"...","howLong":"~2h"}],"tips":["..."]}}. 6 topicGuide, 5 conceptCards. Deutsch. NUR JSON, keine Erklärungen.` }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[learning-hub] API error:", res.status, errBody);
      return NextResponse.json({
        error: res.status === 429
          ? "AI-Rate-Limit erreicht. Versuche es in einer Minute erneut."
          : "AI-Generierung fehlgeschlagen. Versuche es erneut.",
      }, { status: res.status === 429 ? 429 : 502 });
    }

    const response = await res.json();
    const rawText = response.content?.[0]?.text ?? "";

    if (!rawText) {
      console.error("[learning-hub] Empty AI response");
      return NextResponse.json({ error: "AI hat keine Antwort generiert" }, { status: 502 });
    }

    // If response was truncated (max_tokens hit), the JSON will be incomplete
    if (response.stop_reason === "max_tokens") {
      console.error("[learning-hub] Response truncated at max_tokens, length:", rawText.length);
    }

    let result;
    try {
      // Strategy 1: Direct JSON parse
      result = JSON.parse(rawText);
    } catch {
      try {
        // Strategy 2: Extract from markdown code block
        const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch?.[1]) {
          result = JSON.parse(codeBlockMatch[1]);
        } else {
          // Strategy 3: Find first { and last } in the text
          const firstBrace = rawText.indexOf("{");
          const lastBrace = rawText.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            result = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
          } else {
            throw new Error("No JSON found in response");
          }
        }
      } catch (parseErr) {
        console.error("[learning-hub] JSON parse failed:", (parseErr as Error).message, "| length:", rawText.length, "| preview:", rawText.slice(0, 300));
        return NextResponse.json({
          error: "AI-Antwort konnte nicht verarbeitet werden. Versuche 'Neu generieren'.",
        }, { status: 502 });
      }
    }

    // Cache in database
    await supabase.from("learning_hub_cache").upsert({
      user_id: userId,
      module_id: moduleId,
      overview: result.overview ?? null,
      topic_guide: result.topicGuide ?? null,
      concept_cards: result.conceptCards ?? null,
      quick_start: result.quickStart ?? null,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,module_id" });

    return NextResponse.json({
      overview: result.overview,
      topicGuide: result.topicGuide,
      conceptCards: result.conceptCards,
      quickStart: result.quickStart,
      generatedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (err) {
    console.error("[learning-hub] Error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: "Generierung fehlgeschlagen. Versuche es erneut." }, { status: 500 });
  }
}
