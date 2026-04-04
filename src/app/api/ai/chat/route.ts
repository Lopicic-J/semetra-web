import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  mode: "explain" | "quiz" | "chat" | "summarize";
  context?: {
    moduleId?: string;
    moduleName?: string;
    examId?: string;
    examTitle?: string;
    topicId?: string;
    topicTitle?: string;
    documentText?: string;
    language?: string;
  };
}

function buildSystemPrompt(mode: string, context?: ChatRequestBody["context"]): string {
  const lang = context?.language ?? "de";
  const langInstruction = lang === "de"
    ? "Antworte auf Deutsch."
    : lang === "en"
    ? "Respond in English."
    : lang === "fr"
    ? "Réponds en français."
    : lang === "it"
    ? "Rispondi in italiano."
    : lang === "es"
    ? "Responde en español."
    : lang === "nl"
    ? "Antwoord in het Nederlands."
    : "Antworte auf Deutsch.";

  const contextInfo: string[] = [];
  if (context?.moduleName) contextInfo.push(`Module: ${context.moduleName}`);
  if (context?.examTitle) contextInfo.push(`Exam: ${context.examTitle}`);
  if (context?.topicTitle) contextInfo.push(`Topic: ${context.topicTitle}`);
  const contextBlock = contextInfo.length > 0
    ? `\n\nCurrent student context:\n${contextInfo.join("\n")}`
    : "";

  const docBlock = context?.documentText
    ? `\n\nDocument content (uploaded by the student):\n${context.documentText.slice(0, 12000)}`
    : "";

  const basePersona = `You are the Semetra AI study assistant, a friendly and competent tutor for students at Swiss universities and universities of applied sciences. ${langInstruction}`;

  switch (mode) {
    case "explain":
      return `${basePersona}

Mode: Explain ("Explain this to me")
- Explain the topic at student level, not too academic
- Use analogies and everyday examples
- Structure your explanation: Overview → Details → Summary
- Ask at the end whether the student understood or if you should go deeper
- If a topic/module is given, tailor the explanation accordingly${contextBlock}${docBlock}`;

    case "quiz":
      return `${basePersona}

Mode: Exam preparation / Quiz
- Ask the student exam-style questions on the topic
- Start with an easy question and increase difficulty
- After each answer: give constructive feedback (correct/incorrect + explanation)
- Mix question types: multiple choice, open questions, application tasks
- Adjust difficulty based on answers
- Format: always ask exactly ONE question and wait for the answer${contextBlock}${docBlock}`;

    case "summarize":
      return `${basePersona}

Mode: Summary
- Create a clear, structured summary of the given content
- Highlight the most important concepts and key terms
- Use bullet points for better readability
- Add 3-5 possible exam questions at the end
- Maintain technical accuracy${contextBlock}${docBlock}`;

    default: // chat
      return `${basePersona}

Mode: Free chat / Study help
- Help the student with study-related questions
- You can explain concepts, help with assignments, recommend learning strategies
- Be encouraging and motivating
- If the student doesn't understand a topic, try different explanation approaches
- You can also help with time management, study planning, and motivation${contextBlock}${docBlock}`;
  }
}

/**
 * POST /api/ai/chat
 *
 * Streaming chat endpoint for the AI study assistant.
 * Uses Claude API with SSE streaming.
 */
export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY || !SUPABASE_SERVICE_KEY) {
    console.error("Missing env vars:", { hasAnthropicKey: !!ANTHROPIC_API_KEY, hasServiceKey: !!SUPABASE_SERVICE_KEY });
    return new Response(JSON.stringify({ error: "KI-Service nicht konfiguriert. Bitte ANTHROPIC_API_KEY und SUPABASE_SERVICE_ROLE_KEY in .env.local setzen." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth check
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body: ChatRequestBody = await req.json();
  const { messages, mode, context } = body;

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Keine Nachrichten" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Keep only last 20 messages for context window management
  const trimmedMessages = messages.slice(-20);

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
        max_tokens: 2048,
        stream: true,
        system: buildSystemPrompt(mode, context),
        messages: trimmedMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Claude API error:", err);
      return new Response(JSON.stringify({ error: "KI-Fehler" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream the response using SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = res.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
                  } else if (parsed.type === "message_stop") {
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  }
                } catch {
                  // Skip unparseable lines
                }
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("AI chat error:", err);
    return new Response(JSON.stringify({ error: "Interner Fehler" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
