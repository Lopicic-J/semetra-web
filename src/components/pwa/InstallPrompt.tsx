"use client";

import { useState } from "react";
import { usePWA } from "@/lib/hooks/usePWA";
import { useTranslation } from "@/lib/i18n";
import { Download, X, Smartphone } from "lucide-react";

/**
 * Floating install prompt banner.
 * Only shows when the browser supports A2HS and the app isn't installed yet.
 */
export default function InstallPrompt() {
  const { t } = useTranslation();
  const { isInstallable, promptInstall } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-80 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-white border border-surface-200 rounded-2xl shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center shrink-0">
            <Smartphone size={20} className="text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-surface-900">
              {t("pwa.installTitle")}
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {t("pwa.installDesc")}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={promptInstall}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors"
              >
                <Download size={13} />
                {t("pwa.install")}
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 text-xs text-surface-500 hover:text-surface-700 font-medium"
              >
                {t("pwa.later")}
              </button>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg hover:bg-surface-100 text-surface-400 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
