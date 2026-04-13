"use client";
/**
 * SemesterTransitionBanner — Dashboard notification for semester change
 *
 * Checks the semester-transition API and shows a banner when a
 * transition is pending (HS→FS or FS→HS). User can accept or dismiss.
 */

import { useState, useEffect } from "react";
import { GraduationCap, ArrowRight, X, Loader2, Archive } from "lucide-react";

interface TransitionData {
  pending: boolean;
  currentSemester: number;
  nextSemesterNumber: number | null;
  currentPeriod: {
    type: string;
    label: string;
  };
}

export function SemesterTransitionBanner() {
  const [data, setData] = useState<TransitionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ archivedModules: number } | null>(null);

  useEffect(() => {
    fetch("/api/academic/semester-transition")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleTransition() {
    setTransitioning(true);
    try {
      const res = await fetch("/api/academic/semester-transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transition" }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult({ archivedModules: json.archivedModules });
        setDone(true);
      }
    } catch {
      // Silently fail
    }
    setTransitioning(false);
  }

  async function handleDismiss() {
    await fetch("/api/academic/semester-transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    }).catch(() => {});
    setData(null);
  }

  if (loading || !data?.pending) return null;

  if (done && result) {
    return (
      <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-800/50 flex items-center justify-center">
            <GraduationCap size={20} className="text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-green-800 dark:text-green-300">
              Semester erfolgreich gewechselt!
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              Du bist jetzt in Semester {data.nextSemesterNumber}.
              {result.archivedModules > 0 && (
                <> {result.archivedModules} abgeschlossene Module wurden archiviert.</>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-brand-50 to-violet-50 dark:from-brand-900/20 dark:to-violet-900/20 border border-brand-200 dark:border-brand-800">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-800/50 flex items-center justify-center flex-shrink-0">
          <GraduationCap size={20} className="text-brand-600 dark:text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-surface-900 dark:text-white">
            Neues Semester: {data.currentPeriod.label}
          </p>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-0.5">
            Möchtest du von Semester {data.currentSemester} auf{" "}
            <strong>Semester {data.nextSemesterNumber}</strong> wechseln?
            Abgeschlossene Module werden automatisch archiviert.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleTransition}
              disabled={transitioning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {transitioning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowRight size={14} />
              )}
              Semester wechseln
            </button>
            <button
              onClick={handleDismiss}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-surface-600 hover:text-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            >
              Später
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
