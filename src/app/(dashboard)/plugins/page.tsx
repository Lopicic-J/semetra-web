"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import toast from "react-hot-toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PluginConfig } from "@/components/plugins/PluginConfig";
import {
  Puzzle, Download, ToggleLeft, ToggleRight, Trash2, ExternalLink,
  Plug, Globe, BarChart3, Users, Palette, Wrench, Settings, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
}

const CAT_ICONS: Record<string, LucideIcon> = {
  integration: Plug,
  productivity: Wrench,
  analytics: BarChart3,
  social: Users,
  theme: Palette,
  other: Puzzle,
};

const CAT_COLORS: Record<string, string> = {
  integration: "bg-blue-100 text-blue-600",
  productivity: "bg-green-100 text-green-600",
  analytics: "bg-purple-100 text-purple-600",
  social: "bg-amber-100 text-amber-600",
  theme: "bg-pink-100 text-pink-600",
  other: "bg-surface-100 text-surface-600",
};

export default function PluginsPage() {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [configPluginId, setConfigPluginId] = useState<string | null>(null);
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
    } catch (err) {
      console.error("[plugins] load failed:", err);
      toast.error(t("plugins.loadError") || "Fehler beim Laden der Plugins");
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(pluginId: string, action: string) {
    if (action === "uninstall") {
      const ok = await confirmUninstall();
      if (!ok) return;
    }
    setActionId(pluginId);
    try {
      await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId, action }),
      });
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

  const categories = Array.from(new Set(plugins.map(p => p.category)));
  const filtered = filter === "all"
    ? plugins
    : filter === "installed"
      ? plugins.filter(p => p.installed)
      : plugins.filter(p => p.category === filter);

  return (
    <ErrorBoundary feature="Plugins">
      {UninstallConfirm}
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Puzzle className="text-brand-600" size={26} />
            {t("plugins.title")}
          </h1>
          <p className="text-surface-500 text-sm mt-1">{t("plugins.subtitle")}</p>
        </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {["all", "installed", ...categories].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filter === cat ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"
            }`}
          >
            {cat === "all" ? t("plugins.all") : cat === "installed" ? t("plugins.installed") : t(`plugins.cat.${cat}`)}
          </button>
        ))}
      </div>

      {/* Plugin grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-36 bg-surface-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-surface-400">
          <Puzzle size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("plugins.noPlugins")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(p => {
            const CatIcon = CAT_ICONS[p.category] ?? Puzzle;
            const catColor = CAT_COLORS[p.category] ?? CAT_COLORS.other;
            const isActing = actionId === p.id;

            return (
              <div key={p.id} className="card p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${catColor}`}>
                    <CatIcon size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-surface-900">{p.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-500">
                        v{p.version}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 mt-1">{p.description}</p>
                    <p className="text-[10px] text-surface-400 mt-1">{t("plugins.by")} {p.author}</p>

                    {/* Permissions */}
                    {p.permissions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.permissions.map(perm => (
                          <span key={perm} className="text-[10px] px-1.5 py-0.5 bg-surface-50 rounded text-surface-500 border border-surface-100">
                            {perm}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3">
                      {!p.installed ? (
                        <button
                          onClick={() => handleAction(p.id, "install")}
                          disabled={isActing}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                        >
                          <Download size={12} />
                          {t("plugins.install")}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleAction(p.id, "toggle")}
                            disabled={isActing}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              p.enabled
                                ? "bg-green-50 text-green-600 hover:bg-green-100"
                                : "bg-surface-100 text-surface-500 hover:bg-surface-200"
                            }`}
                          >
                            {p.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                            {p.enabled ? t("plugins.enabled") : t("plugins.disabled")}
                          </button>
                          {p.config_schema && (
                            <button
                              onClick={() => setConfigPluginId(p.id)}
                              className="p-1.5 text-surface-400 hover:text-brand-500 rounded-lg hover:bg-brand-50"
                              title={t("plugins.settings")}
                            >
                              <Settings size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => handleAction(p.id, "uninstall")}
                            disabled={isActing}
                            className="p-1.5 text-surface-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                      {p.homepage && (
                        <a href={p.homepage} target="_blank" rel="noopener" className="p-1.5 text-surface-400 hover:text-brand-500 rounded-lg">
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

      {/* Config Dialog */}
      {configPluginId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-surface-900">
                {t("plugins.config.title")} — {plugins.find(p => p.id === configPluginId)?.name}
              </h2>
              <button
                onClick={() => setConfigPluginId(null)}
                className="p-1 text-surface-400 hover:text-surface-600"
              >
                <X size={18} />
              </button>
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
      </div>
    </ErrorBoundary>
  );
}
