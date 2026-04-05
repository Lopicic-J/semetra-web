import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const log = logger("api:math");

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
  if (!ANTHROPIC_API_KEY || !SUPABASE_SERVICE_KEY) {
    log.error("Missing env vars", { hasAnthropicKey: !!ANTHROPIC_API_KEY, hasServiceKey: !!SUPABASE_SERVICE_KEY });
    return NextResponse.json({ error: "KI-Service nicht konfiguriert. Bitte ANTHROPIC_API_KEY und SUPABASE_SERVICE_ROLE_KEY in .env.local setzen." }, { status: 500 });
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

  // ── Math Room: unlimited for Pro, daily limit for Free (client-side) ──
  // The Math Room is a core Semetra feature and does NOT consume KI requests.
  // Free users are gated by mathDailyCalculations (3/day) on the client side.
  // Pro users have unlimited access (gates.ts → mathUsageToday returns allowed:true).
  // We still check that the user is authenticated (above) but do NOT deduct credits.

  const body = await req.json();
  const { equation, variable = "x", mode = "solve", targetVariable, language = "de" } = body as {
    equation: string;
    variable?: string;
    mode?: string;
    targetVariable?: string;
    language?: string;
  };

  if (!equation || equation.trim().length < 2) {
    return NextResponse.json({ error: "Equation too short" }, { status: 400 });
  }

  const LANG_INSTRUCTIONS: Record<string, string> = {
    de: "Antworte auf Deutsch.", en: "Respond in English.", fr: "Réponds en français.",
    it: "Rispondi in italiano.", es: "Responde en español.", nl: "Antwoord in het Nederlands.",
  };
  const langInstr = LANG_INSTRUCTIONS[language] || LANG_INSTRUCTIONS.de;

  const systemPrompt = `You are a math solver for Swiss university students. You solve equations step by step. ${langInstr}

IMPORTANT: Respond EXCLUSIVELY with a JSON object in the following format (no Markdown, no code block):

{
  "type": "linear|quadratic|polynomial|rational|root|exponential|logarithmic|trigonometric|system|rearrangement|simplification",
  "steps": [
    {"expr": "Expression", "op": "Explanation of operation"},
    {"expr": "Next step", "op": "What was done"}
  ],
  "solutions": ["x = 3", "x = -2"],
  "domain": "D = ℝ \\ {-3}" or "D = ℝ" or "D = {x ∈ ℝ | x > 0}",
  "notes": "Additional notes (e.g. verification, periodicity, extraneous solutions)",
  "error": null
}

Rules:
- Show EVERY transformation step individually
- For operations: show what was done (e.g. "| −4 on both sides", "| ÷2", "| squaring")
- Check the domain (division by 0, logarithm only x > 0, square root ≥ 0)
- For root equations: verify for extraneous solutions
- For trigonometric equations: give the general solution with k ∈ ℤ
- For quadratic: use the quadratic formula with discriminant
- For systems: show substitution or elimination method
- For rearrangements: rearrange for the desired variable
- If no solution exists: explain why
- If infinitely many solutions: explain why
- Always state the equation type
- Use mathematical Unicode symbols: ², ³, √, ±, ≠, ≤, ≥, π, ∈, ℝ, ℤ, ∞
- All step explanations ("op" and "notes") MUST be in the requested language`;

  let userPrompt = "";
  if (mode === "solve") {
    userPrompt = `Solve the following equation for ${variable} and show every step:\n\n${equation}`;
  } else if (mode === "rearrange") {
    userPrompt = `Rearrange the following formula for ${targetVariable || variable} and show every step:\n\n${equation}`;
  } else if (mode === "simplify") {
    userPrompt = `Simplify the following expression and show every step:\n\n${equation}`;
  } else if (mode === "system") {
    userPrompt = `Solve the following system of equations and show every step (use substitution or elimination method):\n\n${equation}`;
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
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt.slice(0, 8000) }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      log.error("Claude API error", err);
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
      log.error("Failed to parse solver response", content);
      return NextResponse.json({ error: "Antwort konnte nicht verarbeitet werden" }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    log.error("Math solver error", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
