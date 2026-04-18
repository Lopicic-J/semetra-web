/**
 * /api/ai/summary-coach — Guided Summarization with AI Feedback
 *
 * POST: Student submits a summary of a topic → AI gives structured feedback
 *
 * Body: { topicTitle: string, summary: string, moduleId?: string, maxWords?: number }
 *
 * Returns: {
 *   score: 1-5,
 *   clarity: 1-5,
 *   completeness: 1-5,
 *   accuracy: 1-5,
 *   feedback: string,
 *   keyPointsCovered: string[],
 *   keyPointsMissing: string[],
 *   improvedVersion: string
 * }
 */

import { NextResponse } from "next/server";

// Extend timeout for AI generation
export const maxDuration = 60;
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { topicTitle, summary, moduleId, maxWords = 200 } = body as {
    topicTitle: string;
    summary: string;
    moduleId?: string;
    maxWords?: number;
  };

  if (!topicTitle || !summary || summary.trim().length < 30) {
    return NextResponse.json({ error: "Zusammenfassung muss mindestens 30 Zeichen haben" }, { status: 400 });
  }

  const { checkAndIncrementAiUsage } = await import("@/lib/ai-usage");
  const usageCheck = await checkAndIncrementAiUsage(user.id, "notes_summarize");
  if (!usageCheck.allowed) {
    return NextResponse.json({ error: "AI-Kontingent erschöpft" }, { status: 429 });
  }

  let moduleContext = "";
  if (moduleId) {
    const { data: mod } = await supabase.from("modules").select("name").eq("id", moduleId).maybeSingle();
    if (mod) moduleContext = `Modul: ${mod.name}\n`;
  }

  const systemPrompt = `Du bist ein Studien-Coach der Zusammenfassungen bewertet (Feynman-Methode).
${moduleContext}
Der Student hat eine Zusammenfassung zum Thema "${topicTitle}" geschrieben (max. ${maxWords} Wörter).

Bewerte die Zusammenfassung und antworte als JSON:

{
  "score": 1-5,           // Gesamtbewertung
  "clarity": 1-5,         // Wie klar und verständlich?
  "completeness": 1-5,    // Wie vollständig?
  "accuracy": 1-5,        // Wie korrekt?
  "feedback": "2-3 Sätze Gesamtfeedback",
  "keyPointsCovered": ["Punkt 1", "Punkt 2"],
  "keyPointsMissing": ["Fehlender Punkt 1"],
  "improvedVersion": "Eine verbesserte Version der Zusammenfassung (max 150 Wörter)"
}

Sei konstruktiv. Lobe was gut ist, zeige Verbesserungspotential auf.`;

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
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: summary }],
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "AI-Bewertung fehlgeschlagen" }, { status: 502 });

    const response = await res.json();
    const rawText = response.content?.[0]?.text ?? "";

    let result;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
      result = JSON.parse(jsonMatch[1] || rawText);
    } catch {
      result = { score: 3, feedback: rawText, clarity: 3, completeness: 3, accuracy: 3, keyPointsCovered: [], keyPointsMissing: [], improvedVersion: "" };
    }

    return NextResponse.json({
      topicTitle,
      wordCount: summary.trim().split(/\s+/).length,
      ...result,
    });
  } catch (err) {
    console.error("[summary-coach] Error:", err);
    return NextResponse.json({ error: "Bewertung fehlgeschlagen" }, { status: 500 });
  }
}
