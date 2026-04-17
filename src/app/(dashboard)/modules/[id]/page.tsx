"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useAssessmentComponents, useEnrollments, useAcademicReference } from "@/lib/hooks/useAcademicData";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import {
  calculateModuleGrade,
  gradeNeededForTarget,
  getGradeBand,
  formatGradeValue,
  isPassingGrade,
  bestGrade,
  resolveEffectiveAttempt
} from "@/lib/academic/engine";
import { formatDate, cn } from "@/lib/utils";
import type { Module } from "@/types/database";
import {
  ArrowLeft,
  BookOpen,
  Award,
  Target,
  AlertCircle,
  CheckCircle2,
  XCircle,
  BarChart3,
  Zap,
  Clock
} from "lucide-react";
import dynamic from "next/dynamic";

const ModuleControlCenter = dynamic(
  () => import("@/components/command-center/ModuleControlCenter"),
  { ssr: false }
);

import ModuleToolsBar from "@/components/modules/ModuleToolsBar";
import AIModuleSetup from "@/components/modules/AIModuleSetup";
import QuickExamAdd from "@/components/exams/QuickExamAdd";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function ModuleDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const moduleId = params?.id as string;

  const supabase = createClient();
  const gs = useGradingSystem();
  const { components, loading: componentsLoading } = useAssessmentComponents(moduleId);
  const { enrollments } = useEnrollments();
  const { gradeScales, passPolicies, retakePolicies, roundingPolicies, loading: refLoading } = useAcademicReference();

  const [module, setModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch module data
  useEffect(() => {
    if (!moduleId) return;

    const fetchModule = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from("modules")
          .select("*")
          .eq("id", moduleId)
          .single();

        if (err) throw err;
        setModule(data as Module);
        setError(null);
      } catch (e) {
        console.error("Failed to fetch module:", e);
        setError(e instanceof Error ? e.message : "Module not found");
      } finally {
        setLoading(false);
      }
    };

    fetchModule();
  }, [moduleId, supabase]);

  // Get enrollment for this module
  const enrollment = useMemo(() => {
    if (!moduleId) return null;
    return enrollments.find(e => e.module_id === moduleId);
  }, [enrollments, moduleId]);

  // Get attempts from enrollment
  const attempts = useMemo(() => {
    return enrollment?.attempts ?? [];
  }, [enrollment]);

  // Get current grade and pass status
  const { currentGrade, currentPassed, bestAttempt } = useMemo(() => {
    if (!module || !gradeScales.length || !gs) return { currentGrade: null, currentPassed: null, bestAttempt: null };

    const scale = gradeScales.find(s => s.id === module.grade_scale_id);
    if (!scale) return { currentGrade: null, currentPassed: null, bestAttempt: null };

    if (attempts.length === 0) {
      return { currentGrade: null, currentPassed: null, bestAttempt: null };
    }

    // Get best attempt based on grading system
    const gradedAttempts = attempts.filter(a => a.final_grade_value != null);
    if (gradedAttempts.length === 0) {
      return { currentGrade: null, currentPassed: null, bestAttempt: null };
    }

    const best = bestGrade(
      gradedAttempts.map((a: any) => a.final_grade_value as number),
      scale
    );

    const bestAttemptData = gradedAttempts.find(a => a.final_grade_value === best);

    return {
      currentGrade: best,
      currentPassed: best !== null ? isPassingGrade(best, scale) : null,
      bestAttempt: bestAttemptData,
    };
  }, [module, gradeScales, gs, attempts]);

  // Calculate grade details
  const gradeDetails = useMemo(() => {
    if (!currentGrade || !module || !gradeScales.length) {
      return { band: null, label: null, formatted: null, color: null };
    }

    const scale = gradeScales.find(s => s.id === module.grade_scale_id);
    if (!scale) return { band: null, label: null, formatted: null, color: null };

    const band = getGradeBand(currentGrade, []);
    const formatted = formatGradeValue(currentGrade, scale);

    let color = "text-gray-600";
    if (isPassingGrade(currentGrade, scale)) {
      color = "text-green-600 dark:text-green-400";
    } else {
      color = "text-red-600 dark:text-red-400";
    }

    return {
      band,
      label: band?.label ?? null,
      formatted,
      color,
    };
  }, [currentGrade, module, gradeScales]);

  // Calculate what grade is needed for target
  const targetGradeNeeded = useMemo(() => {
    if (!module || !currentGrade || !gradeScales.length) return null;

    const scale = gradeScales.find(s => s.id === module.grade_scale_id);
    if (!scale || !module.target_grade) return null;

    // Estimate: assume next attempt has same weight as current
    const needed = gradeNeededForTarget(
      currentGrade,
      0,
      module.target_grade,
      1,
      scale
    );

    return needed;
  }, [module, currentGrade, gradeScales]);

  // Calculate weighted component grades (preview)
  const componentGrades = useMemo(() => {
    if (!components.length || !attempts.length || !currentGrade || !gradeScales.length) {
      return [];
    }

    const scale = gradeScales.find(s => s.id === module?.grade_scale_id);
    if (!scale) return [];

    const latestAttempt = attempts[attempts.length - 1] as any;
    if (!latestAttempt?.component_results || !Array.isArray(latestAttempt.component_results)) return [];

    return components.map(comp => {
      const result = latestAttempt.component_results.find((r: any) => r.component_id === comp.id);
      return {
        component: comp,
        result,
        weight: (comp as any).weight_percent ?? comp.weightPercent,
        grade: result?.grade_value ?? null,
        passed: result?.passed ?? null,
      };
    });
  }, [components, attempts, currentGrade, gradeScales, module?.grade_scale_id]);

  if (loading || refLoading) {
    return (
      <div className="min-h-screen bg-[var(--sf-0)] p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-[var(--sf-2)] rounded-lg w-1/3" />
            <div className="h-40 bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)]" />
            <div className="h-60 bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="min-h-screen bg-[var(--sf-0)] p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[var(--sf-10)] hover:text-[var(--accent-9)] mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t("back") || "Back"}
          </button>
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <p className="text-red-800 dark:text-red-100">{error || "Module not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const statusColor = currentPassed === null ? "gray" : currentPassed ? "green" : "red";
  const moduleColor = module.color || "#6d28d9";

  return (
    <div className="min-h-screen bg-[var(--sf-0)] p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[var(--sf-10)] hover:text-[var(--accent-9)] mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t("back") || "Back"}
          </button>

          {/* Decision Engine Module Control Center */}
          <ModuleControlCenter moduleId={moduleId} />

          {/* Module Tools — Quick access to learning tools for this module */}
          {module && (
            <div className="mb-4 space-y-3">
              <ModuleToolsBar
                moduleId={moduleId}
                moduleName={module.name}
                moduleColor={moduleColor}
              />
              <AIModuleSetup
                moduleId={moduleId}
                moduleName={module.name}
                moduleType={module.learning_type ?? undefined}
                ects={module.ects ?? undefined}
                hasTopics={false}
                hasFlashcards={false}
              />
              <QuickExamAdd modules={module ? [module] : []} />
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div
                className="w-12 h-12 rounded-lg flex-shrink-0 border border-[var(--sf-3)]"
                style={{ backgroundColor: moduleColor }}
              />
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold text-[var(--sf-12)]">{module.name}</h1>
                {module.module_code && (
                  <p className="text-[var(--sf-8)] mt-1">{module.module_code}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {module.status && (
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      module.status === "in_progress"
                        ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-200"
                        : module.status === "passed"
                        ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-200"
                        : module.status === "failed"
                        ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-200"
                        : "bg-[var(--sf-2)] text-[var(--sf-11)]"
                    )}>
                      {module.status}
                    </span>
                  )}
                  {module.is_compulsory && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--accent-2)] text-[var(--accent-11)]">
                      Required
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Module Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {module.ects && (
            <div className="bg-[var(--sf-1)] rounded-lg border border-[var(--sf-3)] p-3">
              <p className="text-[var(--sf-8)] text-xs font-medium mb-1">ECTS</p>
              <p className="text-xl font-bold text-[var(--sf-12)]">{module.ects}</p>
            </div>
          )}
          {module.semester && (
            <div className="bg-[var(--sf-1)] rounded-lg border border-[var(--sf-3)] p-3">
              <p className="text-[var(--sf-8)] text-xs font-medium mb-1">Semester</p>
              <p className="text-sm font-semibold text-[var(--sf-12)]">{module.semester}</p>
            </div>
          )}
          {module.professor && (
            <div className="bg-[var(--sf-1)] rounded-lg border border-[var(--sf-3)] p-3">
              <p className="text-[var(--sf-8)] text-xs font-medium mb-1">Professor</p>
              <p className="text-sm font-semibold text-[var(--sf-12)]">{module.professor}</p>
            </div>
          )}
          {currentPassed !== null && (
            <div className="bg-[var(--sf-1)] rounded-lg border border-[var(--sf-3)] p-3">
              <p className="text-[var(--sf-8)] text-xs font-medium mb-1">Status</p>
              <div className="flex items-center gap-2">
                {currentPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                )}
                <span className="text-xs font-semibold text-[var(--sf-12)]">
                  {currentPassed ? "Passed" : "Failed"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Grade Section */}
        {currentGrade !== null && (
          <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-[var(--sf-12)] flex items-center gap-2">
                <Award className="w-5 h-5 text-[var(--accent-9)]" />
                Current Grade
              </h2>
              <div className={cn("text-4xl font-bold", gradeDetails.color)}>
                {gradeDetails.formatted}
              </div>
            </div>
            {gradeDetails.label && (
              <p className="text-[var(--sf-9)] text-sm">{gradeDetails.label}</p>
            )}
          </div>
        )}

        {/* Assessment Components Section */}
        {components.length > 0 && (
          <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-6">
            <h2 className="text-lg font-bold text-[var(--sf-12)] flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-[var(--accent-9)]" />
              Assessment Components
            </h2>
            <div className="space-y-3">
              {components.map((comp, idx) => {
                const compGrade = componentGrades.find(cg => cg.component.id === comp.id);
                return (
                  <div key={comp.id} className="flex items-center justify-between p-3 bg-[var(--sf-0)] rounded-lg border border-[var(--sf-3)]">
                    <div className="flex-1">
                      <p className="font-medium text-[var(--sf-12)]">{comp.name}</p>
                      <p className="text-xs text-[var(--sf-8)]">
                        {(comp as any).component_type ?? comp.componentType} • {(comp as any).weight_percent ?? comp.weightPercent}% weight
                      </p>
                      {((comp as any).mandatory_to_pass ?? comp.mandatoryToPass) && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Mandatory to pass
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {compGrade && compGrade.grade !== null ? (
                        <p className="font-semibold text-[var(--sf-12)]">
                          {typeof compGrade.grade === "number"
                            ? compGrade.grade.toFixed(2)
                            : "—"}
                        </p>
                      ) : (
                        <p className="text-[var(--sf-8)]">No grade</p>
                      )}
                      {compGrade && compGrade.passed !== null && (
                        <div className="flex justify-end mt-1">
                          {compGrade.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Enrollment & Attempts Section */}
        {enrollment && (
          <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-6">
            <h2 className="text-lg font-bold text-[var(--sf-12)] flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-[var(--accent-9)]" />
              Enrollment & Attempts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-[var(--sf-8)] mb-1 font-medium">Enrollment Status</p>
                <span className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium",
                  enrollment.status === "passed"
                    ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-200"
                    : enrollment.status === "failed"
                    ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-200"
                    : enrollment.status === "enrolled"
                    ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-200"
                    : "bg-[var(--sf-2)] text-[var(--sf-11)]"
                )}>
                  {enrollment.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-[var(--sf-8)] mb-1 font-medium">Attempts Used</p>
                <p className="text-lg font-bold text-[var(--sf-12)]">{enrollment.attempts_used}</p>
              </div>
            </div>

            {attempts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--sf-8)] mb-3">All Attempts</p>
                {attempts.map((attempt, idx) => (
                  <div key={attempt.id} className="flex items-center justify-between p-3 bg-[var(--sf-0)] rounded-lg border border-[var(--sf-3)]">
                    <div className="flex-1">
                      <p className="font-medium text-[var(--sf-12)]">
                        Attempt {attempt.attempt_number}
                      </p>
                      {attempt.date_completed && (
                        <p className="text-xs text-[var(--sf-8)]">
                          {formatDate(attempt.date_completed)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {attempt.final_grade_value !== null ? (
                        <p className="font-semibold text-[var(--sf-12)]">
                          {attempt.final_grade_value.toFixed(2)}
                        </p>
                      ) : (
                        <p className="text-[var(--sf-8)]">No grade</p>
                      )}
                      <div className="flex justify-end mt-1">
                        {attempt.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : attempt.final_grade_value !== null ? (
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-[var(--sf-7)]" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Target Grade Calculator */}
        {module.target_grade && currentGrade !== null && targetGradeNeeded !== null && (
          <div className="bg-[var(--accent-1)] rounded-xl border border-[var(--accent-3)] p-6">
            <h2 className="text-lg font-bold text-[var(--accent-12)] flex items-center gap-2 mb-4">
              <Target className="w-5 h-5" />
              Target Grade Calculator
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-[var(--accent-9)] mb-2">Current Grade</p>
                <p className="text-2xl font-bold text-[var(--accent-12)]">{currentGrade.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--accent-9)] mb-2">Target Grade</p>
                <p className="text-2xl font-bold text-[var(--accent-12)]">{module.target_grade.toFixed(2)}</p>
              </div>
              <div className="bg-[var(--accent-2)] rounded-lg p-3 flex flex-col justify-center">
                <p className="text-xs font-medium text-[var(--accent-9)] mb-2">Grade Needed</p>
                <p className="text-2xl font-bold text-[var(--accent-11)]">
                  {targetGradeNeeded.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Policy Info Cards */}
        {module.pass_policy_id && passPolicies.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {passPolicies.slice(0, 1).map(policy => (
              <div key={policy.id} className="bg-[var(--sf-1)] rounded-lg border border-[var(--sf-3)] p-4">
                <p className="text-xs font-medium text-[var(--sf-8)] mb-2">Pass Policy</p>
                <p className="text-sm font-semibold text-[var(--sf-12)]">{policy.name}</p>
                <p className="text-xs text-[var(--sf-9)] mt-2 line-clamp-2">{policy.code}</p>
              </div>
            ))}

            {module.retake_policy_id && retakePolicies.length > 0 && retakePolicies.slice(0, 1).map(policy => (
              <div key={policy.id} className="bg-[var(--sf-1)] rounded-lg border border-[var(--sf-3)] p-4">
                <p className="text-xs font-medium text-[var(--sf-8)] mb-2">Retake Policy</p>
                <p className="text-sm font-semibold text-[var(--sf-12)]">{policy.name}</p>
                <p className="text-xs text-[var(--sf-9)] mt-2">
                  Max {(policy as any).max_attempts ?? policy.maxAttempts} attempts
                </p>
              </div>
            ))}

            {module.rounding_policy_id && roundingPolicies.length > 0 && roundingPolicies.slice(0, 1).map(policy => (
              <div key={policy.id} className="bg-[var(--sf-1)] rounded-lg border border-[var(--sf-3)] p-4">
                <p className="text-xs font-medium text-[var(--sf-8)] mb-2">Rounding Policy</p>
                <p className="text-sm font-semibold text-[var(--sf-12)]">{policy.name}</p>
                <p className="text-xs text-[var(--sf-9)] mt-2">{policy.code}</p>
              </div>
            ))}
          </div>
        )}

        {/* Module Description */}
        {module.description && (
          <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-6">
            <h2 className="text-lg font-bold text-[var(--sf-12)] flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-[var(--accent-9)]" />
              Description
            </h2>
            <p className="text-[var(--sf-10)] leading-relaxed">{module.description}</p>
          </div>
        )}

        {/* Empty State */}
        {!enrollment && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
            <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
            <p className="text-blue-800 dark:text-blue-100 text-sm">
              No enrollment found for this module. Start an attempt to see grades and progress.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
