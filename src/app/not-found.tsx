import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-surface-950 dark:to-surface-900 p-4">
      <div className="w-full max-w-md">
        {/* 404 Icon */}
        <div className="text-center mb-8">
          <div className="text-6xl font-bold text-violet-600 mb-4">404</div>
          <h1 className="text-2xl font-bold text-surface-900">Seite nicht gefunden</h1>
          <p className="text-surface-500 text-sm mt-2">
            Die Seite, die du suchst, existiert nicht.
          </p>
        </div>

        {/* Content Card */}
        <div className="card mb-6">
          <p className="text-surface-600 text-center mb-4">
            Es sieht so aus, als ob der Link, dem du gefolgt bist, nicht mehr gültig ist oder die Seite wurde verschoben.
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link href="/dashboard" className="btn-primary w-full justify-center py-2.5 block text-center">
              Zur Startseite
            </Link>
            <Link href="/" className="btn-secondary w-full justify-center py-2.5 block text-center">
              Zur Hauptseite
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-surface-500">
          Benötigst du Hilfe? Kontaktiere{" "}
          <a href="mailto:support@semetra.com" className="text-violet-600 font-medium hover:underline">
            den Support
          </a>
        </p>
      </div>
    </div>
  );
}
