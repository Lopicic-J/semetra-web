"use client";

import { useMemo, useState } from "react";
import { useModules } from "@/lib/hooks/useModules";
import { useGrades } from "@/lib/hooks/useGrades";
import { useProfile } from "@/lib/hooks/useProfile";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import { useEnrollments, useRecognitions, useCreditAwards, useAcademicTerms } from "@/lib/hooks/useAcademicData";
import { getGradeColor, getGradeLabelText, formatGrade } from "@/lib/grading-systems";
import toast from "react-hot-toast";
import { FileDown, BookOpen, CheckCircle, XCircle, Clock, Award, BarChart3 } from "lucide-react";
import type { Module, Grade } from "@/types/database";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TranscriptModule {
  module: Module;
  grades: Grade[];
  enrollment?: any;
}

interface TranscriptSemester {
  semester: string;
  displayLabel: string;
  modules: TranscriptModule[];
  ectsTotal: number;
}

function displaySemester(raw: string | null | undefined): string {
  if (!raw) return "Sonstige";
  if (raw.startsWith("Semester ")) return raw;
  const match = raw.match(/[HF]S?(\d+)/i);
  if (match) return `Semester ${match[1]}`;
  return raw;
}

export default function TranscriptPage() {
  const { modules, loading: modulesLoading } = useModules();
  const { grades, loading: gradesLoading } = useGrades();
  const { profile, loading: profileLoading } = useProfile();
  const { enrollments, loading: enrollmentsLoading } = useEnrollments();
  const { recognitions, loading: recognitionsLoading } = useRecognitions();
  const gs = useGradingSystem();

  const isLoading = modulesLoading || gradesLoading || profileLoading || enrollmentsLoading || recognitionsLoading;

  // Build transcript data
  const { transcriptSemesters, totalEcts, passedModules, totalModules, gpa, recognitionList } = useMemo(() => {
    if (isLoading || !profile) {
      return {
        transcriptSemesters: [] as TranscriptSemester[],
        totalEcts: 0,
        passedModules: 0,
        totalModules: 0,
        gpa: 0,
        recognitionList: [] as any[],
      };
    }

    // Build module → grades map
    const moduleGradeMap = new Map<string, Grade[]>();
    grades.forEach((g) => {
      if (!g.module_id) return;
      if (!moduleGradeMap.has(g.module_id)) {
        moduleGradeMap.set(g.module_id, []);
      }
      moduleGradeMap.get(g.module_id)!.push(g);
    });

    // Build enrollment map
    const enrollmentMap = new Map<string, any>();
    enrollments.forEach((e) => {
      enrollmentMap.set(e.module_id, e);
    });

    // Group modules by semester
    const semesterMap = new Map<string, TranscriptModule[]>();
    let totalPassed = 0;
    let totalModuleCount = 0;
    let totalEctsEarned = 0;

    modules.forEach((mod) => {
      const sem = mod.semester || "Sonstige";
      if (!semesterMap.has(sem)) {
        semesterMap.set(sem, []);
      }

      const modGrades = moduleGradeMap.get(mod.id) || [];
      const enrollment = enrollmentMap.get(mod.id);

      if (modGrades.length > 0 || enrollment) {
        semesterMap.get(sem)!.push({
          module: mod,
          grades: modGrades,
          enrollment,
        });

        totalModuleCount++;

        if (modGrades.length > 0) {
          const latestGrade = modGrades[0];
          if (latestGrade.grade != null && gs.isPassing(latestGrade.grade)) {
            totalPassed++;
            totalEctsEarned += mod.ects || 0;
          }
        }
      }
    });

    // Recognition list
    const recognitionList: any[] = [];
    recognitions.forEach((rec: any) => {
      recognitionList.push(rec);
      if (rec.recognition_status === "accepted") {
        totalEctsEarned += rec.recognized_ects || 0;
      }
    });

    // Sort semesters
    const semesters = Array.from(semesterMap.entries())
      .sort(([a], [b]) => {
        const aMatch = a.match(/\d+/);
        const bMatch = b.match(/\d+/);
        const aNum = aMatch ? parseInt(aMatch[0]) : 999;
        const bNum = bMatch ? parseInt(bMatch[0]) : 999;
        return aNum - bNum;
      })
      .map(([semester, mods]) => {
        const ectsTotal = mods.reduce((sum, tm) => {
          const modGrades = tm.grades;
          if (modGrades.length > 0 && modGrades[0].grade != null && gs.isPassing(modGrades[0].grade)) {
            return sum + (tm.module.ects || 0);
          }
          return sum;
        }, 0);

        return {
          semester,
          displayLabel: displaySemester(semester),
          modules: mods,
          ectsTotal,
        };
      });

    // Calculate simple ECTS-weighted GPA
    const gradedModules: { grade: number; ects: number }[] = [];
    modules.forEach((mod) => {
      const modGrades = moduleGradeMap.get(mod.id) || [];
      if (modGrades.length > 0 && modGrades[0].grade != null) {
        gradedModules.push({ grade: modGrades[0].grade, ects: mod.ects || 1 });
      }
    });

    let calculatedGpa = 0;
    if (gradedModules.length > 0) {
      const totalWeight = gradedModules.reduce((s, m) => s + m.ects, 0);
      calculatedGpa = totalWeight > 0
        ? gradedModules.reduce((s, m) => s + m.grade * m.ects, 0) / totalWeight
        : 0;
    }

    return {
      transcriptSemesters: semesters,
      totalEcts: totalEctsEarned,
      passedModules: totalPassed,
      totalModules: totalModuleCount,
      gpa: calculatedGpa,
      recognitionList,
    };
  }, [modules, grades, profile, enrollments, recognitions, gs, isLoading]);

  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      // Use the semester-report API to get structured data, then generate a printable view
      const res = await fetch("/api/academic/semester-report");
      if (!res.ok) throw new Error("Report konnte nicht geladen werden");
      // Open print dialog with the current page as a simple PDF workaround
      window.print();
      toast.success("Druckdialog geoeffnet - als PDF speichern");
    } catch {
      toast.error("PDF-Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  };

  const country = gs.country ?? null;

  // Get grade label text from grading system
  const getLabel = (grade: number): string => {
    return getGradeLabelText(grade, country) || "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-[var(--sf-5)] mx-auto mb-2 animate-pulse" />
          <p className="text-[var(--sf-6)]">Leistungsübersicht wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--sf-9)] mb-2">Leistungsübersicht</h1>
          {profile && (
            <div className="flex items-center gap-4 text-sm text-[var(--sf-6)]">
              <span className="font-medium text-[var(--sf-8)]">
                {(profile as any).full_name || "Student"}
              </span>
              {(profile as any).study_program && (
                <span className="hidden sm:block font-medium text-[var(--sf-8)]">
                  {(profile as any).study_program}
                </span>
              )}
              {(profile as any).university && (
                <span className="hidden md:block text-[var(--sf-6)]">
                  {(profile as any).university}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-9)] text-[var(--accent-1)] rounded-lg hover:opacity-90 transition-opacity font-medium disabled:opacity-50 print:hidden"
        >
          <FileDown className="w-4 h-4" />
          <span className="hidden sm:inline">{exporting ? "Exportiere..." : "Als PDF exportieren"}</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--sf-6)] uppercase tracking-wide">ECTS Erreicht</span>
            <Award className="w-4 h-4 text-[var(--accent-9)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--sf-9)]">{totalEcts}</div>
          <p className="text-xs text-[var(--sf-5)] mt-1">von 180 ECTS</p>
        </div>

        <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--sf-6)] uppercase tracking-wide">Notendurchschnitt</span>
            <BarChart3 className="w-4 h-4 text-[var(--accent-9)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--sf-9)]">{gpa > 0 ? gpa.toFixed(2) : "—"}</div>
          <p className="text-xs text-[var(--sf-5)] mt-1">{gs.name || "Schweiz"}</p>
        </div>

        <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--sf-6)] uppercase tracking-wide">Bewertung</span>
            <Award className="w-4 h-4 text-[var(--accent-9)]" />
          </div>
          <div className="text-lg font-bold text-[var(--sf-9)]">{gpa > 0 ? getLabel(gpa) : "—"}</div>
          <p className="text-xs text-[var(--sf-5)] mt-1">Abschluss</p>
        </div>

        <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--sf-6)] uppercase tracking-wide">Module Bestanden</span>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-[var(--sf-9)]">
            {passedModules}/{totalModules}
          </div>
          <p className="text-xs text-[var(--sf-5)] mt-1">
            {totalModules > 0 ? `${Math.round((passedModules / totalModules) * 100)}%` : "0%"}
          </p>
        </div>
      </div>

      {/* Transcript Table by Semester */}
      <div className="space-y-4">
        {transcriptSemesters.length > 0 ? (
          transcriptSemesters.map((semester) => (
            <div key={semester.semester} className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] overflow-hidden">
              <div className="bg-[var(--sf-2)] border-b border-[var(--sf-3)] px-4 sm:px-6 py-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--sf-9)]">{semester.displayLabel}</h3>
                <span className="text-xs font-medium text-[var(--accent-9)] bg-[var(--accent-2)] px-3 py-1 rounded-full">
                  {semester.ectsTotal} ECTS
                </span>
              </div>

              <div className="divide-y divide-[var(--sf-3)]">
                {semester.modules.map((tm) => {
                  const latestGrade = tm.grades.length > 0 ? tm.grades[0] : null;
                  const gradeValue = latestGrade?.grade ?? (tm.enrollment?.current_final_grade as number | null) ?? null;
                  const isPassing = gradeValue != null ? gs.isPassing(gradeValue) : false;
                  const gradeColorClass = gradeValue != null ? getGradeColor(gradeValue, country) : "";
                  const gradeLabelText = gradeValue != null ? getGradeLabelText(gradeValue, country) : "";
                  const normalizedScore = tm.enrollment?.normalized_score_0_100 as number | null;
                  const attemptsUsed = (tm.enrollment?.attempts_used as number) || 0;

                  return (
                    <div
                      key={tm.module.id}
                      className="px-4 sm:px-6 py-3 hover:bg-[var(--sf-2)] transition-colors text-sm"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-start">
                        <div className="sm:col-span-2">
                          <p className="text-xs text-[var(--sf-5)] font-medium uppercase mb-1 sm:hidden">Code</p>
                          <p className="font-mono font-semibold text-[var(--sf-9)]">{tm.module.code || "—"}</p>
                        </div>

                        <div className="sm:col-span-4">
                          <p className="text-xs text-[var(--sf-5)] font-medium uppercase mb-1 sm:hidden">Modul</p>
                          <p className="text-[var(--sf-9)] font-medium line-clamp-2">{tm.module.name}</p>
                        </div>

                        <div className="sm:col-span-1">
                          <p className="text-xs text-[var(--sf-5)] font-medium uppercase mb-1 sm:hidden">ECTS</p>
                          <p className="font-semibold text-[var(--sf-9)]">{tm.module.ects || "—"}</p>
                        </div>

                        <div className="sm:col-span-1">
                          <p className="text-xs text-[var(--sf-5)] font-medium uppercase mb-1 sm:hidden">Note</p>
                          {gradeValue != null ? (
                            <p className="font-bold text-lg" style={{ color: isPassing ? "var(--accent-9)" : "rgb(239 68 68)" }}>
                              {formatGrade(gradeValue, country)}
                            </p>
                          ) : (
                            <p className="text-[var(--sf-5)]">—</p>
                          )}
                        </div>

                        <div className="sm:col-span-2">
                          <p className="text-xs text-[var(--sf-5)] font-medium uppercase mb-1 sm:hidden">Bewertung</p>
                          {gradeLabelText ? (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${gradeColorClass}`}>
                              {gradeLabelText}
                            </span>
                          ) : (
                            <p className="text-[var(--sf-5)]">—</p>
                          )}
                        </div>

                        <div className="sm:col-span-2 flex items-end gap-2">
                          {/* Engine enrichment: normalized score + attempts */}
                          {normalizedScore !== null && normalizedScore > 0 && (
                            <span className="text-[10px] text-surface-400 font-mono" title="Normalisierter Score (0-100)">
                              {Math.round(normalizedScore)}/100
                            </span>
                          )}
                          {attemptsUsed > 1 && (
                            <span className="text-[10px] text-amber-500 font-medium" title="Anzahl Versuche">
                              {attemptsUsed}. Versuch
                            </span>
                          )}
                          {latestGrade ? (
                            isPassing ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-xs font-semibold border border-green-200 dark:border-green-800">
                                <CheckCircle className="w-3 h-3" />
                                Bestanden
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs font-semibold border border-red-200 dark:border-red-800">
                                <XCircle className="w-3 h-3" />
                                Nicht bestanden
                              </span>
                            )
                          ) : tm.enrollment ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800">
                              <Clock className="w-3 h-3" />
                              Laufend
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)]">
            <BookOpen className="w-12 h-12 text-[var(--sf-4)] mx-auto mb-3" />
            <p className="text-[var(--sf-6)] font-medium">Keine Module mit Noten vorhanden</p>
            <p className="text-xs text-[var(--sf-5)] mt-1">Ihre Noten werden hier angezeigt, sobald Sie Module abgeschlossen haben.</p>
          </div>
        )}
      </div>

      {/* Recognition Section */}
      {recognitionList.length > 0 && (
        <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] overflow-hidden">
          <div className="bg-[var(--sf-2)] border-b border-[var(--sf-3)] px-4 sm:px-6 py-3">
            <h3 className="text-sm font-bold text-[var(--sf-9)] flex items-center gap-2">
              <Award className="w-4 h-4 text-[var(--accent-9)]" />
              Anerkannte Leistungen (Transfer-Credits)
            </h3>
          </div>

          <div className="divide-y divide-[var(--sf-3)]">
            {recognitionList.map((rec: any) => (
              <div key={rec.id} className="px-4 sm:px-6 py-4 hover:bg-[var(--sf-2)] transition-colors">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 text-sm">
                  <div className="sm:col-span-3">
                    <p className="text-xs text-[var(--sf-5)] font-medium uppercase mb-1">Herkunftsinstitution</p>
                    <p className="font-medium text-[var(--sf-9)]">{rec.source_institution || "—"}</p>
                  </div>
                  <div className="sm:col-span-4">
                    <p className="text-xs text-[var(--sf-5)] font-medium uppercase mb-1">Modul</p>
                    <p className="text-[var(--sf-9)]">{rec.source_module_name || "—"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-[var(--sf-5)] font-medium uppercase mb-1">Ursprüngliche Note</p>
                    <p className="font-semibold text-[var(--sf-9)]">{rec.source_grade_value ?? "—"}</p>
                  </div>
                  <div className="sm:col-span-1">
                    <p className="text-xs text-[var(--sf-5)] font-medium uppercase mb-1">ECTS</p>
                    <p className="font-semibold text-[var(--sf-9)]">{rec.recognized_ects ?? "—"}</p>
                  </div>
                  <div className="sm:col-span-2 flex items-end">
                    {rec.recognition_status === "accepted" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-xs font-semibold border border-green-200 dark:border-green-800">
                        <CheckCircle className="w-3 h-3" />
                        Anerkannt
                      </span>
                    ) : rec.recognition_status === "pending" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800">
                        <Clock className="w-3 h-3" />
                        Ausstehend
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs font-semibold border border-red-200 dark:border-red-800">
                        <XCircle className="w-3 h-3" />
                        Abgelehnt
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
