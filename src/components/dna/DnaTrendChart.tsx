"use client";

import { useState, useEffect, useMemo } from "react";
import { clsx } from "clsx";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";

// ── Types ────────────────────────────────────────────────────────────────────

interface TrendPoint {
  date: string;
  consistency: number;
  focus: number;
  endurance: number;
  adaptability: number;
  planning: number;
  overall: number;
  learnerType: string;
}

interface TrendSummary {
  dimension: string;
  current: number;
  previous: number;
  change: number;
  trend: "improving" | "stable" | "declining";
}

interface HistoryResponse {
  history: TrendPoint[];
  trends: TrendSummary[];
  stats: {
    snapshotCount: number;
    totalSessions: number;
    totalStudyMinutes: number;
    currentType: string;
    typeChanges: { from: string; to: string; date: string }[];
  };
}

// ── SVG Sparkline ────────────────────────────────────────────────────────────

function Sparkline({
  data,
  color,
  width = 120,
  height = 32,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Current value dot */}
      {data.length > 0 && (
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
          r={2.5}
          fill={color}
        />
      )}
    </svg>
  );
}

// ── Dimension Config ─────────────────────────────────────────────────────────

const DIMENSIONS: {
  key: keyof TrendPoint;
  label: string;
  color: string;
  svgColor: string;
}[] = [
  { key: "overall", label: "Gesamt", color: "text-brand-500", svgColor: "rgb(var(--brand-500))" },
  { key: "consistency", label: "Konsistenz", color: "text-blue-500", svgColor: "#3b82f6" },
  { key: "focus", label: "Fokus", color: "text-purple-500", svgColor: "#a855f7" },
  { key: "endurance", label: "Ausdauer", color: "text-orange-500", svgColor: "#f97316" },
  { key: "adaptability", label: "Anpassung", color: "text-green-500", svgColor: "#22c55e" },
  { key: "planning", label: "Planung", color: "text-cyan-500", svgColor: "#06b6d4" },
];

// ── Main Component ───────────────────────────────────────────────────────────

export function DnaTrendChart() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learning-dna/history?limit=20")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card padding="md">
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-surface-400" />
        </div>
      </Card>
    );
  }

  if (!data || data.history.length < 2) {
    return (
      <Card padding="md">
        <div className="flex items-center gap-2 text-xs text-surface-500 py-4">
          <History size={14} />
          Mindestens 2 Snapshots nötig für den Verlauf
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <div className="flex items-center gap-2 mb-4">
        <History size={16} className="text-brand-500 shrink-0" />
        <h3 className="text-xs sm:text-sm font-semibold text-surface-800">
          DNA-Verlauf
        </h3>
        <span className="text-xs text-surface-500 ml-auto">
          {data.stats.snapshotCount} Snapshots
        </span>
      </div>

      <div className="space-y-3">
        {DIMENSIONS.map((dim) => {
          const values = data.history.map(
            (h) => h[dim.key] as number
          );
          const trend = data.trends.find((t) => t.dimension === dim.label);

          return (
            <div
              key={dim.key}
              className="flex items-center gap-3 min-w-0"
            >
              {/* Label */}
              <span
                className={clsx(
                  "text-xs font-medium w-20 shrink-0 truncate",
                  dim.color
                )}
              >
                {dim.label}
              </span>

              {/* Sparkline */}
              <Sparkline data={values} color={dim.svgColor} />

              {/* Current value */}
              <span className="text-xs font-semibold text-surface-800 w-8 text-right shrink-0">
                {Math.round(values[values.length - 1])}%
              </span>

              {/* Trend */}
              {trend && (
                <span
                  className={clsx(
                    "flex items-center gap-0.5 text-xs shrink-0",
                    trend.trend === "improving"
                      ? "text-green-500"
                      : trend.trend === "declining"
                      ? "text-red-500"
                      : "text-surface-400"
                  )}
                >
                  {trend.trend === "improving" ? (
                    <TrendingUp size={12} />
                  ) : trend.trend === "declining" ? (
                    <TrendingDown size={12} />
                  ) : (
                    <Minus size={12} />
                  )}
                  {trend.change > 0 ? "+" : ""}
                  {trend.change}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Learner type changes */}
      {data.stats.typeChanges.length > 0 && (
        <div className="mt-4 pt-3 border-t border-surface-200">
          <p className="text-xs text-surface-500 mb-1.5">Typ-Entwicklung</p>
          <div className="flex flex-wrap gap-1.5">
            {data.stats.typeChanges.map((change, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400"
              >
                {change.from} → {change.to}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
