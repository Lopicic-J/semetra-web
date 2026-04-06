"use client";

import { useEffect } from "react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-surface-950 dark:to-surface-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600 text-white text-3xl mb-4 shadow-lg">
            ⚠️
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Fehler</h1>
          <p className="text-surface-500 text-sm mt-1">Es ist ein Fehler aufgetreten</p>
        </div>

        <div className="card">
          <p className="text-surface-600 text-center mb-4">
            Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
          </p>

          {process.env.NODE_ENV === "development" && error.message && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-mono break-words">
                {error.message}
              </p>
            </div>
          )}

          <button
            onClick={() => reset()}
            className="btn-primary w-full justify-center py-2.5"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    </div>
  );
}
