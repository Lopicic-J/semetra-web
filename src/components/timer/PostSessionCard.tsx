"use client";

import { useState, useEffect, useCallback, memo } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Coffee, Play, Clock, PenLine, Send } from "lucide-react";
import { getActionLink } from "@/components/dashboard/SmartStartCard";
import type { Action } from "@/lib/decision/types";

interface Props {
  /** Seconds the just-completed session lasted */
  sessionDuration: number;
  /** Module name of the completed session */
  moduleName?: string;
  /** Whether to show (visible after session ends) */
  visible: boolean;
  /** Callback to dismiss */
  onDismiss: () => void;
}

/**
 * Post-Session Card — Shows after timer session ends.
 * Fetches the next recommended action from Decision Engine
 * and presents it as a one-click "Continue" button.
 */
function PostSessionCard({ sessionDuration, moduleName, visible, onDismiss }: Props) {
  const [nextAction, setNextAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  const saveQuickNote = useCallback(async () => {
    if (!quickNote.trim()) return;
    try {
      await fetch("/api/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learned: quickNote,
          sessionDurationSeconds: sessionDuration,
          sessionType: "timer",
        }),
      });
      setNoteSaved(true);
    } catch {}
  }, [quickNote, sessionDuration]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);

    fetch("/api/decision")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.today?.actions?.length > 0) {
          setNextAction(data.today.actions[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  if (!visible) return null;

  const mins = Math.round(sessionDuration / 60);

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 p-5 mb-6 animate-in slide-in-from-bottom-4">
      {/* Completion header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
          <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">
            Gut gemacht!
          </p>
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {mins} Min{moduleName ? ` · ${moduleName}` : ""}
          </p>
        </div>
      </div>

      {/* Next action */}
      {loading ? (
        <div className="h-14 bg-emerald-100/50 dark:bg-emerald-900/20 rounded-xl animate-pulse" />
      ) : nextAction ? (
        <div className="space-y-2">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wider">
            Nächste Aktion
          </p>
          <Link
            href={getActionLink(nextAction)}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/80 dark:bg-surface-800/80 border border-emerald-100 dark:border-emerald-800/30 hover:shadow-md transition-all no-underline group"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
              style={{ background: nextAction.moduleColor ?? "#6d28d9" }}
            >
              <Play size={16} fill="white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                {nextAction.title}
              </p>
              <span className="text-xs text-surface-500 flex items-center gap-1">
                <Clock size={10} /> {nextAction.estimatedMinutes} Min
              </span>
            </div>
            <ArrowRight size={18} className="text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0" />
          </Link>
        </div>
      ) : null}

      {/* Quick reflection note */}
      {!noteSaved ? (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={quickNote}
            onChange={e => setQuickNote(e.target.value)}
            placeholder="Was habe ich gelernt? (optional)"
            className="flex-1 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/30 bg-white/60 dark:bg-surface-800/40 text-xs placeholder:text-emerald-400"
            onKeyDown={e => e.key === "Enter" && saveQuickNote()}
          />
          {quickNote.trim() && (
            <button onClick={saveQuickNote} className="px-2 py-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30">
              <Send size={12} />
            </button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[10px] text-emerald-500 flex items-center gap-1">
          <CheckCircle2 size={10} /> Notiz gespeichert
        </p>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-emerald-100/50 dark:border-emerald-800/20">
        <Link
          href="/guided-session"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-white/60 dark:hover:bg-surface-800/40 transition-colors no-underline"
        >
          <PenLine size={12} /> Reflexion schreiben
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-surface-500 hover:bg-white/60 dark:hover:bg-surface-800/40 transition-colors no-underline"
        >
          <Coffee size={12} /> Pause
        </Link>
        <button
          onClick={onDismiss}
          className="ml-auto text-xs text-surface-400 hover:text-surface-600 transition-colors"
        >
          Schliessen
        </button>
      </div>
    </div>
  );
}

export default memo(PostSessionCard);
