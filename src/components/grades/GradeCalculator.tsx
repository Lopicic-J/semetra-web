"use client";
/**
 * GradeCalculator — "Was brauche ich für eine 5.0?"
 *
 * Interactive widget that calculates the grade needed in upcoming
 * exams to achieve a target module average.
 *
 * Supports all grading systems (higher_better / lower_better).
 */

import { useState, useMemo } from "react";
import { Calculator, Target, Info } from "lucide-react";
import type { Grade, Module } from "@/types/database";
import type { GradingSystem } from "@/lib/grading-systems";
import { getGradeColor, formatGrade } from "@/lib/grading-systems";

interface GradeCalculatorProps {
  grades: Grade[];
  modules: Module[];
  gs: GradingSystem;
}

export function GradeCalculator({ grades, modules, gs }: GradeCalculatorProps) {
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [targetGrade, setTargetGrade] = useState<string>(
    gs.direction === "higher_better" ? String(gs.passingGrade) : String(gs.passingGrade)
  );
  const [nextWeight, setNextWeight] = useState<string>("1");

  // Get modules that have at least one grade
  const modulesWithGrades = useMemo(() => {
    const moduleIds = new Set(grades.filter((g) => g.module_id).map((g) => g.module_id!));
    return modules.filter((m) => moduleIds.has(m.id));
  }, [grades, modules]);

  // Current module grades
  const moduleGrades = useMemo(() => {
    if (!selectedModule) return [];
    return grades.filter((g) => g.module_id === selectedModule && g.grade != null);
  }, [grades, selectedModule]);

  // Calculate weighted average of existing grades
  const currentAvg = useMemo(() => {
    if (moduleGrades.length === 0) return null;
    const totalWeight = moduleGrades.reduce((s, g) => s + (g.weight ?? 1), 0);
    if (totalWeight === 0) return null;
    const weightedSum = moduleGrades.reduce((s, g) => s + (g.grade ?? 0) * (g.weight ?? 1), 0);
    return weightedSum / totalWeight;
  }, [moduleGrades]);

  // Calculate needed grade
  const neededGrade = useMemo(() => {
    if (currentAvg === null || !targetGrade || !nextWeight) return null;

    const target = parseFloat(targetGrade);
    const weight = parseFloat(nextWeight);
    if (isNaN(target) || isNaN(weight) || weight <= 0) return null;

    const totalExistingWeight = moduleGrades.reduce((s, g) => s + (g.weight ?? 1), 0);
    const existingWeightedSum = moduleGrades.reduce(
      (s, g) => s + (g.grade ?? 0) * (g.weight ?? 1),
      0
    );

    // target = (existingWeightedSum + needed * weight) / (totalExistingWeight + weight)
    // needed = (target * (totalExistingWeight + weight) - existingWeightedSum) / weight
    const needed =
      (target * (totalExistingWeight + weight) - existingWeightedSum) / weight;

    return needed;
  }, [currentAvg, targetGrade, nextWeight, moduleGrades]);

  // Determine feasibility
  const isFeasible = useMemo(() => {
    if (neededGrade === null) return null;
    if (gs.direction === "higher_better") {
      return neededGrade >= gs.min && neededGrade <= gs.max;
    }
    return neededGrade >= gs.min && neededGrade <= gs.max;
  }, [neededGrade, gs]);

  const selectedModuleName =
    modules.find((m) => m.id === selectedModule)?.name ?? "";

  return (
    <div className="card p-4 sm:p-5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700">
      <h3 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2 mb-4">
        <Calculator size={18} className="text-brand-600" />
        Notenrechner
      </h3>

      <div className="space-y-3">
        {/* Module selector */}
        <div>
          <label className="text-xs font-medium text-surface-500 mb-1 block">
            Modul
          </label>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-white"
          >
            <option value="">Modul wählen...</option>
            {modulesWithGrades.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code ? `${m.code} — ` : ""}{m.name}
              </option>
            ))}
          </select>
        </div>

        {selectedModule && moduleGrades.length > 0 && (
          <>
            {/* Current average display */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-800">
              <span className="text-sm text-surface-600 dark:text-surface-400">
                Aktueller Schnitt ({moduleGrades.length} Note{moduleGrades.length > 1 ? "n" : ""})
              </span>
              <span
                className="text-lg font-bold"
                style={{ color: currentAvg ? getGradeColor(currentAvg, gs) : undefined }}
              >
                {currentAvg !== null ? formatGrade(currentAvg, gs) : "–"}
              </span>
            </div>

            {/* Target grade input */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-surface-500 mb-1 block">
                  <Target size={12} className="inline mr-1" />
                  Zielnote
                </label>
                <input
                  type="number"
                  value={targetGrade}
                  onChange={(e) => setTargetGrade(e.target.value)}
                  min={gs.min}
                  max={gs.max}
                  step={gs.step}
                  className="w-full rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-surface-500 mb-1 block">
                  Gewicht nächste Prüfung
                </label>
                <input
                  type="number"
                  value={nextWeight}
                  onChange={(e) => setNextWeight(e.target.value)}
                  min={0.1}
                  step={0.1}
                  className="w-full rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-white"
                />
              </div>
            </div>

            {/* Result */}
            {neededGrade !== null && (
              <div
                className={`p-4 rounded-xl text-center ${
                  isFeasible
                    ? "bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                }`}
              >
                <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">
                  Du brauchst mindestens
                </p>
                <p
                  className={`text-3xl font-bold ${
                    isFeasible
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatGrade(Math.round(neededGrade * 100) / 100, gs)}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                  {isFeasible ? (
                    <>
                      um in <strong>{selectedModuleName}</strong> auf{" "}
                      <strong>{formatGrade(parseFloat(targetGrade), gs)}</strong> zu kommen
                    </>
                  ) : (
                    <>
                      <Info size={12} className="inline mr-1" />
                      {gs.direction === "higher_better"
                        ? `Die Zielnote ist mit einer einzigen Prüfung nicht mehr erreichbar (max. ${gs.max})`
                        : `Die Zielnote ist mit einer einzigen Prüfung nicht mehr erreichbar (min. ${gs.min})`}
                    </>
                  )}
                </p>
              </div>
            )}
          </>
        )}

        {selectedModule && moduleGrades.length === 0 && (
          <p className="text-sm text-surface-400 text-center py-4">
            Noch keine Noten für dieses Modul vorhanden.
          </p>
        )}
      </div>
    </div>
  );
}
