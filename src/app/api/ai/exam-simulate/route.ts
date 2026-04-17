/**
 * /api/ai/exam-simulate — AI Exam Simulator
 *
 * POST: Generate mock exam questions based on module topics + flashcards.
 *   Body: { moduleId: string, questionCount?: number, difficulty?: "easy"|"mixed"|"hard" }
 *
 * Returns: { questions: [{question, options?, correctAnswer, explanation, topic, difficulty}] }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { moduleId, questionCount = 10, difficulty = "mixed" } = body as {
    moduleId: string;
    questionCount?: number;
    difficulty?: "easy" | "mixed" | "hard";
  };

  if (!moduleId) return NextResponse.json({ error: "moduleId required" }, { status: 400 });

  // Check AI usage
  const { checkAndIncrementAiUsage } = await import("@/lib/ai-usage");
  const usageCheck = await checkAndIncrementAiUsage(user.id, "chat_explain");
  if (!usageCheck.allowed) {
    return NextResponse.json({ error: "AI-Kontingent erschöpft" }, { status: 429 });
  }

  // Fetch module context in parallel
  const [moduleRes, topicsRes, flashcardsRes, gradesRes] = await Promise.all([
    supabase.from("modules").select("name, code").eq("id", moduleId).single(),
    supabase.from("topics").select("title, knowledge_level").eq("module_id", moduleId),
    supabase.from("flashcards").select("question, answer, deck_name").eq("module_id", moduleId).limit(50),
    supabase.from("grades").select("title, exam_type").eq("module_id", moduleId),
  ]);

  const module = moduleRes.data;
  if (!module) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  const topics = topicsRes.data ?? [];
  const flashcards = flashcardsRes.data ?? [];
  const grades = gradesRes.data ?? [];

  // Build context from existing data
  const topicList = topics.map((t) => `- ${t.title} (Wissensstand: ${t.knowledge_level ?? 0}%)`).join("\n");
  const flashcardSample = flashcards.slice(0, 20).map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
  const examTypes = [...new Set(grades.map((g) => g.exam_type).filter(Boolean))].join(", ");

  // Weak topics should appear more often
  const weakTopics = topics.filter((t) => (t.knowledge_level ?? 0) < 50).map((t) => t.title);

  const difficultyInstruction = {
    easy: "Erstelle hauptsächlich Verständnisfragen und einfache Anwendungsfragen.",
    mixed: "Mische Verständnis- (40%), Anwendungs- (40%) und Analysefragen (20%).",
    hard: "Erstelle anspruchsvolle Analyse- und Transferfragen die tiefes Verständnis erfordern.",
  }[difficulty];

  const systemPrompt = `Du bist ein Prüfungsexperte der realistische Mock-Prüfungen für Schweizer FH-Studierende erstellt.

Modul: ${module.name}${module.code ? ` (${module.code})` : ""}
${examTypes ? `Bisherige Prüfungsformate: ${examTypes}` : ""}

Themen im Modul:
${topicList || "Keine Themen definiert"}

${weakTopics.length > 0 ? `Schwache Themen (öfter abfragen): ${weakTopics.join(", ")}` : ""}

${flashcardSample ? `Vorhandene Karteikarten als Referenz:\n${flashcardSample}` : ""}

Regeln:
- ${difficultyInstruction}
- Erstelle genau ${Math.min(questionCount, 20)} Fragen
- Mix aus Multiple-Choice (mit 4 Optionen, eine korrekt) und offenen Fragen
- Schwache Themen sollen häufiger vorkommen
- Jede Frage muss eine Erklärung der richtigen Antwort enthalten
- Antworte auf Deutsch
- Antworte als JSON-Array

Format pro Frage:
{
  "question": "Die Frage",
  "type": "multiple_choice" oder "open",
  "options": ["A", "B", "C", "D"] (nur bei multiple_choice),
  "correctAnswer": "Die korrekte Antwort",
  "explanation": "Warum das die richtige Antwort ist",
  "topic": "Zugehöriges Thema",
  "difficulty": "easy" | "medium" | "hard"
}`;

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
        messages: [{ role: "user", content: `Erstelle die Mock-Prüfung mit ${Math.min(questionCount, 20)} Fragen. Antworte nur mit dem JSON-Array.` }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "AI-Anfrage fehlgeschlagen" }, { status: 502 });
    }

    const response = await res.json();
    const rawText = response.content?.[0]?.text ?? "";

    // Parse JSON response
    let questions;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
      questions = JSON.parse(jsonMatch[1] || rawText);
    } catch {
      questions = [];
    }

    return NextResponse.json({
      questions: Array.isArray(questions) ? questions : [],
      module: { name: module.name, code: module.code },
      difficulty,
      topicCount: topics.length,
      weakTopicCount: weakTopics.length,
    });
  } catch (err) {
    console.error("[exam-simulate] Error:", err);
    return NextResponse.json({ error: "Prüfungssimulation fehlgeschlagen" }, { status: 500 });
  }
}
