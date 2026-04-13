"use client";

import { useMemo, useState } from "react";
import {
  BookOpen, CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronRight, RotateCcw, Layers, BarChart3,
  Info,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import {
  calculateModuleGrade,
  evaluatePassPolicy,
  resolveEffectiveAttempt,
  checkRetakeEligibility,
  getGradeBand,
  isPassingGrade,
  formatGradeValue,
  normalizeGrade,
  checkPrerequisites,
} from "@/lib/academic";
import type {
  AcademicModule,
  AssessmentComponent,
  ComponentResult,
  Enrollment,
  Attempt,
  GradeScale,
  GradeBand,
  PassPolicy,
  RetakePolicy,
  RoundingPolicy,
  ModulePrerequisite,
} from "@/lib/academic";

// ─────────────────────────────────────────────────────────────────────────────
// Safe field accessor (handles both snake_case DB rows and camelCase TS types)
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function f(obj: any, camel: string, snake: string): any {
  return obj?.[camel] ?? obj?.[snake] ?? null;
}

function attemptGrade(a: any): number | null {
  return f(a, "finalGradeValue", "final_grade_value") ?? f(a, "finalGrade", "final_grade") ?? null;
}

function attemptNumber(a: any): number {
  return f(a, "attemptNumber", "attempt_number") ?? 0;
}

function attemptStatus(a: any): string {
  return f(a, "status", "status") ?? "unknown";
}

function attemptGradedAt(a: any): string | null {
  return f(a, "gradedAt", "graded_at") ?? f(a, "dateCompleted", "date_completed") ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ModuleAcademicDetailProps {
  module: AcademicModule;
  components: AssessmentComponent[];
  componentResults: ComponentResult[];
  enrollment: Enrollment | null;
  attempts: Attempt[];
  gradeScale: GradeScale;
  gradeBands: GradeBand[];
  passPolicy: PassPolicy | null;
  retakePolicy: RetakePolicy | null;
  roundingPolicy: RoundingPolicy | null;
  prerequisites: ModulePrerequisite[];
  allEnrollments: Enrollment[];
  allAttempts: Attempt[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

function AttemptBadge({ attempt, gradeScale, gradeBands }: {
  attempt: any; gradeScale: GradeScale; gradeBands: GradeBand[];
}) {
  const grade = attemptGrade(attempt);
  const status = attemptStatus(attempt);
  const passing = grade != null && isPassingGrade(grade, gradeScale);
  const band = grade != null ? getGradeBand(grade, gradeBands) : null;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
      passing
        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
        : status === "graded"
          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
 :"bg-surface-50 border-surface-200"
    }`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        passing ? "bg-emerald-100 dark:bg-emerald-800/40" :
        status === "graded" ? "bg-red-100 dark:bg-red-800/40" :
"bg-surface-100"
      }`}>
 <span className="text-sm font-bold text-surface-600">
          #{attemptNumber(attempt)}
        </span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-surface-900 dark:text-white">
            {status === "graded" && grade != null
              ? formatGradeValue(grade, gradeScale)
              : status === "submitted" ? "Eingereicht"
              : status === "enrolled" ? "Angemeldet"
              : status}
          </span>
          {band && <span className="text-[10px] text-surface-400">{band.label}</span>}
          {passing && <CheckCircle size={14} className="text-emerald-500" />}
          {status === "graded" && !passing && <XCircle size={14} className="text-red-500" />}
        </div>
        {attemptGradedAt(attempt) && (
          <p className="text-[11px] text-surface-400 mt-0.5">
            {new Date(attemptGradedAt(attempt)!).toLocaleDateString("de-CH")}
          </p>
        )}
      </div>
      {grade != null && (
        <div className="text-right shrink-0">
          <p className="text-xs text-surface-400">Normalisiert</p>
 <p className="text-sm font-semibold text-surface-600">
            {normalizeGrade(grade, gradeScale)?.normalizedScore0to100?.toFixed(1) ?? "–"}/100
          </p>
        </div>
      )}
    </div>
  );
}

function ComponentRow({ component, result, gradeScale }: {
  component: any;
  result: any | null;
  gradeScale: GradeScale;
}) {
  const weight = component.weight ?? component.weight_percentage;
  const weightStr = weight ? `${(weight > 1 ? weight : weight * 100).toFixed(0)}%` : "–";
  const name = component.name ?? component.component_name ?? "Komponente";
  const type = component.assessmentType ?? component.assessment_type ?? "";
  const mandatory = component.isMandatory ?? component.is_mandatory ?? false;
  const score = result?.score ?? result?.grade_value ?? result?.raw_score ?? null;

  return (
 <div className="flex items-center gap-3 py-2.5 border-b border-surface-50 last:border-0">
      <div className="flex-1 min-w-0">
 <p className="text-sm text-surface-800 truncate">{name}</p>
        <p className="text-[11px] text-surface-400">
          {type} · Gewichtung: {weightStr}
          {mandatory && " · Pflicht"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {score != null ? (
          <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
            score >= (gradeScale.passValue ?? 0)
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
 :"bg-surface-100 text-surface-600"
          }`}>
            {formatGradeValue(score, gradeScale)}
          </span>
        ) : (
          <span className="text-xs text-surface-400">Ausstehend</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ModuleAcademicDetail({
  module,
  components,
  componentResults,
  enrollment,
  attempts,
  gradeScale,
  gradeBands,
  passPolicy,
  retakePolicy,
  roundingPolicy,
  prerequisites,
  allEnrollments,
  allAttempts,
}: ModuleAcademicDetailProps) {
  const { t } = useTranslation();
  const gs = useGradingSystem();
  const [showAttempts, setShowAttempts] = useState(true);

  // Calculate module grade if we have results
  const calculatedGrade = useMemo(() => {
    if (components.length === 0 || componentResults.length === 0) return null;
    try {
      return calculateModuleGrade(components, componentResults, gradeScale, roundingPolicy ?? undefined);
    } catch {
      return null;
    }
  }, [components, componentResults, gradeScale, roundingPolicy]);

  // Effective attempt
  const effectiveAttempt = useMemo(() => {
    if (attempts.length === 0) return null;
    if (!retakePolicy) return attempts[attempts.length - 1] ?? null;
    try {
      return resolveEffectiveAttempt(attempts, retakePolicy, gradeScale);
    } catch {
      return attempts[attempts.length - 1] ?? null;
    }
  }, [attempts, retakePolicy]);

  // Effective grade
  const effectiveGrade = effectiveAttempt ? attemptGrade(effectiveAttempt) : null;

  // Pass/fail evaluation
  const passResult = useMemo(() => {
    if (effectiveGrade == null || !passPolicy) return null;
    try {
      return evaluatePassPolicy(effectiveGrade, gradeScale, passPolicy, calculatedGrade?.allMandatoryPassed ?? true);
    } catch {
      return null;
    }
  }, [effectiveGrade, passPolicy, components, componentResults, gradeScale]);

  // Retake eligibility
  const retakeEligible = useMemo(() => {
    if (!retakePolicy || attempts.length === 0 || !enrollment) return null;
    try {
      return checkRetakeEligibility(enrollment, retakePolicy, attemptGradedAt(attempts[attempts.length - 1]) ?? null);
    } catch {
      return null;
    }
  }, [attempts, retakePolicy]);

  // Prerequisite check
  const prereqCheck = useMemo(() => {
    if (prerequisites.length === 0) return null;
    try {
      const passedIds = new Set(
        (allAttempts as any[])
          .filter((a: any) => a.status === "graded" && attemptGrade(a) != null && isPassingGrade(attemptGrade(a)!, gradeScale))
          .map((a: any) => f(a, "moduleId", "module_id") as string)
          .filter(Boolean)
      );
      return checkPrerequisites(prerequisites, passedIds);
    } catch {
      return null;
    }
  }, [prerequisites, allEnrollments, allAttempts, gradeScale]);

  // Status
  const isPassed = passResult?.passed === true || (effectiveGrade != null && isPassingGrade(effectiveGrade, gradeScale));
  const isFailed = attemptStatus(effectiveAttempt) === "graded" && !isPassed;
  const isActive = (f(enrollment, "status", "status") === "enrolled") && !isPassed && !isFailed;

  const scaleBands = gradeBands.filter(b => b.gradeScaleId === gradeScale.id);
  const currentBand = effectiveGrade != null ? getGradeBand(effectiveGrade, scaleBands) : null;

  // Module fields (handle snake/camel)
  const moduleName = module.name ?? (module as any).module_name ?? "Modul";
  const moduleCode = (module as any).moduleCode ?? (module as any).module_code ?? null;
  const moduleCredits = (module as any).ects ?? (module as any).credits ?? 0;
  const moduleSemester = (module as any).semester ?? null;
  const moduleDescription = module.description ?? (module as any).module_description ?? null;

  return (
    <div className="space-y-4">
      {/* Module Header */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            isPassed ? "bg-emerald-100 dark:bg-emerald-900/30" :
            isFailed ? "bg-red-100 dark:bg-red-900/30" :
            "bg-brand-100 dark:bg-brand-900/30"
          }`}>
            {isPassed ? <CheckCircle className="text-emerald-600" size={24} /> :
             isFailed ? <AlertTriangle className="text-red-600" size={24} /> :
             <BookOpen className="text-brand-600" size={24} />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-surface-900 dark:text-white">{moduleName}</h2>
            <p className="text-sm text-surface-500 mt-0.5">
              {moduleCode && <span className="font-mono">{moduleCode}</span>}
              {moduleCode && " · "}
              {moduleCredits} {gs.creditLabel}
              {moduleSemester && ` · ${moduleSemester}`}
            </p>
          </div>
          {effectiveGrade != null && (
            <div className="text-right shrink-0">
 <p className={`text-2xl font-bold ${isPassed ?"text-emerald-600" : isFailed ?"text-red-600" :"text-surface-800"}`}>
                {formatGradeValue(effectiveGrade, gradeScale)}
              </p>
              {currentBand && (
                <p className="text-xs text-surface-400 mt-0.5">{currentBand.label}</p>
              )}
            </div>
          )}
        </div>

        {/* Prerequisites warning */}
        {prereqCheck && !prereqCheck.canEnroll && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {t("academic.prerequisitesNotMet") || "Voraussetzungen nicht erfüllt"}
            </p>
          </div>
        )}

        {/* Retake info */}
        {isFailed && retakeEligible != null && (
          <div className={`mt-4 p-3 rounded-xl flex items-start gap-2 ${
            retakeEligible
              ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
              : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          }`}>
            <RotateCcw size={16} className={retakeEligible ? "text-blue-600" : "text-red-600"} />
            <p className={`text-sm ${retakeEligible ? "text-blue-700 dark:text-blue-300" : "text-red-700 dark:text-red-300"}`}>
              {retakeEligible
                ? (t("academic.retakeAvailable") || "Wiederholung möglich")
                : (t("academic.retakeNotAvailable") || "Keine Wiederholung mehr möglich")}
              {retakePolicy && ` (max. ${f(retakePolicy, "maxAttempts", "max_attempts") ?? "?"} Versuche)`}
            </p>
          </div>
        )}
      </div>

      {/* Assessment Components */}
      {components.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2 mb-3">
            <Layers size={16} className="text-brand-500" />
            {t("academic.assessmentComponents") || "Bewertungskomponenten"}
          </h3>
          <div>
            {[...components]
              .sort((a: any, b: any) => ((a.sortOrder ?? a.sequence_order ?? 0) - (b.sortOrder ?? b.sequence_order ?? 0)))
              .map((comp: any) => {
                const compId = comp.id;
                const result = componentResults.find((r: any) => (r.componentId ?? r.component_id) === compId) ?? null;
                return (
                  <ComponentRow
                    key={compId}
                    component={comp}
                    result={result}
                    gradeScale={gradeScale}
                  />
                );
              })}
          </div>
          {calculatedGrade != null && (
 <div className="mt-3 pt-3 border-t border-surface-100 flex items-center justify-between">
 <span className="text-sm font-medium text-surface-600">
                {t("academic.calculatedGrade") || "Berechnete Gesamtnote"}
              </span>
              <span className="text-lg font-bold text-brand-600">
                {formatGradeValue(calculatedGrade.finalGradeRounded ?? calculatedGrade.finalGrade ?? 0, gradeScale)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Attempts History */}
      {attempts.length > 0 && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowAttempts(!showAttempts)}
            className="w-full flex items-center gap-2 p-4 text-left hover:bg-surface-50/50 dark:hover:bg-surface-800/50 transition-colors"
          >
            {showAttempts ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <BarChart3 size={16} className="text-brand-500" />
            <span className="text-sm font-semibold text-surface-900 dark:text-white">
              {t("academic.attemptHistory") || "Prüfungsversuche"} ({attempts.length})
            </span>
          </button>
          {showAttempts && (
            <div className="px-4 pb-4 space-y-2">
              {[...attempts]
                .sort((a, b) => attemptNumber(b) - attemptNumber(a))
                .map((attempt: any) => (
                  <AttemptBadge
                    key={attempt.id}
                    attempt={attempt}
                    gradeScale={gradeScale}
                    gradeBands={scaleBands}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Module description */}
      {moduleDescription && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2 mb-2">
            <Info size={16} className="text-surface-400" />
            {t("academic.description") || "Beschreibung"}
          </h3>
 <p className="text-sm text-surface-600 leading-relaxed">
            {moduleDescription}
          </p>
        </div>
      )}
    </div>
  );
}

export default ModuleAcademicDetail;
