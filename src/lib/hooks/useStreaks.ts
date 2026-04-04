"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  todayDone: boolean;
  /** last 30 days: date string → total seconds */
  last30Days: Record<string, number>;
  /** total study seconds all time */
  totalSeconds: number;
  /** total distinct study days */
  totalDays: number;
  loading: boolean;
}

const STREAK_THRESHOLD = 15 * 60; // 15 minutes = counts as a study day

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useStreaks(): StreakData {
  const supabase = createClient();
  const [logs, setLogs] = useState<{ started_at: string; duration_seconds: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    // Fetch all time_logs (only started_at + duration_seconds for efficiency)
    const { data } = await supabase
      .from("time_logs")
      .select("started_at, duration_seconds")
      .order("started_at", { ascending: false });
    setLogs(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  // Re-fetch when a time log is saved anywhere in the app
  useEffect(() => {
    const handler = () => fetch();
    window.addEventListener("time-log-updated", handler);
    return () => window.removeEventListener("time-log-updated", handler);
  }, [fetch]);

  return useMemo(() => {
    if (loading || logs.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        todayDone: false,
        last30Days: {},
        totalSeconds: 0,
        totalDays: 0,
        loading,
      };
    }

    // Build day → seconds map
    const dayMap: Record<string, number> = {};
    let totalSeconds = 0;
    for (const log of logs) {
      const ds = dateStr(new Date(log.started_at));
      dayMap[ds] = (dayMap[ds] ?? 0) + (log.duration_seconds ?? 0);
      totalSeconds += log.duration_seconds ?? 0;
    }

    // Study days (above threshold)
    const studyDays = new Set<string>();
    for (const [day, secs] of Object.entries(dayMap)) {
      if (secs >= STREAK_THRESHOLD) studyDays.add(day);
    }

    const today = new Date();
    const todayStr = dateStr(today);
    const todayDone = studyDays.has(todayStr);

    // Calculate current streak (walking backwards from today or yesterday)
    let currentStreak = 0;
    const checkDate = new Date(today);
    // If today has no study time yet, start from yesterday
    if (!todayDone) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (true) {
      const ds = dateStr(checkDate);
      if (studyDays.has(ds)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Calculate longest streak
    const allDaysSorted = Array.from(studyDays).sort();
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;
    for (const ds of allDaysSorted) {
      const d = new Date(ds + "T00:00:00");
      if (prevDate) {
        const diff = Math.round((d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      prevDate = d;
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Last 30 days map
    const last30Days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = dateStr(d);
      last30Days[ds] = dayMap[ds] ?? 0;
    }

    return {
      currentStreak,
      longestStreak,
      todayDone,
      last30Days,
      totalSeconds,
      totalDays: studyDays.size,
      loading,
    };
  }, [logs, loading]);
}
