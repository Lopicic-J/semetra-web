"use client";

import { useMemo } from "react";
import {
  BookOpen, CheckCircle, XCircle, Clock, Award, Calendar,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useModules } from "@/lib/hooks/useModules";
import { useGrades } from "@/lib/hooks/useGrades";
import { useProfile } from "@/lib/hooks/useProfile";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import {
  useAcademicReference,
  useAcademicPageData,
} from "@/lib/hooks/useAcademicData";
import {
  getGradeBand,
  isPassingGrade,
  formatGradeValue,
} from "@/lib/academic";
import { getGradeColor, formatGrade } from "@/lib/grading-systems";
import type { Module, Grade } from "@/types/database";

// ─────────────────────────────────────────────────────────────────────────────

function displaySemester(raw: string | null | undefined): string {
  if (!raw) return "Sonstige";
  if (raw.startsWith("Semester ")) return raw;
  const match = raw.match(/[HF]S?(\d+)/i);
  if (match) return `Semester ${match[1]}`;
  return raw;
}

function semesterSort(a: string, b: string): number {
  const numA = parseInt(a.match(/\d+/)?.[0] ?? "999");
  const numB = parseInt(b.match(/\d+/)?.[0] ?? "999");
  return numA - numB;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TranscriptTab() {
  const { t } = useTranslation();
  const gs = useGradingSystem();
  const { modules, loading: modLoading } = useModules();
  const { grades, loading: gradeLoading } = useGrades();
  const { profile, loading: profileLoading } = useProfile();
  const { gradeScales, gradeBands, loading: refLoading } = useAcademicReference();
  const { recognitions } = useAcademicPageData();

  const isLoading = modLoading || gradeLoading || profileLoading || refLoading;

  // Grade scale
  const gradeScale = useMemo(
    () => gradeScales.find(s => s.code === gs.scaleCode) ?? gradeScales[0] ?? null,
    [gradeScales, gs.scaleCode]
  );
  const scaleBands = useMemo(
    () => gradeScale ? gradeBands.filter(b => b.gradeScaleId === gradeScale.id) : [],
    [gradeScale, gradeBands]
  );

  // Build transcript grouped by semester
  const { semesters, totalCredits, passedModules, totalModules, gpa } = useMemo(() => {
    if (isLoading || !profile) {
      return { semesters: [], totalCredits: 0, passedModules: 0, totalModules: 0, gpa: null };
    }

    const gradeMap = new Map<string, Grade[]>();
    for (const g of grades) {
      const mid = g.module_id;
      if (!mid) continue;
      if (!gradeMap.has(mid)) gradeMap.set(mid, []);
      gradeMap.get(mid)!.push(g);
    }

    const semMap = new Map<string, { module: Module; grades: Grade[]; bestGrade: number | null }[]>();
    let totalCreds = 0;
    let passed = 0;
    const gpaInputs: { grade: number; credits: number }[] = [];

    for (const mod of modules) {
      const sem = displaySemester(mod.semester);
      if (!semMap.has(sem)) semMap.set(sem, []);

      const moduleGrades = gradeMap.get(mod.id) ?? [];
      const numericGrades = moduleGrades.filter(g => g.grade != null).map(g => g.grade!);

      let bestGrade: number | null = null;
      if (numericGrades.length > 0) {
        bestGrade = gs.direction === "higher_better"
          ? Math.max(...numericGrades)
          : Math.min(...numericGrades);
      }

      const isPassed = bestGrade != null && (
        gradeScale
          ? isPassingGrade(bestGrade, gradeScale)
          : gs.direction === "higher_better" ? bestGrade >= gs.passingGrade : bestGrade <= gs.passingGrade
      );

      const credits = mod.ects ?? 0;
      if (isPassed) {
        totalCreds += credits;
        passed++;
      }

      if (bestGrade != null && credits > 0) {
        gpaInputs.push({ grade: bestGrade, credits });
      }

      semMap.get(sem)!.push({ module: mod, grades: moduleGrades, bestGrade });
    }

    // Calculate GPA — weighted average fallback (works without GPAScheme)
    let calcGpa: number | null = null;
    if (gpaInputs.length > 0) {
      const totalW = gpaInputs.reduce((s, i) => s + i.credits, 0);
      calcGpa = totalW > 0
        ? gpaInputs.reduce((s, i) => s + i.grade * i.credits, 0) / totalW
        : null;
    }

    const sorted = Array.from(semMap.entries())
      .sort(([a], [b]) => semesterSort(a, b))
      .map(([sem, mods]) => ({
        semester: sem,
        modules: mods.sort((a, b) => (a.module.name ?? "").localeCompare(b.module.name ?? "")),
        semCredits: mods.reduce((s, m) => {
          const p = m.bestGrade != null && (
            gradeScale
              ? isPassingGrade(m.bestGrade, gradeScale)
              : gs.direction === "higher_better" ? m.bestGrade >= gs.pass : m.bestGrade <= gs.pass
          );
          return s + (p ? (m.module.ects ?? 0) : 0);
        }, 0),
      }));

    return {
      semesters: sorted,
      totalCredits: totalCreds,
      passedModules: passed,
      totalModules: modules.length,
      gpa: calcGpa,
    };
  }, [isLoading, profile, grades, modules, gradeScale, gs, scaleBands]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-brand-600">{totalCredits}</p>
          <p className="text-xs text-surface-500 mt-0.5">{gs.creditLabel} {t("academic.earned") || "erreicht"}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{passedModules}/{totalModules}</p>
          <p className="text-xs text-surface-500 mt-0.5">{t("academic.modulesPassed") || "Module bestanden"}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{gpa != null && typeof gpa === "number" ? gpa.toFixed(2) : "–"}</p>
          <p className="text-xs text-surface-500 mt-0.5">{t("academic.gpa") || "Notenschnitt"}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{recognitions.length}</p>
          <p className="text-xs text-surface-500 mt-0.5">{t("academic.recognitions") || "Anrechnungen"}</p>
        </div>
      </div>

      {/* Semester sections */}
      {semesters.map(({ semester, modules: semModules, semCredits }) => (
        <div key={semester}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-2">
              <Calendar size={14} className="text-brand-500" />
              {semester}
            </h3>
            <span className="text-xs text-surface-400">{semCredits} {gs.creditLabel}</span>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-surface-50 dark:bg-surface-800 text-[11px] font-semibold text-surface-500 border-b border-surface-100 dark:border-surface-700">
              <div className="col-span-5">{t("academic.module") || "Modul"}</div>
              <div className="col-span-2">{gs.creditLabel}</div>
              <div className="col-span-2">{t("academic.grade") || "Note"}</div>
              <div className="col-span-2">{t("academic.band") || "Bewertung"}</div>
              <div className="col-span-1">{t("academic.status") || "Status"}</div>
            </div>
            <div className="divide-y divide-surface-50 dark:divide-surface-800">
              {semModules.map(({ module: mod, bestGrade }) => {
                const isPassed = bestGrade != null && (
                  gradeScale ? isPassingGrade(bestGrade, gradeScale) :
                  gs.direction === "higher_better" ? bestGrade >= gs.pass : bestGrade <= gs.pass
                );
                const band = bestGrade != null && gradeScale
                  ? getGradeBand(bestGrade, scaleBands) : null;
                const colorClass = bestGrade != null
                  ? getGradeColor(bestGrade, gs) : "";

                return (
                  <div key={mod.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-surface-50/50 dark:hover:bg-surface-800/30">
                    <div className="col-span-5 flex items-center gap-2 min-w-0">
                      {mod.color && (
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: mod.color }} />
                      )}
                      <span className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                        {mod.name}
                      </span>
                      {mod.code && (
                        <span className="text-[10px] font-mono text-surface-400 shrink-0">{mod.code}</span>
                      )}
                    </div>
                    <div className="col-span-2 text-sm text-surface-600 dark:text-surface-300">
                      {mod.ects ?? "–"}
                    </div>
                    <div className="col-span-2">
                      {bestGrade != null ? (
                        <span className={`text-sm font-semibold px-1.5 py-0.5 rounded ${colorClass}`}>
                          {gradeScale ? formatGradeValue(bestGrade, gradeScale) : formatGrade(bestGrade, gs)}
                        </span>
                      ) : (
                        <span className="text-xs text-surface-400">–</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      {band ? (
                        <span className="text-[11px] text-surface-500">{band.shortLabel || band.label}</span>
                      ) : (
                        <span className="text-xs text-surface-400">–</span>
                      )}
                    </div>
                    <div className="col-span-1">
                      {isPassed ? (
                        <CheckCircle size={16} className="text-emerald-500" />
                      ) : bestGrade != null ? (
                        <XCircle size={16} className="text-red-500" />
                      ) : (
                        <Clock size={16} className="text-surface-300" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {/* Recognition section */}
      {recognitions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-2 mb-3">
            <Award size={14} className="text-purple-500" />
            {t("academic.transferCredits") || "Angerechnete Leistungen"}
          </h3>
          <div className="card p-0 overflow-hidden">
            <div className="divide-y divide-surface-50 dark:divide-surface-800">
              {recognitions
                .filter((r: any) => (r.recognitionStatus ?? r.recognition_status ?? r.status) === "accepted" || (r.recognitionStatus ?? r.recognition_status ?? r.status) === "approved")
                .map((rec: any) => (
                  <div key={rec.id} className="flex items-center gap-3 px-4 py-3">
                    <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-800 dark:text-surface-200 truncate">
                        {rec.sourceModuleName ?? rec.source_module_name ?? "Transfer Credit"}
                      </p>
                      <p className="text-[11px] text-surface-400">{rec.sourceInstitution ?? rec.source_institution ?? "Extern"}</p>
                    </div>
                    <span className="text-sm font-medium text-surface-600 dark:text-surface-300">
                      {rec.recognizedEcts ?? rec.recognized_ects ?? rec.sourceCreditValue ?? rec.source_credit_value ?? "–"} {gs.creditLabel}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {semesters.length === 0 && (
        <div className="card p-8 text-center">
          <BookOpen size={32} className="mx-auto text-surface-300 mb-3" />
          <p className="text-sm text-surface-500">
            {t("academic.noTranscriptData") || "Noch keine Noten vorhanden. Trage deine ersten Noten ein!"}
          </p>
        </div>
      )}
    </div>
  );
}
