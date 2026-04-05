"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, AlertCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import toast from "react-hot-toast";
import { logger } from "@/lib/logger";

const log = logger("ui:group-chat");

interface Message {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  content: string;
  reply_to: string | null;
  created_at: string;
}

interface GroupChatProps {
  groupId: string;
  currentUserId: string;
}

export default function GroupChat({ groupId, currentUserId }: GroupChatProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      setError("");
      const res = await fetch(`/api/groups/${groupId}/messages?limit=50&offset=0`);
      const json = await res.json();
      if (json.messages) {
        setMessages(json.messages);
        setTimeout(scrollToBottom, 0);
      }
    } catch (err) {
      log.error("load failed", err);
      setError(t("groups.chat.loadError") || "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [groupId, t, scrollToBottom]);

  // Initial load
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Poll for new messages every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const handleSend = async () => {
    if (!content.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Fehler beim Senden");
        return;
      }

      setContent("");
      setError("");
      await loadMessages();
    } catch (err) {
      log.error("send failed", err);
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
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Gerade eben";
    if (minutes < 60) return `vor ${minutes}m`;
    if (hours < 24) return `vor ${hours}h`;
    if (days < 7) return `vor ${days}d`;

    return d.toLocaleDateString("de-CH");
  };

  return (
    <div className="flex flex-col h-full bg-surface-50 rounded-2xl border border-surface-200 overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-96">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 bg-surface-200 rounded-full shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-surface-200 rounded w-24 mb-2" />
                  <div className="h-3 bg-surface-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center py-12">
            <div>
              <p className="text-sm text-surface-500">
                {t("groups.chat.empty")}
              </p>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.user_id === currentUserId ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div className="shrink-0">
                {msg.avatar_url ? (
                  <img
                    src={msg.avatar_url}
                    alt={msg.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-xs font-bold">
                    {msg.username[0]?.toUpperCase() || "?"}
                  </div>
                )}
              </div>

              {/* Message bubble */}
              <div
                className={`flex-1 max-w-xs ${
                  msg.user_id === currentUserId
                    ? "items-end"
                    : "items-start"
                }`}
              >
                <div className="text-[10px] text-surface-500 px-3 mb-1">
                  <span className="font-medium text-surface-700">@{msg.username}</span>
                  <span className="ml-2">{formatTime(msg.created_at)}</span>
                </div>
                <div
                  className={`px-3 py-2 rounded-lg text-sm break-words ${
                    msg.user_id === currentUserId
                      ? "bg-brand-500 text-white rounded-br-none"
                      : "bg-surface-200 text-surface-900 rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex items-center gap-2 text-xs text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-surface-200 p-4 bg-white">
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("groups.chat.placeholder") || "Nachricht schreiben..."}
            disabled={sending}
            rows={3}
            className="flex-1 px-3 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className="p-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            title={t("groups.chat.send")}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-surface-400 mt-1">
          Enter = senden • Shift+Enter = Zeilenumbruch
        </p>
      </div>
    </div>
  );
}
