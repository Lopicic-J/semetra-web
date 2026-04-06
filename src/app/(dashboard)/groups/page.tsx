"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import {
  Users, Plus, X, Copy, Check, Crown, Shield, UserCircle,
  LogIn, Trash2, Settings, ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";

interface Group {
  id: string;
  name: string;
  description: string | null;
  color: string;
  invite_code: string;
  owner_id: string;
  max_members: number;
  created_at: string;
  myRole: string;
}

export default function GroupsPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/groups");
      const json = await res.json();
      if (json.groups) setGroups(json.groups);
    } catch (err) {
      console.error("[groups] load failed:", err);
      toast.error(t("groups.loadError") || "Fehler beim Laden der Gruppen");
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  async function createGroup() {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error); }
      else {
        setShowCreate(false);
        setName("");
        setDescription("");
        await loadGroups();
        toast.success(t("groups.created") || "Gruppe erstellt!");
      }
    } catch { setError("Netzwerkfehler"); }
    setCreating(false);
  }

  async function joinGroup() {
    if (!inviteCode.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error); }
      else {
        setShowJoin(false);
        setInviteCode("");
        await loadGroups();
        toast.success(t("groups.joined") || "Gruppe beigetreten!");
      }
    } catch { setError("Netzwerkfehler"); }
    setCreating(false);
  }

  const [DeleteConfirm, confirmDeleteGroup] = useConfirm({
    title: t("groups.deleteConfirmTitle") || "Gruppe löschen?",
    description: t("groups.deleteConfirmDesc") || "Alle Mitglieder und geteilten Inhalte werden entfernt.",
    confirmLabel: t("groups.deleteBtn") || "Löschen",
    variant: "danger",
  });

  async function deleteGroup(groupId: string) {
    const ok = await confirmDeleteGroup();
    if (!ok) return;
    try {
      await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      setGroups(prev => prev.filter(g => g.id !== groupId));
      toast.success(t("groups.deleted") || "Gruppe gelöscht");
    } catch {
      toast.error(t("groups.deleteError") || "Fehler beim Löschen");
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    toast.success(t("groups.codeCopied") || "Einladungscode kopiert!");
    setTimeout(() => setCopied(null), 2000);
  }

  const ROLE_ICONS = {
    owner: Crown,
    admin: Shield,
    member: UserCircle,
  };

  return (
    <ErrorBoundary feature="Gruppen">
      {DeleteConfirm}
      <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Users className="text-brand-600" size={26} />
            {t("groups.title")}
          </h1>
          <p className="text-surface-500 text-sm mt-1">{t("groups.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); setError(""); }}
            className="flex items-center gap-2 px-4 py-2 border border-surface-200 text-surface-700 rounded-xl text-sm font-medium hover:bg-surface-50 transition-colors"
          >
            <LogIn size={16} />
            {t("groups.join")}
          </button>
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); setError(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Plus size={16} />
            {t("groups.create")}
          </button>
        </div>
      </div>

      {/* ── Create Modal ──────────────────────────────────── */}
      {showCreate && (
        <div className="card mb-6 border-brand-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-surface-800">{t("groups.createTitle")}</h3>
            <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-surface-100 text-surface-400">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t("groups.namePlaceholder")}
              className="w-full px-3 py-2 border border-surface-200 rounded-xl text-sm bg-[rgb(var(--card-bg))] text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t("groups.descPlaceholder")}
              rows={2}
              className="w-full px-3 py-2 border border-surface-200 rounded-xl text-sm bg-[rgb(var(--card-bg))] text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              onClick={createGroup}
              disabled={creating || !name.trim()}
              className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {t("groups.createBtn")}
            </button>
          </div>
        </div>
      )}

      {/* ── Join Modal ────────────────────────────────────── */}
      {showJoin && (
        <div className="card mb-6 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-surface-800">{t("groups.joinTitle")}</h3>
            <button onClick={() => setShowJoin(false)} className="p-1 rounded-lg hover:bg-surface-100 text-surface-400">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              onKeyDown={e => e.key === "Enter" && joinGroup()}
              placeholder={t("groups.codePlaceholder")}
              className="flex-1 px-3 py-2 border border-surface-200 rounded-xl text-sm font-mono bg-[rgb(var(--card-bg))] text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={joinGroup}
              disabled={creating || !inviteCode.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {t("groups.joinBtn")}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      )}

      {/* ── Group cards ───────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 bg-surface-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title={t("groups.noGroups")}
          description={t("groups.noGroupsHint")}
          action={{ label: t("groups.create"), onClick: () => { setShowCreate(true); setShowJoin(false); setError(""); } }}
        />
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const RoleIcon = ROLE_ICONS[group.myRole as keyof typeof ROLE_ICONS] ?? UserCircle;
            return (
              <div
                key={group.id}
                className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/groups/${group.id}`)}
              >
                <div className="flex items-center gap-4">
                  {/* Color indicator */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ background: group.color }}
                  >
                    <Users size={20} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-surface-900 truncate">{group.name}</h3>
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-500">
                        <RoleIcon size={10} />
                        {t(`groups.role.${group.myRole}`)}
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-xs text-surface-500 truncate mt-0.5">{group.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {/* Invite code */}
                    <button
                      onClick={() => copyCode(group.invite_code)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-surface-500 bg-surface-50 rounded-lg hover:bg-surface-100 transition-colors font-mono"
                      title={t("groups.copyCode")}
                    >
                      {copied === group.invite_code ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      {group.invite_code}
                    </button>

                    {group.myRole === "owner" && (
                      <button
                        onClick={() => deleteGroup(group.id)}
                        className="p-1.5 text-surface-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    <ChevronRight size={16} className="text-surface-300" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
}
