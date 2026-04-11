"use client";

import { Suspense, lazy } from "react";
import {
  TrendingUp, GraduationCap, Dna, BarChart3, Trophy, Medal,
} from "lucide-react";
import { PageTabs } from "@/components/ui/PageTabs";
import { useTranslation } from "@/lib/i18n";

// ── Lazy-loaded tab contents ────────────────────────────────────────────────

const StudiumContent = lazy(() => import("../studium/page"));
const LernDnaContent = lazy(() => import("../lern-dna/page"));
const InsightsContent = lazy(() => import("../insights/page"));
const AchievementsTab = lazy(() => import("../achievements/AchievementsTab"));
const LeaderboardContent = lazy(() => import("../leaderboard/page"));

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}

export default function FortschrittPage() {
  const { t } = useTranslation();

  const tabs = [
    {
      id: "studium",
      label: t("studium.pageTitle") || "Mein Studium",
      icon: GraduationCap,
      content: (
        <Suspense fallback={<Loading />}>
          <StudiumContent />
        </Suspense>
      ),
    },
    {
      id: "dna",
      label: t("nav.lernDna") || "Lern-DNA",
      icon: Dna,
      content: (
        <Suspense fallback={<Loading />}>
          <LernDnaContent />
        </Suspense>
      ),
    },
    {
      id: "insights",
      label: t("nav.insights") || "Insights",
      icon: BarChart3,
      content: (
        <Suspense fallback={<Loading />}>
          <InsightsContent />
        </Suspense>
      ),
    },
    {
      id: "erfolge",
      label: t("nav.achievements") || "Erfolge",
      icon: Trophy,
      content: (
        <Suspense fallback={<Loading />}>
          <AchievementsTab />
        </Suspense>
      ),
    },
    {
      id: "bestenliste",
      label: t("nav.leaderboard") || "Bestenliste",
      icon: Medal,
      content: (
        <Suspense fallback={<Loading />}>
          <LeaderboardContent />
        </Suspense>
      ),
    },
  ];

  return (
    <PageTabs
      title={t("nav.fortschritt") || "Fortschritt"}
      subtitle="Studium, Lern-DNA, Insights, Erfolge & Bestenliste"
      icon={<TrendingUp className="text-brand-600" size={26} />}
      tabs={tabs}
    />
  );
}
