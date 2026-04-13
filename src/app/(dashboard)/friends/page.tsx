"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, UserPlus, UserCheck, UserX, Search,
  MessageCircle, Clock, Ban, Check, X, MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import Link from "next/link";
import UserProfileModal from "@/components/community/UserProfileModal";

interface FriendProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
}

interface Friendship {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  direction: "incoming" | "outgoing";
  friend: FriendProfile;
}

type TabId = "friends" | "requests" | "search";

export default function FriendsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("friends");
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [addUsername, setAddUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const loadFriendships = useCallback(async () => {
    try {
      const res = await fetch("/api/friends?status=all");
      const json = await res.json();
      if (json.friendships) setFriendships(json.friendships);
    } catch {
      toast.error("Fehler beim Laden der Freunde");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFriendships();
  }, [loadFriendships]);

  // Realtime subscription for friendship changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("friendships-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => loadFriendships()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadFriendships]);

  const handleSendRequest = async () => {
    if (!addUsername.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: addUsername.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Fehler");
        return;
      }
      toast.success(json.message || "Anfrage gesendet!");
      setAddUsername("");
      loadFriendships();
    } catch {
      toast.error("Fehler beim Senden");
    } finally {
      setAdding(false);
    }
  };

  const handleAction = async (friendshipId: string, action: "accept" | "decline" | "block") => {
    setActionLoading(friendshipId);
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Fehler");
        return;
      }
      toast.success(json.message);
      loadFriendships();
    } catch {
      toast.error("Fehler");
    } finally {
      setActionLoading(friendshipId);
      setOpenMenu(null);
    }
  };

  const handleUnfriend = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Fehler");
        return;
      }
      toast.success(json.message || "Freundschaft entfernt");
      loadFriendships();
    } catch {
      toast.error("Fehler");
    } finally {
      setActionLoading(friendshipId);
      setOpenMenu(null);
    }
  };

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, full_name")
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(10);
      setSearchResults(data ?? []);
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const handleAddById = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Fehler");
        return;
      }
      toast.success(json.message || "Anfrage gesendet!");
      loadFriendships();
    } catch {
      toast.error("Fehler");
    } finally {
      setActionLoading(null);
    }
  };

  const friends = friendships.filter(f => f.status === "accepted");
  const incomingRequests = friendships.filter(f => f.status === "pending" && f.direction === "incoming");
  const outgoingRequests = friendships.filter(f => f.status === "pending" && f.direction === "outgoing");
  const pendingCount = incomingRequests.length;

  const tabs: { id: TabId; label: string; icon: typeof Users; badge?: number }[] = [
    { id: "friends", label: t("friends.myFriends") || "Meine Freunde", icon: Users },
    { id: "requests", label: t("friends.requests") || "Anfragen", icon: UserPlus, badge: pendingCount },
    { id: "search", label: t("friends.search") || "Suchen", icon: Search },
  ];

  const Avatar = ({ user, size = "md" }: { user: FriendProfile; size?: "sm" | "md" }) => {
    const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
    return user.avatar_url ? (
      <img src={user.avatar_url} alt={user.username} className={`${sizeClass} rounded-full object-cover`} />
    ) : (
      <div className={`${sizeClass} bg-brand-100 dark:bg-brand-900/40 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold`}>
        {(user.username ?? "?").charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <div className="px-1 sm:px-2 py-4 sm:py-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-xl">
          <Users className="text-brand-600 dark:text-brand-400" size={26} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white">
            {t("friends.title") || "Freunde"}
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {t("friends.subtitle") || "Freunde hinzufügen und private Nachrichten senden"}
          </p>
        </div>
      </div>

      {/* Add Friend Quick Action */}
      <div className="bg-white rounded-2xl border border-surface-200 p-4">
        <label className="text-sm font-medium text-surface-700 dark:text-surface-500 mb-2 block">
          {t("friends.addByUsername") || "Freund per Benutzername hinzufügen"}
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">@</span>
            <input
              type="text"
              value={addUsername}
              onChange={e => setAddUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendRequest()}
              placeholder={t("friends.usernamePlaceholder") || "benutzername"}
              className="w-full pl-8 pr-3 py-2.5 border border-surface-200 rounded-xl text-sm bg-surface-50 text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          <button
            onClick={handleSendRequest}
            disabled={!addUsername.trim() || adding}
            className="px-4 py-2.5 bg-brand-600 dark:bg-brand-700 text-white rounded-xl hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
          >
            <UserPlus size={16} />
            {adding ? "..." : (t("friends.send") || "Senden")}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? "bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm"
                : "text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200"
            }`}
          >
            <tab.icon size={16} />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge ? (
              <span className="absolute -top-1 -right-1 sm:static bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-3">
        {/* Friends Tab */}
        {activeTab === "friends" && (
          loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse p-4 bg-white rounded-xl border border-surface-200">
                  <div className="w-10 h-10 bg-surface-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-surface-200 rounded w-32 mb-2" />
                    <div className="h-3 bg-surface-200 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-surface-200">
              <Users className="mx-auto text-surface-300 dark:text-surface-600 mb-3" size={40} />
              <p className="text-surface-600 dark:text-surface-400 font-medium">
                {t("friends.noFriends") || "Noch keine Freunde"}
              </p>
              <p className="text-sm text-surface-400 dark:text-surface-500 mt-1">
                {t("friends.noFriendsHint") || "Füge Freunde über den Benutzernamen hinzu!"}
              </p>
            </div>
          ) : (
            friends.map(f => (
              <div key={f.id} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-surface-200 hover:border-brand-200 dark:hover:border-brand-800 transition-colors cursor-pointer" onClick={() => setSelectedUserId(f.friend.id)}>
                <Avatar user={f.friend} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-surface-900 dark:text-white truncate">
                    {f.friend.full_name || f.friend.username}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">@{f.friend.username}</p>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <Link
                    href={`/messages/${f.friend.id}`}
                    className="p-2 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
                    title={t("friends.sendMessage") || "Nachricht senden"}
                  >
                    <MessageCircle size={18} />
                  </Link>
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === f.id ? null : f.id)}
                      className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {openMenu === f.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-surface-200 rounded-xl shadow-lg z-10 py-1 min-w-[160px]">
                        <button
                          onClick={() => handleUnfriend(f.id)}
                          disabled={actionLoading === f.id}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2"
                        >
                          <UserX size={14} />
                          {t("friends.unfriend") || "Entfreunden"}
                        </button>
                        <button
                          onClick={() => handleAction(f.id, "block")}
                          disabled={actionLoading === f.id}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2"
                        >
                          <Ban size={14} />
                          {t("friends.block") || "Blockieren"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {/* Incoming */}
            {incomingRequests.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-400 mb-2 flex items-center gap-2">
                  <ChevronDown size={14} />
                  {t("friends.incoming") || "Eingehende Anfragen"} ({incomingRequests.length})
                </h3>
                <div className="space-y-2">
                  {incomingRequests.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-brand-200 cursor-pointer" onClick={() => setSelectedUserId(f.friend.id)}>
                      <Avatar user={f.friend} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-900 dark:text-white truncate">
                          {f.friend.full_name || f.friend.username}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">@{f.friend.username}</p>
                      </div>
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleAction(f.id, "accept")}
                          disabled={actionLoading === f.id}
                          className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                          title={t("friends.accept") || "Annehmen"}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => handleAction(f.id, "decline")}
                          disabled={actionLoading === f.id}
                          className="p-2 bg-surface-200 text-surface-600 rounded-lg hover:bg-surface-300 disabled:opacity-50 transition-colors"
                          title={t("friends.decline") || "Ablehnen"}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outgoing */}
            {outgoingRequests.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-400 mb-2 flex items-center gap-2">
                  <Clock size={14} />
                  {t("friends.outgoing") || "Gesendete Anfragen"} ({outgoingRequests.length})
                </h3>
                <div className="space-y-2">
                  {outgoingRequests.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-surface-200 cursor-pointer" onClick={() => setSelectedUserId(f.friend.id)}>
                      <Avatar user={f.friend} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-900 dark:text-white truncate">
                          {f.friend.full_name || f.friend.username}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">@{f.friend.username}</p>
                      </div>
                      <span className="text-xs text-surface-400 dark:text-surface-500 flex items-center gap-1">
                        <Clock size={12} />
                        {t("friends.pending") || "Ausstehend"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-surface-200">
                <UserCheck className="mx-auto text-surface-300 dark:text-surface-600 mb-3" size={40} />
                <p className="text-surface-600 dark:text-surface-400 font-medium">
                  {t("friends.noRequests") || "Keine offenen Anfragen"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === "search" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchUsers(e.target.value)}
                placeholder={t("friends.searchPlaceholder") || "Benutzer suchen..."}
                className="w-full pl-10 pr-3 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:focus:ring-brand-600"
              />
            </div>

            {searching && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map(user => {
                  const existingFriendship = friendships.find(
                    f => f.friend.id === user.id
                  );
                  return (
                    <div key={user.id} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-surface-200 cursor-pointer" onClick={() => setSelectedUserId(user.id)}>
                      <Avatar user={user} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-900 dark:text-white truncate">
                          {user.full_name || user.username}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">@{user.username}</p>
                      </div>
                      {existingFriendship ? (
                        <span className="text-xs px-3 py-1.5 rounded-lg bg-surface-100 text-surface-500">
                          {existingFriendship.status === "accepted"
                            ? (t("friends.alreadyFriend") || "Befreundet")
                            : (t("friends.pending") || "Ausstehend")}
                        </span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddById(user.id); }}
                          disabled={actionLoading === user.id}
                          className="px-3 py-1.5 bg-brand-600 dark:bg-brand-700 text-white rounded-lg text-xs font-medium hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                        >
                          <UserPlus size={14} />
                          {t("friends.add") || "Hinzufügen"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <div className="text-center py-8 text-surface-500 dark:text-surface-400 text-sm">
                {t("friends.noResults") || "Keine Benutzer gefunden"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile Modal */}
      <UserProfileModal
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </div>
  );
}
