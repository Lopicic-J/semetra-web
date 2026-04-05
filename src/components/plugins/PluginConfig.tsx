"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import toast from "react-hot-toast";
import { logger } from "@/lib/logger";

const log = logger("ui:plugins");

interface Plugin {
  id: string;
  name: string;
  config_schema?: {
    fields?: Array<{
      name: string;
      label: string;
      type: "text" | "toggle" | "select" | "number";
      options?: Array<{ value: string; label: string }>;
      required?: boolean;
    }>;
  };
  userConfig?: Record<string, any>;
}

interface PluginConfigProps {
  plugin: Plugin;
  onClose: () => void;
  onSave?: () => void;
}

export function PluginConfig({ plugin, onClose, onSave }: PluginConfigProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState(plugin.userConfig ?? {});
  const [saving, setSaving] = useState(false);

  const fields = plugin.config_schema?.fields ?? [];

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/plugins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginId: plugin.id,
          config,
        }),
      });

      if (res.ok) {
        toast.success(t("plugins.config.saved") || "Konfiguration gespeichert!");
        onSave?.();
        onClose();
      } else {
        const json = await res.json();
        toast.error(json.error || t("plugins.config.error"));
      }
    } catch (err) {
      log.error("error", err);
      toast.error(t("plugins.config.error") || "Fehler beim Speichern");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {fields.length === 0 ? (
        <p className="text-sm text-surface-500">Keine Konfigurationsoptionen verfügbar.</p>
      ) : (
        fields.map((field) => (
          <div key={field.name}>
            <label className="text-sm font-medium text-surface-800 block mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {field.type === "text" && (
              <input
                type="text"
                value={config[field.name] ?? ""}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    [field.name]: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            )}

            {field.type === "number" && (
              <input
                type="number"
                value={config[field.name] ?? ""}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    [field.name]: e.target.value ? Number(e.target.value) : "",
                  }))
                }
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            )}

            {field.type === "toggle" && (
              <button
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    [field.name]: !prev[field.name],
                  }))
                }
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  config[field.name]
                    ? "bg-brand-100 text-brand-700"
                    : "bg-surface-100 text-surface-600"
                }`}
              >
                {config[field.name] ? "Aktiviert" : "Deaktiviert"}
              </button>
            )}

            {field.type === "select" && field.options && (
              <select
                value={config[field.name] ?? ""}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    [field.name]: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                <option value="">— wählen —</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))
      )}

      <div className="flex gap-2 pt-4 border-t border-surface-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {t("plugins.config.save") || "Speichern"}
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 text-surface-600 border border-surface-200 rounded-lg font-medium hover:bg-surface-50 transition-colors"
        >
          {t("developer.cancel") || "Abbrechen"}
        </button>
      </div>
    </div>
  );
}
