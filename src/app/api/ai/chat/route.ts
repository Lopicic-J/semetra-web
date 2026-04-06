import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const log = logger("ai:chat");

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type ChatMode = "explain" | "quiz" | "chat" | "summarize" | "study_plan" | "module_advice";

interface ChatRequestBody {
  messages: ChatMessage[];
  mode: ChatMode;
  conversationId?: string;        // For persistence
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

    case "study_plan":
      return `${basePersona}

Mode: Personalized Study Plan Generator
- Based on the student's academic profile (grades, progress, upcoming events), create a personalized study plan
- Consider which modules need the most attention (lowest grades, upcoming exams)
- Structure the plan as a daily/weekly schedule
- Factor in spaced repetition principles
- Balance workload across available time
- Prioritize modules with upcoming deadlines
- Include specific study methods per topic (active recall, practice problems, etc.)
- Be realistic about time estimates
- If the student has exams coming up, focus the plan on exam preparation${contextBlock}${docBlock}`;

    case "module_advice":
      return `${basePersona}

Mode: Module Advisor / Course Selection
- Help the student choose elective modules and plan their remaining semesters
- Analyze their strength/weakness profile based on existing grades
- Recommend modules that build on their strengths or help improve weak areas
- Consider prerequisites and module dependencies
- Factor in workload balance per semester
- Take into account the student's interests and career goals
- Suggest an optimal module sequence for remaining semesters
- Be honest about challenging modules but encouraging${contextBlock}${docBlock}`;

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
    log.error("Missing env vars", { hasAnthropicKey: !!ANTHROPIC_API_KEY, hasServiceKey: !!SUPABASE_SERVICE_KEY });
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
  const { messages, mode, context, conversationId } = body;

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Keine Nachrichten" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Build Academic Engine Context ──
  const { buildEngineContext, formatEngineContextBlock } = await import("@/lib/ai/engine-context");
  let engineContextBlock = "";
  try {
    const engineCtx = await buildEngineContext(supabase, user.id);
    engineContextBlock = formatEngineContextBlock(engineCtx);
  } catch (err) {
    log.warn("Engine context build failed (non-fatal)", err);
  }

  // ── Build Decision Engine Context ──
  const { buildDecisionContextBlock } = await import("@/lib/ai/decision-context");
  let decisionContextBlock = "";
  try {
    decisionContextBlock = await buildDecisionContextBlock(
      supabase,
      user.id,
      context?.moduleId ?? null
    );
  } catch (err) {
    log.warn("Decision context build failed (non-fatal)", err);
  }
  // Merge both context blocks
  engineContextBlock = engineContextBlock + decisionContextBlock;

  // ── Determine action type + token limits ──
  const { classifyChatAction, AI_TOKEN_LIMITS, truncateToTokenLimit } = await import("@/lib/ai-weights");
  const lastMsg = messages[messages.length - 1]?.content ?? "";
  const actionType = mode === "summarize" ? "notes_summarize" as const
    : mode === "explain" ? "chat_explain" as const
    : mode === "study_plan" ? "chat_explain" as const
    : mode === "module_advice" ? "chat_explain" as const
    : classifyChatAction(lastMsg);
  const limits = AI_TOKEN_LIMITS[actionType];

  // ── AI Usage Check (server-side metering with weight) ──
  const { checkAndIncrementAiUsage } = await import("@/lib/ai-usage");
  const aiCheck = await checkAndIncrementAiUsage(user.id, actionType);
  if (!aiCheck.allowed) {
    const msg = aiCheck.addonCredits === 0
      ? `KI-Kontingent aufgebraucht (${aiCheck.used}/${aiCheck.monthlyPool + aiCheck.addonCredits} Credits). Kaufe ein Add-on für weitere Requests.`
      : "KI-Kontingent aufgebraucht.";
    return new Response(JSON.stringify({ error: msg, usage: aiCheck }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Keep only last 20 messages for context window, truncate content to token limit
  const trimmedMessages = messages.slice(-20).map(m => ({
    role: m.role,
    content: truncateToTokenLimit(m.content, limits.maxInput),
  }));

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
        max_tokens: limits.maxOutput,
        stream: true,
        system: buildSystemPrompt(mode, context) + engineContextBlock,
        messages: trimmedMessages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      log.error("Claude API error", err);
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
        let fullAssistantResponse = "";

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
                    fullAssistantResponse += parsed.delta.text;
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
          log.error("Stream error", err);
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

          // ── Persist messages to chat history (fire-and-forget) ──
          if (conversationId && fullAssistantResponse) {
            try {
              const lastUserMsg = messages[messages.length - 1];
              // Save user message
              if (lastUserMsg) {
                await supabase.from("chat_messages").insert({
                  conversation_id: conversationId,
                  role: lastUserMsg.role,
                  content: lastUserMsg.content,
                });
              }
              // Save assistant response
              await supabase.from("chat_messages").insert({
                conversation_id: conversationId,
                role: "assistant",
                content: fullAssistantResponse,
              });
              // Update conversation metadata
              await supabase.from("chat_conversations").update({
                message_count: messages.length + 1,
                last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...(messages.length <= 1 ? {
                  title: (lastUserMsg?.content ?? "").slice(0, 60) +
                    ((lastUserMsg?.content ?? "").length > 60 ? "…" : ""),
                } : {}),
              }).eq("id", conversationId);
            } catch (persistErr) {
              log.warn("Chat persistence failed (non-fatal)", persistErr);
            }
          }
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
    log.error("AI chat error", err);
    return new Response(JSON.stringify({ error: "Interner Fehler" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
