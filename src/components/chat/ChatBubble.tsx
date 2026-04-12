"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageCircle, X, Users, Search, Send,
  ChevronLeft, UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Friend {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  online_status: string;
}

interface Conversation {
  partnerId: string;
  partner: Friend;
  lastMessage: { content: string; created_at: string; isMine: boolean };
  unreadCount: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface StudyGroup {
  id: string;
  name: string;
  color: string;
  lastMessage?: string;
}

type View = "list" | "chat" | "groups";

// ─── Presence Hook ─────────────────────────────────────────────────────────────

function usePresence() {
  useEffect(() => {
    const update = (status: string) => {
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).catch(() => {});
    };

    // Set online
    update("online");

    // Heartbeat every 60s
    const interval = setInterval(() => update("online"), 60_000);

    // Set offline on close
    const handleBeforeUnload = () => {
      navigator.sendBeacon("/api/presence", JSON.stringify({ status: "offline" }));
    };

    // Set away on visibility change
    const handleVisibility = () => {
      update(document.hidden ? "away" : "online");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
      update("offline");
    };
  }, []);
}

// ─── ChatBubble Component ──────────────────────────────────────────────────────

interface ChatBubbleProps {
  /** Hide the floating bubble button (when using UnifiedFAB) */
  hideBubble?: boolean;
  /** External open state (controlled mode) */
  externalOpen?: boolean;
  /** Callback when external toggle requested */
  onExternalToggle?: () => void;
  /** Callback to report unread count changes */
  onUnreadChange?: (count: number) => void;
}

