"use client";

import { clsx } from "clsx";

/**
 * Skeleton — Animated loading placeholders
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton variant="card" />
 *   <Skeleton variant="chart" />
 *   <SkeletonList count={3} />
 */

interface SkeletonProps {
  className?: string;
  variant?: "text" | "card" | "chart" | "avatar" | "button";
}

export function Skeleton({ className, variant = "text" }: SkeletonProps) {
  const variantClasses: Record<string, string> = {
    text: "h-4 w-full rounded",
    card: "h-32 w-full rounded-xl",
    chart: "h-48 w-full rounded-xl",
    avatar: "h-10 w-10 rounded-full",
    button: "h-9 w-24 rounded-lg",
  };

  return (
    <div
      className={clsx(
        "animate-pulse bg-surface-200 dark:bg-surface-700",
        variantClasses[variant],
        className
      )}
    />
  );
}

/**
 * SkeletonList — Render multiple skeleton lines
 */
export function SkeletonList({
  count = 3,
  spacing = "space-y-3",
}: {
  count?: number;
  spacing?: string;
}) {
  return (
    <div className={spacing}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          className={clsx("h-4", i % 3 === 0 ? "w-full" : i % 3 === 1 ? "w-3/4" : "w-1/2")}
        />
      ))}
    </div>
  );
}

/**
 * SkeletonCard — Card-shaped skeleton for dashboard blocks
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-surface-200 dark:border-surface-700 p-4 space-y-3",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" className="h-8 w-8" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton variant="chart" className="h-24" />
    </div>
  );
}

/**
 * SkeletonDashboard — Full dashboard loading state
 */
export function SkeletonDashboard() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton variant="button" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="rounded-xl border border-surface-200 dark:border-surface-700 p-4 space-y-2"
          >
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>

      {/* Content blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
