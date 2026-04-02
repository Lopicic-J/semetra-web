"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-50 p-4">
      <div className="w-full max-w-md">
        <div className="card bg-white rounded-2xl shadow-lg border border-red-100">
          {/* Error Icon */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 text-3xl">
              ⚠️
            </div>
          </div>

          {/* Error Title */}
          <h1 className="text-2xl font-bold text-surface-900 text-center mb-2">
            Etwas ist schiefgelaufen
          </h1>

          {/* Error Description */}
          <p className="text-surface-600 text-center mb-6">
            Ein Fehler ist aufgetreten. Bitte versuche es erneut.
          </p>

          {/* Error Message (Development Only) */}
          {process.env.NODE_ENV === "development" && error.message && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-mono break-words">
                {error.message}
              </p>
            </div>
          )}

          {/* Try Again Button */}
          <button
            onClick={() => reset()}
            className="btn-primary w-full justify-center py-2.5 mb-3"
          >
            Erneut versuchen
          </button>

          {/* Back to Dashboard Link */}
          <a
            href="/dashboard"
            className="btn-secondary w-full justify-center py-2.5"
          >
            Zur Startseite
          </a>
        </div>

        {/* Footer Text */}
        <p className="text-center text-sm text-surface-500 mt-6">
          Wenn das Problem weiterhin besteht, kontaktiere bitte den Support.
        </p>
      </div>
    </div>
  );
}
