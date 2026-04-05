"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  Users, ArrowLeft, Crown, Shield, UserCircle, Copy, Check,
  UserPlus, LogOut, Trash2, FileText, FolderOpen, Share2,
  MessageCircle, Activity, Settings,
} from "lucide-react";
import toast from "react-hot-toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import GroupChat from "@/components/groups/GroupChat";
import ActivityFeed from "@/components/groups/ActivityFeed";
import RoleManager from "@/components/groups/RoleManager";

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
        <div className="p-6 max-w-4xl mx-auto animate-pulse">
          <div className="h-8 bg-surface-100 rounded-xl w-48 mb-6" />
          <div className="h-32 bg-surface-100 rounded-2xl" />
        </div>
      ) : !group ? (
        <div className="p-6 max-w-4xl mx-auto text-center py-20 text-surface-400">
          <p>{t("groups.notFound")}</p>
        </div>
      ) : (
        <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.push("/groups")}
        className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-4"
      >
        <ArrowLeft size={16} /> {t("groups.backToGroups")}
      </button>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: group.color }}
          >
            <Users size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-surface-900">{group.name}</h1>
            {group.description && (
              <p className="text-sm text-surface-500 mt-0.5">{group.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-50 rounded-lg text-xs font-mono text-surface-600 hover:bg-surface-100 transition-colors"
            >
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              {group.invite_code}
            </button>
            {myRole !== "owner" && (
              <button
                onClick={leaveGroup}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <LogOut size={12} /> {t("groups.leave")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────── */}
      <div className="border-b border-surface-200 mb-6 flex gap-1">
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
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-surface-600 hover:text-surface-800"
              }`}
            >
              <TabIcon size={16} />
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
                    <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-surface-50 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        {m.profiles?.avatar_url ? (
                          <img src={m.profiles.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-xs font-bold">
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
        <div className="card">
          <h2 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
            <Share2 size={16} className="text-brand-600" />
            {t("groups.sharedResources")}
          </h2>

          {shares.length === 0 ? (
            <div className="text-center py-8 text-surface-400">
              <FolderOpen size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t("groups.noSharedResources")}</p>
              <p className="text-xs mt-1">{t("groups.shareHint")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {shares.map(s => (
                <div key={s.id} className="flex items-center gap-3 py-2 px-3 bg-surface-50 rounded-xl">
                  {s.resource_type === "note" ? (
                    <FileText size={16} className="text-amber-500 shrink-0" />
                  ) : (
                    <FolderOpen size={16} className="text-blue-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-700">
                      {s.resource_type === "note" ? t("groups.sharedNote") : t("groups.sharedDocument")}
                    </p>
                    <p className="text-[10px] text-surface-400">
                      {t("groups.sharedBy")} @{s.profiles?.username} · {new Date(s.created_at).toLocaleDateString("de-CH")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
        </div>
      )}
    </ErrorBoundary>
  );
}
