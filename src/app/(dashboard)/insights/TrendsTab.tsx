"use client";

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { useGrades } from "@/lib/hooks/useGrades";
import { useModules } from "@/lib/hooks/useModules";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import { getGradeColor, formatGrade } from "@/lib/grading-systems";
import { ectsWeightedAvg } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Minus, Target, AlertTriangle,
  Award, Zap, GraduationCap, BarChart3,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Trends & Prognosen Tab
// Grade analytics, GPA trajectory, predictions, risk alerts
// Data: Academic Engine → Grade calculations + trend analysis
// ═══════════════════════════════════════════════════════════════════════════

export default function TrendsTab() {
  const { t } = useTranslation();
  const { grades } = useGrades();
  const { modules } = useModules();
  const gs = useGradingSystem();

  // ── Grade trend analysis ───────────────────────────────────────────────
  const analysis = useMemo(() => {
    if (!grades.length) return null;

    const sorted = [...grades]
      .filter(g => g.grade !== null && g.grade !== undefined)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (sorted.length < 2) return null;

    // Linear regression for trend
    const values = sorted.map((g, i) => ({ x: i, y: Number(g.grade) }));
    const n = values.length;
    const sumX = values.reduce((s, v) => s + v.x, 0);
    const sumY = values.reduce((s, v) => s + v.y, 0);
    const sumXY = values.reduce((s, v) => s + v.x * v.y, 0);
    const sumX2 = values.reduce((s, v) => s + v.x * v.x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Momentum: first half vs second half
    const mid = Math.floor(n / 2);
    const firstHalf = values.slice(0, mid).reduce((s, v) => s + v.y, 0) / mid;
    const secondHalf = values.slice(mid).reduce((s, v) => s + v.y, 0) / (n - mid);
    const momentum = secondHalf - firstHalf;

    // Predictions: next 3 grades
    const predictions = [1, 2, 3].map(i => {
      const predicted = slope * (n + i) + intercept;
      return Math.max(gs?.min ?? 1, Math.min(gs?.max ?? 6, Math.round(predicted * 10) / 10));
    });

    // Module averages for strengths/weaknesses
    const moduleGrades: Record<string, { sum: number; count: number; name: string }> = {};
    sorted.forEach(g => {
      const mod = modules.find(m => m.id === g.module_id);
      if (!mod) return;
      if (!moduleGrades[mod.id]) moduleGrades[mod.id] = { sum: 0, count: 0, name: mod.name };
      moduleGrades[mod.id].sum += Number(g.grade);
      moduleGrades[mod.id].count++;
    });

    const moduleAvgs = Object.entries(moduleGrades)
      .filter(([, v]) => v.count >= 1)
      .map(([id, v]) => ({ id, name: v.name, avg: v.sum / v.count }))
      .sort((a, b) => {
        return gs?.direction === "lower_better" ? a.avg - b.avg : b.avg - a.avg;
      });

    const strengths = moduleAvgs.slice(0, 3);
    const weaknesses = moduleAvgs.slice(-3).reverse();

    // Current GPA — join grades with modules to get ECTS weights
    const gradeModulePairs = sorted
      .map(g => {
        const mod = modules.find(m => m.id === g.module_id);
        return mod ? { grade: Number(g.grade), ects: mod.ects ?? 0 } : null;
      })
      .filter((x): x is { grade: number; ects: number } => x !== null && x.ects > 0);
    const currentGPA = ectsWeightedAvg(gradeModulePairs);

    // Target GPA: dynamically based on grading system
    // For higher_better (CH 1-6): aim for "gut" = ~5.0
    // For lower_better (DE 1-5): aim for "gut" = ~2.0
    const targetGPA = gs?.direction === "lower_better"
      ? Math.round((gs.min + gs.passingGrade) / 2 * 10) / 10  // e.g. DE: (1+4)/2 = 2.5
      : Math.round((gs?.max ?? 6) * 0.83 * 10) / 10;          // e.g. CH: 6*0.83 ≈ 5.0
    const totalModules = sorted.length;
    const currentSum = sorted.reduce((s, g) => s + Number(g.grade), 0);
    const neededForTarget = totalModules > 0
      ? (targetGPA * (totalModules + 1) - currentSum)
      : targetGPA;

    return {
      slope,
      momentum,
      predictions,
      strengths,
      weaknesses,
      currentGPA,
      targetGPA,
      neededForTarget,
      totalGrades: n,
    };
  }, [grades, modules, gs]);

  if (!grades.length) {
    return (
      <div className="text-center py-20 text-surface-400">
        <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">Noch keine Noten vorhanden — Trends werden sichtbar sobald du Noten einträgst.</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-20 text-surface-400">
        <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">Mindestens 2 Noten benötigt für Trend-Analyse.</p>
      </div>
    );
  }

  // For lower_better systems (DE, AT, CZ): slope < 0 means improving
  const isLowerBetter = gs?.direction === "lower_better";
  const improving = isLowerBetter ? analysis.slope < -0.05 : analysis.slope > 0.05;
  const declining = isLowerBetter ? analysis.slope > 0.05 : analysis.slope < -0.05;
  const trendDir = improving ? "up" : declining ? "down" : "stable";
  const TrendIcon = trendDir === "up" ? TrendingUp : trendDir === "down" ? TrendingDown : Minus;
  const trendColor = trendDir === "up" ? "text-green-600" : trendDir === "down" ? "text-red-500" : "text-surface-500";
  const trendLabel = trendDir === "up" ? "Aufwärts" : trendDir === "down" ? "Abwärts" : "Stabil";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          icon={<GraduationCap size={20} className="text-brand-600" />}
          label="Aktueller Schnitt"
          value={analysis.currentGPA.toFixed(2)}
        />
        <MetricCard
          icon={<TrendIcon size={20} className={trendColor} />}
          label="Trend"
          value={trendLabel}
          sublabel={`Steigung: ${analysis.slope > 0 ? "+" : ""}${analysis.slope.toFixed(3)}`}
        />
        <MetricCard
          icon={<Zap size={20} className={
            (isLowerBetter ? analysis.momentum < 0 : analysis.momentum > 0) ? "text-green-500" : "text-red-500"
          } />}
          label="Momentum"
          value={analysis.momentum > 0 ? `+${analysis.momentum.toFixed(2)}` : analysis.momentum.toFixed(2)}
          sublabel="2. Hälfte vs. 1. Hälfte"
        />
        <MetricCard
          icon={<Target size={20} className="text-amber-500" />}
          label={`Nächste Note für ${analysis.targetGPA}`}
          value={analysis.neededForTarget.toFixed(1)}
          sublabel="Ziel-Durchschnitt"
        />
      </div>

      {/* Predictions */}
      <div className="card">
        <h3 className="text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-brand-500" /> Notenprognose
        </h3>
        <p className="text-xs text-surface-400 mb-4">
          Basierend auf linearer Regression über {analysis.totalGrades} Noten
        </p>
        <div className="flex gap-4">
          {analysis.predictions.map((pred, i) => (
 <div key={i} className="flex-1 text-center p-3 rounded-xl bg-surface-50">
              <p className="text-xs text-surface-400 mb-1">Note {analysis.totalGrades + i + 1}</p>
              <p className="text-2xl font-bold text-surface-800">{pred.toFixed(1)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
            <Award size={16} className="text-green-500" /> Stärken
          </h3>
          <div className="space-y-2">
            {analysis.strengths.map(s => (
              <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
                <span className="text-sm text-surface-700 truncate">{s.name}</span>
                <span className="text-sm font-semibold text-green-600">{s.avg.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" /> Verbesserungspotential
          </h3>
          <div className="space-y-2">
            {analysis.weaknesses.map(w => (
              <div key={w.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                <span className="text-sm text-surface-700 truncate">{w.name}</span>
                <span className="text-sm font-semibold text-amber-600">{w.avg.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sublabel }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="card text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-2xl font-bold text-surface-800">{value}</p>
      <p className="text-xs text-surface-500 mt-1">{label}</p>
      {sublabel && <p className="text-[10px] text-surface-400 mt-0.5">{sublabel}</p>}
    </div>
  );
}
