"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff size={36} className="text-surface-400" />
        </div>
        <h1 className="text-2xl font-bold text-surface-900 mb-2">Offline</h1>
        <p className="text-surface-500 text-sm mb-6">
          Du bist gerade nicht mit dem Internet verbunden. Sobald du wieder online bist, wird Semetra automatisch neu laden.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors"
        >
          <RefreshCw size={16} />
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
