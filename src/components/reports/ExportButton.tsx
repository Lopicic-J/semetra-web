"use client";
/**
 * ExportButton — Reusable export dropdown (PDF, CSV, JSON)
 *
 * Triggers download from /api/academic/export in the selected format.
 */

import { useState } from "react";
import { Download, FileText, Table, Code, ChevronDown, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { events } from "@/lib/analytics/tracker";

interface ExportButtonProps {
  semester?: string | number;
  /** Compact mode for inline placement */
  compact?: boolean;
}

const FORMATS = [
  { key: "pdf", label: "PDF Report", icon: FileText, ext: ".pdf" },
  { key: "csv", label: "CSV Tabelle", icon: Table, ext: ".csv" },
  { key: "json", label: "JSON Daten", icon: Code, ext: ".json" },
] as const;

export function ExportButton({ semester, compact = false }: ExportButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleExport(format: string) {
    setLoading(format);
    setOpen(false);

    try {
      const params = new URLSearchParams({ format });
      if (semester) params.set("semester", String(semester));

      const res = await fetch(`/api/academic/export?${params}`);
      if (!res.ok) throw new Error("Export fehlgeschlagen");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `Semetra_Report.${format}`;

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      events.exportGenerated(format);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading !== null}
        className={`flex items-center gap-2 rounded-xl font-medium transition-all
          ${compact
 ?"px-3 py-1.5 text-xs bg-surface-100 text-surface-600 hover:bg-surface-200 dark:hover:bg-surface-700"
            : "px-4 py-2.5 text-sm bg-brand-600 text-white hover:bg-brand-700 shadow-sm"
          }
          disabled:opacity-50`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span>{t("export.button")}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-48 z-50
            bg-white dark:bg-surface-800 rounded-xl shadow-lg border border-surface-200 dark:border-surface-700
            overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {FORMATS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleExport(key)}
                disabled={loading !== null}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left
 text-surface-700
                  hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors
                  disabled:opacity-50"
              >
                <Icon className="w-4 h-4 text-surface-400" />
                <span>{label}</span>
                {loading === key && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
