"use client";

import { Suspense, lazy } from "react";
import { Brain, CalendarClock, Layers, BookOpen, Timer, FileText, Users } from "lucide-react";
import { PageTabs } from "@/components/ui/PageTabs";
import { useTranslation } from "@/lib/i18n";

const LernplanContent = lazy(() => import("../lernplan/page"));
const FlashcardsContent = lazy(() => import("../flashcards/page"));
const KnowledgeContent = lazy(() => import("../knowledge/page"));
const TimerContent = lazy(() => import("../timer/page"));
const MaterialsContent = lazy(() => import("../materials/page"));
const GroupsContent = lazy(() => import("../groups/page"));

function Loading() {
  return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
}

export default function LearningPage() {
  const { t } = useTranslation();

  const tabs = [
    {
      id: "lernplan",
      label: t("nav.lernplan") || "Lernplan",
      icon: CalendarClock,
      content: <Suspense fallback={<Loading />}><LernplanContent /></Suspense>,
    },
    {
      id: "timer",
      label: t("nav.timer") || "Timer",
      icon: Timer,
      content: <Suspense fallback={<Loading />}><TimerContent /></Suspense>,
    },
    {
      id: "flashcards",
      label: t("nav.flashcards") || "Karteikarten",
      icon: Layers,
      content: <Suspense fallback={<Loading />}><FlashcardsContent /></Suspense>,
    },
    {
      id: "knowledge",
      label: t("nav.knowledge") || "Lernziele",
      icon: BookOpen,
      content: <Suspense fallback={<Loading />}><KnowledgeContent /></Suspense>,
    },
    {
      id: "materials",
      label: t("nav.materials") || "Materialien",
      icon: FileText,
      content: <Suspense fallback={<Loading />}><MaterialsContent /></Suspense>,
    },
    {
      id: "groups",
      label: t("nav.groups") || "Gruppen",
      icon: Users,
      content: <Suspense fallback={<Loading />}><GroupsContent /></Suspense>,
    },
  ];

  return (
    <PageTabs
      title={t("nav.learning") || "Lernen"}
      subtitle="Timer, Materialien, Karteikarten, Lernziele & Gruppen"
      icon={<Brain className="text-brand-600" size={26} />}
      tabs={tabs}
    />
  );
}
