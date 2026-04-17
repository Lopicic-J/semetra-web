/**
 * /api/ai/module-setup — AI-Powered Module Setup
 *
 * POST: Generate Topics, Flashcards, and Resource suggestions for a new module.
 *
 * Body: {
 *   moduleName: string,
 *   moduleType?: "theory"|"math"|"programming"|"language"|"project"|"mixed",
 *   ects?: number,
 *   semester?: number,
 *   institutionName?: string,
 *   country?: string,
 *   examFormat?: string
 * }
 *
 * Returns: {
 *   topics: [{ title, description, difficulty }],
 *   flashcards: [{ question, answer, topic }],
 *   resources: [{ title, url, type }],
 *   learningRecommendation: string,
 *   moduleType: string
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    moduleName,
    moduleType = "mixed",
    ects,
    semester,
    institutionName,
    country = "CH",
    examFormat,
  } = body;

  if (!moduleName) return NextResponse.json({ error: "moduleName required" }, { status: 400 });

  // Check AI usage
  const { checkAndIncrementAiUsage } = await import("@/lib/ai-usage");
  const usageCheck = await checkAndIncrementAiUsage(user.id, "chat_explain");
  if (!usageCheck.allowed) {
    return NextResponse.json({ error: "AI-Kontingent erschöpft" }, { status: 429 });
  }

  const countryNames: Record<string, string> = {
    CH: "Schweizer", DE: "deutscher", AT: "österreichischer",
    FR: "französischer", IT: "italienischer",
  };
  const countryAdj = countryNames[country] ?? "europäischer";

  const typeDescriptions: Record<string, string> = {
    theory: "theorielastiges Modul (Lesen, Verstehen, Auswendiglernen)",
    math: "mathematisches/rechnerisches Modul (Formeln, Beweise, Berechnungen)",
    programming: "Programmier-Modul (Code schreiben, Algorithmen, Projekte)",
    language: "Sprach-Modul (Vokabeln, Grammatik, Konversation)",
    project: "Projekt-Modul (Gruppenarbeit, Meilensteine, Präsentationen)",
    mixed: "gemischtes Modul",
  };

  const systemPrompt = `Du bist ein Studienberater der Studierenden hilft, ein neues Modul in ihrer Lern-App einzurichten.

Kontext:
- Modul: "${moduleName}"
- Typ: ${typeDescriptions[moduleType] || typeDescriptions.mixed}
- ECTS: ${ects ?? "unbekannt"}
- Semester: ${semester ?? "unbekannt"}
- Institution: ${institutionName ?? `${countryAdj} Fachhochschule`}
${examFormat ? `- Prüfungsformat: ${examFormat}` : ""}

Aufgabe: Generiere eine Modul-Einrichtung als JSON mit:

1. "topics": Array von 10-15 Themen die typischerweise in diesem Modul behandelt werden
   Format: [{"title": "Themenname", "description": "1 Satz Beschreibung", "difficulty": "easy"|"medium"|"hard"}]

2. "flashcards": Array von 15-20 Starter-Karteikarten (verteilt über die Topics)
   Format: [{"question": "Frage", "answer": "Antwort", "topic": "zugehöriges Topic-Titel"}]

3. "resources": Array von 3-5 Ressourcen-Vorschläge (reale, bekannte Quellen)
   Format: [{"title": "Titel", "type": "video"|"article"|"textbook", "description": "Warum hilfreich"}]

4. "learningRecommendation": 1-2 Sätze Lernempfehlung für diesen Modultyp

5. "detectedModuleType": Der erkannte Modultyp falls "mixed" übergeben wurde

Antworte NUR mit dem JSON-Objekt, kein Markdown.`;

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
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: `Richte das Modul "${moduleName}" ein.` }],
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "AI-Setup fehlgeschlagen" }, { status: 502 });

    const response = await res.json();
    const rawText = response.content?.[0]?.text ?? "";

    let result;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
      result = JSON.parse(jsonMatch[1] || rawText);
    } catch {
      return NextResponse.json({ error: "AI-Antwort konnte nicht verarbeitet werden", raw: rawText }, { status: 502 });
    }

    return NextResponse.json({
      moduleName,
      moduleType: result.detectedModuleType ?? moduleType,
      topics: result.topics ?? [],
      flashcards: result.flashcards ?? [],
      resources: result.resources ?? [],
      learningRecommendation: result.learningRecommendation ?? "",
    });
  } catch (err) {
    console.error("[module-setup] Error:", err);
    return NextResponse.json({ error: "Modul-Setup fehlgeschlagen" }, { status: 500 });
  }
}

/**
 * PATCH: Apply the AI-generated setup to an existing module.
 * Creates topics, flashcards, and resources in the database.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { moduleId, topics, flashcards, resources, learningRecommendation, moduleType } = body;

  if (!moduleId) return NextResponse.json({ error: "moduleId required" }, { status: 400 });

  const results = { topics: 0, flashcards: 0, resources: 0 };

  // Update module metadata
  const moduleUpdates: Record<string, unknown> = {};
  if (learningRecommendation) moduleUpdates.learning_recommendation = learningRecommendation;
  if (moduleType) moduleUpdates.learning_type = moduleType;
  if (Object.keys(moduleUpdates).length > 0) {
    await supabase.from("modules").update(moduleUpdates).eq("id", moduleId).eq("user_id", user.id);
  }

  // Create topics
  if (topics && Array.isArray(topics)) {
    for (const topic of topics) {
      const { error } = await supabase.from("topics").insert({
        user_id: user.id,
        module_id: moduleId,
        title: topic.title,
        description: topic.description ?? null,
        knowledge_level: 0,
      });
      if (!error) results.topics++;
    }
  }

  // Create flashcards (link to topics by title match)
  if (flashcards && Array.isArray(flashcards)) {
    // Get created topics for linking
    const { data: createdTopics } = await supabase
      .from("topics")
      .select("id, title")
      .eq("module_id", moduleId)
      .eq("user_id", user.id);

    const topicMap = new Map((createdTopics ?? []).map(t => [t.title.toLowerCase(), t.id]));

    for (const fc of flashcards) {
      const topicId = topicMap.get(fc.topic?.toLowerCase()) ?? null;
      const { error } = await supabase.from("flashcards").insert({
        user_id: user.id,
        module_id: moduleId,
        topic_id: topicId,
        question: fc.question,
        answer: fc.answer,
        deck_name: "AI Starter",
      });
      if (!error) results.flashcards++;
    }
  }

  // Create topic resources
  if (resources && Array.isArray(resources)) {
    // Get first topic for linking (resources are module-level)
    const { data: firstTopic } = await supabase
      .from("topics")
      .select("id")
      .eq("module_id", moduleId)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    for (const res of resources) {
      if (!firstTopic) break;
      const { error } = await supabase.from("topic_resources").insert({
        user_id: user.id,
        topic_id: firstTopic.id,
        module_id: moduleId,
        title: res.title,
        url: res.url ?? null,
        resource_type: res.type === "video" ? "video" : res.type === "textbook" ? "article" : "link",
        is_recommended: true,
      });
      if (!error) results.resources++;
    }
  }

  return NextResponse.json({ applied: true, results });
}
