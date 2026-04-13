"use client";

import { useMemo } from "react";
import { GraduationCap } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import {
  useAcademicReference,
  useAcademicPageData,
} from "@/lib/hooks/useAcademicData";
import { ProgramMap } from "@/components/academic/ProgramMap";

export default function ProgramMapTab() {
  const { t } = useTranslation();
  const gs = useGradingSystem();

  const { gradeScales, gradeBands, loading: refLoading } = useAcademicReference();
  const {
    programs,
    requirementGroups,
    enrollments,
    attempts,
    creditAwards,
    academicModules,
    prerequisites,
    loading: pageLoading,
  } = useAcademicPageData();

  const isLoading = refLoading || pageLoading;

  // Find the user's active program
  const activeProgram = useMemo(
    () => programs.find((p: any) => (p.isActive ?? p.is_active) !== false) ?? programs[0] ?? null,
    [programs]
  );

  // Grade scale for the user's country
  const gradeScale = useMemo(
    () => gradeScales.find(s => s.code === gs.scaleCode) ?? gradeScales[0] ?? null,
    [gradeScales, gs.scaleCode]
  );

  // Filter requirement groups for active program
  const programGroups = useMemo(
    () => activeProgram ? requirementGroups.filter((g: any) => (g.programId ?? g.program_id) === activeProgram.id) : [],
    [activeProgram, requirementGroups]
  );

  // Filter modules for active program
  const programModules = useMemo(
    () => activeProgram ? academicModules.filter((m: any) => (m.programId ?? m.program_id) === activeProgram.id) : [],
    [activeProgram, academicModules]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeProgram || !gradeScale) {
    return (
      <div className="card p-8 text-center max-w-lg mx-auto">
        <GraduationCap size={40} className="mx-auto text-surface-300 mb-3" />
 <h3 className="text-base font-semibold text-surface-800 mb-2">
          {t("academic.noProgramSelected") || "Kein Studiengang ausgewählt"}
        </h3>
        <p className="text-sm text-surface-500 mb-4">
          {t("academic.selectProgramHint") || "Importiere einen Studiengang unter 'Studiengänge', um die Programmübersicht zu sehen."}
        </p>
        <a href="/studiengaenge" className="btn-primary text-sm">
          {t("academic.goToPrograms") || "Studiengänge durchsuchen"}
        </a>
      </div>
    );
  }

  return (
    <ProgramMap
      program={activeProgram}
      requirementGroups={programGroups}
      enrollments={enrollments}
      attempts={attempts}
      creditAwards={creditAwards}
      gradeScale={gradeScale}
      gradeBands={gradeBands}
      modules={programModules as any}
      prerequisites={prerequisites as any}
    />
  );
}
