"use client";

export default function GuidedSessionError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-2">Lernsession konnte nicht geladen werden</p>
      <p className="text-sm text-surface-500 mb-4">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">
        Erneut versuchen
      </button>
    </div>
  );
}
