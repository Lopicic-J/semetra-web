"use client";

import { useCommandCenter } from "@/lib/hooks/useCommandCenter";
import { useSmartAutomations } from "@/lib/hooks/useSmartAutomations";
import { useStreaks } from "@/lib/hooks/useStreaks";
import AlertBanner from "./AlertBanner";
import OverviewCards from "./OverviewCards";
import DailyActions from "./DailyActions";
import ModulePriorityList from "./ModulePriorityList";
import RiskOverview from "./RiskOverview";
import PredictionPanel from "./PredictionPanel";
import { Loader2, RefreshCw, Command } from "lucide-react";

export default function CommandCenter() {
  // Single entry point — one useModuleIntelligence instance for everything
  const { state, modules, loading, refetch, computedAt } = useCommandCenter(undefined, true);
  const streakData = useStreaks();

  // Smart automations (receives state from useCommandCenter, no duplicate hooks)
  useSmartAutomations({ state, modules });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <p className="text-sm text-surface-500">Decision Engine berechnet...</p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Command className="w-10 h-10 text-surface-300" />
          <p className="text-sm text-surface-500">Noch keine Module vorhanden.</p>
          <p className="text-xs text-surface-400">Erstelle dein erstes Modul, um das Command Center zu aktivieren.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
            <Command className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Command Center</h1>
            <p className="text-sm text-surface-500">
              {new Date().toLocaleDateString("de-CH", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <button
          onClick={refetch}
          className="p-2 rounded-lg hover:bg-surface-200 transition-colors text-surface-500 hover:text-surface-700"
          title="Aktualisieren"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Alerts */}
      <AlertBanner alerts={state.today.alerts} />

      {/* Overview Stats */}
      <OverviewCards
        overview={state.overview}
        studyStreak={streakData.currentStreak}
      />

      {/* Main Grid: Actions + Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DailyActions
          actions={state.today.actions}
          totalMinutes={state.today.totalMinutes}
          focusModule={state.today.focusModule}
        />
        <ModulePriorityList
          rankings={state.moduleRankings}
          modules={modules}
        />
      </div>

      {/* Secondary Grid: Risk + Predictions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RiskOverview
          risks={state.risks}
          modules={modules}
        />
        <PredictionPanel
          predictions={state.predictions}
          modules={modules}
        />
      </div>

      {/* Timestamp */}
      {computedAt && (
        <p className="text-xs text-surface-400 text-right">
          Berechnet: {new Date(computedAt).toLocaleTimeString("de-CH")}
        </p>
      )}
    </div>
  );
}
