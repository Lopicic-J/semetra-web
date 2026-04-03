import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * POST /api/math/solve
 *
 * AI-powered equation solver with step-by-step output.
 * Handles: solving, rearranging, simplifying, systems, and all equation types.
 *
 * Body: {
 *   equation: string,
 *   variable?: string,        // default "x"
 *   mode: "solve" | "rearrange" | "simplify" | "system",
 *   targetVariable?: string,  // for rearrange mode
 * }
 */
export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI nicht konfiguriert" }, { status: 500 });
  }

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

  const body = await req.json();
  const { equation, variable = "x", mode = "solve", targetVariable } = body as {
    equation: string;
    variable?: string;
    mode?: string;
    targetVariable?: string;
  };

  if (!equation || equation.trim().length < 2) {
    return NextResponse.json({ error: "Gleichung zu kurz" }, { status: 400 });
  }

  const systemPrompt = `Du bist ein mathematischer Solver für Schweizer FH/Uni-Studierende. Du löst Gleichungen Schritt für Schritt.

WICHTIG: Antworte AUSSCHLIESSLICH mit einem JSON-Objekt im folgenden Format (kein Markdown, kein Codeblock):

{
  "type": "linear|quadratic|polynomial|rational|root|exponential|logarithmic|trigonometric|system|rearrangement|simplification",
  "steps": [
    {"expr": "Ausdruck", "op": "Erklärung der Operation"},
    {"expr": "Nächster Schritt", "op": "Was wurde gemacht"}
  ],
  "solutions": ["x = 3", "x = -2"],
  "domain": "D = ℝ \\ {-3}" oder "D = ℝ" oder "D = {x ∈ ℝ | x > 0}",
  "notes": "Zusätzliche Hinweise (z.B. Probe, Periodizität, Scheinlösungen)",
  "error": null
}

Regeln:
- Zeige JEDEN Umformungsschritt einzeln
- Bei der Operation: zeige was gemacht wurde (z.B. "| −4 auf beiden Seiten", "| ÷2", "| Quadrieren")
- Prüfe die Definitionsmenge (Division durch 0, Logarithmus nur x > 0, Wurzel ≥ 0)
- Bei Wurzelgleichungen: mache eine Probe für Scheinlösungen
- Bei trigonometrischen Gleichungen: gib die allgemeine Lösung mit k ∈ ℤ an
- Bei quadratischen: verwende die Mitternachtsformel mit Diskriminante
- Bei Systemen: zeige Einsetzverfahren oder Additionsverfahren
- Bei Umstellungen: stelle nach der gewünschten Variable um
- Wenn keine Lösung existiert: erkläre warum
- Wenn unendlich viele Lösungen: erkläre warum
- Gib immer den Typ der Gleichung an
- Verwende mathematische Unicode-Symbole: ², ³, √, ±, ≠, ≤, ≥, π, ∈, ℝ, ℤ, ∞`;

  let userPrompt = "";
  if (mode === "solve") {
    userPrompt = `Löse die folgende Gleichung nach ${variable} auf und zeige jeden Schritt:\n\n${equation}`;
  } else if (mode === "rearrange") {
    userPrompt = `Stelle die folgende Formel nach ${targetVariable || variable} um und zeige jeden Schritt:\n\n${equation}`;
  } else if (mode === "simplify") {
    userPrompt = `Vereinfache den folgenden Ausdruck und zeige jeden Schritt:\n\n${equation}`;
  } else if (mode === "system") {
    userPrompt = `Löse das folgende Gleichungssystem und zeige jeden Schritt (verwende Einsetzverfahren oder Additionsverfahren):\n\n${equation}`;
  }

  try {
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
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Claude API error:", err);
      return NextResponse.json({ error: "KI-Fehler" }, { status: 502 });
    }

    const data = await res.json();
    const content = data.content?.[0]?.text ?? "";

    // Parse JSON from response
    let result;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse solver response:", content);
      return NextResponse.json({ error: "Antwort konnte nicht verarbeitet werden" }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Math solver error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
