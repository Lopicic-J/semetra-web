"use client";

import { Suspense, lazy } from "react";
import { Wrench, Sparkles, Network, Calculator } from "lucide-react";
import { PageTabs } from "@/components/ui/PageTabs";
import { useTranslation } from "@/lib/i18n";

const AiAssistantContent = lazy(() => import("../ai-assistant/page"));
const CreativeContent = lazy(() => import("../creative/page"));
const MathContent = lazy(() => import("../math/page"));

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}

export default function WerkzeugePage() {
  const { t } = useTranslation();

  const tabs = [
    {
      id: "ki",
      label: t("nav.aiAssistant") || "KI-Assistent",
      icon: Sparkles,
      content: (
        <Suspense fallback={<Loading />}>
          <AiAssistantContent />
        </Suspense>
      ),
    },
    {
      id: "kreativ",
      label: t("nav.creative") || "Kreativ",
      icon: Network,
      content: (
        <Suspense fallback={<Loading />}>
          <CreativeContent />
        </Suspense>
      ),
    },
    {
      id: "mathe",
      label: t("nav.math") || "Mathe",
      icon: Calculator,
      content: (
        <Suspense fallback={<Loading />}>
          <MathContent />
        </Suspense>
      ),
    },
  ];

  return (
    <PageTabs
      title={t("nav.werkzeuge") || "Werkzeuge"}
      subtitle="KI-Assistent, Kreativtools & Mathe-Raum"
      icon={<Wrench className="text-brand-600" size={26} />}
      tabs={tabs}
    />
  );
}
