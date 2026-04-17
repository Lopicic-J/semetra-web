"use client";

import { memo } from "react";
import { X, BookOpen } from "lucide-react";

interface Props {
  moduleName: string;
  moduleColor?: string;
  onClear: () => void;
}

/**
 * Banner showing active module filter with clear button.
 * Used on pages that accept ?module= deep-links.
 */
function ModuleFilterBanner({ moduleName, moduleColor, onClear }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800/40 mb-4">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: moduleColor ?? "#6d28d9" }} />
      <BookOpen size={13} className="text-brand-500 shrink-0" />
      <span className="text-xs font-medium text-brand-700 dark:text-brand-300 flex-1 truncate">
        Gefiltert: {moduleName}
      </span>
      <button
        onClick={onClear}
        className="p-0.5 rounded text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 transition-colors"
        title="Filter entfernen"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default memo(ModuleFilterBanner);
