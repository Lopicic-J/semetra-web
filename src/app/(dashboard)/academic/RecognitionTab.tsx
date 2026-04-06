"use client";

import { useMemo } from "react";
import { Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import {
  useAcademicReference,
  useAcademicPageData,
} from "@/lib/hooks/useAcademicData";
import { RecognitionCenter } from "@/components/academic/RecognitionCenter";

export default function RecognitionTab() {
  const { t } = useTranslation();
  const gs = useGradingSystem();

  const { gradeScales, gradeBands, creditSchemes, loading: refLoading } = useAcademicReference();
  const { recognitions, institutions, loading: pageLoading } = useAcademicPageData();

  const isLoading = refLoading || pageLoading;

  const currentGradeScale = useMemo(
    () => gradeScales.find(s => s.code === gs.scaleCode) ?? gradeScales[0] ?? null,
    [gradeScales, gs.scaleCode]
  );

  const currentCreditScheme = useMemo(
    () => creditSchemes.find(cs => cs.code === "ECTS") ?? creditSchemes[0] ?? null,
    [creditSchemes]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentGradeScale || !currentCreditScheme) {
    return (
      <div className="card p-8 text-center max-w-lg mx-auto">
        <Globe size={40} className="mx-auto text-surface-300 mb-3" />
        <p className="text-sm text-surface-500">
          {t("academic.noReferenceData") || "Referenzdaten werden geladen..."}
        </p>
      </div>
    );
  }

  return (
    <RecognitionCenter
      recognitions={recognitions}
      gradeScales={gradeScales}
      gradeBands={gradeBands}
      creditSchemes={creditSchemes}
      institutions={institutions}
      currentGradeScale={currentGradeScale}
      currentCreditScheme={currentCreditScheme}
    />
  );
}
