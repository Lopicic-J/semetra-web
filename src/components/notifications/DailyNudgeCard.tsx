"use client";
/**
 * DailyNudgeCard — Personalized daily nudge widget for the dashboard
 *
 * Shows a compact card with today's personalized recommendations:
 * - Focus module with exam countdown
 * - Time budget breakdown
 * - Best study time window
 * - Streak status
 * - Quick win suggestion
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, Target, Clock, Zap, BookOpen, Flame, Trophy, ChevronRight, RefreshCw
} from "lucide-react";
import { buildDailyNudge, type DailyNudge, type NudgeSection } from "@/lib/decision/daily-nudge";
import type { CommandCenterState, ModuleIntelligence } from "@/lib/decision/types";
import { useTranslation } from "@/lib/i18n";

interface DailyNudgeCardProps {
  state: CommandCenterState;
  modules: ModuleIntelligence[];
  streakData?: {
    currentStreak: number;
    longestStreak: number;
    todayDone: boolean;
  };
}

const SECTION_ICONS: Record<string, typeof Sparkles> = {
  focus_module: Target,
  time_budget: Clock,
  best_time: Zap,
  exam_countdown: BookOpen,
  quick_win: Trophy,
  streak: Flame,
  encouragement: Sparkles,
};

const SECTION_COLORS: Record<string, string> = {
  focus_module: "text-brand-600 dark:text-brand-400",
  time_budget: "text-blue-600 dark:text-blue-400",
  best_time: "text-amber-600 dark:text-amber-400",
  exam_countdown: "text-red-600 dark:text-red-400",
  quick_win: "text-green-600 dark:text-green-400",
  streak: "text-orange-600 dark:text-orange-400",
  encouragement: "text-purple-600 dark:text-purple-400",
};

export function DailyNudgeCard({ state, modules, streakData }: DailyNudgeCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [nudge, setNudge] = useState<DailyNudge | null>(null);
  const [persisted, setPersisted] = useState(false);

  // Generate nudge on mount/state change
  useEffect(() => {
    if (!state || modules.length === 0) return;

    const result = buildDailyNudge({
      state,
      modules,
      streakData,
    });
    setNudge(result);

    // Persist (fire-and-forget, once per day)
    if (!persisted) {
      setPersisted(true);
      fetch("/api/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nudge: result }),
      }).catch(() => { /* silent */ });
    }
  }, [state, modules, streakData, persisted]);

  if (!nudge || nudge.sections.length === 0) return null;

  return (
 <div className="rounded-2xl border border-surface-200
 bg-gradient-to-br from-brand-50/50 to-white dark:from-brand-950/20
      p-4 space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
            {t("nudge.daily_plan")}
          </h3>
        </div>
 <span className="text-[10px] text-surface-400">
          {new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>

      {/* Greeting */}
 <p className="text-xs text-surface-600">
        {nudge.greeting}
      </p>

      {/* Sections */}
      <div className="space-y-2">
        {nudge.sections.slice(0, 4).map((section) => (
          <NudgeSectionRow key={section.type} section={section} />
        ))}
      </div>

      {/* Action */}
      {state.today.focusModule && (
        <button
          onClick={() => router.push(`/modules/${state.today.focusModule!.id}`)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium
            bg-brand-600 text-white hover:bg-brand-700 transition-colors"
        >
          {t("nudge.start_learning")}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function NudgeSectionRow({ section }: { section: NudgeSection }) {
  const Icon = SECTION_ICONS[section.type] || Sparkles;
  const color = SECTION_COLORS[section.type] || "text-surface-500";

  return (
    <div className="flex items-start gap-2.5 py-1">
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
 <p className="text-xs font-medium text-surface-800 leading-tight">
          {section.title}
        </p>
 <p className="text-[11px] text-surface-500 leading-tight mt-0.5">
          {section.message}
        </p>
      </div>
    </div>
  );
}
