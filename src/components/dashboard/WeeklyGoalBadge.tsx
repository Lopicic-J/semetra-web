"use client";

import { useState, useEffect, memo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Target } from "lucide-react";

/**
 * Compact weekly study goal badge for the dashboard.
 * Shows current week's study time vs. target from onboarding.
 */
function WeeklyGoalBadge() {
  const [data, setData] = useState<{ current: number; target: number } | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get target from onboarding
      const { data: onboarding } = await supabase
        .from("onboarding_responses")
        .select("weekly_study_target_hours")
        .eq("user_id", user.id)
        .single();

      const targetHours = onboarding?.weekly_study_target_hours ?? 10;

      // Get this week's study time
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);

      const { data: logs } = await supabase
        .from("time_logs")
        .select("duration_seconds")
        .eq("user_id", user.id)
        .gte("started_at", monday.toISOString());

      const currentMinutes = (logs ?? []).reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / 60;
      const currentHours = Math.round(currentMinutes / 60 * 10) / 10;

      setData({ current: currentHours, target: targetHours });
    }

    load();
  }, []);

  if (!data || data.target <= 0) return null;

  const progress = Math.min(100, Math.round((data.current / data.target) * 100));
  const isComplete = progress >= 100;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs ${
      isComplete
        ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600"
        : "bg-surface-100 dark:bg-surface-800 text-surface-500"
    }`}>
      <Target size={13} className={isComplete ? "text-emerald-500" : "text-surface-400"} />
      <div className="flex items-center gap-1.5">
        <span className="font-semibold">{data.current}h</span>
        <span className="text-surface-400">/ {data.target}h</span>
      </div>
      <div className="w-12 h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-brand-500"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default memo(WeeklyGoalBadge);
