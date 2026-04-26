/**
 * AI Chat — Mobile-friendly endpoint.
 *
 * The web /api/ai/chat returns SSE which is awkward on React Native; this
 * endpoint accepts a single message + optional moduleId and returns one JSON
 * blob `{ reply, conversationId? }`. Auth is via Supabase access-token in the
 * Authorization header (the mobile app already sends this).
 */

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const log = logger("ai:chat-mobile");

interface Body {
  message: string;
  moduleId?: string | null;
  history?: { role: "user" | "assistant"; content: string }[];
}

const SYSTEM_PROMPT = [
  "Du bist Semetra, ein freundlicher KI-Lernassistent für Studierende.",
  "Antworte präzise, didaktisch und auf Deutsch (außer der Nutzer wechselt die Sprache).",
  "Verwende Markdown sparsam — keine langen Tabellen, kurze Listen wenn nötig.",
  "Halte Antworten knapp (max ~250 Wörter), es sei denn der Nutzer bittet explizit um mehr Tiefe.",
  "Wenn die Frage mehrdeutig ist, frag in einem Satz nach.",
  "Lehne ab: Hausaufgaben für den Nutzer komplett zu lösen — biete stattdessen Erklärungen + Schritte.",
].join(" ");

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY || !SUPABASE_SERVICE_KEY) {
    log.error("Missing env vars");
    return jsonError(500, "KI-Service nicht konfiguriert.");
  }

  // Auth
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return jsonError(401, "Nicht autorisiert");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return jsonError(401, "Nicht autorisiert");

  // Body
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Ungültiger Request-Body");
  }
  const userMsg = (body.message ?? "").trim();
  if (!userMsg) return jsonError(400, "Nachricht fehlt");
  if (userMsg.length > 4000) return jsonError(400, "Nachricht zu lang (max 4000 Zeichen)");

  // Optional: prepend module context if moduleId is set
  let moduleContext = "";
  if (body.moduleId) {
    try {
      const { data: mod } = await supabase
        .from("modules")
        .select("name, description, ects, semester")
        .eq("id", body.moduleId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (mod?.name) {
        const parts = [`Aktuelles Modul: ${mod.name}`];
        if (mod.ects) parts.push(`ECTS: ${mod.ects}`);
        if (mod.semester) parts.push(`Semester: ${mod.semester}`);
        if (mod.description) parts.push(`Beschreibung: ${mod.description.slice(0, 400)}`);
        moduleContext = `\n\nKontext:\n${parts.join("\n")}`;
      }
    } catch {
      /* non-fatal */
    }
  }

  // Build messages array (history + new)
  const history = (body.history ?? []).slice(-10); // last 10 turns max
  const messages = [
    ...history.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content.slice(0, 2000) : "",
    })),
    { role: "user" as const, content: userMsg },
  ];

  // Call Anthropic
  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 1024,
        system: SYSTEM_PROMPT + moduleContext,
        messages,
      }),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.text().catch(() => "");
      log.error("Anthropic error", { status: aiRes.status, body: errBody.slice(0, 500) });
      return jsonError(502, "KI-Service vorübergehend nicht erreichbar.");
    }

    const data = await aiRes.json();
    const reply = data?.content?.[0]?.text?.trim() ?? "";
    if (!reply) {
      return jsonError(502, "KI-Service hat keine Antwort geliefert.");
    }

    // Track usage
    try {
      await supabase.from("ai_usage").insert({
        user_id: user.id,
        feature: "chat_mobile",
        input_tokens: data?.usage?.input_tokens ?? 0,
        output_tokens: data?.usage?.output_tokens ?? 0,
      });
    } catch {
      /* non-fatal */
    }

    return new Response(JSON.stringify({ reply, model: data?.model ?? "claude-opus-4-7" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    log.error("Chat-mobile failed", err);
    return jsonError(500, "Interner Fehler bei der KI-Anfrage.");
  }
}

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
