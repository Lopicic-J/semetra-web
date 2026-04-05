"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  X, Share2, Link2, Copy, Check, UserPlus, Globe, Trash2, Users,
} from "lucide-react";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  resourceType: "note" | "document";
  resourceId: string;
  resourceTitle: string;
}

interface ShareEntry {
  id: string;
  permission: string;
  profiles?: { username: string; full_name: string | null; avatar_url: string | null };
}

interface ShareLink {
  id: string;
  token: string;
  permission: string;
  view_count: number;
  expires_at: string | null;
  active: boolean;
}

export default function ShareDialog({
  isOpen, onClose, resourceType, resourceId, resourceTitle,
}: ShareDialogProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [permission, setPermission] = useState<"viewer" | "editor">("viewer");
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"user" | "link">("user");

  // Load existing shares
  async function loadShares() {
    const res = await fetch(`/api/sharing?resourceType=${resourceType}&resourceId=${resourceId}`);
    const json = await res.json();
    if (json.shares) setShares(json.shares);
  }

  // Share with user
  async function handleShare() {
    if (!username.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sharing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType, resourceId, username: username.trim(), permission }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Fehler");
      } else {
        setUsername("");
        loadShares();
      }
    } catch { setError("Netzwerkfehler"); }
    setLoading(false);
  }

  // Remove share
  async function removeShare(shareId: string) {
    await fetch("/api/sharing", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId, resourceType }),
    });
    setShares(prev => prev.filter(s => s.id !== shareId));
  }

  // Create link
  async function createLink() {
    setLoading(true);
    try {
      const res = await fetch("/api/sharing/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType, resourceId, permission, expiresInDays: 30 }),
      });
      const json = await res.json();
      if (json.link) {
        setShareLinks(prev => [json.link, ...prev]);
      }
    } catch { /* noop */ }
    setLoading(false);
  }

  // Copy link
  function copyLink(token: string) {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Deactivate link
  async function deactivateLink(linkId: string) {
    await fetch("/api/sharing/link", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId }),
    });
    setShareLinks(prev => prev.filter(l => l.id !== linkId));
  }

  // Load on open
  if (isOpen && shares.length === 0 && shareLinks.length === 0) {
    loadShares();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface-100 rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-100">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-brand-600" />
            <h2 className="font-semibold text-surface-900">{t("sharing.title")}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-100 text-surface-400">
            <X size={18} />
          </button>
        </div>

        {/* Resource name */}
        <div className="px-4 pt-3 pb-2">
          <p className="text-sm text-surface-600 truncate">{resourceTitle}</p>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-1 mb-3">
          <button
            onClick={() => setTab("user")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "user" ? "bg-brand-50 text-brand-700" : "text-surface-500 hover:bg-surface-50"
            }`}
          >
            <UserPlus size={14} />
            {t("sharing.byUser")}
          </button>
          <button
            onClick={() => setTab("link")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "link" ? "bg-brand-50 text-brand-700" : "text-surface-500 hover:bg-surface-50"
            }`}
          >
            <Globe size={14} />
            {t("sharing.byLink")}
          </button>
        </div>

        <div className="px-4 pb-4 max-h-80 overflow-y-auto">
          {/* ── Share with user ──────────────────────── */}
          {tab === "user" && (
            <>
              <div className="flex gap-2 mb-3">
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleShare()}
                  placeholder={t("sharing.usernamePlaceholder")}
                  className="flex-1 px-3 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
                <select
                  value={permission}
                  onChange={e => setPermission(e.target.value as "viewer" | "editor")}
                  className="px-2 py-2 border border-surface-200 rounded-xl text-sm bg-surface-100"
                >
                  <option value="viewer">{t("sharing.viewer")}</option>
                  <option value="editor">{t("sharing.editor")}</option>
                </select>
                <button
                  onClick={handleShare}
                  disabled={loading || !username.trim()}
                  className="px-3 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  <UserPlus size={16} />
                </button>
              </div>

              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

              {/* Existing shares */}
              <div className="space-y-2">
                {shares.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-surface-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-xs font-bold">
                        {(s.profiles?.full_name || s.profiles?.username || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-surface-800">
                          {s.profiles?.full_name || s.profiles?.username}
                        </p>
                        <p className="text-[10px] text-surface-400">@{s.profiles?.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-200 text-surface-600">
                        {s.permission === "editor" ? t("sharing.editor") : t("sharing.viewer")}
                      </span>
                      <button
                        onClick={() => removeShare(s.id)}
                        className="p-1 text-surface-400 hover:text-red-500 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {shares.length === 0 && (
                  <p className="text-xs text-surface-400 text-center py-4">
                    {t("sharing.noShares")}
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── Share via link ──────────────────────── */}
          {tab === "link" && (
            <>
              <button
                onClick={createLink}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-50 text-brand-600 rounded-xl text-sm font-medium hover:bg-brand-100 transition-colors mb-3"
              >
                <Link2 size={15} />
                {t("sharing.createLink")}
              </button>

              <div className="space-y-2">
                {shareLinks.map(l => (
                  <div key={l.id} className="flex items-center justify-between py-2 px-3 bg-surface-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-surface-600 font-mono truncate">
                        /share/{l.token.slice(0, 8)}...
                      </p>
                      <p className="text-[10px] text-surface-400">
                        {l.view_count} {t("sharing.views")}
                        {l.expires_at && ` · ${t("sharing.expires")} ${new Date(l.expires_at).toLocaleDateString("de-CH")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => copyLink(l.token)}
                        className="p-1.5 text-surface-500 hover:text-brand-600 rounded-lg hover:bg-brand-50"
                      >
                        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                      <button
                        onClick={() => deactivateLink(l.id)}
                        className="p-1.5 text-surface-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {shareLinks.length === 0 && (
                  <p className="text-xs text-surface-400 text-center py-4">
                    {t("sharing.noLinks")}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
