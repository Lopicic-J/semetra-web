/**
 * /api/ai/explain-check — Feynman Technique: Check Student Explanation
 *
 * POST: Student explains a concept → AI evaluates quality
 *
 * Body: { concept: string, explanation: string, moduleId?: string, topicId?: string }
 *
 * Returns: { score: 1-5, feedback: string, missing: string[], suggestions: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { concept, explanation, moduleId, topicId } = body as {
    concept: string;
    explanation: string;
    moduleId?: string;
    topicId?: string;
  };

  if (!concept || !explanation || explanation.trim().length < 30) {
    return NextResponse.json({ error: "Erklärung muss mindestens 30 Zeichen haben" }, { status: 400 });
  }

  // Check AI usage
  const { checkAndIncrementAiUsage } = await import("@/lib/ai-usage");
  const usageCheck = await checkAndIncrementAiUsage(user.id, "chat_short");
  if (!usageCheck.allowed) {
    return NextResponse.json({ error: "AI-Kontingent erschöpft" }, { status: 429 });
  }

  // Get module context
  let moduleContext = "";
  if (moduleId) {
    const { data: mod } = await supabase
      .from("modules")
      .select("name, code")
      .eq("id", moduleId)
      .single();
    if (mod) moduleContext = `Modul: ${mod.name}${mod.code ? ` (${mod.code})` : ""}`;
  }

  const systemPrompt = `Du bist ein Universitäts-Tutor der die Feynman-Technik anwendet.
${moduleContext}

Der Student hat versucht, das Konzept "${concept}" in eigenen Worten zu erklären.
Bewerte die Erklärung auf einer Skala von 1-5:
1 = Grundlegend falsch oder unverständlich
2 = Teilweise korrekt, aber wesentliche Fehler
3 = Grundidee verstanden, aber unvollständig
4 = Gut erklärt, kleine Lücken
5 = Exzellent — klar, vollständig, könnte einem Laien erklärt werden

Antworte als JSON:
{
  "score": 1-5,
  "feedback": "2-3 Sätze: Was war gut? Was fehlt?",
  "missing": ["Punkt 1 der fehlt", "Punkt 2 der fehlt"],
  "suggestions": "1 konkreter Tipp zur Verbesserung"
}

Sei ehrlich aber ermutigend. Wenn die Erklärung gut ist, sag es. Wenn Fehler drin sind, erkläre sie klar.`;

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: explanation }],
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
      result = { score: 3, feedback: rawText, missing: [], suggestions: "" };
    }

    // Update topic knowledge level based on score (if topicId provided)
    if (topicId && result.score) {
      const newLevel = Math.min(100, result.score * 20); // 1→20, 5→100
      await supabase
        .from("topics")
        .update({ knowledge_level: newLevel })
        .eq("id", topicId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      concept,
      ...result,
      knowledgeUpdated: !!topicId,
    });
  } catch (err) {
    console.error("[explain-check] Error:", err);
    return NextResponse.json({ error: "Bewertung fehlgeschlagen" }, { status: 500 });
  }
}
