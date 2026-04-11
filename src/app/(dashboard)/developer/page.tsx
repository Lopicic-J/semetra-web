"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useProfile } from "@/lib/hooks/useProfile";
import {
  Key, Webhook, BarChart3, Plus, Trash2, Copy, Check,
  Loader2, RefreshCw, Shield,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import toast from "react-hot-toast";

/* ── Types ── */
interface ApiKey {
  id: string; name: string; key_prefix: string; scopes: string[];
  rate_limit: number; last_used: string | null; expires_at: string | null;
  active: boolean; created_at: string;
}
interface WebhookEntry {
  id: string; url: string; events: string[]; secret_prefix: string;
  active: boolean; created_at: string;
}
interface UsageDay { date: string; count: number }
interface UsageByKey { key_id: string; key_prefix: string; name: string; count: number }
interface UsageData { daily: UsageDay[]; total: number; byKey: UsageByKey[] }

const TABS = ["keys", "webhooks", "usage"] as const;
type Tab = (typeof TABS)[number];

const AVAILABLE_SCOPES = [
  { value: "modules:read",  label: "Modules lesen" },
  { value: "modules:write", label: "Modules schreiben" },
  { value: "tasks:read",    label: "Tasks lesen" },
  { value: "tasks:write",   label: "Tasks schreiben" },
  { value: "grades:read",   label: "Noten lesen" },
  { value: "schedule:read", label: "Stundenplan lesen" },
  { value: "profile:read",  label: "Profil lesen" },
];

const AVAILABLE_EVENTS = [
  { value: "module.created",  label: "Modul erstellt" },
  { value: "module.updated",  label: "Modul aktualisiert" },
  { value: "task.completed",  label: "Task erledigt" },
  { value: "grade.added",     label: "Note hinzugefügt" },
  { value: "exam.scheduled",  label: "Prüfung geplant" },
];

export default function DeveloperPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPro, isAdmin, loading: profileLoading } = useProfile();

  const [tab, setTab] = useState<Tab>("keys");

  // Keys State
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [newKeyExpiry, setNewKeyExpiry] = useState<number>(90);
  const [showNewKey, setShowNewKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);

  // Webhooks State
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [newWhUrl, setNewWhUrl] = useState("");
  const [newWhEvents, setNewWhEvents] = useState<string[]>([]);
  const [showNewWh, setShowNewWh] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [creatingWh, setCreatingWh] = useState(false);

  // Usage State
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const canAccess = isPro || isAdmin;

  useEffect(() => {
    if (!profileLoading && !canAccess) router.replace("/dashboard");
  }, [profileLoading, canAccess, router]);

  const fetchKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const res = await fetch("/api/developer/keys");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setKeys(data.keys || []);
    } catch { toast.error("Fehler beim Laden der API-Keys"); }
    finally { setKeysLoading(false); }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    setWebhooksLoading(true);
    try {
      const res = await fetch("/api/developer/webhooks");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } catch { toast.error("Fehler beim Laden der Webhooks"); }
    finally { setWebhooksLoading(false); }
  }, []);

  const fetchUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const res = await fetch("/api/developer/usage");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsage(data);
    } catch { toast.error("Fehler beim Laden der Nutzungsdaten"); }
    finally { setUsageLoading(false); }
  }, []);

  useEffect(() => {
    if (!canAccess) return;
    fetchKeys(); fetchWebhooks(); fetchUsage();
  }, [canAccess, fetchKeys, fetchWebhooks, fetchUsage]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) { toast.error("Name erforderlich"); return; }
    setCreatingKey(true);
    try {
      const res = await fetch("/api/developer/keys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim(), scopes: newKeyScopes.length > 0 ? newKeyScopes : undefined, expiresInDays: newKeyExpiry }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRevealedKey(data.key.fullKey);
      setNewKeyName(""); setNewKeyScopes([]); setShowNewKey(false);
      toast.success("API-Key erstellt"); fetchKeys();
    } catch { toast.error("Fehler beim Erstellen"); }
    finally { setCreatingKey(false); }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const res = await fetch("/api/developer/keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyId: id }) });
      if (!res.ok) throw new Error();
      toast.success("Key deaktiviert"); fetchKeys();
    } catch { toast.error("Fehler beim Löschen"); }
  };

  const handleCreateWebhook = async () => {
    if (!newWhUrl.trim()) { toast.error("URL erforderlich"); return; }
    if (newWhEvents.length === 0) { toast.error("Mindestens ein Event wählen"); return; }
    setCreatingWh(true);
    try {
      const res = await fetch("/api/developer/webhooks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newWhUrl.trim(), events: newWhEvents }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRevealedSecret(data.webhook.secret);
      setNewWhUrl(""); setNewWhEvents([]); setShowNewWh(false);
      toast.success("Webhook erstellt"); fetchWebhooks();
    } catch { toast.error("Fehler beim Erstellen"); }
    finally { setCreatingWh(false); }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      const res = await fetch("/api/developer/webhooks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webhookId: id }) });
      if (!res.ok) throw new Error();
      toast.success("Webhook gelöscht"); fetchWebhooks();
    } catch { toast.error("Fehler beim Löschen"); }
  };

  const copyToClipboard = async (text: string, type: "key" | "secret") => {
    await navigator.clipboard.writeText(text);
    if (type === "key") { setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }
    else { setCopiedSecret(true); setTimeout(() => setCopiedSecret(false), 2000); }
    toast.success("Kopiert!");
  };

  const maxUsage = usage ? Math.max(...usage.daily.map(d => d.count), 1) : 1;

  if (profileLoading) {
    return (<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>);
  }
  if (!canAccess) return null;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-100">{t("nav.developer") || "Developer Console"}</h1>
        <p className="text-surface-600 dark:text-surface-400 mt-1">{t("developer.subtitle") || "API-Keys, Webhooks und Nutzungsstatistiken verwalten"}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-700 overflow-x-auto">
        {TABS.map((tb) => {
          const icons = { keys: Key, webhooks: Webhook, usage: BarChart3 };
          const labels = { keys: t("developer.tabKeys") || "API Keys", webhooks: t("developer.tabWebhooks") || "Webhooks", usage: t("developer.tabUsage") || "Nutzung" };
          const Icon = icons[tb];
          const active = tab === tb;
          return (
            <button key={tb} onClick={() => setTab(tb)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${active ? "border-brand-600 dark:border-brand-500 text-brand-700 dark:text-brand-400" : "border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 hover:border-surface-300 dark:hover:border-surface-600"}`}>
              <Icon size={16} /><span className="hidden sm:inline">{labels[tb]}</span><span className="sm:hidden">{labels[tb].split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* ══ KEYS TAB ══ */}
      {tab === "keys" && (
        <div className="space-y-4">
          {revealedKey && (
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 p-4">
              <div className="flex flex-col sm:flex-row items-start gap-3">
                <Shield className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-green-900 dark:text-green-200 text-sm mb-1">{t("developer.keyCreatedTitle") || "API-Key erstellt — jetzt kopieren!"}</p>
                  <p className="text-green-700 dark:text-green-300 text-xs mb-2">{t("developer.keyCreatedHint") || "Dieser Schlüssel wird nur einmal angezeigt."}</p>
                  <div className="overflow-x-auto flex items-center gap-2 bg-[rgb(var(--card-bg))] dark:bg-surface-800 rounded-lg px-3 py-2 border border-green-200 dark:border-green-800 font-mono text-xs break-all">
                    <span className="flex-1">{revealedKey}</span>
                    <button onClick={() => copyToClipboard(revealedKey, "key")} className="shrink-0 p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-800 transition-colors">
                      {copiedKey ? <Check size={14} className="text-green-600 dark:text-green-400" /> : <Copy size={14} className="text-green-600 dark:text-green-400" />}
                    </button>
                  </div>
                </div>
                <button onClick={() => setRevealedKey(null)} className="text-green-400 dark:text-green-500 hover:text-green-600 dark:hover:text-green-300 text-xs shrink-0">Schliessen</button>
              </div>
            </Card>
          )}

          <div className="flex justify-between items-center gap-2">
            <p className="text-sm text-surface-600 dark:text-surface-400">{keys.length} {keys.length === 1 ? "Key" : "Keys"} aktiv</p>
            <div className="flex gap-2">
              <button onClick={fetchKeys} className="p-2.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-surface-500 dark:text-surface-400"><RefreshCw size={16} /></button>
              <button onClick={() => setShowNewKey(!showNewKey)} className="flex items-center gap-2 px-3 py-2 bg-brand-600 dark:bg-brand-700 text-white rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors text-sm font-medium"><Plus size={15} /><span className="hidden sm:inline">Neuer Key</span><span className="sm:hidden">Key</span></button>
            </div>
          </div>

          {showNewKey && (
            <Card className="p-4 space-y-3 border-brand-200 dark:border-brand-800 bg-brand-50/30 dark:bg-brand-900/10">
              <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key-Name (z.B. 'Production App')" className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400" />
              <div>
                <p className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Scopes</p>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label key={scope.value} className="flex items-center gap-1.5 text-xs cursor-pointer text-surface-900 dark:text-surface-100">
                      <input type="checkbox" checked={newKeyScopes.includes(scope.value)} onChange={(e) => setNewKeyScopes(e.target.checked ? [...newKeyScopes, scope.value] : newKeyScopes.filter((s) => s !== scope.value))} className="rounded border-surface-300 dark:border-surface-600 text-brand-600 dark:text-brand-500 focus:ring-brand-500 dark:focus:ring-brand-400" />
                      {scope.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label className="text-xs text-surface-600 dark:text-surface-400 whitespace-nowrap">Ablauf in</label>
                <select value={newKeyExpiry} onChange={(e) => setNewKeyExpiry(Number(e.target.value))} className="text-sm px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] dark:bg-surface-800 text-surface-900 dark:text-surface-100">
                  <option value={30}>30 Tagen</option><option value={90}>90 Tagen</option><option value={180}>180 Tagen</option><option value={365}>1 Jahr</option>
                </select>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                <button onClick={() => setShowNewKey(false)} className="px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors">Abbrechen</button>
                <button onClick={handleCreateKey} disabled={creatingKey} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 dark:bg-brand-700 text-white rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors text-sm font-medium disabled:opacity-50">
                  {creatingKey && <Loader2 size={14} className="animate-spin" />}Erstellen
                </button>
              </div>
            </Card>
          )}

          {keysLoading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500" /></div>
          ) : keys.length === 0 ? (
            <Card className="text-center py-8 text-surface-500 dark:text-surface-400 text-sm">Noch keine API-Keys erstellt</Card>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <Card key={k.id} padding="sm" className="flex flex-col sm:flex-row sm:items-center gap-3 group">
                  <Key size={16} className="text-surface-400 dark:text-surface-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">{k.name}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 font-mono break-all">{k.key_prefix}...</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-surface-400 dark:text-surface-500">
                    {k.scopes.length > 0 && <span className="px-1.5 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-surface-600 dark:text-surface-300">{k.scopes.length} scope{k.scopes.length > 1 ? "s" : ""}</span>}
                    {k.last_used && <span className="truncate">Zuletzt: {new Date(k.last_used).toLocaleDateString("de-CH")}</span>}
                    {k.expires_at && <span className="truncate">Ablauf: {new Date(k.expires_at).toLocaleDateString("de-CH")}</span>}
                  </div>
                  <button onClick={() => handleDeleteKey(k.id)} className="p-2 rounded-lg text-surface-300 dark:text-surface-600 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ WEBHOOKS TAB ══ */}
      {tab === "webhooks" && (
        <div className="space-y-4">
          {revealedSecret && (
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 p-4">
              <div className="flex flex-col sm:flex-row items-start gap-3">
                <Shield className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-green-900 dark:text-green-200 text-sm mb-1">Webhook-Secret — jetzt kopieren!</p>
                  <p className="text-green-700 dark:text-green-300 text-xs mb-2">Dieses Secret wird nur einmal angezeigt.</p>
                  <div className="overflow-x-auto flex items-center gap-2 bg-[rgb(var(--card-bg))] dark:bg-surface-800 rounded-lg px-3 py-2 border border-green-200 dark:border-green-800 font-mono text-xs break-all">
                    <span className="flex-1">{revealedSecret}</span>
                    <button onClick={() => copyToClipboard(revealedSecret, "secret")} className="shrink-0 p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-800 transition-colors">
                      {copiedSecret ? <Check size={14} className="text-green-600 dark:text-green-400" /> : <Copy size={14} className="text-green-600 dark:text-green-400" />}
                    </button>
                  </div>
                </div>
                <button onClick={() => setRevealedSecret(null)} className="text-green-400 dark:text-green-500 hover:text-green-600 dark:hover:text-green-300 text-xs shrink-0">Schliessen</button>
              </div>
            </Card>
          )}

          <div className="flex justify-between items-center gap-2">
            <p className="text-sm text-surface-600 dark:text-surface-400">{webhooks.length} Webhook{webhooks.length !== 1 ? "s" : ""}</p>
            <div className="flex gap-2">
              <button onClick={fetchWebhooks} className="p-2.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-surface-500 dark:text-surface-400"><RefreshCw size={16} /></button>
              <button onClick={() => setShowNewWh(!showNewWh)} className="flex items-center gap-2 px-3 py-2 bg-brand-600 dark:bg-brand-700 text-white rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors text-sm font-medium"><Plus size={15} /><span className="hidden sm:inline">Neuer Webhook</span><span className="sm:hidden">Hook</span></button>
            </div>
          </div>

          {showNewWh && (
            <Card className="p-4 space-y-3 border-brand-200 dark:border-brand-800 bg-brand-50/30 dark:bg-brand-900/10">
              <input type="url" value={newWhUrl} onChange={(e) => setNewWhUrl(e.target.value)} placeholder="https://example.com/webhook" className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 break-all" />
              <div>
                <p className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Events</p>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_EVENTS.map((ev) => (
                    <label key={ev.value} className="flex items-center gap-1.5 text-xs cursor-pointer text-surface-900 dark:text-surface-100">
                      <input type="checkbox" checked={newWhEvents.includes(ev.value)} onChange={(e) => setNewWhEvents(e.target.checked ? [...newWhEvents, ev.value] : newWhEvents.filter((v) => v !== ev.value))} className="rounded border-surface-300 dark:border-surface-600 text-brand-600 dark:text-brand-500 focus:ring-brand-500 dark:focus:ring-brand-400" />
                      {ev.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                <button onClick={() => setShowNewWh(false)} className="px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors">Abbrechen</button>
                <button onClick={handleCreateWebhook} disabled={creatingWh} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 dark:bg-brand-700 text-white rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors text-sm font-medium disabled:opacity-50">
                  {creatingWh && <Loader2 size={14} className="animate-spin" />}Erstellen
                </button>
              </div>
            </Card>
          )}

          {webhooksLoading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500" /></div>
          ) : webhooks.length === 0 ? (
            <Card className="text-center py-8 text-surface-500 dark:text-surface-400 text-sm">Noch keine Webhooks eingerichtet</Card>
          ) : (
            <div className="space-y-2">
              {webhooks.map((wh) => (
                <Card key={wh.id} padding="sm" className="flex flex-col sm:flex-row sm:items-center gap-3 group">
                  <Webhook size={16} className="text-surface-400 dark:text-surface-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100 break-all">{wh.url}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {wh.events.map((ev) => (<span key={ev} className="text-[10px] px-1.5 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-surface-600 dark:text-surface-300">{ev}</span>))}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${wh.active ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400"}`}>{wh.active ? "Aktiv" : "Inaktiv"}</span>
                  <button onClick={() => handleDeleteWebhook(wh.id)} className="p-2 rounded-lg text-surface-300 dark:text-surface-600 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ USAGE TAB ══ */}
      {tab === "usage" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-2">
            <p className="text-sm text-surface-600 dark:text-surface-400">Letzte 30 Tage</p>
            <button onClick={fetchUsage} className="p-2.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-surface-500 dark:text-surface-400"><RefreshCw size={16} /></button>
          </div>

          {usageLoading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500" /></div>
          ) : !usage ? (
            <Card className="text-center py-8 text-surface-500 dark:text-surface-400 text-sm">Keine Nutzungsdaten verfügbar</Card>
          ) : (
            <>
              <Card padding="md">
                <p className="text-xs text-surface-500 dark:text-surface-400 uppercase tracking-wider font-semibold">Gesamt-Anfragen</p>
                <p className="text-2xl sm:text-4xl font-bold text-surface-900 dark:text-surface-100 mt-1">{usage.total.toLocaleString("de-CH")}</p>
              </Card>

              <Card padding="md">
                <p className="text-xs text-surface-500 dark:text-surface-400 uppercase tracking-wider font-semibold mb-3">Tägliche Anfragen</p>
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-[2px] h-32 min-w-full">
                    {usage.daily.map((d) => (
                      <div key={d.date} className="flex-1 flex flex-col items-center group/bar relative min-w-[20px]">
                        <div className="w-full bg-brand-500 dark:bg-brand-600 rounded-t-sm transition-all hover:bg-brand-600 dark:hover:bg-brand-500 min-h-[2px]" style={{ height: `${(d.count / maxUsage) * 100}%` }} />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover/bar:block bg-surface-900 dark:bg-surface-800 text-white dark:text-surface-100 text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                          {new Date(d.date).toLocaleDateString("de-CH", { day: "2-digit", month: "short" })}: {d.count}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-surface-400 dark:text-surface-500 mt-1">
                  <span>{usage.daily[0] && new Date(usage.daily[0].date).toLocaleDateString("de-CH", { day: "2-digit", month: "short" })}</span>
                  <span>{usage.daily[usage.daily.length - 1] && new Date(usage.daily[usage.daily.length - 1].date).toLocaleDateString("de-CH", { day: "2-digit", month: "short" })}</span>
                </div>
              </Card>

              {usage.byKey.length > 0 && (
                <Card padding="md">
                  <p className="text-xs text-surface-500 dark:text-surface-400 uppercase tracking-wider font-semibold mb-3">Nach API-Key</p>
                  <div className="space-y-2">
                    {usage.byKey.map((bk) => {
                      const pct = usage.total > 0 ? (bk.count / usage.total) * 100 : 0;
                      return (
                        <div key={bk.key_id} className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:justify-between text-sm mb-0.5 gap-2">
                              <span className="truncate text-surface-800 dark:text-surface-200 font-medium">{bk.name}</span>
                              <span className="text-surface-500 dark:text-surface-400 shrink-0">{bk.count.toLocaleString("de-CH")}</span>
                            </div>
                            <div className="h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-500 dark:bg-brand-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <span className="text-xs text-surface-400 dark:text-surface-500 sm:w-10 sm:text-right">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
