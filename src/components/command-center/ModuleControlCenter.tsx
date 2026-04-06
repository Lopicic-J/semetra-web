"use client";
/**
 * Module Control Center — Decision Engine Summary for a single module.
 * Displays risk, predictions, actions, and knowledge status at a glance.
 *
 * Usage: Place at top of any module detail page via moduleId prop.
 */

import { useMemo } from "react";
import { useModuleIntelligence } from "@/lib/hooks/useModuleIntelligence";
import {
  assessModuleRisk,
  calculateModulePriority,
  predictOutcome,
  generateActions,
} from "@/lib/decision/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/lib/decision/types";
import type { RiskLevel, ActionUrgency } from "@/lib/decision/types";
import {
  Shield, TrendingUp, Target, Zap, Clock, BookOpen,
  AlertTriangle, CheckCircle, Brain, ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface ModuleControlCenterProps {
  moduleId: string;
}

const riskBadge: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", label: "Kritisch" },
  high: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", label: "Hoch" },
  medium: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", label: "Mittel" },
  low: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "Niedrig" },
  none: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", label: "Kein Risiko" },
};

const urgencyLabel: Record<ActionUrgency, string> = {
  now: "Jetzt",
  today: "Heute",
  this_week: "Diese Woche",
  soon: "Bald",
  later: "Später",
};

export default function ModuleControlCenter({ moduleId }: ModuleControlCenterProps) {
  const { modules, loading } = useModuleIntelligence();

  const analysis = useMemo(() => {
    const mod = modules.find((m) => m.moduleId === moduleId);
    if (!mod) return null;

    const risk = assessModuleRisk(mod, DEFAULT_ENGINE_CONFIG);
    const priority = calculateModulePriority(mod, risk, DEFAULT_ENGINE_CONFIG);
    const prediction = predictOutcome(mod);
    const actions = generateActions(mod, risk, DEFAULT_ENGINE_CONFIG);

    return { mod, risk, priority, prediction, actions };
  }, [modules, moduleId]);

  if (loading || !analysis) return null;

  const { mod, risk, priority, prediction, actions } = analysis;
  const badge = riskBadge[risk.overall];
  const topActions = actions.slice(0, 3);

  return (
    <div className="bg-surface-100/50 rounded-xl border border-surface-200 p-5 mb-6">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-surface-600" />
          <h3 className="font-semibold text-surface-900 text-sm">Modul-Status</h3>
        </div>
        <span className={`${badge.bg} ${badge.text} text-xs font-semibold px-2.5 py-1 rounded-full`}>
          Risiko: {badge.label}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* Grade */}
        <div className="bg-surface-200/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3.5 h-3.5 text-surface-500" />
            <span className="text-[10px] uppercase tracking-wide text-surface-500 font-medium">Note</span>
          </div>
          <p className="text-lg font-bold text-surface-900">
            {mod.grades.current?.toFixed(1) ?? "–"}
          </p>
          {mod.grades.target && (
            <p className="text-[10px] text-surface-400">Ziel: {mod.grades.target.toFixed(1)}</p>
          )}
        </div>

        {/* Pass Probability */}
        <div className="bg-surface-200/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-surface-500" />
            <span className="text-[10px] uppercase tracking-wide text-surface-500 font-medium">Bestehen</span>
          </div>
          <p className="text-lg font-bold text-surface-900">{prediction.passProbability}%</p>
          {prediction.currentTrajectory !== null && (
            <p className="text-[10px] text-surface-400">
              Prognose: {prediction.currentTrajectory.toFixed(1)}
            </p>
          )}
        </div>

        {/* Study Time */}
        <div className="bg-surface-200/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-surface-500" />
            <span className="text-[10px] uppercase tracking-wide text-surface-500 font-medium">Lernzeit</span>
          </div>
          <p className="text-lg font-bold text-surface-900">
            {mod.studyTime.last7Days}m
          </p>
          <p className="text-[10px] text-surface-400">letzte 7 Tage</p>
        </div>

        {/* Priority */}
        <div className="bg-surface-200/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-surface-500" />
            <span className="text-[10px] uppercase tracking-wide text-surface-500 font-medium">Priorität</span>
          </div>
          <p className="text-lg font-bold text-surface-900">{priority.score}</p>
          <p className="text-[10px] text-surface-400">
            {priority.suggestedMinutesToday} Min empfohlen
          </p>
        </div>
      </div>

      {/* Risk Factors */}
      {risk.factors.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-surface-600 mb-2">Risikofaktoren</p>
          <div className="flex flex-wrap gap-1.5">
            {risk.factors.slice(0, 4).map((f, i) => (
              <span
                key={i}
                className={`text-[10px] px-2 py-1 rounded-full ${riskBadge[f.severity].bg} ${riskBadge[f.severity].text}`}
              >
                {f.message}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Required Performance */}
      {prediction.requiredPerformance && (
        <div className="bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 rounded-lg p-3 mb-4">
          <p className="text-xs font-medium text-brand-700 dark:text-brand-300">
            {prediction.requiredPerformance.description}
          </p>
        </div>
      )}

      {/* Top Actions */}
      {topActions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-surface-600 mb-2">Empfohlene Aktionen</p>
          <div className="space-y-1.5">
            {topActions.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs p-2 rounded-lg hover:bg-surface-200/40 transition-colors">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  a.urgency === "now" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                  a.urgency === "today" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" :
                  "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                }`}>
                  {urgencyLabel[a.urgency]}
                </span>
                <span className="text-surface-700 truncate flex-1">{a.title}</span>
                <span className="text-surface-400">{a.estimatedMinutes}min</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
