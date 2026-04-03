"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { aiUsageToday, aiUsageIncrement } from "@/lib/gates";
import Link from "next/link";
import {
  Sparkles, Send, Brain, BookOpen, HelpCircle, FileText,
  ChevronDown, X, Loader2, Zap, MessageSquare, RotateCcw,
  GraduationCap, Target, Lightbulb, Lock
} from "lucide-react";
import type { CalendarEvent, Topic } from "@/types/database";

type ChatMode = "chat" | "explain" | "quiz" | "summarize";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatContext {
  moduleId?: string;
  moduleName?: string;
  examId?: string;
  examTitle?: string;
  topicId?: string;
  topicTitle?: string;
  documentText?: string;
  language?: string;
}

const MODE_CONFIGS: Record<ChatMode, { icon: React.ReactNode; colorClass: string }> = {
  chat:      { icon: <MessageSquare size={14} />, colorClass: "bg-brand-100 text-brand-700" },
  explain:   { icon: <Lightbulb size={14} />,     colorClass: "bg-amber-100 text-amber-700" },
  quiz:      { icon: <Target size={14} />,         colorClass: "bg-green-100 text-green-700" },
  summarize: { icon: <FileText size={14} />,       colorClass: "bg-blue-100 text-blue-700" },
};

export default function AIAssistantPage() {
  const { t, locale } = useTranslation();
  const { modules } = useModules();
  const { isPro } = useProfile();
  const supabase = createClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState<ChatMode>("chat");
  const [showContext, setShowContext] = useState(false);
  const [context, setContext] = useState<ChatContext>({});
  const [exams, setExams] = useState<CalendarEvent[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [usage, setUsage] = useState(aiUsageToday(isPro));

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch exams and topics for context selector
  useEffect(() => {
    async function fetch() {
      const [examRes, topicRes] = await Promise.all([
        supabase.from("events").select("*").eq("event_type", "exam").order("start_dt", { ascending: true }),
        supabase.from("topics").select("*").order("title", { ascending: true }),
      ]);
      setExams(examRes.data ?? []);
      setTopics(topicRes.data ?? []);
    }
    fetch();
  }, [supabase]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Refresh usage on mount
  useEffect(() => {
    setUsage(aiUsageToday(isPro));
  }, [isPro]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    // Check usage limit
    const currentUsage = aiUsageToday(isPro);
    if (!currentUsage.allowed) {
      setUsage(currentUsage);
      return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    // Increment usage counter
    aiUsageIncrement();
    setUsage(aiUsageToday(isPro));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMessages(prev =>
          prev.map(m => m.id === assistantMsg.id ? { ...m, content: t("ai.errorAuth") } : m)
        );
        setStreaming(false);
        return;
      }

      const allMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const abortController = new AbortController();
      abortRef.current = abortController;

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          mode,
          context: { ...context, language: locale },
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Fehler" }));
        setMessages(prev =>
          prev.map(m => m.id === assistantMsg.id ? { ...m, content: err.error || t("ai.errorGeneral") } : m)
        );
        setStreaming(false);
        return;
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      if (!reader) {
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

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
              if (parsed.text) {
                fullText += parsed.text;
                setMessages(prev =>
                  prev.map(m => m.id === assistantMsg.id ? { ...m, content: fullText } : m)
                );
              }
            } catch {
              // skip
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled
      } else {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id && !m.content
              ? { ...m, content: t("ai.errorGeneral") }
              : m
          )
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, messages, mode, context, locale, isPro, supabase, t]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  function newChat() {
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  }

  // Active context label
  const contextParts: string[] = [];
  if (context.moduleName) contextParts.push(context.moduleName);
  if (context.examTitle) contextParts.push(context.examTitle);
  if (context.topicTitle) contextParts.push(context.topicTitle);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="shrink-0 border-b border-surface-100 bg-white px-6 py-3">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900">{t("ai.title")}</h1>
              <p className="text-xs text-surface-500">{t("ai.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Usage counter */}
            {!isPro && (
              <div className="flex items-center gap-1.5 text-xs text-surface-500 bg-surface-50 px-2.5 py-1 rounded-lg">
                <Zap size={12} className={usage.remaining <= 1 ? "text-red-500" : "text-brand-500"} />
                {usage.remaining}/{usage.max} {t("ai.actionsLeft")}
              </div>
            )}
            <button onClick={newChat} className="p-2 rounded-lg hover:bg-surface-100 text-surface-400" title={t("ai.newChat")}>
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Mode & Context Selector */}
      <div className="shrink-0 bg-surface-50 border-b border-surface-100 px-6 py-2">
        <div className="flex items-center gap-2 max-w-3xl mx-auto flex-wrap">
          {/* Mode pills */}
          {(["chat", "explain", "quiz", "summarize"] as ChatMode[]).map(m => {
            const cfg = MODE_CONFIGS[m];
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  mode === m ? cfg.colorClass + " shadow-sm" : "text-surface-500 hover:bg-surface-100"
                }`}
              >
                {cfg.icon}
                {t(`ai.mode.${m}`)}
              </button>
            );
          })}

          <div className="w-px h-5 bg-surface-200 mx-1" />

          {/* Context button */}
          <button
            onClick={() => setShowContext(!showContext)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              contextParts.length > 0
                ? "bg-purple-100 text-purple-700"
                : "text-surface-500 hover:bg-surface-100"
            }`}
          >
            <BookOpen size={12} />
            {contextParts.length > 0 ? contextParts.join(" · ") : t("ai.addContext")}
            <ChevronDown size={10} className={showContext ? "rotate-180" : ""} />
          </button>
        </div>

        {/* Context dropdown */}
        {showContext && (
          <div className="max-w-3xl mx-auto mt-2 p-3 bg-white rounded-xl border border-surface-100 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Module */}
              <div>
                <label className="text-[10px] font-semibold text-surface-500 uppercase">{t("ai.contextModule")}</label>
                <select
                  className="input text-xs mt-1"
                  value={context.moduleId ?? ""}
                  onChange={e => {
                    const mod = modules.find(m => m.id === e.target.value);
                    setContext(c => ({ ...c, moduleId: mod?.id, moduleName: mod?.name }));
                  }}
                >
                  <option value="">{t("ai.contextNone")}</option>
                  {modules.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              {/* Exam */}
              <div>
                <label className="text-[10px] font-semibold text-surface-500 uppercase">{t("ai.contextExam")}</label>
                <select
                  className="input text-xs mt-1"
                  value={context.examId ?? ""}
                  onChange={e => {
                    const exam = exams.find(ex => ex.id === e.target.value);
                    setContext(c => ({ ...c, examId: exam?.id, examTitle: exam?.title }));
                  }}
                >
                  <option value="">{t("ai.contextNone")}</option>
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.title}</option>
                  ))}
                </select>
              </div>
              {/* Topic */}
              <div>
                <label className="text-[10px] font-semibold text-surface-500 uppercase">{t("ai.contextTopic")}</label>
                <select
                  className="input text-xs mt-1"
                  value={context.topicId ?? ""}
                  onChange={e => {
                    const topic = topics.find(tp => tp.id === e.target.value);
                    setContext(c => ({ ...c, topicId: topic?.id, topicTitle: topic?.title }));
                  }}
                >
                  <option value="">{t("ai.contextNone")}</option>
                  {topics.map(tp => (
                    <option key={tp.id} value={tp.id}>{tp.title}</option>
                  ))}
                </select>
              </div>
            </div>
            {contextParts.length > 0 && (
              <button
                onClick={() => { setContext({}); }}
                className="mt-2 text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <X size={10} /> {t("ai.clearContext")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <WelcomeScreen mode={mode} onSuggestion={(text) => { setInput(text); inputRef.current?.focus(); }} />
          ) : (
            messages.map(msg => (
              <ChatBubble key={msg.id} message={msg} streaming={streaming && msg.role === "assistant" && msg === messages[messages.length - 1]} />
            ))
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-surface-100 bg-white px-6 py-3">
        <div className="max-w-3xl mx-auto">
          {/* Usage limit warning */}
          {!isPro && !usage.allowed && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-amber-600" />
                <span className="text-xs text-amber-800">{t("ai.limitReached")}</span>
              </div>
              <Link href="/upgrade" className="flex items-center gap-1 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-brand-500">
                <Zap size={12} /> Upgrade
              </Link>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t(`ai.placeholder.${mode}`)}
                disabled={streaming || (!isPro && !usage.allowed)}
                className="input text-sm resize-none pr-4 min-h-[42px] max-h-[120px]"
                rows={1}
                style={{ height: "auto" }}
                onInput={e => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
              />
            </div>
            {streaming ? (
              <button onClick={stopStreaming} className="p-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors shrink-0">
                <X size={18} />
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim() || (!isPro && !usage.allowed)}
                className="p-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send size={18} />
              </button>
            )}
          </div>
          <p className="text-[10px] text-surface-400 mt-1.5 text-center">{t("ai.disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Welcome Screen ─── */
function WelcomeScreen({ mode, onSuggestion }: { mode: ChatMode; onSuggestion: (text: string) => void }) {
  const { t } = useTranslation();

  const suggestions = [
    { icon: <Lightbulb size={16} />, text: t("ai.suggestion.1"), color: "hover:border-amber-300 hover:bg-amber-50" },
    { icon: <GraduationCap size={16} />, text: t("ai.suggestion.2"), color: "hover:border-green-300 hover:bg-green-50" },
    { icon: <Brain size={16} />, text: t("ai.suggestion.3"), color: "hover:border-purple-300 hover:bg-purple-50" },
    { icon: <Target size={16} />, text: t("ai.suggestion.4"), color: "hover:border-blue-300 hover:bg-blue-50" },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white mb-4 shadow-lg">
        <Sparkles size={28} />
      </div>
      <h2 className="text-xl font-bold text-surface-900 mb-1">{t("ai.welcomeTitle")}</h2>
      <p className="text-sm text-surface-500 mb-8 max-w-md">{t("ai.welcomeDesc")}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggestion(s.text)}
            className={`flex items-start gap-3 p-4 rounded-xl border border-surface-200 text-left transition-all ${s.color}`}
          >
            <span className="text-surface-400 mt-0.5">{s.icon}</span>
            <span className="text-sm text-surface-700">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Chat Bubble ─── */
function ChatBubble({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white shrink-0 mt-0.5">
          <Sparkles size={14} />
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
        isUser
          ? "bg-brand-600 text-white"
          : "bg-surface-100 text-surface-800"
      }`}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm whitespace-pre-wrap leading-relaxed">
            {!message.content && streaming ? (
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            ) : (
              message.content
            )}
            {streaming && message.content && <span className="inline-block w-1 h-4 bg-brand-500 animate-pulse ml-0.5" />}
          </div>
        )}
      </div>
    </div>
  );
}
