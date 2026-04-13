"use client";

import { WifiOff, RefreshCw, Gem } from "lucide-react";

export default function OfflinePage() {
  return (
 <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-surface-50 via-white to-surface-100 p-6 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-brand-100/30 dark:bg-brand-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-surface-200/40 dark:bg-brand-600/10 blur-3xl pointer-events-none" />

      <div className="text-center max-w-sm relative z-10">
        {/* Brand */}
        <div className="inline-flex items-center gap-2 mb-8 opacity-60">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <Gem size={16} className="text-white" />
          </div>
 <span className="text-sm font-bold text-surface-500">Semetra</span>
        </div>

        {/* Icon */}
 <div className="w-24 h-24 bg-surface-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-surface-200/50 dark:shadow-none border border-surface-200">
 <WifiOff size={40} className="text-surface-400" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white mb-3">Du bist offline</h1>
 <p className="text-surface-500 text-sm sm:text-base mb-8 leading-relaxed">
          Keine Internetverbindung. Sobald du wieder online bist, wird Semetra automatisch neu laden.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2.5 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm sm:text-base shadow-lg shadow-brand-600/25 hover:shadow-brand-500/30 transition-all active:scale-[0.98]"
        >
          <RefreshCw size={18} />
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
