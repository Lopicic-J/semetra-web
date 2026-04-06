"use client";

import { Suspense, lazy } from "react";
import { Network, Lightbulb } from "lucide-react";
import { PageTabs } from "@/components/ui/PageTabs";
import { useTranslation } from "@/lib/i18n";

const MindmapsContent = lazy(() => import("../mindmaps/page"));
const BrainstormingContent = lazy(() => import("../brainstorming/page"));

function Loading() {
  return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
}

export default function CreativePage() {
  const { t } = useTranslation();

  const tabs = [
    {
      id: "mindmaps",
      label: t("nav.mindmaps") || "Mind Maps",
      icon: Network,
      content: <Suspense fallback={<Loading />}><MindmapsContent /></Suspense>,
    },
    {
      id: "brainstorming",
      label: t("nav.brainstorming") || "Brainstorming",
      icon: Lightbulb,
      content: <Suspense fallback={<Loading />}><BrainstormingContent /></Suspense>,
    },
  ];

  return (
    <PageTabs
      title={t("nav.creative") || "Kreativtools"}
      subtitle={t("creative.subtitle") || "Mindmaps & Brainstorming"}
      icon={<Network className="text-brand-600" size={26} />}
      tabs={tabs}
    />
  );
}
