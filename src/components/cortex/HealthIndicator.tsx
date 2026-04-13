"use client";

import { clsx } from "clsx";

interface HealthIndicatorProps {
  status: "healthy" | "stale" | "degraded" | "critical";
  label: string;
  size?: "sm" | "md";
}

const STATUS_CONFIG = {
  healthy: {
    color: "bg-emerald-500",
    ring: "ring-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "Gesund",
  },
  stale: {
    color: "bg-yellow-500",
    ring: "ring-yellow-500/30",
    text: "text-yellow-600 dark:text-yellow-400",
    label: "Veraltet",
  },
  degraded: {
    color: "bg-orange-500",
    ring: "ring-orange-500/30",
    text: "text-orange-600 dark:text-orange-400",
    label: "Beeinträchtigt",
  },
  critical: {
    color: "bg-red-500",
    ring: "ring-red-500/30",
    text: "text-red-600 dark:text-red-400",
    label: "Kritisch",
  },
};

export default function HealthIndicator({ status, label, size = "md" }: HealthIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const dotSize = size === "sm" ? "h-2 w-2" : "h-3 w-3";

  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          "rounded-full ring-2",
          config.color,
          config.ring,
          dotSize,
          status !== "healthy" && "animate-pulse"
        )}
      />
      <span className={clsx("text-xs font-medium", config.text)}>
        {label}
      </span>
    </div>
  );
}

export function OverallHealthBadge({ health }: { health: "healthy" | "degraded" | "critical" }) {
  const config = {
    healthy: {
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-200 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-300",
      label: "Alles läuft",
    },
    degraded: {
      bg: "bg-orange-50 dark:bg-orange-900/20",
      border: "border-orange-200 dark:border-orange-800",
      text: "text-orange-700 dark:text-orange-300",
      label: "Teilweise beeinträchtigt",
    },
    critical: {
      bg: "bg-red-50 dark:bg-red-900/20",
      border: "border-red-200 dark:border-red-800",
      text: "text-red-700 dark:text-red-300",
      label: "Aufmerksamkeit nötig",
    },
  }[health];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        config.bg,
        config.border,
        config.text
      )}
    >
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          health === "healthy" ? "bg-emerald-500" : health === "degraded" ? "bg-orange-500" : "bg-red-500"
        )}
      />
      {config.label}
    </span>
  );
}
