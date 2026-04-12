"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  PenTool,
  Presentation,
  Users,
  FlaskConical,
  BookOpen,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calculator,
  RotateCcw,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface AssessmentComponent {
  id: string;
  module_id: string;
  name: string;
  component_type: string;
  weight_percent: number;
  min_pass_required: boolean;
  contributes_to_final: boolean;
  mandatory_to_pass: boolean;
  sequence_order: number;
}

interface ComponentResultInput {
  component_id: string;
  grade_value: number | null;
  passed: boolean | null;
  weight_applied: number;
}

interface Props {
  moduleId: string;
  enrollmentId: string | null;
  countryCode: string | null;
  onGradeCalculated?: (finalGrade: number | null, passed: boolean) => void;
}

/* ─── Icon map ──────────────────────────────────────────────────────────── */

const typeIcons: Record<string, typeof FileText> = {
  written_exam: FileText,
  oral_exam: Presentation,
  project: FlaskConical,
  lab: FlaskConical,
  homework: PenTool,
  presentation: Presentation,
  participation: Users,
  thesis: BookOpen,
  attendance_requirement: Users,
  pass_fail_requirement: CheckCircle,
};

const typeLabels: Record<string, string> = {
  written_exam: "Schriftliche Pruefung",
  oral_exam: "Muendliche Pruefung",
  project: "Projekt",
  lab: "Labor",
  homework: "Hausarbeit",
  presentation: "Praesentation",
  participation: "Mitarbeit",
  thesis: "Abschlussarbeit",
  attendance_requirement: "Anwesenheitspflicht",
  pass_fail_requirement: "Bestanden/Nicht bestanden",
};

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function ComponentGradePanel({
  moduleId,
  enrollmentId,
  countryCode,
  onGradeCalculated,
}: Props) {
  const [components, setComponents] = useState<AssessmentComponent[]>([]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load assessment components for this module
  const loadComponents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/academic/modules/${moduleId}`);
      if (!res.ok) {
        setComponents([]);
        return;
      }
      const data = await res.json();
      // Components may be nested under module or directly
      const comps =
        data.module?.assessment_components ||
        data.assessment_components ||
        data.components ||
        [];
      setComponents(
        comps.sort(
          (a: AssessmentComponent, b: AssessmentComponent) =>
            a.sequence_order - b.sequence_order
        )
      );

      // Load existing component results if enrollment exists
      if (enrollmentId) {
        const attRes = await fetch(
          `/api/academic/enrollments/${enrollmentId}/attempts`
        );
        if (attRes.ok) {
          const attData = await attRes.json();
          const attempts = attData.attempts || [];
          // Use the latest attempt's component results
          if (attempts.length > 0) {
            const latest = attempts[attempts.length - 1];
            const existingGrades: Record<string, string> = {};
            for (const cr of latest.component_results || []) {
              if (cr.grade_value !== null) {
                existingGrades[cr.component_id] = cr.grade_value.toString();
              }
            }
            setGrades(existingGrades);
          }
        }
      }
    } catch {
      setComponents([]);
    } finally {
      setLoading(false);
    }
  }, [moduleId, enrollmentId]);

  useEffect(() => {
    loadComponents();
  }, [loadComponents]);

  // Calculate weighted final grade
  const calculation = useMemo(() => {
    if (components.length === 0) return null;

    let weightedSum = 0;
    let totalWeight = 0;
    let allMandatoryOk = true;
    const details: Array<{
      comp: AssessmentComponent;
      grade: number | null;
      contribution: number | null;
      passed: boolean | null;
    }> = [];

    for (const comp of components) {
      const val = grades[comp.id];
      const grade = val ? parseFloat(val) : null;
      let contribution: number | null = null;
      let passed: boolean | null = null;

      if (grade !== null && !isNaN(grade)) {
        // Simple pass check based on country
        passed = isPassing(grade, countryCode);

        if (comp.contributes_to_final) {
          const w = comp.weight_percent / 100;
          contribution = grade * w;
          weightedSum += grade * w;
          totalWeight += w;
        }

        if (comp.mandatory_to_pass && !passed) {
          allMandatoryOk = false;
        }
      } else if (comp.mandatory_to_pass) {
        allMandatoryOk = false;
      }

      details.push({ comp, grade, contribution, passed });
    }

    const finalGrade = totalWeight > 0 ? weightedSum / totalWeight : null;
    const finalPassed =
      finalGrade !== null && allMandatoryOk && isPassing(finalGrade, countryCode);
    const filledCount = details.filter((d) => d.grade !== null).length;

    return { finalGrade, finalPassed, allMandatoryOk, details, filledCount };
  }, [components, grades, countryCode]);

  // Notify parent of calculated grade
  useEffect(() => {
    if (calculation && onGradeCalculated) {
      onGradeCalculated(calculation.finalGrade, calculation.finalPassed);
    }
  }, [calculation, onGradeCalculated]);

  // Save component results as a new attempt
  async function handleSave() {
    if (!enrollmentId || !calculation) return;
    setSaving(true);
    setMsg(null);

    try {
      const componentResults: ComponentResultInput[] = components
        .map((comp) => {
          const val = grades[comp.id];
          const grade = val ? parseFloat(val) : null;
          return {
            component_id: comp.id,
            grade_value: grade,
            passed: grade !== null ? isPassing(grade, countryCode) : null,
            weight_applied: comp.weight_percent,
          };
        })
        .filter((cr) => cr.grade_value !== null);

      if (componentResults.length === 0) {
        setMsg({ type: "error", text: "Mindestens eine Komponentennote eingeben" });
        setSaving(false);
        return;
      }

      const res = await fetch(
        `/api/academic/enrollments/${enrollmentId}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "graded",
            date_completed: new Date().toISOString().split("T")[0],
            final_grade_value: calculation.finalGrade,
            final_grade_label: calculation.finalGrade?.toFixed(2) || null,
            passed: calculation.finalPassed,
            credits_awarded: 0, // determined by enrollment update
            component_results: componentResults,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      setMsg({ type: "success", text: "Komponentennoten gespeichert" });
    } catch (err: unknown) {
      setMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Fehler beim Speichern",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-surface-400 dark:text-surface-500 py-3">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-xs">Pruefungskomponenten laden...</span>
      </div>
    );
  }

  if (components.length === 0) return null;

  const totalWeight = components.reduce(
    (s, c) => s + (c.contributes_to_final ? c.weight_percent : 0),
    0
  );

  return (
    <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden mt-3">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300">
          <Calculator size={14} className="text-brand-500" />
          Pruefungskomponenten ({components.length})
        </span>
        <div className="flex items-center gap-3">
          {calculation && calculation.filledCount > 0 && (
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                calculation.finalPassed
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : "bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
              }`}
            >
              {calculation.finalGrade?.toFixed(2) || "—"}
            </span>
          )}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-2">
          {/* Weight summary */}
          <div className="flex items-center justify-between text[10px] text-surface-400 dark:text-surface-500 mb-1">
            <span>Gewichtung Total: {totalWeight}%</span>
            {totalWeight !== 100 && (
              <span className="text-amber-500 font-medium">
                Gewichte ergeben nicht 100%
              </span>
            )}
          </div>

          {/* Component rows */}
          {components.map((comp) => {
            const Icon = typeIcons[comp.component_type] || FileText;
            const val = grades[comp.id] || "";
            const grade = val ? parseFloat(val) : null;
            const passed =
              grade !== null && !isNaN(grade)
                ? isPassing(grade, countryCode)
                : null;

            return (
              <div
                key={comp.id}
                className="flex items-center gap-3 py-1.5"
              >
                {/* Icon + name */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Icon size={13} className="text-surface-400 dark:text-surface-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-surface-700 dark:text-surface-300 truncate">
                      {comp.name}
                    </p>
                    <p className="text-[10px] text-surface-400 dark:text-surface-500">
                      {typeLabels[comp.component_type] || comp.component_type} ·{" "}
                      {comp.weight_percent}%
                      {comp.mandatory_to_pass && (
                        <span className="text-red-400 ml-1">Pflicht</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Grade input */}
                <input
                  type="number"
                  step="0.1"
                  value={val}
                  onChange={(e) =>
                    setGrades((prev) => ({
                      ...prev,
                      [comp.id]: e.target.value,
                    }))
                  }
                  placeholder="—"
                  className="w-20 text-right text-sm font-mono bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 focus:outline-none"
                />

                {/* Pass indicator */}
                <div className="w-5 flex justify-center">
                  {passed === true && (
                    <CheckCircle size={14} className="text-green-500" />
                  )}
                  {passed === false && (
                    <XCircle size={14} className="text-red-500" />
                  )}
                </div>
              </div>
            );
          })}

          {/* Calculated result */}
          {calculation && calculation.filledCount > 0 && (
            <div
              className={`flex items-center justify-between rounded-lg px-3 py-2 mt-2 ${
                calculation.finalPassed
                  ? "bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30"
                  : "bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
              }`}
            >
              <span className="text-xs text-surface-600 dark:text-surface-400">
                Berechnete Modulnote
                {!calculation.allMandatoryOk && (
                  <span className="text-red-500 ml-1">
                    (Pflichtkomponente fehlt)
                  </span>
                )}
              </span>
              <span
                className={`text-base font-bold ${
                  calculation.finalPassed
                    ? "text-green-700 dark:text-green-400"
                    : "text-surface-700 dark:text-surface-300"
                }`}
              >
                {calculation.finalGrade?.toFixed(2) || "—"}
              </span>
            </div>
          )}

          {/* Actions */}
          {enrollmentId && (
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !calculation || calculation.filledCount === 0}
                className="btn-primary text-xs py-1.5 px-3"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  "Noten speichern"
                )}
              </button>
              <button
                onClick={() => setGrades({})}
                className="text-xs text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-400 flex items-center gap-1"
              >
                <RotateCcw size={11} />
                Zuruecksetzen
              </button>
            </div>
          )}

          {msg && (
            <p
              className={`text-xs px-2 py-1.5 rounded-lg ${
                msg.type === "success"
                  ? "bg-green-50 text-green-600"
                  : "bg-red-50 text-red-500"
              }`}
            >
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Helper ────────────────────────────────────────────────────────────── */

function isPassing(grade: number, country: string | null): boolean {
  if (!country) return grade >= 50;
  switch (country) {
    case "CH":
      return grade >= 4.0;
    case "DE":
    case "AT":
      return grade <= 4.0;
    case "UK":
    case "US":
      return grade >= 40;
    case "FR":
    case "BE":
      return grade >= 10;
    case "IT":
      return grade >= 18;
    case "NL":
      return grade >= 5.5;
    case "ES":
      return grade >= 5;
    default:
      return grade >= 50;
  }
}
