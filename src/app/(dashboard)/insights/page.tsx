"use client";

import { Suspense, lazy } from "react";
import {
  BarChart3, TrendingUp, Brain, Calendar,
} from "lucide-react";
import { PageTabs } from "@/components/ui/PageTabs";
import { useTranslation } from "@/lib/i18n";

// ── Lazy-loaded tab contents ────────────────────────────────────────────────

const WeeklyReviewPage = lazy(() => import("../weekly-review/page"));
const TrendsTab        = lazy(() => import("./TrendsTab"));
const PatternsTab      = lazy(() => import("./PatternsTab"));
const TimelinePage     = lazy(() => import("../timeline/page"));

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Insights Hub — Intelligence Dashboard
// Consolidates: /weekly-review, grade predictions, study patterns, /timeline
//
// Powered by: Decision Engine + Schedule Engine (pattern-analyzer, rescheduler)
//
// Landing tab is "Wochenreview" — ensures it stays visible and central.
// ═══════════════════════════════════════════════════════════════════════════

export default function InsightsPage() {
  const { t } = useTranslation();

  const tabs = [
    {
      id: "review",
      label: t("insights.weeklyReview") || "Wochenreview",
      icon: BarChart3,
      content: (
        <Suspense fallback={<Loading />}>
          <WeeklyReviewPage />
        </Suspense>
      ),
    },
    {
      id: "trends",
      label: t("insights.trends") || "Trends & Prognosen",
      icon: TrendingUp,
      content: (
        <Suspense fallback={<Loading />}>
          <TrendsTab />
        </Suspense>
      ),
    },
    {
      id: "patterns",
      label: t("insights.patterns") || "Lernmuster",
      icon: Brain,
      content: (
        <Suspense fallback={<Loading />}>
          <PatternsTab />
        </Suspense>
      ),
    },
    {
      id: "timeline",
      label: t("insights.timeline") || "Timeline",
      icon: Calendar,
      content: (
        <Suspense fallback={<Loading />}>
          <TimelinePage />
        </Suspense>
      ),
    },
  ];

  return (
    <PageTabs
      title={t("insights.pageTitle") || "Insights"}
      subtitle={t("insights.pageSubtitle") || "Analysen, Prognosen und Empfehlungen für dein Studium"}
      icon={<BarChart3 className="text-brand-600" size={26} />}
      tabs={tabs}
      defaultTab="review"
    />
  );
}
