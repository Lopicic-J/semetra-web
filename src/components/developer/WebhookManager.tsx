"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Plus, Trash2, Copy, Check, Eye, EyeOff, Webhook } from "lucide-react";
import { logger } from "@/lib/logger";

const log = logger("ui:webhooks");

interface WebhookRecord {
  id: string;
  url: string;
  events: string[];
  secret_prefix: string;
  active: boolean;
  created_at: string;
}

const EVENT_TYPES = [
  "grade.created",
  "module.updated",
  "task.completed",
  "achievement.unlocked",
];

export function WebhookManager() {
  const { t } = useTranslation();
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["grade.created"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [DeleteConfirm, confirmDelete] = useConfirm({
    title: t("developer.webhooks.deleteConfirm") || "Webhook löschen?",
    description: "Diese Aktion kann nicht rückgängig gemacht werden.",
    confirmLabel: "Löschen",
    variant: "danger",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/developer/webhooks");
      const json = await res.json();
      if (json.webhooks) setWebhooks(json.webhooks);
    } catch (err) {
      log.error("load failed", err);
      toast.error(t("developer.webhooks.loadError") || "Fehler beim Laden");
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { load(); }, [load]);

  async function createWebhook() {
    if (!url.trim()) {
      toast.error("URL erforderlich");
      return;
    }
    if (!selectedEvents.length) {
      toast.error("Mindestens ein Event erforderlich");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/developer/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), events: selectedEvents }),
      });
      const json = await res.json();
      if (json.webhook) {
        setNewSecret(json.webhook.secret);
        setShowCreate(false);
        setUrl("");
        setSelectedEvents(["grade.created"]);
        load();
        toast.success(t("developer.webhooks.created") || "Webhook erstellt!");
      } else {
        toast.error(json.error || "Fehler beim Erstellen");
      }
    } catch {
      toast.error("Fehler beim Erstellen des Webhooks");
    }
    setCreating(false);
  }

  async function deleteWebhook(id: string) {
    const ok = await confirmDelete();
    if (!ok) return;

    try {
      await fetch("/api/developer/webhooks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookId: id }),
      });
      load();
      toast.success(t("developer.webhooks.deleted") || "Webhook gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  function copySecret(secret: string) {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success("Secret kopiert!");
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="space-y-6">
      {DeleteConfirm}

      {/* New secret created banner */}
      {newSecret && (
        <div className="card mb-6 border-green-200 bg-green-50">
          <div className="flex items-start gap-3">
            <Webhook size={20} className="text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">{t("developer.webhooks.created")}</p>
              <p className="text-xs text-green-600 mt-1 mb-2">Kopiere das Secret jetzt — es wird nicht erneut angezeigt.</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={newSecret}
                    readOnly
                    className="w-full text-xs bg-[rgb(var(--card-bg))] px-3 py-2 rounded-lg border border-green-200 font-mono text-green-800"
                  />
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-green-600 hover:text-green-700"
                  >
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={() => copySecret(newSecret)}
                  className="p-2 bg-[rgb(var(--card-bg))] rounded-lg border border-green-200 hover:bg-green-100"
                >
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-green-600" />}
                </button>
              </div>
            </div>
            <button onClick={() => setNewSecret(null)} className="text-green-400 hover:text-green-600">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="card mb-6 border-brand-200 p-4">
          <h3 className="font-semibold text-surface-800 mb-4">{t("developer.webhooks.create")}</h3>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks"
            className="w-full px-3 py-2 border border-surface-200 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <p className="text-xs text-surface-500 mb-2">{t("developer.webhooks.events")}:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {EVENT_TYPES.map(event => (
              <button
                key={event}
                onClick={() => setSelectedEvents(prev =>
                  prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
                )}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedEvents.includes(event)
                    ? "bg-brand-100 text-brand-700 border border-brand-300"
                    : "bg-surface-50 text-surface-500 border border-surface-200"
                }`}
              >
                {event}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={createWebhook}
              disabled={creating || !url.trim()}
              className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {t("developer.webhooks.create")}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-surface-500 text-sm">
              {t("developer.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Create button */}
      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus size={16} /> {t("developer.webhooks.create")}
        </button>
      )}

      {/* Webhooks list */}
      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 bg-surface-100 rounded-xl animate-pulse" />)}</div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16 text-surface-400">
          <Webhook size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("developer.webhooks.empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh.id} className={`card p-4 ${!wh.active ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-surface-800 break-all">{wh.url}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {wh.events.map(event => (
                      <span key={event} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-600 border border-brand-100">
                        {event}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-surface-400 mt-2">
                    {wh.secret_prefix}... · erstellt {new Date(wh.created_at).toLocaleDateString("de-CH")}
                  </p>
                </div>
                {wh.active && (
                  <button
                    onClick={() => deleteWebhook(wh.id)}
                    className="p-1.5 text-surface-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
