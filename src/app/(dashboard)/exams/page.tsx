"use client";

import { Suspense, lazy } from "react";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { PageTabs } from "@/components/ui/PageTabs";
import { useTranslation } from "@/lib/i18n";

const ExamsContent = lazy(() => import("./ExamsContent"));
const ExamIntelligenceContent = lazy(() => import("../exam-intelligence/page"));

function Loading() {
  return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
}

export default function ExamsPage() {
  const { t } = useTranslation();

  const tabs = [
    {
      id: "exams",
      label: t("nav.exams") || "Prüfungen",
      icon: GraduationCap,
      content: <Suspense fallback={<Loading />}><ExamsContent /></Suspense>,
    },
    {
      id: "intelligence",
      label: t("nav.examIntelligence") || "Intelligence",
      icon: ShieldCheck,
      content: <Suspense fallback={<Loading />}><ExamIntelligenceContent /></Suspense>,
    },
  ];

  return (
    <PageTabs
      title={t("nav.exams") || "Prüfungen"}
      subtitle="Prüfungsverwaltung & Intelligence-Analyse"
      icon={<GraduationCap className="text-brand-600" size={26} />}
      tabs={tabs}
    />
  );
}
