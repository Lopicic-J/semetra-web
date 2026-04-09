"use client";
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Target, BarChart2, AlertTriangle, Award, BookOpen } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { Grade, Module } from "@/types/database";
import type { GradingSystem } from "@/lib/grading-systems";

interface GradeAnalyticsProps {
  grades: Grade[];
  modules: Module[];
  gs: GradingSystem;
}

/**
 * Notenprognosen & Trendanalyse — Pro Feature
 *
 * Reine Mathematik, kein AI, keine Requests.
 * Berechnet: Trend, Prognose, Stärken/Schwächen, Zielnotenberechnung.
 */
export function GradeAnalytics({ grades, modules, gs }: GradeAnalyticsProps) {
  const { t } = useTranslation();
  const gradesWithDate = useMemo(() =>
    grades
      .filter(g => g.grade != null && g.created_at)
      .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()),
    [grades]
  );

  // ─── Trend: Lineare Regression über die letzten Noten ───
  const trend = useMemo(() => {
    if (gradesWithDate.length < 3) return null;

    const values = gradesWithDate.map((g, i) => ({ x: i, y: g.grade! }));
    const n = values.length;
    const sumX = values.reduce((s, v) => s + v.x, 0);
    const sumY = values.reduce((s, v) => s + v.y, 0);
    const sumXY = values.reduce((s, v) => s + v.x * v.y, 0);
    const sumX2 = values.reduce((s, v) => s + v.x * v.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgGrade = sumY / n;

    // Prognose: nächste 3 Noten extrapolieren
    const nextPredicted = avgGrade + slope * (n + 1);

    // Trend-Richtung
    const direction = Math.abs(slope) < 0.05
      ? "stable" as const
      : (gs.direction === "higher_better"
        ? (slope > 0 ? "improving" : "declining")
        : (slope < 0 ? "improving" : "declining")) as "improving" | "declining";

    return { slope, avgGrade, nextPredicted, direction };
  }, [gradesWithDate, gs.direction]);

  // ─── Letzte 5 vs. erste 5 Noten ───
  const momentum = useMemo(() => {
    if (gradesWithDate.length < 6) return null;
    const first5 = gradesWithDate.slice(0, 5).reduce((s, g) => s + g.grade!, 0) / 5;
    const last5 = gradesWithDate.slice(-5).reduce((s, g) => s + g.grade!, 0) / 5;
    const diff = last5 - first5;
    return { first5, last5, diff };
  }, [gradesWithDate]);

  // ─── Stärken & Schwächen (Module mit besten/schlechtesten Noten) ───
  const moduleStats = useMemo(() => {
    const stats = modules.map(m => {
      const mGrades = grades.filter(g => g.module_id === m.id && g.grade != null);
      if (mGrades.length === 0) return null;
      const avg = mGrades.reduce((s, g) => s + g.grade!, 0) / mGrades.length;
      return { module: m, avg, count: mGrades.length };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    if (stats.length < 2) return null;

    const sorted = [...stats].sort((a, b) =>
      gs.direction === "higher_better" ? b.avg - a.avg : a.avg - b.avg
    );

    return {
      strongest: sorted.slice(0, 2),
      weakest: sorted.slice(-2).reverse(),
    };
  }, [grades, modules, gs.direction]);

  // ─── Zielnotenberechnung: Was brauche ich für X? ───
  const targetCalc = useMemo(() => {
    const allGrades = grades.filter(g => g.grade != null);
    if (allGrades.length < 2) return null;

    const currentAvg = allGrades.reduce((s, g) => s + g.grade!, 0) / allGrades.length;
    // Dynamic target: ~83% of max for higher_better, midpoint of min–pass for lower_better
    const targetAvg = gs.direction === "lower_better"
      ? Math.round((gs.min + gs.passingGrade) / 2 * 10) / 10    // e.g. DE: (1+4)/2 = 2.5
      : Math.round(gs.max * 0.83 * 10) / 10;                     // e.g. CH: 6*0.83 ≈ 5.0
    const remaining = Math.max(1, modules.length - allGrades.length);

    // Was muss der Schnitt der restlichen Noten sein?
    const needed = (targetAvg * (allGrades.length + remaining) - allGrades.reduce((s, g) => s + g.grade!, 0)) / remaining;

    return {
      currentAvg,
      targetAvg,
      needed: Math.round(needed * 100) / 100,
      remaining,
      achievable: gs.direction === "higher_better"
        ? needed <= gs.max && needed >= gs.min
        : needed >= gs.min && needed <= gs.max,
    };
  }, [grades, modules, gs]);

  // ─── Per-Module Prognose: Welche Note brauche ich als nächstes? ───
  const modulePrognosis = useMemo(() => {
    // Dynamic targets: passing, mid-range good, excellent — scale-relative
    const range = gs.max - gs.min;
    const targets = gs.direction === "higher_better"
      ? [
          gs.passingGrade,                                           // e.g. CH: 4.0
          Math.round((gs.passingGrade + (gs.max - gs.passingGrade) * 0.5) * 10) / 10, // e.g. CH: 5.0
          Math.round((gs.passingGrade + (gs.max - gs.passingGrade) * 0.8) * 10) / 10, // e.g. CH: 5.6
        ]
      : [
          gs.passingGrade,                                           // e.g. DE: 4.0
          Math.round((gs.min + (gs.passingGrade - gs.min) * 0.5) * 10) / 10, // e.g. DE: 2.5
          Math.round((gs.min + (gs.passingGrade - gs.min) * 0.2) * 10) / 10, // e.g. DE: 1.6
        ];

    return modules
      .map(m => {
        const mg = grades.filter(g => g.module_id === m.id && g.grade != null);
        if (mg.length === 0) return null;

        const totalWeight = mg.reduce((s, g) => s + (g.weight ?? 1), 0);
        const weightedSum = mg.reduce((s, g) => s + g.grade! * (g.weight ?? 1), 0);
        const currentAvg = totalWeight > 0 ? weightedSum / totalWeight : 0;

        const prognosis = targets.map(target => {
          // needed = (target * (totalWeight + 1) - weightedSum) / 1
          const needed = target * (totalWeight + 1) - weightedSum;
          const rounded = Math.round(needed * 100) / 100;
          const achievable = gs.direction === "higher_better"
            ? rounded <= gs.max
            : rounded >= gs.min;
          const alreadyMet = gs.direction === "higher_better"
            ? currentAvg >= target
            : currentAvg <= target;
          return { target, needed: rounded, achievable, alreadyMet };
        });

        return {
          module: m,
          currentAvg,
          gradeCount: mg.length,
          prognosis,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter(x => x.prognosis.some(p => !p.alreadyMet)); // only show modules that still need work
  }, [grades, modules, gs]);

  // ─── Notenverteilung ───
  const distribution = useMemo(() => {
    const allGrades = grades.filter(g => g.grade != null).map(g => g.grade!);
    if (allGrades.length < 3) return null;

    const buckets: Record<string, number> = {};
    for (const g of allGrades) {
      const rounded = Math.round(g * 2) / 2; // 0.5er Schritte
      const key = rounded.toFixed(1);
      buckets[key] = (buckets[key] ?? 0) + 1;
    }

    return Object.entries(buckets)
      .map(([grade, count]) => ({ grade: parseFloat(grade), count }))
      .sort((a, b) => a.grade - b.grade);
  }, [grades]);

  if (gradesWithDate.length < 3) {
    return (
      <div className="bg-surface-50 border border-surface-200 rounded-xl p-5 text-center">
        <BarChart2 size={24} className="text-surface-400 mx-auto mb-2" />
        <p className="text-sm text-surface-500">
          Mindestens 3 Noten nötig für Analysen & Prognosen.
        </p>
        <p className="text-xs text-surface-400 mt-1">
          Aktuell: {gradesWithDate.length} Noten eingetragen
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Trend & Prognose */}
      {trend && (
        <div className="bg-[rgb(var(--card-bg))] border border-surface-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            {trend.direction === "improving" ? (
              <TrendingUp size={18} className="text-green-600" />
            ) : trend.direction === "declining" ? (
              <TrendingDown size={18} className="text-red-500" />
            ) : (
              <Minus size={18} className="text-surface-400" />
            )}
            <h3 className="text-sm font-semibold text-surface-900">Notentrend</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-surface-500">Durchschnitt</p>
              <p className="text-lg font-bold text-surface-900">{trend.avgGrade.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-surface-500">Trend</p>
              <p className={`text-lg font-bold ${
                trend.direction === "improving" ? "text-green-600" :
                trend.direction === "declining" ? "text-red-500" : "text-surface-600"
              }`}>
                {trend.direction === "improving" ? "Aufwärts" :
                 trend.direction === "declining" ? "Abwärts" : "Stabil"}
              </p>
            </div>
            <div>
              <p className="text-xs text-surface-500">Prognose nächste Note</p>
              <p className="text-lg font-bold text-brand-600">
                ~{Math.max(gs.min, Math.min(gs.max, trend.nextPredicted)).toFixed(1)}
              </p>
            </div>
          </div>

          {momentum && (
            <div className="mt-3 pt-3 border-t border-surface-100">
              <p className="text-xs text-surface-500">
                Erste 5 Noten: <span className="font-semibold">{momentum.first5.toFixed(2)}</span> →
                Letzte 5 Noten: <span className="font-semibold">{momentum.last5.toFixed(2)}</span>
                {momentum.diff !== 0 && (
                  <span className={`ml-1.5 font-semibold ${
                    (gs.direction === "higher_better" ? momentum.diff > 0 : momentum.diff < 0)
                      ? "text-green-600" : "text-red-500"
                  }`}>
                    ({momentum.diff > 0 ? "+" : ""}{momentum.diff.toFixed(2)})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Notenverteilung (simple bar chart) */}
      {distribution && (
        <div className="bg-[rgb(var(--card-bg))] border border-surface-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={18} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-surface-900">Notenverteilung</h3>
          </div>
          <div className="flex items-end gap-1 h-20">
            {distribution.map(d => {
              const maxCount = Math.max(...distribution.map(x => x.count));
              const height = (d.count / maxCount) * 100;
              const isPassing = gs.isPassing(d.grade);
              return (
                <div key={d.grade} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[9px] text-surface-500">{d.count}</span>
                  <div
                    className={`w-full rounded-t ${isPassing ? "bg-brand-500" : "bg-red-400"}`}
                    style={{ height: `${Math.max(4, height)}%` }}
                  />
                  <span className="text-[9px] text-surface-500">{d.grade}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stärken & Schwächen */}
      {moduleStats && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-[rgb(var(--card-bg))] border border-surface-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Award size={18} className="text-green-600" />
              <h3 className="text-sm font-semibold text-surface-900">Stärkste Module</h3>
            </div>
            {moduleStats.strongest.map(s => (
              <div key={s.module.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.module.color ?? "#6366f1" }} />
                  <span className="text-xs text-surface-700">{s.module.name}</span>
                </div>
                <span className="text-xs font-bold text-green-600">{s.avg.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="bg-[rgb(var(--card-bg))] border border-surface-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-surface-900">Schwächste Module</h3>
            </div>
            {moduleStats.weakest.map(s => (
              <div key={s.module.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.module.color ?? "#6366f1" }} />
                  <span className="text-xs text-surface-700">{s.module.name}</span>
                </div>
                <span className="text-xs font-bold text-amber-600">{s.avg.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zielnotenberechnung */}
      {targetCalc && (
        <div className="bg-[rgb(var(--card-bg))] border border-surface-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target size={18} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-surface-900">{t("grades.analytics.targetCalc")}</h3>
          </div>
          <p className="text-xs text-surface-600">
            {t("grades.analytics.currentAvg")}: <span className="font-bold">{targetCalc.currentAvg.toFixed(2)}</span> ·
            {t("grades.analytics.target")}: <span className="font-bold">{targetCalc.targetAvg.toFixed(1)}</span> ·
            {t("grades.analytics.remaining", { count: targetCalc.remaining })}
          </p>
          <div className={`mt-2 p-3 rounded-lg text-sm ${
            targetCalc.achievable
              ? "bg-green-50 text-green-800"
              : "bg-amber-50 text-amber-800"
          }`}>
            {targetCalc.achievable ? (
              <>{t("grades.analytics.needAvg", { grade: targetCalc.needed.toFixed(1), target: targetCalc.targetAvg.toFixed(1) })}</>
            ) : (
              <>{t("grades.analytics.unreachable", { target: targetCalc.targetAvg.toFixed(1) })}</>
            )}
          </div>
        </div>
      )}

      {/* Per-Module Prognose: Welche Note brauche ich als nächstes? */}
      {modulePrognosis.length > 0 && (
        <div className="bg-[rgb(var(--card-bg))] border border-surface-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={18} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-surface-900">{t("grades.analytics.modulePrognosis")}</h3>
          </div>
          <p className="text-xs text-surface-500 mb-3">{t("grades.analytics.modulePrognosisDesc")}</p>
          <div className="space-y-2.5">
            {modulePrognosis.map(mp => (
              <div key={mp.module.id} className="border border-surface-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: mp.module.color ?? "#6366f1" }} />
                  <span className="text-xs font-semibold text-surface-800 flex-1">{mp.module.name}</span>
                  <span className="text-xs text-surface-500">
                    ⌀ {mp.currentAvg.toFixed(2)} ({mp.gradeCount} {mp.gradeCount === 1 ? t("grades.analytics.gradesSg") : t("grades.analytics.gradesPl")})
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {mp.prognosis.map(p => {
                    if (p.alreadyMet) return (
                      <span key={p.target} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 text-[10px] font-medium">
                        ✓ ⌀ {p.target.toFixed(1)}
                      </span>
                    );
                    if (!p.achievable) return (
                      <span key={p.target} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-600 text-[10px] font-medium">
                        ✗ ⌀ {p.target.toFixed(1)}
                      </span>
                    );
                    return (
                      <span key={p.target} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-[10px] font-medium">
                        → {t("grades.analytics.need")} <strong>{p.needed.toFixed(1)}</strong> {t("grades.analytics.forAvg")} {p.target.toFixed(1)}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
