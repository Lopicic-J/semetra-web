"use client";

import { TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import type { OutcomePrediction, ModuleIntelligence } from "@/lib/decision/types";
import Link from "next/link";

interface PredictionPanelProps {
  predictions: Map<string, OutcomePrediction> | Record<string, OutcomePrediction>;
  modules: ModuleIntelligence[];
}

function passColor(probability: number): string {
  if (probability >= 80) return "text-green-600 dark:text-green-400";
  if (probability >= 60) return "text-blue-600 dark:text-blue-400";
  if (probability >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function passBg(probability: number): string {
  if (probability >= 80) return "bg-green-500";
  if (probability >= 60) return "bg-blue-500";
  if (probability >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

export default function PredictionPanel({ predictions, modules }: PredictionPanelProps) {
  // Convert Map or Record to entries
  const entries: [string, OutcomePrediction][] =
    predictions instanceof Map
      ? Array.from(predictions.entries())
      : Object.entries(predictions);

  const activeModules = modules.filter((m) => m.status === "active");
  if (activeModules.length === 0 || entries.length === 0) return null;

  return (
    <div className="bg-surface-100/50 rounded-xl border border-surface-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-surface-600" />
          <h3 className="font-semibold text-surface-900">Prognosen</h3>
        </div>
        <span className="text-xs text-surface-500">voraussichtliche Endnoten</span>
      </div>

      <div className="space-y-3">
        {entries.slice(0, 6).map(([moduleId, pred]) => {
          const mod = modules.find((m) => m.moduleId === moduleId);
          if (!mod || mod.status !== "active") return null;

          return (
            <Link
              key={moduleId}
              href={`/modules/${moduleId}`}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-200/50 transition-colors group"
            >
              <div
                className="w-2 h-10 rounded-full flex-shrink-0"
                style={{ backgroundColor: mod.color ?? "#6b7280" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 truncate group-hover:text-brand-600">
                  {mod.moduleName}
                </p>
                {pred.requiredPerformance && (
                  <p className="text-xs text-surface-500 truncate">
                    {pred.requiredPerformance.description}
                  </p>
                )}
              </div>

              {/* Trajectory */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {pred.currentTrajectory !== null && (
                  <div className="text-right">
                    <p className="text-sm font-bold text-surface-900">
                      {pred.currentTrajectory.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-surface-400">Prognose</p>
                  </div>
                )}
                {pred.targetGrade !== null && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-surface-600">
                      {pred.targetGrade.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-surface-400">Ziel</p>
                  </div>
                )}

                {/* Pass Probability Bar */}
                <div className="w-12 flex flex-col items-center">
                  <span className={`text-xs font-bold ${passColor(pred.passProbability)}`}>
                    {pred.passProbability}%
                  </span>
                  <div className="w-full h-1.5 rounded-full bg-surface-200 mt-0.5">
                    <div
                      className={`h-full rounded-full ${passBg(pred.passProbability)}`}
                      style={{ width: `${pred.passProbability}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
