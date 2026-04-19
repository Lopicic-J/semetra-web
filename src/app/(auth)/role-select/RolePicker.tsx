"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, User, Mail, Loader2, Gem } from "lucide-react";

type Role = "student" | "non_student";

export default function RolePicker() {
  const router = useRouter();
  const [saving, setSaving] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(role: Role) {
    setSaving(role);
    setError(null);
    try {
      const res = await fetch("/api/role-select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Speichern fehlgeschlagen");
      }
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(null);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50/40 via-white to-surface-50 p-4 sm:p-8">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white mb-4 shadow-lg shadow-brand-500/25">
            <Gem size={24} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">
            Willkommen bei Semetra
          </h1>
          <p className="text-surface-500 text-sm mt-2">
            Damit wir dein Erlebnis anpassen können — wer bist du?
          </p>
        </div>

        <div className="bg-[rgb(var(--card-bg))] rounded-2xl shadow-xl shadow-surface-200/50 dark:shadow-black/50 border border-surface-200/60 p-6 sm:p-8">
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => pick("student")}
              disabled={saving !== null}
              className="group flex flex-col items-start gap-3 p-5 rounded-xl border-2 border-surface-200 hover:border-brand-500 hover:bg-brand-50/50 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
                {saving === "student" ? <Loader2 size={20} className="animate-spin" /> : <GraduationCap size={20} />}
              </div>
              <div>
                <p className="font-semibold text-surface-900 dark:text-white">Student:in</p>
                <p className="text-xs text-surface-500 mt-1">
                  Du studierst aktuell an einer Fachhochschule oder Universität.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => pick("non_student")}
              disabled={saving !== null}
              className="group flex flex-col items-start gap-3 p-5 rounded-xl border-2 border-surface-200 hover:border-surface-400 hover:bg-surface-50 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-11 h-11 rounded-xl bg-surface-100 text-surface-700 flex items-center justify-center group-hover:bg-surface-600 group-hover:text-white transition-colors">
                {saving === "non_student" ? <Loader2 size={20} className="animate-spin" /> : <User size={20} />}
              </div>
              <div>
                <p className="font-semibold text-surface-900 dark:text-white">Kein:e Student:in</p>
                <p className="text-xs text-surface-500 mt-1">
                  Selbstlernende:r, Remote-Worker, allgemein Produktivitäts-Fan.
                </p>
              </div>
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 p-4 rounded-xl bg-surface-50 border border-surface-200 flex items-start gap-3">
            <Mail size={16} className="text-surface-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-surface-700">
                Dozent:in oder Institution?
              </p>
              <p className="text-xs text-surface-500 mt-1 leading-relaxed">
                Für verifizierte Dozent:innen- und Institutions-Accounts kontaktiere bitte
                {" "}
                <a href="mailto:support@semetra.ch?subject=Institutions-Account" className="text-brand-600 hover:underline">
                  support@semetra.ch
                </a>
                {" "}
                mit einer kurzen Anfrage. Wir melden uns innerhalb von 48 Stunden.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-surface-400 mt-6">
          Du kannst deine Rolle später in den Einstellungen ändern.
        </p>
      </div>
    </div>
  );
}
