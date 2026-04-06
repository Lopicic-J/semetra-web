"use client";

import { Suspense, lazy } from "react";
import {
  GraduationCap, TrendingUp, Target, ClipboardList, ArrowRightLeft,
} from "lucide-react";
import { PageTabs } from "@/components/ui/PageTabs";
import { useTranslation } from "@/lib/i18n";

// ── Lazy-loaded tab contents ────────────────────────────────────────────────
// Each tab reuses the existing, battle-tested components — zero duplication.

const ProgressTab     = lazy(() => import("../progress/ProgressTab"));
const StudienplanPage = lazy(() => import("../studienplan/page"));
const GradesTab       = lazy(() => import("../grades/GradesTab"));
const TranscriptTab   = lazy(() => import("../academic/TranscriptTab"));
const RecognitionTab  = lazy(() => import("../academic/RecognitionTab"));

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Studium Hub — "Mein Studium"
// Consolidates: /progress, /studienplan, /grades, /credits, /transcript,
//               /academic (Program Map, Transcript, Recognition)
//
// Powered by: Academic Engine (grades, credits, pass/fail, classification)
// ═══════════════════════════════════════════════════════════════════════════

export default function StudiumPage() {
  const { t } = useTranslation();

  const tabs = [
    {
      id: "uebersicht",
      label: t("studium.overview") || "Übersicht",
      icon: GraduationCap,
      content: (
        <Suspense fallback={<Loading />}>
          <ProgressTab />
        </Suspense>
      ),
    },
    {
      id: "studienplan",
      label: t("studium.plan") || "Studienplan",
      icon: Target,
      content: (
        <Suspense fallback={<Loading />}>
          <StudienplanPage />
        </Suspense>
      ),
    },
    {
      id: "noten",
      label: t("studium.grades") || "Noten",
      icon: TrendingUp,
      content: (
        <Suspense fallback={<Loading />}>
          <GradesTab />
        </Suspense>
      ),
    },
    {
      id: "transcript",
      label: t("studium.transcript") || "Leistungsnachweis",
      icon: ClipboardList,
      content: (
        <Suspense fallback={<Loading />}>
          <TranscriptTab />
        </Suspense>
      ),
    },
    {
      id: "anrechnungen",
      label: t("studium.recognition") || "Anrechnungen",
      icon: ArrowRightLeft,
      content: (
        <Suspense fallback={<Loading />}>
          <RecognitionTab />
        </Suspense>
      ),
    },
  ];

  return (
    <PageTabs
      title={t("studium.pageTitle") || "Mein Studium"}
      subtitle={t("studium.pageSubtitle") || "Akademischer Fortschritt, Noten, Credits und Studienplan"}
      icon={<GraduationCap className="text-brand-600" size={26} />}
      tabs={tabs}
    />
  );
}
