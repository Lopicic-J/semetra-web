"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useModules } from "@/lib/hooks/useModules";
import {
  Users, ArrowLeft, Crown, Shield, UserCircle, Copy, Check,
  UserPlus, LogOut, Trash2, FileText, FolderOpen, Share2,
  MessageCircle, Activity, Settings, Plus, BookOpen,
  GraduationCap, Layers, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import GroupChat from "@/components/groups/GroupChat";
import ActivityFeed from "@/components/groups/ActivityFeed";
import RoleManager from "@/components/groups/RoleManager";
import { createClient } from "@/lib/supabase/client";
import UserProfileModal from "@/components/community/UserProfileModal";

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
}

interface GroupShare {
  id: string;
  resource_type: string;
  resource_id: string;
  shared_by: string;
  created_at: string;
  resource_name: string | null;
  profiles: { username: string; full_name: string | null } | null;
}

interface GroupData {
  id: string;
  name: string;
  description: string | null;
  color: string;
  invite_code: string;
  owner_id: string;
  max_members: number;
}

export default function GroupDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [shares, setShares] = useState<GroupShare[]>([]);
  const [myRole, setMyRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [addUsername, setAddUsername] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "members" | "activity" | "shared">("chat");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Get current user ID
      const authRes = await fetch("/api/auth/me");
      const authJson = await authRes.json();
      if (authJson.user?.id) {
        setCurrentUserId(authJson.user.id);
      }

      const res = await fetch(`/api/groups/${groupId}`);
      const json = await res.json();
      if (json.group) {
        setGroup(json.group);
        setMembers(json.members ?? []);
        setShares(json.shares ?? []);
        setMyRole(json.myRole ?? "member");
      }
    } catch (err) {
      console.error("[group-detail] load failed:", err);
      toast.error(t("groups.loadError") || "Fehler beim Laden");
    }
    setLoading(false);
  }, [groupId, t]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription for members + shares changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group-detail-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "study_group_members", filter: `group_id=eq.${groupId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_shares", filter: `group_id=eq.${groupId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, load]);

  async function addMember() {
    if (!addUsername.trim()) return;
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: addUsername.trim() }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error);
      else { setAddUsername(""); await load(); toast.success(t("groups.memberAdded") || "Mitglied hinzugefügt"); }
    } catch {
      toast.error(t("groups.addMemberError") || "Fehler beim Hinzufügen");
    }
  }

  const [RemoveConfirm, confirmRemove] = useConfirm({
    title: t("groups.removeMemberTitle") || "Mitglied entfernen?",
    description: t("groups.removeMemberDesc") || "Das Mitglied verliert Zugriff auf alle geteilten Inhalte.",
    confirmLabel: t("groups.removeBtn") || "Entfernen",
    variant: "danger",
  });

  const [LeaveConfirm, confirmLeave] = useConfirm({
    title: t("groups.leaveTitle") || "Gruppe verlassen?",
    description: t("groups.leaveDesc") || "Du verlierst Zugriff auf alle geteilten Inhalte der Gruppe.",
    confirmLabel: t("groups.leaveBtn") || "Verlassen",
    variant: "warning",
  });

  async function removeMember(userId: string) {
    const ok = await confirmRemove();
    if (!ok) return;
    try {
      await fetch(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      await load();
      toast.success(t("groups.memberRemoved") || "Mitglied entfernt");
    } catch {
      toast.error(t("groups.removeError") || "Fehler beim Entfernen");
    }
  }

  async function leaveGroup() {
    const ok = await confirmLeave();
    if (!ok) return;
    try {
      await fetch(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      toast.success(t("groups.leftGroup") || "Gruppe verlassen");
      router.push("/groups");
    } catch {
      toast.error(t("groups.leaveError") || "Fehler beim Verlassen");
    }
  }

  function copyCode() {
    if (group) {
      navigator.clipboard.writeText(group.invite_code);
      setCopied(true);
      toast.success(t("groups.codeCopied") || "Einladungscode kopiert!");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const ROLE_ICONS = { owner: Crown, admin: Shield, member: UserCircle };
  const isAdmin = myRole === "owner" || myRole === "admin";

  return (
    <ErrorBoundary feature="Gruppendetail">
      {RemoveConfirm}
      {LeaveConfirm}
      {loading ? (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse">
          <div className="h-8 bg-surface-100 rounded-xl w-48 mb-6" />
          <div className="h-32 bg-surface-100 rounded-2xl" />
        </div>
      ) : !group ? (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto text-center py-20 text-surface-400">
          <p>{t("groups.notFound")}</p>
        </div>
      ) : (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.push("/groups")}
 className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-200 mb-4"
      >
        <ArrowLeft size={16} /> {t("groups.backToGroups")}
      </button>

      {/* Header */}
 <div className="card mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: group.color }}
          >
            <Users size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-surface-900 dark:text-white truncate">{group.name}</h1>
            {group.description && (
 <p className="text-sm text-surface-500 mt-0.5 line-clamp-2">{group.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={copyCode}
 className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-50 rounded-lg text-xs font-mono text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-600 transition-colors"
            >
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              {group.invite_code}
            </button>
            {myRole !== "owner" && (
              <button
                onClick={leaveGroup}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              >
                <LogOut size={12} /> {t("groups.leave")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────── */}
 <div className="border-b border-surface-200 mb-6 flex gap-0.5 overflow-x-auto scrollbar-hide">
        {[
          { id: "chat" as const, label: t("groups.tabs.chat") || "Chat", icon: MessageCircle },
          { id: "members" as const, label: t("groups.tabs.members") || "Mitglieder", icon: Users },
          { id: "activity" as const, label: t("groups.tabs.activity") || "Aktivität", icon: Activity },
          { id: "shared" as const, label: t("groups.tabs.shared") || "Geteilt", icon: Share2 },
        ].map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400"
 :"border-transparent text-surface-600 hover:text-surface-800 dark:hover:text-surface-200"
              }`}
            >
              <TabIcon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Chat Tab ────────────────────────────── */}
      {activeTab === "chat" && (
        <div>
          <GroupChat groupId={groupId} currentUserId={currentUserId} />
        </div>
      )}

      {/* ── Members Tab ─────────────────────────── */}
      {activeTab === "members" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
              <Users size={16} className="text-brand-600" />
              {t("groups.members")} ({members.length}/{group.max_members})
            </h2>

            {/* Add member (admin) */}
            {isAdmin && (
              <div className="flex gap-2 mb-4">
                <input
                  value={addUsername}
                  onChange={e => setAddUsername(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addMember()}
                  placeholder={t("groups.addMemberPlaceholder")}
                  className="flex-1 px-3 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
                <button
                  onClick={addMember}
                  disabled={!addUsername.trim()}
                  className="p-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  <UserPlus size={16} />
                </button>
              </div>
            )}
            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

            {isAdmin ? (
              <RoleManager groupId={groupId} members={members} myRole={myRole} onUpdate={load} />
            ) : (
              <div className="space-y-2">
                {members.map(m => {
                  const RoleIcon = ROLE_ICONS[m.role as keyof typeof ROLE_ICONS] ?? UserCircle;
                  return (
 <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-surface-50 rounded-xl cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors" onClick={() => setSelectedUserId(m.user_id)}>
                      <div className="flex items-center gap-2.5">
                        {m.profiles?.avatar_url ? (
                          <img src={m.profiles.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900/40 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400 text-xs font-bold">
                            {(m.profiles?.full_name || m.profiles?.username || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <div>
 <p className="text-sm font-medium text-surface-800">
                            {m.profiles?.full_name || m.profiles?.username}
                          </p>
 <p className="text-[10px] text-surface-400">@{m.profiles?.username}</p>
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-surface-200 text-surface-600">
                        <RoleIcon size={10} />
                        {t(`groups.role.${m.role}`)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Activity Tab ────────────────────────── */}
      {activeTab === "activity" && (
        <ActivityFeed groupId={groupId} />
      )}

      {/* ── Shared Resources Tab ────────────────── */}
      {activeTab === "shared" && (
        <SharedResourcesTab groupId={groupId} shares={shares} currentUserId={currentUserId} isAdmin={isAdmin} onUpdate={load} />
      )}
        {/* Profile Modal */}
        <UserProfileModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
        </div>
      )}
    </ErrorBoundary>
  );
}

// ═══════════════════════════════════════════════════════════════
// Shared Resources Tab Component
// ═══════════════════════════════════════════════════════════════

const RESOURCE_TYPE_META: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  module:         { label: "Modul",           icon: BookOpen,      color: "text-brand-500" },
  exam:           { label: "Prüfung",         icon: GraduationCap, color: "text-red-500" },
  note:           { label: "Notiz",           icon: FileText,      color: "text-amber-500" },
  document:       { label: "Dokument",        icon: FolderOpen,    color: "text-blue-500" },
  flashcards:     { label: "Karteikarten",    icon: Layers,        color: "text-violet-500" },
};

function SharedResourcesTab({
  groupId, shares, currentUserId, isAdmin, onUpdate,
}: {
  groupId: string;
  shares: GroupShare[];
  currentUserId: string;
  isAdmin: boolean;
  onUpdate: () => void;
}) {
  const { t } = useTranslation();
  const { modules } = useModules();
  const supabase = createClient();

  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareType, setShareType] = useState<string>("module");
  const [shareSearch, setShareSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load shareable resources based on selected type
  useEffect(() => {
    if (!showShareDialog) return;
    async function loadResources() {
      let results: { id: string; name: string }[] = [];

      if (shareType === "module") {
        results = modules.map(m => ({ id: m.id, name: m.name }));
      } else if (shareType === "exam") {
        const { data } = await supabase
          .from("events")
          .select("id, title")
          .eq("event_type", "exam")
          .order("start_dt", { ascending: false })
          .limit(50);
        results = (data ?? []).map(e => ({ id: e.id, name: e.title }));
      } else if (shareType === "note") {
        const { data } = await supabase
          .from("notes")
          .select("id, title")
          .order("updated_at", { ascending: false })
          .limit(50);
        results = (data ?? []).map(n => ({ id: n.id, name: n.title || "Ohne Titel" }));
      } else if (shareType === "document") {
        const { data } = await supabase
          .from("documents")
          .select("id, name")
          .order("created_at", { ascending: false })
          .limit(50);
        results = (data ?? []).map(d => ({ id: d.id, name: d.name }));
      } else if (shareType === "flashcards") {
        const { data } = await supabase
          .from("flashcards")
          .select("id, question")
          .order("created_at", { ascending: false })
          .limit(50);
        results = (data ?? []).map(d => ({ id: d.id, name: d.question || "Karteikarte" }));
      }

      setSearchResults(results);
    }
    loadResources();
  }, [showShareDialog, shareType, modules, supabase]);

  const filteredResults = shareSearch
    ? searchResults.filter(r => r.name.toLowerCase().includes(shareSearch.toLowerCase()))
    : searchResults;

  // Already shared resource IDs for current type
  const alreadySharedIds = new Set(
    shares.filter(s => s.resource_type === shareType).map(s => s.resource_id)
  );

  async function shareResource(resourceId: string, resourceName: string) {
    setSharing(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType: shareType, resourceId, resourceName }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Fehler beim Teilen");
      } else {
        toast.success(`${RESOURCE_TYPE_META[shareType]?.label || "Ressource"} geteilt!`);
        onUpdate();
      }
    } catch {
      toast.error("Netzwerkfehler");
    }
    setSharing(false);
  }

  async function unshareResource(shareId: string) {
    setDeleting(shareId);
    try {
      const res = await fetch(`/api/groups/${groupId}/shares`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
      });
      if (res.ok) {
        toast.success("Freigabe entfernt");
        onUpdate();
      }
    } catch {
      toast.error("Fehler beim Entfernen");
    }
    setDeleting(null);
  }

  // Group shares by type
  const sharesByType = shares.reduce<Record<string, GroupShare[]>>((acc, s) => {
    if (!acc[s.resource_type]) acc[s.resource_type] = [];
    acc[s.resource_type].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header + Share button */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-surface-800 dark:text-white flex items-center gap-2">
          <Share2 size={16} className="text-brand-600" />
          Geteilte Ressourcen
          {shares.length > 0 && (
 <span className="text-xs bg-surface-200 text-surface-600 px-1.5 py-0.5 rounded-full">{shares.length}</span>
          )}
        </h2>
        <button
          onClick={() => { setShowShareDialog(true); setShareSearch(""); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 dark:bg-brand-700 text-white text-sm font-medium rounded-xl hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors active:scale-[0.97]"
        >
          <Plus size={14} /> Teilen
        </button>
      </div>

      {/* Share Dialog */}
      {showShareDialog && (
 <div className="card border-brand-200 dark:border-brand-800 bg-surface-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-surface-800 dark:text-white text-sm">Ressource teilen</h3>
            <button onClick={() => setShowShareDialog(false)} className="p-1 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400">
              <X size={16} />
            </button>
          </div>

          {/* Type selector */}
          <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide pb-1">
            {Object.entries(RESOURCE_TYPE_META).map(([key, meta]) => {
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  onClick={() => { setShareType(key); setShareSearch(""); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-all ${
                    shareType === key
                      ? "bg-brand-600 text-white"
 :"bg-surface-100 text-surface-600 hover:bg-surface-200 dark:hover:bg-surface-600"
                  }`}
                >
                  <Icon size={13} />
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <input
            value={shareSearch}
            onChange={e => setShareSearch(e.target.value)}
            placeholder={`${RESOURCE_TYPE_META[shareType]?.label || "Ressource"} suchen…`}
            className="w-full px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-xl text-sm bg-white dark:bg-surface-900 text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:focus:ring-brand-600 mb-3"
          />

          {/* Results */}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredResults.length === 0 ? (
 <p className="text-xs text-surface-400 text-center py-4">
                {searchResults.length === 0 ? `Keine ${RESOURCE_TYPE_META[shareType]?.label || "Ressourcen"} vorhanden` : "Keine Treffer"}
              </p>
            ) : (
              filteredResults.map(r => {
                const meta = RESOURCE_TYPE_META[shareType];
                const Icon = meta?.icon || FileText;
                const isShared = alreadySharedIds.has(r.id);
                return (
                  <div key={r.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
                    <Icon size={14} className={meta?.color || "text-surface-400"} />
 <span className="flex-1 text-sm text-surface-800 truncate">{r.name}</span>
                    {isShared ? (
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                        <Check size={12} /> Geteilt
                      </span>
                    ) : (
                      <button
                        onClick={() => shareResource(r.id, r.name)}
                        disabled={sharing}
                        className="text-xs px-2.5 py-1 bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors disabled:opacity-50"
                      >
                        Teilen
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Shared resources list grouped by type */}
      {shares.length === 0 ? (
 <div className="card text-center py-10 text-surface-400">
          <FolderOpen size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Noch nichts geteilt</p>
          <p className="text-xs mt-1.5">Teile Module, Prüfungen, Notizen oder Dokumente mit deiner Lerngruppe.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(sharesByType).map(([type, typeShares]) => {
            const meta = RESOURCE_TYPE_META[type];
            const Icon = meta?.icon || FileText;
            return (
              <div key={type} className="card">
 <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-700 mb-3">
                  <Icon size={15} className={meta?.color || "text-surface-400"} />
                  {meta?.label || type} ({typeShares.length})
                </h3>
                <div className="space-y-1.5">
                  {typeShares.map(s => {
                    const canRemove = s.shared_by === currentUserId || isAdmin;
                    return (
 <div key={s.id} className="flex items-center gap-2.5 py-2 px-3 bg-surface-50 rounded-xl group">
                        <Icon size={14} className={meta?.color || "text-surface-400"} />
                        <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-surface-800 truncate">
                            {s.resource_name || `${meta?.label || type} #${s.resource_id.slice(0, 8)}`}
                          </p>
 <p className="text-[10px] text-surface-400">
                            @{s.profiles?.username} · {new Date(s.created_at).toLocaleDateString("de-CH")}
                          </p>
                        </div>
                        {canRemove && (
                          <button
                            onClick={() => unshareResource(s.id)}
                            disabled={deleting === s.id}
 className="p-1.5 text-surface-300 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
