/**
 * /api/ai/document-analyze — AI Document Analysis
 *
 * POST: Upload document text → AI generates:
 *   - Summary (concise overview)
 *   - Key concepts (list of important terms/ideas)
 *   - Flashcards (question/answer pairs for review)
 *   - Study questions (exam-style questions)
 *
 * Body: { text: string, moduleId?: string, mode?: "summary" | "flashcards" | "all", language?: string }
 */

import { NextResponse } from "next/server";

// Extend timeout for AI generation
export const maxDuration = 30;
import { createClient } from "@/lib/supabase/server";

const MAX_INPUT_CHARS = 50000; // ~12K tokens

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { text, moduleId, mode = "all", language = "de" } = body as {
    text: string;
    moduleId?: string;
    mode?: "summary" | "flashcards" | "questions" | "all";
    language?: string;
  };

  if (!text || text.trim().length < 50) {
    return NextResponse.json({ error: "Text zu kurz (mindestens 50 Zeichen)" }, { status: 400 });
  }

  const truncatedText = text.slice(0, MAX_INPUT_CHARS);

  // Check AI usage
  const { checkAndIncrementAiUsage } = await import("@/lib/ai-usage");
  const usageCheck = await checkAndIncrementAiUsage(user.id, "pdf_analyze");
  if (!usageCheck.allowed) {
    return NextResponse.json({ error: "AI-Kontingent erschöpft" }, { status: 429 });
  }

  // Get module context if provided
  let moduleContext = "";
  if (moduleId) {
    const { data: mod } = await supabase
      .from("modules")
      .select("name, code")
      .eq("id", moduleId)
      .single();
    if (mod) moduleContext = `\nModul: ${mod.name}${mod.code ? ` (${mod.code})` : ""}`;
  }

  const langInstructions: Record<string, string> = {
    de: "Antworte auf Deutsch.",
    en: "Respond in English.",
    fr: "Réponds en français.",
    it: "Rispondi in italiano.",
    es: "Responde en español.",
    nl: "Antwoord in het Nederlands.",
  };

  const modeInstructions: Record<string, string> = {
    summary: `Erstelle eine strukturierte Zusammenfassung mit:
- Überblick (2-3 Sätze)
- Hauptpunkte (5-8 Bulletpoints)
- Fazit (1-2 Sätze)`,
    flashcards: `Erstelle 10-15 Karteikarten (Frage/Antwort-Paare) für Spaced Repetition.
Format: JSON-Array mit {question, answer} Objekten.`,
    questions: `Erstelle 5-8 prüfungsrelevante Fragen mit Musterantworten.
Format: JSON-Array mit {question, answer, difficulty: "easy"|"medium"|"hard"} Objekten.`,
    all: `Analysiere diesen Text und erstelle:

1. **summary**: Strukturierte Zusammenfassung (Überblick, 5-8 Hauptpunkte, Fazit)
2. **keyConcepts**: Array von 8-12 Schlüsselbegriffen mit je einer kurzen Erklärung [{term, definition}]
3. **flashcards**: 10-15 Karteikarten [{question, answer}]
4. **studyQuestions**: 5 prüfungsrelevante Fragen [{question, answer, difficulty}]

Antworte als JSON-Objekt mit diesen 4 Keys.`,
  };

  const systemPrompt = `Du bist ein Studienassistent der akademische Texte analysiert und Lernmaterial erstellt.
${langInstructions[language] || langInstructions.de}${moduleContext}

Regeln:
- Fasse Inhalte präzise und lernfreundlich zusammen
- Karteikarten: Fragen die Verständnis testen, nicht nur Fakten abfragen
- Prüfungsfragen: Mischung aus Verständnis, Anwendung und Analyse
- Halte dich strikt an den Quelltext — keine Informationen erfinden`;

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
        messages: [{ role: "user", content: `${modeInstructions[mode]}\n\n--- DOKUMENT ---\n${truncatedText}` }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[document-analyze] API error:", res.status, errBody);
      return NextResponse.json({ error: "AI-Analyse fehlgeschlagen" }, { status: 502 });
    }

    const response = await res.json();
    const content = response.content?.[0];
    const rawText = content?.type === "text" ? content.text : "";

    // Try to parse as JSON (for structured modes)
    let result: any;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
      result = JSON.parse(jsonMatch[1] || rawText);
    } catch {
      // If not valid JSON, return as raw text
      result = { summary: rawText };
    }

    // Save analysis result to documents table if moduleId provided
    if (moduleId) {
      await supabase.from("documents").insert({
        user_id: user.id,
        module_id: moduleId,
        title: `AI-Analyse: ${new Date().toLocaleDateString("de-CH")}`,
        content: typeof result === "string" ? result : JSON.stringify(result),
        doc_type: "ai_analysis",
      }).select().maybeSingle();
    }

    return NextResponse.json({
      analysis: result,
      mode,
      tokensUsed: response?.usage?.output_tokens ?? 0,
      inputLength: truncatedText.length,
    });
  } catch (err) {
    console.error("[document-analyze] AI error:", err);
    return NextResponse.json({ error: "AI-Analyse fehlgeschlagen" }, { status: 500 });
  }
}
