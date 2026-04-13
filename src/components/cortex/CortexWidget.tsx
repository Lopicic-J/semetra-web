"use client";

import { useState, useEffect, useCallback } from "react";
import { clsx } from "clsx";
import {
  Brain,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Activity,
} from "lucide-react";
import HealthIndicator, { OverallHealthBadge } from "./HealthIndicator";
import InsightCard from "./InsightCard";

// ─── Types (matches API response) ─────────────────────────────────

interface EngineHealthSummary {
  name: string;
  status: "healthy" | "stale" | "degraded" | "critical";
}

interface InsightData {
  id: string;
  type: string;
  severity: "info" | "attention" | "warning" | "critical";
  title: string;
  description: string;
  suggestion: string;
  actionHref?: string;
  engines: string[];
}

interface CortexData {
  overallHealth: "healthy" | "degraded" | "critical";
  engines: Record<string, { status: string }>;
  integrity: { issuesFound: number; autoRepaired: number };
  insights: InsightData[];
  cycleDuration: number;
}

// ─── Engine Labels ────────────────────────────────────────────────

const ENGINE_LABELS: Record<string, string> = {
  decision: "Decision",
  schedule: "Zeitplan",
  academic: "Akademisch",
  dna: "Lern-DNA",
  streaks: "Streaks",
  patterns: "Muster",
};

// ─── Component ────────────────────────────────────────────────────

export default function CortexWidget() {
  const [data, setData] = useState<CortexData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchCortex = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cortex");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail — widget is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCortex();
    // Refresh every 5 minutes
    const interval = setInterval(fetchCortex, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCortex]);

  const handleDismiss = useCallback(
    async (id: string) => {
      setDismissed((prev) => new Set(prev).add(id));
      // Fire-and-forget dismiss to API
      try {
        await fetch(`/api/cortex/insights`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ insightId: id, action: "dismiss" }),
        });
      } catch {
        // ignore
      }
    },
    []
  );

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cortex", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Loading State ───────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 animate-pulse text-purple-500" />
          <span className="text-sm text-neutral-500">Cortex analysiert...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ── Filter visible insights ─────────────────────────────────────

  const visibleInsights = (data.insights || []).filter(
    (i) => !dismissed.has(i.id)
  );
  const topInsights = expanded ? visibleInsights : visibleInsights.slice(0, 3);
  const hasMore = visibleInsights.length > 3;

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Cortex
          </span>
          <OverallHealthBadge health={data.overallHealth} />
        </div>
        <div className="flex items-center gap-1">
          {data.integrity.issuesFound > 0 && (
            <span className="mr-2 text-xs text-neutral-500">
              {data.integrity.autoRepaired}/{data.integrity.issuesFound} repariert
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            title="Cortex-Zyklus neu ausführen"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Engine Health Grid */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-1 border-b border-neutral-100 px-4 py-2 dark:border-neutral-800 sm:grid-cols-6">
        {Object.entries(data.engines).map(([name, engine]) => (
          <HealthIndicator
            key={name}
            status={engine.status as "healthy" | "stale" | "degraded" | "critical"}
            label={ENGINE_LABELS[name] || name}
            size="sm"
          />
        ))}
      </div>

      {/* Insights */}
      {topInsights.length > 0 ? (
        <div className="space-y-2 p-3">
          {topInsights.map((ins) => (
            <InsightCard
              key={ins.id}
              id={ins.id}
              type={ins.type}
              severity={ins.severity}
              title={ins.title}
              description={ins.description}
              suggestion={ins.suggestion}
              actionHref={ins.actionHref}
              engines={ins.engines}
              onDismiss={handleDismiss}
            />
          ))}

          {/* Expand / Collapse */}
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              {expanded ? (
                <>Weniger anzeigen <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>{visibleInsights.length - 3} weitere Insights <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-neutral-500">
          <Activity className="h-4 w-4" />
          Keine besonderen Hinweise — alles läuft nach Plan.
        </div>
      )}
    </div>
  );
}
