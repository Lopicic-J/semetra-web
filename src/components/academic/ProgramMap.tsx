"use client";

import { useMemo, useState } from "react";
import {
  GraduationCap, BookOpen, CheckCircle, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Lock, Award, Target, Layers,
  ArrowRight, Info, BarChart3,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import {
  calculateGPA,
  calculateCompletionPercentage,
  evaluateRequirementGroup,
  checkPrerequisites,
} from "@/lib/academic";
import type {
  Program,
  ProgramRequirementGroup,
  Enrollment,
  Attempt,
  GradeScale,
  CreditAward,
  ModulePrerequisite,
  AcademicModule,
  GradeBand,
} from "@/lib/academic";
import { getGradeBand, isPassingGrade, formatGradeValue } from "@/lib/academic";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProgramMapProps {
  program: Program;
  requirementGroups: ProgramRequirementGroup[];
  enrollments: Enrollment[];
  attempts: Attempt[];
  creditAwards: CreditAward[];
  gradeScale: GradeScale;
  gradeBands: GradeBand[];
  modules: AcademicModule[];
  prerequisites: ModulePrerequisite[];
}

type ModuleStatus = "completed" | "in_progress" | "planned" | "failed" | "locked";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Safe field accessor for snake_case DB rows and camelCase types */
function ff(obj: any, camel: string, snake: string): any {
  return obj?.[camel] ?? obj?.[snake] ?? null;
}

function getModuleStatus(
  moduleId: string,
  enrollments: Enrollment[],
  attempts: Attempt[],
  gradeScale: GradeScale,
): ModuleStatus {
  const enrollment = enrollments.find((e: any) =>
    (e.moduleId ?? e.module_id) === moduleId
  );
  if (!enrollment) return "planned";

  const enrId = (enrollment as any).id;
  const enrStatus = ff(enrollment, "status", "status");
  const moduleAttempts = attempts.filter((a: any) =>
    (a.enrollmentId ?? a.enrollment_id) === enrId
  );
  if (moduleAttempts.length === 0) return enrStatus === "enrolled" ? "in_progress" : "planned";

  const passed = moduleAttempts.some((a: any) => {
    const grade = ff(a, "finalGradeValue", "final_grade_value") ?? ff(a, "finalGrade", "final_grade");
    return a.status === "graded" && grade != null && isPassingGrade(grade, gradeScale);
  });
  if (passed) return "completed";

  const anyFailed = moduleAttempts.some((a: any) => {
    const grade = ff(a, "finalGradeValue", "final_grade_value") ?? ff(a, "finalGrade", "final_grade");
    return a.status === "graded" && grade != null;
  });
  if (anyFailed) return "failed";

  return "in_progress";
}

const STATUS_CONFIG: Record<ModuleStatus, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  completed:   { icon: CheckCircle,    color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800", label: "Bestanden" },
  in_progress: { icon: Clock,          color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",       label: "Laufend" },
 planned: { icon: Target, color:"text-surface-400", bg:"bg-surface-50 border-surface-200", label:"Geplant" },
  failed:      { icon: AlertTriangle,  color: "text-red-600",     bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",         label: "Nicht bestanden" },
 locked: { icon: Lock, color:"text-surface-300", bg:"bg-surface-50/50 border-dashed border-surface-200", label:"Gesperrt" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

function ModuleCard({
  module,
  status,
  grade,
  credits,
  creditLabel,
  gradeBand,
}: {
  module: AcademicModule;
  status: ModuleStatus;
  grade: number | null;
  credits: number;
  creditLabel: string;
  gradeBand: GradeBand | null;
}) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border p-3 transition-all hover:shadow-sm ${cfg.bg}`}>
      <div className="flex items-start gap-2.5">
        <Icon size={16} className={`${cfg.color} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
            {module.name}
          </p>
          {((module as any).moduleCode ?? (module as any).module_code) && (
            <p className="text-[11px] font-mono text-surface-400 mt-0.5">{(module as any).moduleCode ?? (module as any).module_code}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-surface-500">
              {credits} {creditLabel}
            </span>
            {grade != null && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
"bg-surface-100 text-surface-600"
              }`}>
                {formatGradeValue(grade, { decimalPlaces: 1 } as GradeScale)}
              </span>
            )}
            {gradeBand && (
              <span className="text-[10px] text-surface-400">{gradeBand.shortLabel || gradeBand.label}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RequirementGroupCard({
  group,
  modules,
  enrollments,
  attempts,
  gradeScale,
  gradeBands,
  creditLabel,
}: {
  group: ProgramRequirementGroup;
  modules: AcademicModule[];
  enrollments: Enrollment[];
  attempts: Attempt[];
  gradeScale: GradeScale;
  gradeBands: GradeBand[];
  creditLabel: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const { t } = useTranslation();

  // Get modules in this group
  const groupModules = useMemo(() =>
    modules.filter((m: any) => (m.requirementGroupId ?? m.requirement_group_id) === group.id),
    [modules, group.id]
  );

  // Calculate progress
  const progress = useMemo(() => {
    let completedCredits = 0;
    let totalCredits = 0;
    let completedCount = 0;

    for (const mod of groupModules) {
      const credits = (mod as any).ects ?? (mod as any).credits ?? 0;
      totalCredits += credits;
      const status = getModuleStatus(mod.id, enrollments, attempts, gradeScale);
      if (status === "completed") {
        completedCredits += credits;
        completedCount++;
      }
    }

    const reqCreds = ff(group, "requiredCredits", "required_credits");
    const requiredCredits = reqCreds ?? totalCredits;
    const percentage = requiredCredits > 0 ? Math.min(100, Math.round((completedCredits / requiredCredits) * 100)) : 0;

    return { completedCredits, totalCredits, requiredCredits, completedCount, total: groupModules.length, percentage };
  }, [groupModules, enrollments, attempts, gradeScale, group]);

  const gType = ff(group, "groupType", "group_type") ?? "";
  const groupTypeLabel = gType === "mandatory" ? t("academic.mandatory") || "Pflicht"
    : gType === "elective" ? t("academic.elective") || "Wahlpflicht"
    : gType === "thesis" ? t("academic.thesis") || "Abschlussarbeit"
    : gType || "Module";

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-50/50 dark:hover:bg-surface-800/50 transition-colors"
      >
        {expanded ? <ChevronDown size={16} className="text-surface-400" /> : <ChevronRight size={16} className="text-surface-400" />}
        <Layers size={16} className="text-brand-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-surface-900 dark:text-white">{group.name}</p>
          <p className="text-xs text-surface-400 mt-0.5">
            {groupTypeLabel} · {progress.completedCount}/{progress.total} Module · {progress.completedCredits}/{progress.requiredCredits} {creditLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
 <div className="w-24 h-2 rounded-full bg-surface-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
 <span className="text-xs font-semibold text-surface-600 w-10 text-right">{progress.percentage}%</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {groupModules.map((mod: any) => {
            const status = getModuleStatus(mod.id, enrollments, attempts, gradeScale);
            const enrollment = enrollments.find((e: any) => (e.moduleId ?? e.module_id) === mod.id);
            const enrId = (enrollment as any)?.id;
            const lastAttempt = enrollment
              ? attempts
                  .filter((a: any) => (a.enrollmentId ?? a.enrollment_id) === enrId)
                  .sort((a: any, b: any) => ((b.attemptNumber ?? b.attempt_number ?? 0) - (a.attemptNumber ?? a.attempt_number ?? 0)))[0]
              : null;
            const grade = lastAttempt
              ? (ff(lastAttempt, "finalGradeValue", "final_grade_value") ?? ff(lastAttempt, "finalGrade", "final_grade"))
              : null;
            const band = grade != null ? getGradeBand(grade, gradeBands.filter(b => b.gradeScaleId === gradeScale.id)) : null;

            return (
              <ModuleCard
                key={mod.id}
                module={mod}
                status={status}
                grade={grade}
                credits={mod.credits ?? 0}
                creditLabel={creditLabel}
                gradeBand={band}
              />
            );
          })}
          {groupModules.length === 0 && (
            <p className="text-xs text-surface-400 col-span-full py-4 text-center">
              {t("academic.noModulesInGroup") || "Noch keine Module in dieser Gruppe"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ProgramMap({
  program,
  requirementGroups,
  enrollments,
  attempts,
  creditAwards,
  gradeScale,
  gradeBands,
  modules,
  prerequisites,
}: ProgramMapProps) {
  const { t } = useTranslation();
  const gs = useGradingSystem();
  // Theme available via Tailwind dark: classes

  // Overall progress
  const overallProgress = useMemo(() => {
    let earnedCredits = 0;
    const totalRequired = ff(program, "totalCredits", "total_credits") ?? 180;

    for (const award of creditAwards) {
      earnedCredits += (ff(award, "creditsAwarded", "credits_awarded") ?? 0);
    }

    const percentage = totalRequired > 0 ? Math.min(100, Math.round((earnedCredits / totalRequired) * 100)) : 0;
    const completedModules = enrollments.filter((e: any) => e.status === "completed").length;
    const totalModules = modules.length;

    return { earnedCredits, totalRequired, percentage, completedModules, totalModules };
  }, [program, creditAwards, enrollments, modules]);

  // GPA
  const gpa = useMemo(() => {
    const inputs = attempts
      .filter((a: any) => {
        const grade = ff(a, "finalGradeValue", "final_grade_value") ?? ff(a, "finalGrade", "final_grade");
        return a.status === "graded" && grade != null;
      })
      .map((a: any) => {
        const grade = ff(a, "finalGradeValue", "final_grade_value") ?? ff(a, "finalGrade", "final_grade");
        const enrId = ff(a, "enrollmentId", "enrollment_id");
        const enrollment = enrollments.find((e: any) => e.id === enrId);
        const modId = enrollment ? ff(enrollment, "moduleId", "module_id") : null;
        const mod = modId ? modules.find((m: any) => m.id === modId) : null;
        return { grade: grade as number, credits: (mod as any)?.credits ?? (mod as any)?.ects ?? 0, passed: true, isRepeat: false };
      })
      .filter(i => i.credits > 0);

    if (inputs.length === 0) return null;
    return calculateGPA(inputs, gradeScale as any);
  }, [attempts, enrollments, modules, gradeScale]);

  // Sort groups by sort_order
  const sortedGroups = useMemo(() =>
    [...requirementGroups].sort((a: any, b: any) => ((a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0))),
    [requirementGroups]
  );

  return (
    <div className="space-y-6">
      {/* Header with overall stats */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
            <GraduationCap className="text-brand-600" size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-surface-900 dark:text-white">{program.name}</h2>
            <p className="text-sm text-surface-500 mt-0.5">
              {ff(program, "degreeLevel", "degree_level") ?? ""} · {ff(program, "totalCredits", "total_credits") ?? ""} {gs.creditLabel}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
 <div className="text-center p-3 rounded-xl bg-surface-50">
            <p className="text-2xl font-bold text-brand-600">{overallProgress.percentage}%</p>
            <p className="text-xs text-surface-500 mt-0.5">{t("academic.completion") || "Fortschritt"}</p>
          </div>
 <div className="text-center p-3 rounded-xl bg-surface-50">
            <p className="text-2xl font-bold text-surface-900 dark:text-white">
              {overallProgress.earnedCredits}/{overallProgress.totalRequired}
            </p>
            <p className="text-xs text-surface-500 mt-0.5">{gs.creditLabel}</p>
          </div>
 <div className="text-center p-3 rounded-xl bg-surface-50">
            <p className="text-2xl font-bold text-surface-900 dark:text-white">
              {overallProgress.completedModules}/{overallProgress.totalModules}
            </p>
            <p className="text-xs text-surface-500 mt-0.5">{t("academic.modules") || "Module"}</p>
          </div>
 <div className="text-center p-3 rounded-xl bg-surface-50">
            <p className="text-2xl font-bold text-surface-900 dark:text-white">
              {gpa?.gpa != null ? gpa.gpa.toFixed(2) : "–"}
            </p>
            <p className="text-xs text-surface-500 mt-0.5">{t("academic.gpa") || "Notenschnitt"}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
 <div className="w-full h-3 rounded-full bg-surface-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-700"
              style={{ width: `${overallProgress.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Requirement Groups */}
      <div className="space-y-4">
        {sortedGroups.map(group => (
          <RequirementGroupCard
            key={group.id}
            group={group}
            modules={modules}
            enrollments={enrollments}
            attempts={attempts}
            gradeScale={gradeScale}
            gradeBands={gradeBands}
            creditLabel={gs.creditLabel}
          />
        ))}

        {sortedGroups.length === 0 && (
          <div className="card p-8 text-center">
            <Info size={32} className="mx-auto text-surface-300 mb-3" />
            <p className="text-sm text-surface-500">
              {t("academic.noRequirementGroups") || "Noch keine Anforderungsgruppen definiert. Importiere einen Studiengang oder erstelle Gruppen manuell."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProgramMap;
