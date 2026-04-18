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

// Extend timeout for AI generation (default 10s is too short)
export const maxDuration = 30;

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
  return generateAndCache(supabase, user.id, moduleId);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { moduleId } = body;
  if (!moduleId) return NextResponse.json({ error: "moduleId required" }, { status: 400 });

  return generateAndCache(supabase, user.id, moduleId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateAndCache(supabase: any, userId: string, moduleId: string) {
  // Check AI usage
  const { checkAndIncrementAiUsage } = await import("@/lib/ai-usage");
  const usageCheck = await checkAndIncrementAiUsage(userId, "pdf_analyze"); // Weight 5 — comprehensive generation
  if (!usageCheck.allowed) {
    return NextResponse.json({ error: "AI-Kontingent erschöpft" }, { status: 429 });
  }

  // Get module + topics
  const [moduleRes, topicsRes] = await Promise.all([
    supabase.from("modules").select("name, code, ects, semester, learning_type, exam_format, textbook, exam_notes")
      .eq("id", moduleId).single(),
    supabase.from("topics").select("title, description, knowledge_level, is_exam_relevant")
      .eq("module_id", moduleId).eq("user_id", userId).order("created_at"),
  ]);

  const mod = moduleRes.data;
  if (!mod) return NextResponse.json({ error: "Modul nicht gefunden" }, { status: 404 });

  const topics = topicsRes.data ?? [];
  const topicList = topics.map((t: any) => t.title).join(", ");

  const systemPrompt = `Erstelle eine Lernumgebung für das Modul "${mod.name}". Antworte NUR mit einem JSON-Objekt, KEIN Text davor oder danach.

${topics.length > 0 ? `Topics: ${topicList}` : ""}

JSON-Format:
{"overview":{"summary":"Was ist das Fach? 2-3 Sätze","prerequisites":["..."],"learningGoals":["..."],"realWorldUse":"Praxisbezug"},"topicGuide":[{"title":"...","explanation":"2 Sätze","relevance":"...","difficulty":"beginner","order":1}],"conceptCards":[{"title":"...","definition":"...","example":"...","application":"..."}],"quickStart":{"topThree":[{"title":"...","why":"...","howLong":"~2h"}],"recommendedOrder":["..."],"tips":["..."]}}

Max 6 topicGuide, max 5 conceptCards. Deutsch. Nur allgemeines Verständnis, kein Prüfungsbezug.`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI nicht konfiguriert" }, { status: 500 });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: `Erstelle die Lernumgebung für "${mod.name}". Halte dich kurz und präzise — max 8 Topic-Guide Einträge und 6 Concept Cards.` }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[learning-hub] API error:", res.status, errBody.slice(0, 200));
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

    let result;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
      result = JSON.parse(jsonMatch[1] || rawText);
    } catch (parseErr) {
      console.error("[learning-hub] JSON parse failed:", (parseErr as Error).message, rawText.slice(0, 200));
      return NextResponse.json({ error: "AI-Antwort konnte nicht verarbeitet werden. Versuche 'Neu generieren'." }, { status: 502 });
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
    return NextResponse.json({ error: "Generierung fehlgeschlagen" }, { status: 500 });
  }
}
