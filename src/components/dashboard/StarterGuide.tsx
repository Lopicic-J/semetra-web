"use client";

/**
 * StarterGuide — Personalized next-steps widget for new users
 *
 * Shows on the dashboard when the user hasn't completed key setup actions.
 * Disappears automatically once all steps are done (or dismissed).
 */

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { clsx } from "clsx";
import {
  BookOpen,
  Calendar,
  Timer,
  Target,
  Brain,
  Users,
  Check,
  Rocket,
  X,
  ChevronRight,
  Sparkles,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SetupStep {
  id: string;
  icon: typeof BookOpen;
  color: string;
  bgColor: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  check: () => Promise<boolean>;
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function StarterGuide() {
  const [dismissed, setDismissed] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const steps: SetupStep[] = useMemo(
    () => [
      {
        id: "modules",
        icon: BookOpen,
        color: "text-brand-500",
        bgColor: "bg-brand-50 dark:bg-brand-500/10",
        title: "Module anlegen",
        description: "Erstelle deine Studienmodule für dieses Semester.",
        href: "/modules",
        cta: "Module erstellen",
        check: async () => {
          const { count } = await supabase
            .from("modules")
            .select("*", { count: "exact", head: true });
          return (count ?? 0) > 0;
        },
      },
      {
        id: "schedule",
        icon: Calendar,
        color: "text-blue-500",
        bgColor: "bg-blue-50 dark:bg-blue-500/10",
        title: "Stundenplan eintragen",
        description: "Trage deine Vorlesungszeiten ein, damit Semetra Lernblöcke drum herum plant.",
        href: "/stundenplan",
        cta: "Stundenplan öffnen",
        check: async () => {
          const { count } = await supabase
            .from("timetable_entries")
            .select("*", { count: "exact", head: true });
          return (count ?? 0) > 0;
        },
      },
      {
        id: "timer",
        icon: Timer,
        color: "text-violet-500",
        bgColor: "bg-violet-50 dark:bg-violet-500/10",
        title: "Erste Lernsession starten",
        description: "Starte den Timer und sammle deine ersten Lernminuten.",
        href: "/timer",
        cta: "Timer starten",
        check: async () => {
          const { count } = await supabase
            .from("time_logs")
            .select("*", { count: "exact", head: true });
          return (count ?? 0) > 0;
        },
      },
      {
        id: "tasks",
        icon: Target,
        color: "text-emerald-500",
        bgColor: "bg-emerald-50 dark:bg-emerald-500/10",
        title: "Erste Aufgabe erstellen",
        description: "Plane eine Aufgabe oder ein Lernziel für diese Woche.",
        href: "/tasks",
        cta: "Aufgaben öffnen",
        check: async () => {
          const { count } = await supabase
            .from("tasks")
            .select("*", { count: "exact", head: true });
          return (count ?? 0) > 0;
        },
      },
      {
        id: "ai",
        icon: Brain,
        color: "text-purple-500",
        bgColor: "bg-purple-50 dark:bg-purple-500/10",
        title: "KI-Assistenten ausprobieren",
        description: "Stell dem KI-Assistenten eine Frage zu deinem Studium.",
        href: "/ai-assistant",
        cta: "KI fragen",
        check: async () => {
          const { count } = await supabase
            .from("ai_conversations")
            .select("*", { count: "exact", head: true });
          return (count ?? 0) > 0;
        },
      },
    ],
    [supabase]
  );

  // Check completion status on mount
  useEffect(() => {
    const wasDismissed = localStorage.getItem("semetra_starter_dismissed");
    if (wasDismissed) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    async function checkAll() {
      const done = new Set<string>();
      for (const step of steps) {
        try {
          const isDone = await step.check();
          if (isDone) done.add(step.id);
        } catch {
          // Ignore check errors
        }
      }
      setCompleted(done);
      setLoading(false);

      // Auto-dismiss if all done
      if (done.size >= steps.length) {
        localStorage.setItem("semetra_starter_dismissed", "1");
        setDismissed(true);
      }
    }

    checkAll();
  }, [steps]);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem("semetra_starter_dismissed", "1");
  };

  if (dismissed || loading) return null;

  const remaining = steps.filter((s) => !completed.has(s.id));
  const progress = Math.round((completed.size / steps.length) * 100);

  if (remaining.length === 0) return null;

  return (
    <div className="rounded-2xl border border-surface-200/60 bg-[rgb(var(--card-bg))] shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-brand-500/5 to-violet-500/5 dark:from-brand-500/10 dark:to-violet-500/10 border-b border-surface-200/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-md shadow-brand-500/20">
            <Rocket size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-surface-900 dark:text-white">
              Startklar machen
            </h2>
            <p className="text-xs text-surface-500">
              {completed.size}/{steps.length} erledigt — noch {remaining.length}{" "}
              {remaining.length === 1 ? "Schritt" : "Schritte"}
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
          title="Ausblenden"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3">
        <div className="h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="p-3">
        {steps.map((step) => {
          const isDone = completed.has(step.id);
          const Icon = step.icon;
          return (
            <Link
              key={step.id}
              href={isDone ? "#" : step.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                isDone
                  ? "opacity-50"
                  : "hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer"
              )}
            >
              <div
                className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  isDone ? "bg-green-100 dark:bg-green-500/20" : step.bgColor
                )}
              >
                {isDone ? (
                  <Check size={14} className="text-green-600 dark:text-green-400" />
                ) : (
                  <Icon size={14} className={step.color} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={clsx(
                    "text-sm font-medium",
                    isDone
                      ? "line-through text-surface-400"
                      : "text-surface-800"
                  )}
                >
                  {step.title}
                </p>
                {!isDone && (
                  <p className="text-xs text-surface-500 truncate">
                    {step.description}
                  </p>
                )}
              </div>
              {!isDone && (
                <ChevronRight
                  size={14}
                  className="text-surface-400 shrink-0"
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Motivation footer */}
      {completed.size >= 2 && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
            <Sparkles size={12} className="text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {completed.size >= 4
                ? "Fast geschafft! Nur noch ein Schritt."
                : completed.size >= 3
                  ? "Super Fortschritt! Du bist auf dem besten Weg."
                  : "Guter Start! Mach weiter so."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
