"use client";

import { clsx } from "clsx";
import {
  AlertTriangle,
  Brain,
  Flame,
  BookOpen,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  Calendar,
  Zap,
  ChevronRight,
  X,
} from "lucide-react";
import Link from "next/link";

interface InsightCardProps {
  id: string;
  type: string;
  severity: "info" | "attention" | "warning" | "critical";
  title: string;
  description: string;
  suggestion: string;
  actionHref?: string;
  engines: string[];
  onDismiss?: (id: string) => void;
}

const SEVERITY_STYLES = {
  info: {
    bg: "bg-blue-50 dark:bg-blue-900/10",
    border: "border-blue-200 dark:border-blue-800/50",
    icon: "text-blue-500",
  },
  attention: {
    bg: "bg-amber-50 dark:bg-amber-900/10",
    border: "border-amber-200 dark:border-amber-800/50",
    icon: "text-amber-500",
  },
  warning: {
    bg: "bg-orange-50 dark:bg-orange-900/10",
    border: "border-orange-200 dark:border-orange-800/50",
    icon: "text-orange-500",
  },
  critical: {
    bg: "bg-red-50 dark:bg-red-900/10",
    border: "border-red-200 dark:border-red-800/50",
    icon: "text-red-500",
  },
};

const TYPE_ICONS: Record<string, typeof Brain> = {
  planning_execution_gap: Target,
  burnout_risk: Flame,
  exam_underprep: AlertTriangle,
  module_neglect: BookOpen,
  grade_trajectory_alert: TrendingDown,
  optimal_time_unused: Clock,
  streak_momentum: TrendingUp,
  knowledge_decay: Brain,
  schedule_overload: Calendar,
  quick_win_available: Zap,
};

export default function InsightCard({
  id,
  type,
  severity,
  title,
  description,
  suggestion,
  actionHref,
  engines,
  onDismiss,
}: InsightCardProps) {
  const styles = SEVERITY_STYLES[severity];
  const Icon = TYPE_ICONS[type] || Brain;

  return (
    <div
      className={clsx(
        "relative rounded-lg border p-3 transition-all",
        styles.bg,
        styles.border
      )}
    >
      {/* Dismiss */}
      {onDismiss && (
        <button
          onClick={() => onDismiss(id)}
          className="absolute right-2 top-2 rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
          aria-label="Verwerfen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Header */}
      <div className="flex items-start gap-2 pr-6">
        <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", styles.icon)} />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h4>
          <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
            {description}
          </p>
        </div>
      </div>

      {/* Suggestion */}
      <p className="mt-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 pl-6">
        {suggestion}
      </p>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between pl-6">
        <div className="flex gap-1">
          {engines.map((e) => (
            <span
              key={e}
              className="rounded bg-neutral-200/60 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-700/60 dark:text-neutral-400"
            >
              {e}
            </span>
          ))}
        </div>
        {actionHref && (
          <Link
            href={actionHref}
            className={clsx(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              styles.icon,
              "hover:underline"
            )}
          >
            Ansehen <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
