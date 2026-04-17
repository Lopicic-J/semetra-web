"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  Heart, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Clock, Battery, Brain, Sparkles, RefreshCw,
} from "lucide-react";

interface WellnessData {
  analysis: {
    balanceScore: number;
    averages: { energy: number; understanding: number; confidence: number; sessionMinutes: number };
    trends: { energy: string };
    totalSessions: number;
    totalStudyHours: number;
    warnings: string[];
    suggestions: string[];
  } | null;
  message?: string;
  period: string;
}

export default function WellnessPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<WellnessData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wellness?days=14");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4 animate-pulse">
        <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-48" />
        <div className="h-32 bg-surface-200 dark:bg-surface-700 rounded-xl" />
      </div>
    );
  }

  const analysis = data?.analysis;

  if (!analysis) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Heart size={40} className="mx-auto mb-3 text-surface-300" />
        <p className="text-surface-500">{data?.message || "Noch keine Wellness-Daten. Schliesse Lernsessions mit Reflexion ab."}</p>
      </div>
    );
  }

  const scoreColor = analysis.balanceScore >= 70 ? "text-emerald-600" :
    analysis.balanceScore >= 40 ? "text-amber-600" : "text-red-600";
  const scoreLabel = analysis.balanceScore >= 70 ? "Gesund" :
    analysis.balanceScore >= 40 ? "Achtung" : "Kritisch";

  const TrendIcon = analysis.trends.energy === "improving" ? TrendingUp :
    analysis.trends.energy === "declining" ? TrendingDown : Minus;
  const trendColor = analysis.trends.energy === "improving" ? "text-emerald-500" :
    analysis.trends.energy === "declining" ? "text-red-500" : "text-surface-400";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
            <Heart size={28} className="text-rose-500" />
            Wellness & Balance
          </h1>
          <p className="text-surface-500 text-sm mt-1">Letzte {data?.period ?? "14 Tage"}</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
          <RefreshCw size={16} className="text-surface-400" />
        </button>
      </div>

      {/* Balance Score */}
      <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-6 text-center">
        <p className="text-xs text-surface-500 uppercase tracking-wider mb-2">Balance-Score</p>
        <p className={`text-5xl font-bold ${scoreColor}`}>{analysis.balanceScore}</p>
        <p className={`text-sm font-medium ${scoreColor} mt-1`}>{scoreLabel}</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 text-center">
          <Battery size={16} className="mx-auto mb-1 text-amber-500" />
          <p className="text-lg font-bold text-surface-900 dark:text-surface-50">{analysis.averages.energy}</p>
          <p className="text-[10px] text-surface-500">Ø Energie</p>
          <TrendIcon size={12} className={`mx-auto mt-1 ${trendColor}`} />
        </div>
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 text-center">
          <Brain size={16} className="mx-auto mb-1 text-violet-500" />
          <p className="text-lg font-bold text-surface-900 dark:text-surface-50">{analysis.averages.understanding}</p>
          <p className="text-[10px] text-surface-500">Ø Verständnis</p>
        </div>
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 text-center">
          <Sparkles size={16} className="mx-auto mb-1 text-brand-500" />
          <p className="text-lg font-bold text-surface-900 dark:text-surface-50">{analysis.averages.confidence}</p>
          <p className="text-[10px] text-surface-500">Ø Sicherheit</p>
        </div>
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 text-center">
          <Clock size={16} className="mx-auto mb-1 text-blue-500" />
          <p className="text-lg font-bold text-surface-900 dark:text-surface-50">{analysis.averages.sessionMinutes}m</p>
          <p className="text-[10px] text-surface-500">Ø Session</p>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
        <p className="text-xs text-surface-500 mb-2">{analysis.totalSessions} Sessions · {analysis.totalStudyHours}h Lernzeit</p>
      </div>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <AlertTriangle size={14} /> Warnungen
          </p>
          {analysis.warnings.map((w, i) => (
            <div key={i} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-300">
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <Sparkles size={14} /> Empfehlungen
          </p>
          {analysis.suggestions.map((s, i) => (
            <div key={i} className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-sm text-emerald-700 dark:text-emerald-300">
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
