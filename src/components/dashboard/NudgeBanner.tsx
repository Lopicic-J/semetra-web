"use client";

import { useState, useEffect } from "react";
import { clsx } from "clsx";
import {
  Flame,
  AlertTriangle,
  CheckCircle,
  Target,
  CalendarCheck,
  Zap,
  Calendar,
  Heart,
  BarChart3,
  Clock,
  X,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface Nudge {
  id: string;
  type: string;
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
  action?: {
    label: string;
    href: string;
  };
  icon: string;
}

// ── Icon Map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, typeof Flame> = {
  Flame,
  AlertTriangle,
  CheckCircle,
  Target,
  CalendarCheck,
  Zap,
  Calendar,
  Heart,
  BarChart3,
  Clock,
};

// ── Priority Styles ──────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20",
  medium: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20",
  low: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20",
};

const PRIORITY_ICON_COLORS: Record<string, string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-blue-500",
};

const PRIORITY_TEXT_COLORS: Record<string, string> = {
  high: "text-red-800 dark:text-red-300",
  medium: "text-amber-800 dark:text-amber-300",
  low: "text-blue-800 dark:text-blue-300",
};

// ── Component ────────────────────────────────────────────────────────────────

export function NudgeBanner() {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/nudges")
      .then((r) => r.json())
      .then((data) => {
        if (data.nudges) setNudges(data.nudges);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const visibleNudges = nudges.filter((n) => !dismissed.has(n.id));

  if (loading || visibleNudges.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleNudges.map((nudge) => {
        const Icon = ICON_MAP[nudge.icon] ?? Zap;

        return (
          <div
            key={nudge.id}
            className={clsx(
              "flex items-start gap-3 p-3 rounded-xl border transition-all",
              PRIORITY_STYLES[nudge.priority]
            )}
          >
            {/* Icon */}
            <div className="shrink-0 mt-0.5">
              <Icon
                size={16}
                className={PRIORITY_ICON_COLORS[nudge.priority]}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p
                className={clsx(
                  "text-xs sm:text-sm font-semibold",
                  PRIORITY_TEXT_COLORS[nudge.priority]
                )}
              >
                {nudge.title}
              </p>
              <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5 leading-relaxed">
                {nudge.message}
              </p>

              {nudge.action && (
                <Link
                  href={nudge.action.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 mt-1.5"
                >
                  {nudge.action.label}
                  <ChevronRight size={12} />
                </Link>
              )}
            </div>

            {/* Dismiss */}
            <button
              onClick={() =>
                setDismissed((prev) => new Set([...prev, nudge.id]))
              }
              className="shrink-0 p-1 rounded-md hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 hover:text-surface-600 transition-colors"
              aria-label="Schliessen"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
