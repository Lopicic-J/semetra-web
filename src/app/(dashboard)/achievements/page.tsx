"use client";

import { Suspense, lazy } from "react";
import { Trophy, Medal } from "lucide-react";
import { PageTabs } from "@/components/ui/PageTabs";
import { useTranslation } from "@/lib/i18n";

const AchievementsContent = lazy(() => import("./AchievementsTab"));
const LeaderboardContent = lazy(() => import("../leaderboard/page"));

function Loading() {
  return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
}

export default function AchievementsPage() {
  const { t } = useTranslation();

  const tabs = [
    {
      id: "achievements",
      label: t("nav.achievements") || "Erfolge",
      icon: Trophy,
      content: <Suspense fallback={<Loading />}><AchievementsContent /></Suspense>,
    },
    {
      id: "leaderboard",
      label: t("nav.leaderboard") || "Bestenliste",
      icon: Medal,
      content: <Suspense fallback={<Loading />}><LeaderboardContent /></Suspense>,
    },
  ];

  return (
    <PageTabs
      title={t("achievements.pageTitle") || "Erfolge"}
      subtitle={t("achievements.pageSubtitle") || "Deine Erfolge & Bestenliste"}
      icon={<Trophy className="text-brand-600" size={26} />}
      tabs={tabs}
    />
  );
}
