"use client";

import { Suspense, lazy } from "react";
import { Calendar, Clock3 } from "lucide-react";
import { PageTabs } from "@/components/ui/PageTabs";
import { useTranslation } from "@/lib/i18n";

const CalendarContent = lazy(() => import("../calendar/page"));
const StundenplanContent = lazy(() => import("../stundenplan/page"));

function Loading() {
  return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
}

export default function SchedulePage() {
  const { t } = useTranslation();

  const tabs = [
    {
      id: "calendar",
      label: t("nav.calendar") || "Kalender",
      icon: Calendar,
      content: <Suspense fallback={<Loading />}><CalendarContent /></Suspense>,
    },
    {
      id: "stundenplan",
      label: t("nav.stundenplan") || "Stundenplan",
      icon: Clock3,
      content: <Suspense fallback={<Loading />}><StundenplanContent /></Suspense>,
    },
  ];

  return (
    <PageTabs
      title={t("nav.schedule") || "Zeitplan"}
      subtitle={t("schedule.subtitle") || "Kalender & Stundenplan an einem Ort"}
      icon={<Calendar className="text-brand-600" size={26} />}
      tabs={tabs}
    />
  );
}