export default function ChatBubble({ hideBubble, externalOpen, onExternalToggle, onUnreadChange }: ChatBubbleProps = {}) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = externalOpen !== undefined;
  const open = controlled ? externalOpen : internalOpen;
  const setOpen = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    if (controlled) {
      onExternalToggle?.();
    } else {
      setInternalOpen(v);
    }
  }, [controlled, onExternalToggle]);
  const [view, setView] = useState<View>("list");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Report unread count to parent (UnifiedFAB)
  useEffect(() => { onUnreadChange?.(totalUnread); }, [totalUnread, onUnreadChange]);

  // Active chat state
  const [activeChatUser, setActiveChatUser] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  usePresence();

  // Get current user ID
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  // Safe JSON fetch helper — returns null on any error
  const safeFetch = useCallback(async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  // Load conversations and friends
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [convJson, friendsJson, groupsJson, unreadJson] = await Promise.all([
        safeFetch("/api/dm/conversations"),
        safeFetch("/api/friends?status=accepted"),
        safeFetch("/api/groups"),
        safeFetch("/api/presence"),
      ]);

      if (Array.isArray(convJson?.conversations)) {
        // Filter out conversations with missing partner data or lastMessage
        setConversations(
          convJson.conversations
            .filter((c: any) => c?.partner?.username && c?.lastMessage)
            .map((c: any) => ({
              ...c,
              partner: {
                ...c.partner,
                full_name: c.partner.full_name ?? null,
                avatar_url: c.partner.avatar_url ?? null,
                online_status: c.partner.online_status ?? "offline",
              },
              lastMessage: {
                content: c.lastMessage.content ?? "",
                created_at: c.lastMessage.created_at ?? new Date().toISOString(),
                isMine: !!c.lastMessage.isMine,
              },
              unreadCount: c.unreadCount ?? 0,
            }))
        );
      }
      if (Array.isArray(friendsJson?.friendships)) {
        setFriends(
          friendsJson.friendships
            .filter((f: any) => f?.friend?.id && f?.friend?.username)
            .map((f: any) => ({
              id: f.friend.id,
              username: f.friend.username,
              full_name: f.friend.full_name ?? null,
              avatar_url: f.friend.avatar_url ?? null,
              online_status: f.friend.online_status ?? "offline",
            }))
        );
      }
      if (Array.isArray(groupsJson?.groups)) {
        setGroups(
          groupsJson.groups.filter((g: any) => g?.id && g?.name)
        );
      }
      setTotalUnread(typeof unreadJson?.unread === "number" ? unreadJson.unread : 0);
    } catch (err) {
      console.error("ChatBubble loadData error:", err);
      setError(t("chat.loadError") || "Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [safeFetch, t]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  // Realtime: DM updates
  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    const channel = supabase
      .channel("chat-bubble-dm")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const msg = payload.new as Message;
        // Update conversation list
        loadData();
        // If in active chat with this user, add message
        if (activeChatUser && (msg.sender_id === activeChatUser.id || msg.receiver_id === activeChatUser.id)) {
          setMessages(prev => [...prev, msg]);
          // Mark as read if it's incoming
          if (msg.sender_id === activeChatUser.id) {
            fetch(`/api/dm/${activeChatUser.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ markRead: true }),
            }).catch(() => {});
          }
        }
        // Request notification permission and show
        if (msg.sender_id !== currentUserId && typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification("Semetra", {
              body: "Neue Nachricht",
              icon: "/icons/icon-192x192.png",
            });
          } catch { /* Notification API not available */ }
        }
      })
      .subscribe();

    // Request notification permission
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => { supabase.removeChannel(channel); };
  }, [open, activeChatUser, currentUserId, loadData]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat messages for a user
  const openChat = async (friend: Friend) => {
    setActiveChatUser(friend);
    setView("chat");
    setMessages([]);

    try {
      const json = await safeFetch(`/api/dm/${friend.id}`);
      if (Array.isArray(json?.messages)) {
        setMessages(json.messages.filter((m: any) => m?.id && m?.content !== undefined));
      }
      // Mark as read
      fetch(`/api/dm/${friend.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markRead: true }),
      }).catch(() => {});
      loadData(); // refresh unread counts
    } catch {
      // Silent
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChatUser || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/dm/${activeChatUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      if (res.ok) {
        setNewMessage("");
      }
    } catch {
      // Silent
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: string) => {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "";
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return t("chat.justNow") || "Jetzt";
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(diff / 3600000);
      if (hours < 24) return `${hours}h`;
      return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
    } catch {
      return "";
    }
  };

  /** Safe first-letter getter — never crashes on empty/null */
  const initial = (name: string | null | undefined): string =>
    (name && name.length > 0) ? name[0].toUpperCase() : "?";

  /** Display name from friend/partner */
  const displayName = (user: { full_name?: string | null; username?: string }): string =>
    user.full_name || user.username || "?";

  const StatusDot = ({ status, size = 8 }: { status: string; size?: number }) => {
    const colors: Record<string, string> = {
      online: "bg-green-500", away: "bg-amber-500", dnd: "bg-red-500", offline: "bg-surface-400",
    };
    return <span className={`inline-block rounded-full ${colors[status] || colors.offline}`} style={{ width: size, height: size }} />;
  };

  const filteredConversations = conversations.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.partner.username.toLowerCase().includes(q) || (c.partner.full_name?.toLowerCase().includes(q) ?? false);
  });

  const filteredFriends = friends.filter(f => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.username.toLowerCase().includes(q) || (f.full_name?.toLowerCase().includes(q) ?? false);
  });

  // Friends without active conversation
  const friendsWithoutConvo = filteredFriends.filter(
    f => !conversations.some(c => c.partnerId === f.id)
  );

  return (
    <>
      {/* Bubble Button — hidden when using UnifiedFAB */}
      {!hideBubble && <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          open
            ? "bg-surface-700 dark:bg-surface-600 scale-90"
            : "bg-brand-600 hover:bg-brand-700 dark:bg-brand-700 dark:hover:bg-brand-600 hover:scale-105"
        }`}
        aria-label="Chat"
      >
        {open ? (
          <X className="text-white" size={22} />
        ) : (
          <>
            <MessageCircle className="text-white" size={22} />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </>
        )}
      </button>}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[520px] bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 flex flex-col overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/80">
            {view === "chat" && activeChatUser ? (
              <div className="flex items-center gap-2">
                <button onClick={() => { setView("list"); setActiveChatUser(null); }} className="p-1 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg transition-colors">
                  <ChevronLeft size={18} className="text-surface-600 dark:text-surface-400" />
                </button>
                <div className="flex items-center gap-2">
                  {activeChatUser.avatar_url ? (
                    <img src={activeChatUser.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                      <span className="text-brand-600 dark:text-brand-400 font-bold text-xs">
                        {initial(activeChatUser.full_name || activeChatUser.username)}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-surface-900 dark:text-white leading-tight">
                      {displayName(activeChatUser)}
                    </p>
                    <p className="text-[10px] text-surface-500 dark:text-surface-400 flex items-center gap-1">
                      <StatusDot status={activeChatUser.online_status} size={6} />
                      {activeChatUser.online_status === "online" ? "Online" : activeChatUser.online_status === "dnd" ? (t("chat.dnd") || "Nicht stören") : "Offline"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-brand-600 dark:text-brand-400" />
                <span className="text-sm font-bold text-surface-900 dark:text-white">
                  {t("chat.title") || "Chat"}
                </span>
                {totalUnread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold">
                    {totalUnread}
                  </span>
                )}
              </div>
            )}

            {view !== "chat" && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setView("list")}
                  className={`p-1.5 rounded-lg transition-colors ${view === "list" ? "bg-brand-100 dark:bg-brand-900/30 text-brand-600" : "text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700"}`}
                  title={t("chat.chats") || "Chats"}
                >
                  <MessageCircle size={16} />
                </button>
                <button
                  onClick={() => setView("groups")}
                  className={`p-1.5 rounded-lg transition-colors ${view === "groups" ? "bg-brand-100 dark:bg-brand-900/30 text-brand-600" : "text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700"}`}
                  title={t("chat.groups") || "Gruppen"}
                >
                  <Users size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* ── List View ── */}
            {view === "list" && (
              <div>
                {/* Search */}
                <div className="px-3 py-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" size={14} />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder={t("chat.search") || "Suchen..."}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-700/50 border-none text-xs text-surface-900 dark:text-white placeholder:text-surface-400 focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>

                {error ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-red-500 dark:text-red-400 mb-2">{error}</p>
                    <button
                      onClick={loadData}
                      className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                    >
                      {t("chat.retry") || "Erneut versuchen"}
                    </button>
                  </div>
                ) : loading ? (
                  <div className="px-4 py-8 text-center text-xs text-surface-400">
                    {t("chat.loading") || "Laden..."}
                  </div>
                ) : (
                  <>
                    {/* Active conversations */}
                    {filteredConversations.length > 0 && (
                      <div>
                        {filteredConversations.map(conv => (
                          <button
                            key={conv.partnerId}
                            onClick={() => openChat(conv.partner as Friend)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors text-left"
                          >
                            <div className="relative shrink-0">
                              {conv.partner.avatar_url ? (
                                <img src={conv.partner.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                                  <span className="text-brand-600 dark:text-brand-400 font-bold text-sm">
                                    {initial(conv.partner.full_name || conv.partner.username)}
                                  </span>
                                </div>
                              )}
                              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-surface-800 ${
                                conv.partner.online_status === "online" ? "bg-green-500" : "bg-surface-400"
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                                  {displayName(conv.partner)}
                                </span>
                                <span className="text-[10px] text-surface-400 shrink-0 ml-2">
                                  {formatTime(conv.lastMessage.created_at)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                                  {conv.lastMessage.isMine && <span className="text-surface-400">Du: </span>}
                                  {conv.lastMessage.content}
                                </p>
                                {conv.unreadCount > 0 && (
                                  <span className="ml-2 w-4.5 h-4.5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {conv.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Friends without conversations */}
                    {friendsWithoutConvo.length > 0 && (
                      <div>
                        <p className="px-4 py-2 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
                          {t("chat.friends") || "Freunde"}
                        </p>
                        {friendsWithoutConvo.map(friend => (
                          <button
                            key={friend.id}
                            onClick={() => openChat(friend)}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors text-left"
                          >
                            <div className="relative shrink-0">
                              {friend.avatar_url ? (
                                <img src={friend.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center">
                                  <span className="text-surface-600 dark:text-surface-400 font-bold text-xs">
                                    {initial(friend.full_name || friend.username)}
                                  </span>
                                </div>
                              )}
                              <StatusDot status={friend.online_status} size={6} />
                            </div>
                            <span className="text-sm text-surface-700 dark:text-surface-500 truncate">
                              {displayName(friend)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {filteredConversations.length === 0 && friendsWithoutConvo.length === 0 && (
                      <div className="px-4 py-8 text-center">
                        <MessageCircle className="mx-auto text-surface-300 dark:text-surface-600 mb-2" size={32} />
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {t("chat.noConversations") || "Noch keine Unterhaltungen"}
                        </p>
                        <Link
                          href="/community"
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-1 mt-2 text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                        >
                          <Users size={12} />
                          {t("chat.findPeople") || "Leute finden"}
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Groups View ── */}
            {view === "groups" && (
              <div>
                {groups.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Users className="mx-auto text-surface-300 dark:text-surface-600 mb-2" size={32} />
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {t("chat.noGroups") || "Noch keine Lerngruppen"}
                    </p>
                    <Link
                      href="/groups"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-1 mt-2 text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                    >
                      <UserPlus size={12} />
                      {t("chat.createGroup") || "Gruppe erstellen"}
                    </Link>
                  </div>
                ) : (
                  groups.map(group => (
                    <Link
                      key={group.id}
                      href={`/groups?group=${group.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: group.color }}
                      >
                        {initial(group.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{group.name}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* ── Chat View ── */}
            {view === "chat" && activeChatUser && (
              <div className="flex flex-col h-[380px]">
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                  {messages.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-xs text-surface-400">
                        {t("chat.startConversation") || "Starte eine Unterhaltung!"}
                      </p>
                    </div>
                  )}
                  {messages.map(msg => {
                    const isMine = msg.sender_id === currentUserId;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] px-3 py-1.5 rounded-2xl text-sm ${
                            isMine
                              ? "bg-brand-600 text-white rounded-br-md"
                              : "bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-white rounded-bl-md"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-[13px]">{msg.content}</p>
                          <p className={`text-[9px] mt-0.5 ${isMine ? "text-white/60" : "text-surface-400"}`}>
                            {new Date(msg.created_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                            {isMine && msg.read_at && " ✓✓"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-3 py-2 border-t border-surface-100 dark:border-surface-700">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder={t("chat.typePlaceholder") || "Nachricht schreiben..."}
                      className="flex-1 px-3 py-2 rounded-xl bg-surface-100 dark:bg-surface-700/50 border-none text-sm text-surface-900 dark:text-white placeholder:text-surface-400 focus:ring-1 focus:ring-brand-500"
                      disabled={sending}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="p-2 rounded-xl bg-brand-600 text-white disabled:opacity-40 hover:bg-brand-700 transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer link */}
          {view !== "chat" && (
            <div className="px-4 py-2 border-t border-surface-100 dark:border-surface-700 flex items-center justify-between">
              <Link
                href="/community"
                onClick={() => setOpen(false)}
                className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold hover:underline flex items-center gap-1"
              >
                <Users size={12} />
                {t("chat.openCommunity") || "Community öffnen"}
              </Link>
              <Link
                href="/messages"
                onClick={() => setOpen(false)}
                className="text-[11px] text-surface-500 dark:text-surface-400 hover:underline"
              >
                {t("chat.openFull") || "Vollansicht →"}
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
