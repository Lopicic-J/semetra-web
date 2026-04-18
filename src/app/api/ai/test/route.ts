/**
 * /api/ai/test — Minimal AI test endpoint for debugging
 * GET: Makes a tiny Anthropic API call and returns the raw result
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set", hasKey: false }, { status: 500 });

  const startTime = Date.now();

  try {
    // Test 1: Non-streaming (simplest possible call)
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 100,
        messages: [{ role: "user", content: "Sage nur: Hallo Semetra" }],
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({
        test: "FAILED",
        status: res.status,
        error: errBody,
        elapsed_ms: elapsed,
        keyPrefix: apiKey.slice(0, 10) + "...",
      });
    }

    const data = await res.json();
    return NextResponse.json({
      test: "OK",
      status: res.status,
      response: data.content?.[0]?.text ?? "no text",
      model: data.model,
      elapsed_ms: elapsed,
      keyPrefix: apiKey.slice(0, 10) + "...",
    });
  } catch (err) {
    return NextResponse.json({
      test: "ERROR",
      error: err instanceof Error ? err.message : "Unknown",
      elapsed_ms: Date.now() - startTime,
    });
  }
}
