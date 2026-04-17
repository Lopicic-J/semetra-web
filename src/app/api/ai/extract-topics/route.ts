/**
 * /api/ai/extract-topics — Extract Topics from Lecture Notes
 *
 * POST: Student uploads lecture notes text → AI extracts topics + flashcards
 *
 * Body: { text: string, moduleId: string, createTopics?: boolean, createFlashcards?: boolean }
 *
 * Returns: { topics: [{title, description}], flashcards: [{question, answer}], created: {topics, flashcards} }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { text, moduleId, createTopics = false, createFlashcards = false } = body;

  if (!text || text.trim().length < 50) {
    return NextResponse.json({ error: "Text muss mindestens 50 Zeichen haben" }, { status: 400 });
  }
  if (!moduleId) {
    return NextResponse.json({ error: "moduleId erforderlich" }, { status: 400 });
  }

  // Check AI usage
  const { checkAndIncrementAiUsage } = await import("@/lib/ai-usage");
  const usageCheck = await checkAndIncrementAiUsage(user.id, "notes_summarize");
  if (!usageCheck.allowed) {
    return NextResponse.json({ error: "AI-Kontingent erschöpft" }, { status: 429 });
  }

  // Get module context
  const { data: mod } = await supabase
    .from("modules")
    .select("name, code")
    .eq("id", moduleId)
    .single();

  // Get existing topics to avoid duplicates
  const { data: existingTopics } = await supabase
    .from("topics")
    .select("title")
    .eq("module_id", moduleId)
    .eq("user_id", user.id);

  const existingTitles = new Set((existingTopics ?? []).map(t => t.title.toLowerCase()));

  const truncatedText = text.slice(0, 30000); // ~7K tokens

  const systemPrompt = `Du analysierst Vorlesungsnotizen und extrahierst die behandelten Themen.

Modul: ${mod?.name ?? "Unbekannt"}${mod?.code ? ` (${mod.code})` : ""}

${existingTitles.size > 0 ? `Bereits vorhandene Topics (NICHT nochmal extrahieren):\n${[...existingTitles].join(", ")}` : ""}

Aufgabe:
1. Extrahiere 5-15 NEUE Themen/Konzepte die in den Notizen behandelt werden
2. Für jedes Thema: Erstelle 2-3 Flashcard-Fragen die das Verständnis testen

Antworte als JSON:
{
  "topics": [{"title": "Themenname", "description": "1-Satz Beschreibung"}],
  "flashcards": [{"question": "Frage", "answer": "Antwort", "topic": "zugehöriges Topic"}]
}

Regeln:
- Nur NEUE Themen extrahieren (nicht die oben gelisteten)
- Themen-Titel kurz und prägnant (2-5 Wörter)
- Flashcards testen Verständnis, nicht nur Fakten
- Antworte auf Deutsch`;

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
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: "user", content: `Analysiere diese Vorlesungsnotizen:\n\n${truncatedText}` }],
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "AI-Extraktion fehlgeschlagen" }, { status: 502 });

    const response = await res.json();
    const rawText = response.content?.[0]?.text ?? "";

    let result;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
      result = JSON.parse(jsonMatch[1] || rawText);
    } catch {
      return NextResponse.json({ error: "AI-Antwort konnte nicht verarbeitet werden" }, { status: 502 });
    }

    const topics = result.topics ?? [];
    const flashcards = result.flashcards ?? [];
    const created = { topics: 0, flashcards: 0 };

    // Optionally create topics in database
    if (createTopics && topics.length > 0) {
      for (const topic of topics) {
        // Skip if already exists
        if (existingTitles.has(topic.title.toLowerCase())) continue;

        const { error } = await supabase.from("topics").insert({
          user_id: user.id,
          module_id: moduleId,
          title: topic.title,
          description: topic.description ?? null,
          knowledge_level: 0,
        });
        if (!error) created.topics++;
      }
    }

    // Optionally create flashcards
    if (createFlashcards && flashcards.length > 0) {
      // Map topics to IDs
      const { data: allTopics } = await supabase
        .from("topics")
        .select("id, title")
        .eq("module_id", moduleId)
        .eq("user_id", user.id);

      const topicMap = new Map((allTopics ?? []).map(t => [t.title.toLowerCase(), t.id]));

      for (const fc of flashcards) {
        const topicId = topicMap.get(fc.topic?.toLowerCase()) ?? null;
        const { error } = await supabase.from("flashcards").insert({
          user_id: user.id,
          module_id: moduleId,
          topic_id: topicId,
          question: fc.question,
          answer: fc.answer,
          deck_name: "Vorlesung",
        });
        if (!error) created.flashcards++;
      }
    }

    return NextResponse.json({
      topics,
      flashcards,
      created,
      existingTopicsSkipped: topics.filter((t: { title: string }) => existingTitles.has(t.title.toLowerCase())).length,
    });
  } catch (err) {
    console.error("[extract-topics] Error:", err);
    return NextResponse.json({ error: "Extraktion fehlgeschlagen" }, { status: 500 });
  }
}
