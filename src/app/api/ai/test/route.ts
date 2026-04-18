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
    const basicOk = !!data.content?.[0]?.text;

    // Test 2: Lernraum-style call (streaming, JSON response)
    const startTime2 = Date.now();
    let lernraumResult = "not tested";
    try {
      const res2 = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          stream: true,
          messages: [{ role: "user", content: 'Antworte NUR mit diesem JSON: {"overview":{"summary":"Test"},"topicGuide":[{"title":"Test","order":1}]}' }],
        }),
      });

      if (!res2.ok) {
        const errBody2 = await res2.text();
        lernraumResult = `FAILED: ${res2.status} ${errBody2.slice(0, 100)}`;
      } else {
        // Collect streaming chunks
        let rawText = "";
        const reader = res2.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ") && !line.includes("[DONE]")) {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                    rawText += parsed.delta.text;
                  }
                } catch {}
              }
            }
          }
        }

        // Try to parse JSON from collected text
        try {
          const firstBrace = rawText.indexOf("{");
          const lastBrace = rawText.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
            lernraumResult = "OK — streaming + JSON parse works";
          } else {
            lernraumResult = `NO JSON FOUND in: ${rawText.slice(0, 200)}`;
          }
        } catch (e) {
          lernraumResult = `JSON PARSE FAILED: ${(e as Error).message} | raw: ${rawText.slice(0, 200)}`;
        }
      }
    } catch (e) {
      lernraumResult = `STREAM ERROR: ${(e as Error).message}`;
    }

    return NextResponse.json({
      test1_basic: basicOk ? "OK" : "FAILED",
      test1_response: data.content?.[0]?.text ?? "no text",
      test1_ms: elapsed,
      test2_streaming_json: lernraumResult,
      test2_ms: Date.now() - startTime2,
      model: data.model,
    });
  } catch (err) {
    return NextResponse.json({
      test: "ERROR",
      error: err instanceof Error ? err.message : "Unknown",
      elapsed_ms: Date.now() - startTime,
    });
  }
}
