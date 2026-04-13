"use client";

import { Pencil, X, RotateCcw } from "lucide-react";
import { clsx } from "clsx";
import { useLayoutEditor } from "@/lib/hooks/useLayoutEditor";
import { useTranslation } from "@/lib/i18n";

/**
 * Floating button that toggles the layout editor mode.
 * Shows a pencil icon when inactive, an X + reset when active.
 */
export default function LayoutEditorToggle() {
  const { editing, toggleEditing, resetLayout } = useLayoutEditor();
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-24 right-6 z-50 flex items-center gap-2">
      {editing && (
        <button
          onClick={resetLayout}
 className="flex items-center gap-2 px-3 py-2 bg-surface-100 text-surface-600 rounded-xl shadow-lg border border-surface-200 hover:bg-surface-200 dark:hover:bg-surface-700 transition-all text-[12px] font-medium"
          title={t("layout.reset") || "Layout zurücksetzen"}
        >
          <RotateCcw size={14} />
          {t("layout.reset") || "Zurücksetzen"}
        </button>
      )}
      <button
        onClick={toggleEditing}
        className={clsx(
          "flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg transition-all duration-200 text-[13px] font-semibold",
          editing
            ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/25"
            : "bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/25",
        )}
        title={editing ? (t("layout.done") || "Bearbeitung beenden") : (t("layout.edit") || "Layout bearbeiten")}
      >
        {editing ? (
          <>
            <X size={16} />
            {t("layout.done") || "Fertig"}
          </>
        ) : (
          <>
            <Pencil size={16} />
            {t("layout.edit") || "Anpassen"}
          </>
        )}
      </button>
    </div>
  );
}
