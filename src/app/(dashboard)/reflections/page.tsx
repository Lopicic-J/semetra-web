"use client";

import { useState, useEffect, useCallback } from "react";
import { useModules } from "@/lib/hooks/useModules";
import { useTranslation } from "@/lib/i18n";
import { PenLine, BookOpen, Clock, Brain, TrendingUp, Star, Filter } from "lucide-react";

interface Reflection {
  id: string;
  learned: string | null;
  difficult: string | null;
  next_steps: string | null;
  understanding_rating: number | null;
  confidence_rating: number | null;
  energy_after: number | null;
  session_duration_seconds: number | null;
  session_type: string | null;
  module_id: string | null;
  created_at: string;
  modules?: { name: string; color: string } | null;
  topics?: { title: string } | null;
}

export default function ReflectionsPage() {
  const { t } = useTranslation();
  const { modules } = useModules();
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterModule, setFilterModule] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = filterModule ? `?moduleId=${filterModule}` : "";
    try {
      const res = await fetch(`/api/reflections${params}`);
      if (res.ok) {
        const data = await res.json();
        setReflections(data.reflections ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filterModule]);

  useEffect(() => { load(); }, [load]);

  // Aggregate stats
  const totalReflections = reflections.length;
  const avgUnderstanding = totalReflections > 0
    ? Math.round(reflections.reduce((s, r) => s + (r.understanding_rating ?? 3), 0) / totalReflections * 10) / 10
    : 0;
  const avgConfidence = totalReflections > 0
    ? Math.round(reflections.reduce((s, r) => s + (r.confidence_rating ?? 3), 0) / totalReflections * 10) / 10
    : 0;

  const ratingColor = (val: number) =>
    val >= 4 ? "text-emerald-600" : val >= 3 ? "text-amber-600" : "text-red-600";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
            <PenLine size={28} className="text-rose-500" />
            {t("reflections.title") || "Lernreflexionen"}
          </h1>
          <p className="text-surface-500 text-sm mt-1">
            {t("reflections.subtitle") || "Was du gelernt hast, über die Zeit betrachtet"}
          </p>
        </div>
      </div>

      {/* Stats */}
      {totalReflections > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 text-center">
            <p className="text-2xl font-bold text-surface-900 dark:text-surface-50">{totalReflections}</p>
            <p className="text-xs text-surface-500">{t("reflections.total") || "Reflexionen"}</p>
          </div>
          <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 text-center">
            <p className={`text-2xl font-bold ${ratingColor(avgUnderstanding)}`}>{avgUnderstanding}</p>
            <p className="text-xs text-surface-500">{t("reflections.avgUnderstanding") || "Ø Verständnis"}</p>
          </div>
          <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 text-center">
            <p className={`text-2xl font-bold ${ratingColor(avgConfidence)}`}>{avgConfidence}</p>
            <p className="text-xs text-surface-500">{t("reflections.avgConfidence") || "Ø Sicherheit"}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-surface-400" />
        <select
          value={filterModule}
          onChange={e => setFilterModule(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-xs"
        >
          <option value="">{t("reflections.allModules") || "Alle Module"}</option>
          {modules.filter(m => m.status === "active").map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-surface-200 dark:bg-surface-700 rounded-xl animate-pulse" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && reflections.length === 0 && (
        <div className="text-center py-12 text-surface-400">
          <PenLine size={40} className="mx-auto mb-3 opacity-30" />
          <p>{t("reflections.empty") || "Noch keine Reflexionen. Schliesse eine Lernsession mit Reflexion ab!"}</p>
        </div>
      )}

      {/* Reflection List */}
      {!loading && reflections.map(ref => (
        <div key={ref.id} className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-4 space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {ref.modules && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: ref.modules.color ?? "#6d28d9" }} />
                  <span className="text-xs font-medium text-surface-600 dark:text-surface-400">{ref.modules.name}</span>
                </>
              )}
              {ref.session_duration_seconds && (
                <span className="text-xs text-surface-400 flex items-center gap-1">
                  <Clock size={10} /> {Math.round(ref.session_duration_seconds / 60)} Min
                </span>
              )}
            </div>
            <span className="text-[10px] text-surface-400">
              {new Date(ref.created_at).toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>

          {/* Content */}
          {ref.learned && (
            <div>
              <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider mb-0.5">
                {t("reflections.learned") || "Gelernt"}
              </p>
              <p className="text-sm text-surface-800 dark:text-surface-200">{ref.learned}</p>
            </div>
          )}
          {ref.difficult && (
            <div>
              <p className="text-[10px] font-medium text-amber-500 uppercase tracking-wider mb-0.5">
                {t("reflections.difficult") || "Schwierig"}
              </p>
              <p className="text-sm text-surface-800 dark:text-surface-200">{ref.difficult}</p>
            </div>
          )}
          {ref.next_steps && (
            <div>
              <p className="text-[10px] font-medium text-blue-500 uppercase tracking-wider mb-0.5">
                {t("reflections.nextSteps") || "Nächste Schritte"}
              </p>
              <p className="text-sm text-surface-800 dark:text-surface-200">{ref.next_steps}</p>
            </div>
          )}

          {/* Ratings */}
          {(ref.understanding_rating || ref.confidence_rating || ref.energy_after) && (
            <div className="flex gap-4 pt-1">
              {ref.understanding_rating && (
                <span className="text-xs text-surface-500 flex items-center gap-1">
                  <Brain size={10} /> {ref.understanding_rating}/5
                </span>
              )}
              {ref.confidence_rating && (
                <span className="text-xs text-surface-500 flex items-center gap-1">
                  <Star size={10} /> {ref.confidence_rating}/5
                </span>
              )}
              {ref.energy_after && (
                <span className="text-xs text-surface-500 flex items-center gap-1">
                  <TrendingUp size={10} /> {ref.energy_after}/5
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
