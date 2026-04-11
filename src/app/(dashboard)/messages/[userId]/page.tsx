"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, AlertCircle, UserCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import Link from "next/link";
import { useParams } from "next/navigation";

interface DmMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  sender: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

interface Partner {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
}

export default function DirectMessagePage() {
  const { t } = useTranslation();
  const params = useParams();
  const userId = params.userId as string;

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Get current user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      setError("");
      const res = await fetch(`/api/dm/${userId}?limit=100&offset=0`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Fehler");
        return;
      }
      if (json.messages) {
        setMessages(json.messages);
        setTimeout(scrollToBottom, 50);
      }
      if (json.partner) setPartner(json.partner);
    } catch {
      setError(t("groups.chat.loadError") || "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [userId, t, scrollToBottom]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription for new messages in this conversation
  useEffect(() => {
    if (!currentUserId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`dm-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        (payload: Record<string, unknown>) => {
          const newMsg = payload.new as { sender_id?: string; receiver_id?: string } | undefined;
          // Only reload if this message is part of our conversation
          const involves = (
            (newMsg?.sender_id === userId && newMsg?.receiver_id === currentUserId) ||
            (newMsg?.sender_id === currentUserId && newMsg?.receiver_id === userId)
          );
          if (involves && newMsg?.sender_id !== currentUserId) {
            loadMessages();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, currentUserId, loadMessages]);

  const handleSend = async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/dm/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Fehler beim Senden");
        return;
      }
      setContent("");
      setError("");
      if (json.message) {
        setMessages(prev => [...prev, json.message]);
        setTimeout(scrollToBottom, 50);
      }
    } catch {
      toast.error(t("groups.chat.sendError") || "Nachricht konnte nicht gesendet werden");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return t("groups.chat.justNow") || "Gerade eben";
    if (minutes < 60) return `vor ${minutes}m`;
    if (hours < 24) return `vor ${hours}h`;
    return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const formatDateSeparator = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) return t("common.today") || "Heute";
    if (isYesterday) return t("common.yesterday") || "Gestern";
    return d.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: DmMessage[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const dateStr = new Date(msg.created_at).toDateString();
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groupedMessages.push({ date: msg.created_at, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
        <Link
          href="/messages"
          className="p-1.5 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        {partner ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {partner.avatar_url ? (
              <img src={partner.avatar_url} alt={partner.username} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 bg-brand-100 dark:bg-brand-900/40 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm">
                {(partner.username ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium text-surface-900 dark:text-surface-50 truncate">
                {partner.full_name || partner.username}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">@{partner.username}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-surface-200 dark:bg-surface-700 rounded-full animate-pulse" />
            <div className="h-4 w-24 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" />
          </div>
        )}
        <Link
          href={`/friends`}
          className="p-1.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
        >
          <UserCircle size={20} />
        </Link>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-surface-50 dark:bg-surface-900">
        {loading ? (
          <div className="space-y-3 py-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? "" : "flex-row-reverse"} animate-pulse`}>
                <div className="w-8 h-8 bg-surface-200 dark:bg-surface-700 rounded-full shrink-0" />
                <div className={`h-8 bg-surface-200 dark:bg-surface-700 rounded-xl ${i % 3 === 0 ? "w-48" : "w-32"}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center py-12">
            <div>
              <MessageCircleEmpty className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
              <p className="text-sm text-surface-500 dark:text-surface-400">
                {t("messages.startConversation") || "Schreibe die erste Nachricht!"}
              </p>
            </div>
          </div>
        ) : (
          groupedMessages.map((group, gi) => (
            <div key={gi}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
                <span className="text-[11px] text-surface-400 dark:text-surface-500 font-medium">
                  {formatDateSeparator(group.date)}
                </span>
                <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
              </div>

              {group.messages.map(msg => {
                const isMine = msg.sender_id === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 mb-2 ${isMine ? "flex-row-reverse" : ""}`}
                  >
                    {/* Avatar (only for other user) */}
                    {!isMine && (
                      <div className="shrink-0 mt-auto">
                        {msg.sender?.avatar_url ? (
                          <img src={msg.sender.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 bg-brand-100 dark:bg-brand-900/40 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400 text-[10px] font-bold">
                            {(msg.sender?.username ?? "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"}`}>
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm break-words ${
                          isMine
                            ? "bg-brand-500 text-white rounded-br-md"
                            : "bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 border border-surface-200 dark:border-surface-700 rounded-bl-md"
                        }`}
                      >
                        {msg.content}
                      </div>
                      <p className={`text-[10px] text-surface-400 dark:text-surface-500 mt-0.5 px-1 ${isMine ? "text-right" : ""}`}>
                        {formatTime(msg.created_at)}
                        {isMine && msg.read_at && (
                          <span className="ml-1 text-brand-400">✓</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-800 flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-surface-200 dark:border-surface-700 p-3 bg-white dark:bg-surface-800">
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("messages.placeholder") || "Nachricht schreiben..."}
            disabled={sending}
            rows={1}
            className="flex-1 px-3 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-50 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:focus:ring-brand-600 resize-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className="p-2.5 bg-brand-600 dark:bg-brand-700 text-white rounded-xl hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 active:scale-[0.95]"
            title={t("groups.chat.send") || "Senden"}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-1">
          Enter = {t("groups.chat.sendAction") || "senden"} • Shift+Enter = {t("groups.chat.newLine") || "Zeilenumbruch"}
        </p>
      </div>
    </div>
  );
}

// Simple empty message icon
function MessageCircleEmpty({ className }: { className?: string }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
