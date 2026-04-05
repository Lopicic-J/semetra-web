"use client";

import { useMemo, useState } from "react";
import { useEnrollments, useAcademicReference, usePrograms, useRequirementGroups, useCreditAwards, useAcademicTerms } from "@/lib/hooks/useAcademicData";
import { useModules } from "@/lib/hooks/useModules";
import { useGrades } from "@/lib/hooks/useGrades";
import { useProfile } from "@/lib/hooks/useProfile";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import { getGradeLabelText } from "@/lib/grading-systems";
import {
  TrendingUp,
  GraduationCap,
  BookOpen,
  Award,
  AlertCircle,
  Zap,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

function displaySemester(raw: string | null | undefined): string {
  if (!raw) return "Sonstige";
  if (raw.startsWith("Semester ")) return raw;
  const match = raw.match(/[HF]S?(\d+)/i);
  if (match) return `Semester ${match[1]}`;
  return raw;
}

export default function ProgressPage() {
  const { enrollments, loading: enrollmentsLoading } = useEnrollments();
  const { gradeScales, gpaSchemes } = useAcademicReference();
  const { programs } = usePrograms();
  const { modules, loading: modulesLoading } = useModules();
  const { grades, loading: gradesLoading } = useGrades();
  const { profile } = useProfile();
  const gs = useGradingSystem();

  // State for what-if scenario
  const [targetGPA, setTargetGPA] = useState<number | null>(null);
  const [nextModuleCredits, setNextModuleCredits] = useState(6);

  const isLoading = enrollmentsLoading || modulesLoading || gradesLoading;

  // ─── Simple ECTS-weighted GPA from grades + modules (works without enrollments) ───

  const { ectsEarned, ectsRequired, gpa, passedCount, failedCount, ongoingCount, semesterData } = useMemo(() => {
    if (isLoading) {
      return { ectsEarned: 0, ectsRequired: 180, gpa: 0, passedCount: 0, failedCount: 0, ongoingCount: 0, semesterData: [] };
    }

    // Build module → best grade map
    const moduleGradeMap = new Map<string, number>();
    const moduleGrades = new Map<string, { grade: number; ects: number }>();

    grades.forEach((g) => {
      if (!g.module_id || g.grade == null) return;
      const existing = moduleGradeMap.get(g.module_id);
      if (existing == null || (gs.direction === "higher_better" ? g.grade > existing : g.grade < existing)) {
        moduleGradeMap.set(g.module_id, g.grade);
      }
    });

    let totalEctsEarned = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalOngoing = 0;

    // Track semesters
    const semMap = new Map<string, { grades: number[]; ects: number[] }>();

    modules.forEach((mod) => {
      const bestGrade = moduleGradeMap.get(mod.id);
      const sem = mod.semester || "Sonstige";

      if (bestGrade != null) {
        const isPassing = gs.isPassing(bestGrade);
        if (isPassing) {
          totalPassed++;
          totalEctsEarned += mod.ects || 0;
        } else {
          totalFailed++;
        }

        // Track semester data
        if (!semMap.has(sem)) semMap.set(sem, { grades: [], ects: [] });
        const s = semMap.get(sem)!;
        s.grades.push(bestGrade);
        s.ects.push(mod.ects || 0);

        moduleGrades.set(mod.id, { grade: bestGrade, ects: mod.ects || 0 });
      } else if (mod.status === "active") {
        totalOngoing++;
      }
    });

    // Also count from enrollments
    enrollments.forEach((e: any) => {
      if (e.status === "recognised" && e.credits_awarded > 0) {
        totalEctsEarned += e.credits_awarded;
      }
    });

    // ECTS-weighted GPA
    let calculatedGpa = 0;
    const gradeEntries = Array.from(moduleGrades.values());
    if (gradeEntries.length > 0) {
      const totalWeight = gradeEntries.reduce((s, m) => s + m.ects, 0);
      if (totalWeight > 0) {
        calculatedGpa = gradeEntries.reduce((s, m) => s + m.grade * m.ects, 0) / totalWeight;
      }
    }

    // Semester chart data
    const semesterData = Array.from(semMap.entries())
      .sort(([a], [b]) => {
        const aMatch = a.match(/\d+/);
        const bMatch = b.match(/\d+/);
        return (aMatch ? parseInt(aMatch[0]) : 999) - (bMatch ? parseInt(bMatch[0]) : 999);
      })
      .map(([sem, data]) => {
        const totalEcts = data.ects.reduce((s, e) => s + e, 0);
        const weightedSum = data.grades.reduce((s, g, i) => s + g * data.ects[i], 0);
        const avg = totalEcts > 0 ? weightedSum / totalEcts : 0;
        return {
          semester: displaySemester(sem),
          gpa: Math.round(avg * 100) / 100,
          credits: totalEcts,
        };
      });

    // Required ECTS from first program or default 180
    const ectsRequired = programs[0]?.requiredTotalCredits || 180;

    return {
      ectsEarned: totalEctsEarned,
      ectsRequired: typeof ectsRequired === "number" ? ectsRequired : 180,
      gpa: calculatedGpa,
      passedCount: totalPassed,
      failedCount: totalFailed,
      ongoingCount: totalOngoing,
      semesterData,
    };
  }, [modules, grades, enrollments, programs, gs, isLoading]);

  const completionPercentage = ectsRequired > 0 ? Math.min(100, Math.round((ectsEarned / ectsRequired) * 1000) / 10) : 0;

  // ─── What-If calculation ───
  const gradeNeeded = useMemo(() => {
    if (!targetGPA || gpa <= 0 || ectsEarned <= 0) return null;

    // target = (currentGPA * currentCredits + needed * nextCredits) / (currentCredits + nextCredits)
    const needed = (targetGPA * (ectsEarned + nextModuleCredits) - gpa * ectsEarned) / nextModuleCredits;

    // Check if achievable
    if (gs.direction === "higher_better") {
      if (needed > gs.max || needed < gs.min) return null;
    } else {
      if (needed < gs.min || needed > gs.max) return null;
    }

    return Math.round(needed * 100) / 100;
  }, [targetGPA, gpa, ectsEarned, nextModuleCredits, gs]);

  // ─── Graduation estimate ───
  const graduationEstimate = useMemo(() => {
    if (semesterData.length === 0 || ectsEarned >= ectsRequired) return null;
    const avgCreditsPerSem = semesterData.reduce((s, d) => s + d.credits, 0) / semesterData.length;
    if (avgCreditsPerSem <= 0) return null;
    const remaining = ectsRequired - ectsEarned;
    const termsRemaining = Math.ceil(remaining / avgCreditsPerSem);
    return {
      termsRemaining,
      estimatedSemester: semesterData.length + termsRemaining,
    };
  }, [semesterData, ectsEarned, ectsRequired]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-[var(--sf-5)] mx-auto mb-2 animate-pulse" />
          <p className="text-[var(--sf-6)]">Studienfortschritt wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--sf-9)] mb-2">
          Studienfortschritt
        </h1>
        <p className="text-[var(--sf-6)]">
          Überblick über deinen akademischen Fortschritt und Prognosen
        </p>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {/* ECTS Card */}
        <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-4 sm:p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-[var(--sf-6)] mb-1">ECTS Fortschritt</p>
              <p className="text-2xl sm:text-3xl font-bold text-[var(--sf-9)]">{ectsEarned}</p>
              <p className="text-xs text-[var(--sf-5)] mt-1">von {ectsRequired} erforderlich</p>
            </div>
            <BookOpen className="w-6 h-6 text-[var(--accent-9)]" />
          </div>
          <div className="w-full h-2 bg-[var(--sf-2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent-9)] transition-all duration-500"
              style={{ width: `${Math.min(completionPercentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--sf-6)] mt-2">{completionPercentage.toFixed(1)}% abgeschlossen</p>
        </div>

        {/* GPA Card */}
        <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-4 sm:p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-[var(--sf-6)] mb-1">Notendurchschnitt</p>
              <p className="text-2xl sm:text-3xl font-bold text-[var(--sf-9)]">
                {gpa > 0 ? gpa.toFixed(2) : "—"}
              </p>
              <p className="text-xs text-[var(--sf-5)] mt-1">
                {gpa > 0 ? (getGradeLabelText(gpa, gs.country) || gs.name) : gs.name}
              </p>
            </div>
            <Award className="w-6 h-6 text-[var(--accent-9)]" />
          </div>
        </div>

        {/* Modules Card */}
        <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-4 sm:p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-[var(--sf-6)] mb-1">Module</p>
              <p className="text-2xl sm:text-3xl font-bold text-[var(--sf-9)]">{passedCount}</p>
              <p className="text-xs text-[var(--sf-5)] mt-1">bestanden / {failedCount} nicht bestanden</p>
            </div>
            <TrendingUp className="w-6 h-6 text-[var(--accent-9)]" />
          </div>
          <p className="text-xs text-[var(--sf-6)]">{ongoingCount} in Bearbeitung</p>
        </div>

        {/* Graduation Estimate */}
        <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-4 sm:p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-[var(--sf-6)] mb-1">Geschätzter Abschluss</p>
              <p className="text-2xl sm:text-3xl font-bold text-[var(--sf-9)]">
                {graduationEstimate ? `Sem. ${graduationEstimate.estimatedSemester}` : "—"}
              </p>
              <p className="text-xs text-[var(--sf-5)] mt-1">
                {graduationEstimate
                  ? `${graduationEstimate.termsRemaining} Semester verbleibend`
                  : "Keine Daten"}
              </p>
            </div>
            <GraduationCap className="w-6 h-6 text-[var(--accent-9)]" />
          </div>
        </div>
      </div>

      {/* Large ECTS Progress Bar */}
      <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-4 sm:p-6 mb-8">
        <h2 className="text-lg font-semibold text-[var(--sf-9)] mb-4">ECTS-Übersicht</h2>
        <div className="space-y-3">
          <div className="h-10 bg-[var(--sf-2)] rounded-lg overflow-hidden flex">
            <div
              className="bg-[var(--accent-9)] transition-all duration-500 flex items-center justify-center"
              style={{ width: `${Math.min(completionPercentage, 100)}%` }}
            >
              {completionPercentage > 15 && (
                <span className="text-xs font-bold text-white">{ectsEarned} ECTS</span>
              )}
            </div>
            {completionPercentage < 100 && (
              <div className="flex-1 flex items-center justify-end pr-3">
                <span className="text-xs font-semibold text-[var(--sf-6)]">
                  {ectsRequired - ectsEarned} verbleibend
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-between text-xs text-[var(--sf-6)]">
            <span>0 ECTS</span>
            <span className="font-semibold text-[var(--sf-9)]">{completionPercentage.toFixed(1)}%</span>
            <span>{ectsRequired} ECTS</span>
          </div>
        </div>
      </div>

      {/* Semester Performance (simple table instead of Recharts to avoid import issues) */}
      {semesterData.length > 0 && (
        <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-4 sm:p-6 mb-8">
          <h2 className="text-lg font-semibold text-[var(--sf-9)] mb-4">Leistung pro Semester</h2>
          <div className="space-y-3">
            {semesterData.map((sem) => (
              <div key={sem.semester} className="flex items-center gap-4">
                <span className="text-sm font-medium text-[var(--sf-9)] w-28 flex-shrink-0">{sem.semester}</span>
                <div className="flex-1 h-6 bg-[var(--sf-2)] rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-[var(--accent-9)] rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${Math.min((sem.gpa / gs.max) * 100, 100)}%` }}
                  >
                    {(sem.gpa / gs.max) * 100 > 30 && (
                      <span className="text-[10px] font-bold text-white">{sem.gpa.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-[var(--sf-6)] w-16 text-right">{sem.credits} ECTS</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What-If Scenario */}
      {gpa > 0 && (
        <div className="bg-[var(--sf-1)] rounded-xl border border-[var(--sf-3)] p-4 sm:p-6">
          <div className="flex items-start gap-3 mb-6">
            <Zap className="w-5 h-5 text-[var(--accent-9)] flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--sf-9)]">Was-Wäre-Wenn Szenario</h2>
              <p className="text-sm text-[var(--sf-6)] mt-1">
                Welche Note brauchst du im nächsten Modul?
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--sf-9)] mb-2">Ziel-Durchschnitt</label>
              <input
                type="number"
                step="0.1"
                min={gs.min}
                max={gs.max}
                placeholder={`z.B. ${gs.direction === "higher_better" ? "5.0" : "2.0"}`}
                value={targetGPA ?? ""}
                onChange={(e) => setTargetGPA(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--sf-3)] bg-[var(--sf-0)] text-[var(--sf-9)] placeholder-[var(--sf-5)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-9)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--sf-9)] mb-2">ECTS des nächsten Moduls</label>
              <input
                type="number"
                step="1"
                min="1"
                max="30"
                value={nextModuleCredits}
                onChange={(e) => setNextModuleCredits(parseInt(e.target.value) || 6)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--sf-3)] bg-[var(--sf-0)] text-[var(--sf-9)] placeholder-[var(--sf-5)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-9)]"
              />
            </div>
          </div>

          {targetGPA !== null && (
            <div className="mt-6 p-4 bg-[var(--sf-2)] rounded-lg border border-[var(--sf-3)]">
              {gradeNeeded !== null ? (
                <div>
                  <p className="text-sm text-[var(--sf-6)] mb-2">
                    Um einen Schnitt von <span className="font-semibold">{targetGPA.toFixed(2)}</span> zu erreichen:
                  </p>
                  <p className="text-2xl font-bold text-[var(--accent-9)]">
                    {gradeNeeded.toFixed(2)}
                  </p>
                  <p className="text-xs text-[var(--sf-6)] mt-2">
                    Note nötig im nächsten {nextModuleCredits}-ECTS-Modul
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-100">Nicht erreichbar</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Der Ziel-Schnitt kann mit einem einzelnen Modul nicht erreicht werden.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
