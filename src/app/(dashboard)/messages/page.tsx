"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Search, Users } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface ConversationPartner {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
}

interface Conversation {
  partnerId: string;
  partner: ConversationPartner;
  lastMessage: {
    id: string;
    content: string;
    created_at: string;
    read_at: string | null;
    isMine: boolean;
  };
  unreadCount: number;
}

export default function MessagesPage() {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/dm/conversations");
      const json = await res.json();
      if (json.conversations) setConversations(json.conversations);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Realtime: reload on new DMs
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dm-conversations-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        () => loadConversations()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadConversations]);

  const filtered = conversations.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.partner.username.toLowerCase().includes(q) ||
      (c.partner.full_name?.toLowerCase().includes(q) ?? false)
    );
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t("groups.chat.justNow") || "Gerade eben";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString("de-CH");
  };

  return (
    <div className="px-1 sm:px-2 py-4 sm:py-6 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-xl">
            <MessageCircle className="text-brand-600 dark:text-brand-400" size={26} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-surface-50">
              {t("messages.title") || "Nachrichten"}
            </h1>
            {totalUnread > 0 && (
              <p className="text-sm text-brand-600 dark:text-brand-400 font-medium">
                {totalUnread} {t("messages.unread") || "ungelesen"}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/friends"
          className="p-2.5 text-surface-500 hover:text-brand-600 dark:text-surface-400 dark:hover:text-brand-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
          title={t("friends.title") || "Freunde"}
        >
          <Users size={20} />
        </Link>
      </div>

      {/* Search */}
      {conversations.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("messages.search") || "Konversation suchen..."}
            className="w-full pl-10 pr-3 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-50 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:focus:ring-brand-600"
          />
        </div>
      )}

      {/* Conversation List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-3 p-4 animate-pulse bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700">
              <div className="w-12 h-12 bg-surface-200 dark:bg-surface-700 rounded-full shrink-0" />
              <div className="flex-1">
                <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-28 mb-2" />
                <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700">
          <MessageCircle className="mx-auto text-surface-300 dark:text-surface-600 mb-3" size={40} />
          <p className="text-surface-600 dark:text-surface-400 font-medium">
            {t("messages.empty") || "Noch keine Nachrichten"}
          </p>
          <p className="text-sm text-surface-400 dark:text-surface-500 mt-1">
            {t("messages.emptyHint") || "Schreibe einem Freund eine Nachricht!"}
          </p>
          <Link
            href="/friends"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Users size={16} />
            {t("friends.title") || "Freunde"}
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(conv => (
            <Link
              key={conv.partnerId}
              href={`/messages/${conv.partnerId}`}
              className={`flex items-center gap-3 p-3.5 rounded-xl transition-colors ${
                conv.unreadCount > 0
                  ? "bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800"
                  : "bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 hover:border-brand-200 dark:hover:border-brand-800"
              }`}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                {conv.partner.avatar_url ? (
                  <img src={conv.partner.avatar_url} alt={conv.partner.username} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/40 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-lg">
                    {(conv.partner.username ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
                {conv.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`font-medium truncate ${conv.unreadCount > 0 ? "text-surface-900 dark:text-surface-50" : "text-surface-700 dark:text-surface-300"}`}>
                    {conv.partner.full_name || conv.partner.username}
                  </p>
                  <span className="text-[11px] text-surface-400 dark:text-surface-500 shrink-0 ml-2">
                    {formatTime(conv.lastMessage.created_at)}
                  </span>
                </div>
                <p className={`text-sm truncate mt-0.5 ${conv.unreadCount > 0 ? "text-surface-700 dark:text-surface-300 font-medium" : "text-surface-500 dark:text-surface-400"}`}>
                  {conv.lastMessage.isMine && <span className="text-surface-400 dark:text-surface-500">Du: </span>}
                  {conv.lastMessage.content}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
