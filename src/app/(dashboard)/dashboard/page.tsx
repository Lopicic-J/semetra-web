"use client";
/**
 * Dashboard Page — View Router
 *
 * Schlanke Wrapper-Komponente die zwischen Command Center und
 * klassischem Dashboard umschaltet. Jede View ist eine eigene
 * Komponente mit eigenen Hooks — so laufen keine klassischen
 * Hooks wenn Command Center aktiv ist (und umgekehrt).
 */
import { useState } from "react";
import { Command, LayoutDashboard } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import dynamic from "next/dynamic";

function LoadingPlaceholder({ textKey }: { textKey: string }) {
  return (
    <div className="flex items-center justify-center min-h-[300px] text-sm text-surface-500">
      <div className="w-6 h-6 border-2 border-surface-200 border-t-brand-500 rounded-full animate-spin mr-2" />
    </div>
  );
}

const CommandCenter = dynamic(
  () => import("@/components/command-center/CommandCenter"),
  { ssr: false, loading: () => <LoadingPlaceholder textKey="commandCenter" /> }
);

const ClassicDashboard = dynamic(
  () => import("@/components/dashboard/ClassicDashboard"),
  { ssr: false, loading: () => <LoadingPlaceholder textKey="dashboard" /> }
);

type DashboardView = "command-center" | "classic";

export default function DashboardPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<DashboardView>("command-center");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* View Toggle */}
      <div className="flex items-center justify-end mb-6">
        <div className="flex items-center gap-1 bg-surface-200/60 rounded-lg p-1">
          <button
            onClick={() => setView("command-center")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === "command-center"
                ? "bg-brand-500 text-white shadow-sm"
                : "text-surface-600 hover:text-surface-900"
            }`}
          >
            <Command className="w-3.5 h-3.5" />
            {t("dashboard.commandCenter")}
          </button>
          <button
            onClick={() => setView("classic")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === "classic"
                ? "bg-brand-500 text-white shadow-sm"
                : "text-surface-600 hover:text-surface-900"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            {t("dashboard.classicView")}
          </button>
        </div>
      </div>

      {/* Conditional rendering — only ONE set of hooks runs at a time */}
      {view === "command-center" ? <CommandCenter /> : <ClassicDashboard />}
    </div>
  );
}
