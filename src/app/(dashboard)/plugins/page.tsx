"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { useProfile } from "@/lib/hooks/useProfile";
import toast from "react-hot-toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PluginConfig } from "@/components/plugins/PluginConfig";
import {
  Puzzle, Download, ToggleLeft, ToggleRight, Trash2, ExternalLink,
  Plug, Globe, BarChart3, Users, Palette, Wrench, Settings, X,
  Play, Clock, FileDown, Lock, ShoppingCart, BadgeCheck, Building2,
  Shield, ChevronDown, ChevronUp, AlertTriangle, Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Plugin {
  id: string;
  name: string;
  description: string | null;
  author: string;
  version: string;
  icon_url: string | null;
  homepage: string | null;
  category: string;
  permissions: string[];
  installed: boolean;
  enabled: boolean;
  config_schema?: any;
  userConfig?: Record<string, any>;
  // Monetization fields
  pricing_type: "free" | "premium";
  price_chf: number;
  requires_pro: boolean;
  status: "active" | "coming_soon" | "beta" | "deprecated";
  purchased: boolean;
  purchaseMethod: string | null;
  canAccess: boolean;
  isFreeViaInstitution: boolean;
  effectivePrice: number;
  // Legal fields
  legal_disclaimer: string | null;
  third_party_name: string | null;
  third_party_terms_url: string | null;
  data_processing_note: string | null;
}

const FUNCTIONAL_PLUGINS = new Set(["grade-export", "pomodoro-plus"]);

const CAT_ICONS: Record<string, LucideIcon> = {
  integration: Plug,
  productivity: Wrench,
  analytics: BarChart3,
  social: Users,
  theme: Palette,
  other: Puzzle,
};

const CAT_COLORS: Record<string, string> = {
  integration: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  productivity: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  analytics: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  social: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  theme: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
  other: "bg-surface-100 text-surface-600",
};

export default function PluginsPage() {
  const { t } = useTranslation();
  const { isPro, profile } = useProfile();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [configPluginId, setConfigPluginId] = useState<string | null>(null);
  const [pomodoroStats, setPomodoroStats] = useState<any>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [legalExpandedId, setLegalExpandedId] = useState<string | null>(null);
  const [hasInstitution, setHasInstitution] = useState(false);

  const [UninstallConfirm, confirmUninstall] = useConfirm({
    title: t("plugins.uninstallConfirm") || "Plugin deinstallieren?",
    description: t("plugins.uninstallDesc") || "Alle Plugin-Daten werden entfernt.",
    confirmLabel: t("plugins.uninstallBtn") || "Deinstallieren",
    variant: "danger",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/plugins");
      const json = await res.json();
      if (json.plugins) setPlugins(json.plugins);
      if (json.hasInstitution !== undefined) setHasInstitution(json.hasInstitution);
    } catch (err) {
      console.error("[plugins] load failed:", err);
      toast.error(t("plugins.loadError") || "Fehler beim Laden der Plugins");
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { load(); }, [load]);

  // Check URL for purchase success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchased")) {
      toast.success("Plugin erfolgreich erworben!");
      // Clean URL
      window.history.replaceState({}, "", "/plugins");
      load();
    }
    if (params.get("canceled")) {
      toast.error("Kauf abgebrochen");
      window.history.replaceState({}, "", "/plugins");
    }
  }, [load]);

  async function handleAction(pluginId: string, action: string) {
    if (action === "uninstall") {
      const ok = await confirmUninstall();
      if (!ok) return;
    }
    setActionId(pluginId);
    try {
      const res = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId, action }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Fehler");
        setActionId(null);
        return;
      }
      await load();
      const messages: Record<string, string> = {
        install: t("plugins.installSuccess") || "Plugin installiert!",
        uninstall: t("plugins.uninstallSuccess") || "Plugin deinstalliert",
        toggle: t("plugins.toggleSuccess") || "Plugin aktualisiert",
      };
      toast.success(messages[action] || "Aktion ausgeführt");
    } catch {
      toast.error(t("plugins.actionError") || "Fehler bei der Plugin-Aktion");
    }
    setActionId(null);
  }

  async function handlePurchase(pluginId: string) {
    setPurchasingId(pluginId);
    try {
      const res = await fetch("/api/plugins/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Fehler beim Kauf");
        setPurchasingId(null);
        return;
      }

      // Institution users get it free immediately
      if (json.granted) {
        toast.success("Plugin freigeschaltet!");
        await load();
        setPurchasingId(null);
        return;
      }

      // Redirect to Stripe checkout
      if (json.url) {
        window.location.href = json.url;
      }
    } catch {
      toast.error("Fehler beim Kauf");
      setPurchasingId(null);
    }
  }

  async function handleExecute(pluginId: string, action?: string) {
    setExecutingId(pluginId);
    try {
      const res = await fetch("/api/plugins/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId, action }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Ausführungsfehler"); return; }
      if (json.type === "download") {
        const blob = new Blob([json.content], { type: json.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = json.filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Export heruntergeladen!");
      } else if (json.type === "data") {
        setPomodoroStats(json.stats);
        toast.success("Statistiken geladen!");
      } else if (json.type === "config") {
        toast.success(`Fokus: ${json.focusMinutes}min, Pause: ${json.breakMinutes}min`);
      }
    } catch { toast.error("Plugin-Ausführung fehlgeschlagen"); }
    finally { setExecutingId(null); }
  }

  const categories = Array.from(new Set(plugins.map(p => p.category)));
  const filtered = filter === "all" ? plugins
    : filter === "installed" ? plugins.filter(p => p.installed)
    : filter === "premium" ? plugins.filter(p => p.pricing_type === "premium")
    : plugins.filter(p => p.category === filter);

  const isFunctional = (p: Plugin) => FUNCTIONAL_PLUGINS.has(p.id) || (p.status === "active" && p.canAccess);

  return (
    <ErrorBoundary feature="Plugins">
      {UninstallConfirm}
      <div className="p-3 sm:p-5 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
            <Puzzle className="text-brand-600 dark:text-brand-400" size={26} />
            {t("plugins.title")}
          </h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">{t("plugins.subtitle")}</p>
        </div>

        {/* Institution badge */}
        {hasInstitution && isPro && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400">
            <Building2 size={16} />
            <span>Alle Premium-Plugins sind für dich als Institutions-Mitglied kostenlos.</span>
          </div>
        )}

        {/* Not Pro hint */}
        {!isPro && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
            <Lock size={16} />
            <span>Premium-Plugins erfordern eine Pro-Mitgliedschaft. <a href="/upgrade" className="underline font-medium">Jetzt upgraden</a></span>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {["all", "installed", "premium", ...categories].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === cat ? "bg-brand-600 dark:bg-brand-700 text-white" : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              {cat === "all" ? (t("plugins.all") || "Alle")
                : cat === "installed" ? (t("plugins.installed") || "Installiert")
                : cat === "premium" ? "Premium"
                : t(`plugins.cat.${cat}`) || cat}
            </button>
          ))}
        </div>

        {/* Plugin grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-44 bg-surface-100 dark:bg-surface-800 rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-surface-400 dark:text-surface-500">
            <Puzzle size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t("plugins.noPlugins") || "Keine Plugins gefunden"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {filtered.map(p => {
              const CatIcon = CAT_ICONS[p.category] ?? Puzzle;
              const catColor = CAT_COLORS[p.category] ?? CAT_COLORS.other;
              const isActing = actionId === p.id;
              const isExecuting = executingId === p.id;
              const isPurchasing = purchasingId === p.id;
              const functional = isFunctional(p);
              const isPremium = p.pricing_type === "premium";
              const showLegal = legalExpandedId === p.id;

              return (
                <div key={p.id} className={`card dark:bg-surface-800 dark:border-surface-700 p-3 sm:p-5 ${p.status === "coming_soon" ? "opacity-75" : ""}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${catColor}`}>
                      <CatIcon size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-surface-900 dark:text-surface-100">{p.name}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400">v{p.version}</span>

                        {/* Status badges */}
                        {p.status === "coming_soon" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-semibold">
                            Coming Soon
                          </span>
                        )}
                        {p.status === "beta" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold">
                            Beta
                          </span>
                        )}

                        {/* Pricing badge */}
                        {isPremium && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 font-semibold flex items-center gap-0.5">
                            {p.canAccess ? (
                              <><BadgeCheck size={10} /> {p.isFreeViaInstitution ? "Inklusive" : "Erworben"}</>
                            ) : (
                              <><Lock size={10} /> CHF {p.price_chf.toFixed(2)}</>
                            )}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{p.description}</p>

                      {/* Third party notice */}
                      {p.third_party_name && (
                        <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-1 flex items-center gap-1">
                          <Globe size={9} />
                          Nutzt die {p.third_party_name} API
                        </p>
                      )}

                      <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-0.5">{t("plugins.by") || "Von"} {p.author}</p>

                      {/* Permissions */}
                      {p.permissions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.permissions.map(perm => (
                            <span key={perm} className="text-[10px] px-1.5 py-0.5 bg-surface-50 dark:bg-surface-700 rounded text-surface-500 dark:text-surface-400 border border-surface-100 dark:border-surface-600">
                              {perm}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Legal disclaimer (expandable) */}
                      {(p.legal_disclaimer || p.data_processing_note) && (
                        <div className="mt-2">
                          <button
                            onClick={() => setLegalExpandedId(showLegal ? null : p.id)}
                            className="flex items-center gap-1 text-[10px] text-surface-400 hover:text-surface-600 transition-colors"
                          >
                            <Shield size={10} />
                            Rechtliches & Datenschutz
                            {showLegal ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          </button>
                          {showLegal && (
                            <div className="mt-1.5 p-2.5 bg-surface-50 dark:bg-surface-700 rounded-lg text-[10px] text-surface-500 dark:text-surface-300 space-y-1.5 border border-surface-100 dark:border-surface-600">
                              {p.data_processing_note && (
                                <div className="flex gap-1.5">
                                  <Info size={10} className="shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" />
                                  <span>{p.data_processing_note}</span>
                                </div>
                              )}
                              {p.legal_disclaimer && (
                                <div className="flex gap-1.5">
                                  <AlertTriangle size={10} className="shrink-0 mt-0.5 text-amber-500 dark:text-amber-400" />
                                  <span>{p.legal_disclaimer}</span>
                                </div>
                              )}
                              {p.third_party_terms_url && (
                                <a href={p.third_party_terms_url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline">
                                  <ExternalLink size={9} />
                                  {p.third_party_name} Nutzungsbedingungen
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {p.status === "coming_soon" ? (
                          // Coming Soon
                          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-medium">
                            Coming Soon
                          </span>
                        ) : !p.canAccess && p.requires_pro && !isPro ? (
                          // Requires Pro — user needs to upgrade
                          <a
                            href="/upgrade"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 dark:bg-brand-700 text-white rounded-lg text-xs font-medium hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors"
                          >
                            <Lock size={12} />
                            Pro erforderlich
                          </a>
                        ) : !p.canAccess ? (
                          // Premium, not purchased — offer purchase
                          <button
                            onClick={() => handlePurchase(p.id)}
                            disabled={isPurchasing}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 dark:bg-brand-700 text-white rounded-lg text-xs font-medium hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 transition-colors"
                          >
                            <ShoppingCart size={12} />
                            {isPurchasing ? "Wird geladen..." : `CHF ${p.effectivePrice.toFixed(2)} kaufen`}
                          </button>
                        ) : !p.installed ? (
                          <button
                            onClick={() => handleAction(p.id, "install")}
                            disabled={isActing}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 dark:bg-brand-700 text-white rounded-lg text-xs font-medium hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 transition-colors"
                          >
                            <Download size={12} />
                            {t("plugins.install") || "Installieren"}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleAction(p.id, "toggle")}
                              disabled={isActing}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                p.enabled
                                  ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
                                  : "bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600"
                              }`}
                            >
                              {p.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                              {p.enabled ? (t("plugins.enabled") || "Aktiv") : (t("plugins.disabled") || "Inaktiv")}
                            </button>

                            {p.enabled && functional && FUNCTIONAL_PLUGINS.has(p.id) && (
                              <button
                                onClick={() => {
                                  if (p.id === "grade-export") handleExecute(p.id);
                                  else if (p.id === "pomodoro-plus") handleExecute(p.id, "stats");
                                }}
                                disabled={isExecuting}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-lg text-xs font-medium hover:bg-brand-100 dark:hover:bg-brand-900/30 disabled:opacity-50 transition-colors"
                              >
                                {isExecuting ? (
                                  <div className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                                ) : p.id === "grade-export" ? <FileDown size={12} /> : <Play size={12} />}
                                {p.id === "grade-export" ? "Exportieren" : "Statistiken"}
                              </button>
                            )}

                            {p.config_schema && (
                              <button
                                onClick={() => setConfigPluginId(p.id)}
                                className="p-1.5 text-surface-400 dark:text-surface-500 hover:text-brand-500 dark:hover:text-brand-400 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20"
                                title={t("plugins.settings") || "Einstellungen"}
                              >
                                <Settings size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => handleAction(p.id, "uninstall")}
                              disabled={isActing}
                              className="p-1.5 text-surface-400 dark:text-surface-500 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                        {p.homepage && (
                          <a href={p.homepage} target="_blank" rel="noopener" className="p-1.5 text-surface-400 dark:text-surface-500 hover:text-brand-500 dark:hover:text-brand-400 rounded-lg">
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pomodoro Stats Panel */}
        {pomodoroStats && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setPomodoroStats(null)}>
            <div className="bg-[rgb(var(--card-bg))] dark:bg-surface-800 rounded-2xl max-w-md w-full p-5 sm:p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                  <Clock size={20} className="text-brand-500 dark:text-brand-400" />
                  Pomodoro Statistiken
                </h2>
                <button onClick={() => setPomodoroStats(null)} className="p-1 text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-400"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-50 dark:bg-surface-700 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-surface-900 dark:text-surface-100">{pomodoroStats.totalSessions}</div>
                  <div className="text-[10px] text-surface-500 dark:text-surface-400">Sessions gesamt</div>
                </div>
                <div className="bg-surface-50 dark:bg-surface-700 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-surface-900 dark:text-surface-100">{Math.round(pomodoroStats.totalMinutes)}</div>
                  <div className="text-[10px] text-surface-500 dark:text-surface-400">Minuten gesamt</div>
                </div>
                <div className="bg-surface-50 dark:bg-surface-700 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-surface-900 dark:text-surface-100">{pomodoroStats.todaySessions}</div>
                  <div className="text-[10px] text-surface-500 dark:text-surface-400">Heute</div>
                </div>
                <div className="bg-surface-50 dark:bg-surface-700 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-surface-900 dark:text-surface-100">{Math.round(pomodoroStats.avgSessionMinutes)}</div>
                  <div className="text-[10px] text-surface-500 dark:text-surface-400">Durchschn. min</div>
                </div>
              </div>
              <div className="mt-4 bg-surface-50 dark:bg-surface-700 rounded-xl p-3">
                <div className="text-xs font-medium text-surface-700 dark:text-surface-300 mb-2">Längste Session</div>
                <div className="text-lg font-bold text-brand-600 dark:text-brand-400">{Math.round(pomodoroStats.longestSession)} Minuten</div>
              </div>
            </div>
          </div>
        )}

        {/* Config Dialog */}
        {configPluginId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-[rgb(var(--card-bg))] dark:bg-surface-800 rounded-2xl max-w-md w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                  {t("plugins.config.title") || "Plugin-Einstellungen"} — {plugins.find(p => p.id === configPluginId)?.name}
                </h2>
                <button onClick={() => setConfigPluginId(null)} className="p-1 text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-400"><X size={18} /></button>
              </div>
              {plugins.find(p => p.id === configPluginId) && (
                <PluginConfig
                  plugin={plugins.find(p => p.id === configPluginId)!}
                  onClose={() => setConfigPluginId(null)}
                  onSave={() => load()}
                />
              )}
            </div>
          </div>
        )}

        {/* Legal footer */}
        <div className="mt-8 pt-4 border-t border-surface-100 dark:border-surface-700 text-[10px] text-surface-400 dark:text-surface-500 space-y-1">
          <p>Alle genannten Marken- und Produktnamen sind Eigentum ihrer jeweiligen Inhaber. Semetra ist kein offizieller Partner der genannten Dienste.</p>
          <p>Plugins nutzen ausschliesslich öffentliche APIs gemäss den jeweiligen Nutzungsbedingungen. Deine Daten werden nur in deinem Semetra-Konto gespeichert und nicht an Dritte weitergegeben.</p>
          <p>Für Fragen zum Datenschutz: <a href="mailto:support@semetra.ch" className="text-brand-500 dark:text-brand-400 hover:underline">support@semetra.ch</a></p>
        </div>
      </div>
    </ErrorBoundary>
  );
}
