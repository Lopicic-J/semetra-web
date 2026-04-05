"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import toast from "react-hot-toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { UsageDashboard } from "@/components/developer/UsageDashboard";
import { WebhookManager } from "@/components/developer/WebhookManager";
import {
  Code, Plus, Copy, Check, Trash2, Key, Eye, EyeOff,
  Shield, Clock, Zap, ExternalLink, BarChart3, Webhook, BookOpen,
} from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit: number;
  last_used: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  fullKey?: string;
}

const SCOPES = ["read", "write", "modules", "grades", "notes", "tasks", "calendar", "time_logs"];

export default function DeveloperPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"keys" | "usage" | "webhooks" | "docs">("keys");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["read"]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [RevokeConfirm, confirmRevoke] = useConfirm({
    title: t("developer.revokeTitle") || "API-Key widerrufen?",
    description: t("developer.revokeDesc") || "Alle Anwendungen die diesen Key verwenden verlieren sofort den Zugriff.",
    confirmLabel: t("developer.revokeBtn") || "Widerrufen",
    variant: "danger",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/developer/keys");
      const json = await res.json();
      if (json.keys) setKeys(json.keys);
    } catch (err) {
      console.error("[developer] load failed:", err);
      toast.error(t("developer.loadError") || "Fehler beim Laden der API-Keys");
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { load(); }, [load]);

  async function createKey() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scopes: selectedScopes, expiresInDays: 365 }),
      });
      const json = await res.json();
      if (json.key) {
        setNewKey(json.key.fullKey);
        setShowCreate(false);
        setName("");
        setSelectedScopes(["read"]);
        load();
        toast.success(t("developer.keyCreatedToast") || "API-Key erstellt!");
      } else {
        toast.error(json.error || t("developer.createError") || "Fehler beim Erstellen");
      }
    } catch {
      toast.error(t("developer.createError") || "Fehler beim Erstellen des Keys");
    }
    setCreating(false);
  }

  async function revokeKey(keyId: string) {
    const ok = await confirmRevoke();
    if (!ok) return;
    try {
      await fetch("/api/developer/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      });
      load();
      toast.success(t("developer.keyRevoked") || "Key widerrufen");
    } catch {
      toast.error(t("developer.revokeError") || "Fehler beim Widerrufen");
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    toast.success(t("developer.keyCopied") || "API-Key kopiert!");
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <ErrorBoundary feature="Developer">
      {RevokeConfirm}
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Code className="text-brand-600" size={26} />
            {t("developer.title")}
          </h1>
          <p className="text-surface-500 text-sm mt-1">{t("developer.subtitle")}</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 border-b border-surface-200">
          <button
            onClick={() => setActiveTab("keys")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "keys"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-surface-500 hover:text-surface-700"
            }`}
          >
            <Key size={16} />
            {t("developer.tabs.keys") || "API-Keys"}
          </button>

          <button
            onClick={() => setActiveTab("usage")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "usage"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-surface-500 hover:text-surface-700"
            }`}
          >
            <BarChart3 size={16} />
            {t("developer.tabs.usage") || "Nutzung"}
          </button>

          <button
            onClick={() => setActiveTab("webhooks")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "webhooks"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-surface-500 hover:text-surface-700"
            }`}
          >
            <Webhook size={16} />
            {t("developer.tabs.webhooks") || "Webhooks"}
          </button>

          <button
            onClick={() => window.open("/developer/docs", "_blank")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-surface-500 hover:text-surface-700 transition-colors whitespace-nowrap"
          >
            <BookOpen size={16} />
            {t("developer.tabs.docs") || "Dokumentation"}
            <ExternalLink size={14} />
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "keys" && (
          <div className="space-y-4">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              <Plus size={16} /> {t("developer.newKey")}
            </button>

            {/* New key created banner */}
            {newKey && (
              <div className="card mb-6 border-green-200 bg-green-50">
                <div className="flex items-start gap-3">
                  <Key size={20} className="text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-800">{t("developer.keyCreated")}</p>
                    <p className="text-xs text-green-600 mt-1 mb-2">{t("developer.keyWarning")}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white px-3 py-2 rounded-lg border border-green-200 font-mono text-green-800 break-all">
                        {newKey}
                      </code>
                      <button onClick={() => copyKey(newKey)} className="p-2 bg-white rounded-lg border border-green-200 hover:bg-green-100">
                        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-green-600" />}
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setNewKey(null)} className="text-green-400 hover:text-green-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Create key form */}
            {showCreate && (
              <div className="card mb-6 border-brand-200">
                <h3 className="font-semibold text-surface-800 mb-4">{t("developer.createKey")}</h3>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t("developer.keyNamePlaceholder")}
                  className="w-full px-3 py-2 border border-surface-200 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
                <p className="text-xs text-surface-500 mb-2">{t("developer.selectScopes")}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {SCOPES.map(scope => (
                    <button
                      key={scope}
                      onClick={() => setSelectedScopes(prev =>
                        prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
                      )}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        selectedScopes.includes(scope)
                          ? "bg-brand-100 text-brand-700 border border-brand-300"
                          : "bg-surface-50 text-surface-500 border border-surface-200"
                      }`}
                    >
                      {scope}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={createKey} disabled={creating || !name.trim()} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                    {t("developer.generate")}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-surface-500 text-sm">
                    {t("developer.cancel")}
                  </button>
                </div>
              </div>
            )}

            {/* Keys list */}
            {loading ? (
              <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 bg-surface-100 rounded-xl animate-pulse" />)}</div>
            ) : keys.length === 0 ? (
              <div className="text-center py-16 text-surface-400">
                <Key size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">{t("developer.noKeys")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {keys.map(k => (
                  <div key={k.id} className={`card p-4 ${!k.active ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Key size={14} className="text-brand-500" />
                          <span className="text-sm font-semibold text-surface-800">{k.name}</span>
                          <code className="text-xs text-surface-400 font-mono">{k.key_prefix}...</code>
                          {!k.active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">revoked</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                          <span className="flex items-center gap-1"><Shield size={10} /> {k.scopes.join(", ")}</span>
                          <span className="flex items-center gap-1"><Zap size={10} /> {k.rate_limit}/min</span>
                          {k.last_used && <span className="flex items-center gap-1"><Clock size={10} /> {new Date(k.last_used).toLocaleDateString("de-CH")}</span>}
                        </div>
                      </div>
                      {k.active && (
                        <button onClick={() => revokeKey(k.id)} className="p-1.5 text-surface-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "usage" && <UsageDashboard />}

        {activeTab === "webhooks" && <WebhookManager />}
      </div>
    </ErrorBoundary>
  );
}
