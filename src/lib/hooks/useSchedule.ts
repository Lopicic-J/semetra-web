"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSupabaseQuery } from "./useSupabaseQuery";
import type {
  ScheduleBlock, TimerSession, ScheduleDay, ScheduleWeek, FreeSlot,
  SchedulePreferences, ModuleScheduleStats, DailyBudget,
} from "@/lib/schedule";
import {
  buildScheduleDay, buildScheduleWeek, findFreeSlots,
  computeModuleScheduleStats, computeDailyBudget,
  expandRecurringBlocks, detectConflicts, DEFAULT_PREFERENCES,
} from "@/lib/schedule";
import type { PlanVsReality, ScheduleConflict } from "@/lib/schedule";
import { computePlanVsReality } from "@/lib/schedule";

// ── useSchedulePreferences ──────────────────────────────────────────────────

export function useSchedulePreferences() {
  const [preferences, setPreferences] = useState<SchedulePreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/schedule/preferences")
      .then(res => res.json())
      .then(data => {
        setPreferences(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const updatePreferences = useCallback(async (updates: Partial<SchedulePreferences>) => {
    const res = await fetch("/api/schedule/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      setPreferences(data);
      return data;
    }
    throw new Error("Einstellungen konnten nicht gespeichert werden");
  }, []);

  return { preferences, loading, updatePreferences };
}

// ── useScheduleDay ──────────────────────────────────────────────────────────

export function useScheduleDay(date: string) {
  const { data: blocks, loading: blocksLoading, refetch: refetchBlocks } = useSupabaseQuery<ScheduleBlock>({
    table: "schedule_blocks",
    select: "*, module:modules(name, color, code)",
    filter: (q) => q
      .gte("start_time", `${date}T00:00:00`)
      .lte("start_time", `${date}T23:59:59`),
    order: { column: "start_time", ascending: true },
    realtime: true,
  });

  const { data: sessions, loading: sessionsLoading, refetch: refetchSessions } = useSupabaseQuery<TimerSession>({
    table: "timer_sessions",
    select: "*, module:modules(name, color), schedule_block:schedule_blocks(title, block_type)",
    filter: (q) => q
      .gte("started_at", `${date}T00:00:00`)
      .lte("started_at", `${date}T23:59:59`),
    order: { column: "started_at", ascending: true },
    realtime: true,
  });

  const { preferences } = useSchedulePreferences();

  const scheduleDay = useMemo<ScheduleDay | null>(() => {
    if (blocksLoading || sessionsLoading) return null;
    const expanded = expandRecurringBlocks(blocks, date, date);
    return buildScheduleDay(expanded, sessions, preferences, date);
  }, [blocks, sessions, preferences, date, blocksLoading, sessionsLoading]);

  const freeSlots = useMemo<FreeSlot[]>(() => {
    if (!scheduleDay) return [];
    return scheduleDay.freeSlots;
  }, [scheduleDay]);

  const planVsReality = useMemo<PlanVsReality[]>(() => {
    if (blocksLoading || sessionsLoading) return [];
    return computePlanVsReality(blocks, sessions, date);
  }, [blocks, sessions, date, blocksLoading, sessionsLoading]);

  const conflicts = useMemo<ScheduleConflict[]>(() => {
    if (blocksLoading) return [];
    return detectConflicts(blocks);
  }, [blocks, blocksLoading]);

  const budget = useMemo<DailyBudget | null>(() => {
    if (blocksLoading || sessionsLoading) return null;
    return computeDailyBudget(blocks, sessions, preferences, date);
  }, [blocks, sessions, preferences, date, blocksLoading, sessionsLoading]);

  const refetch = useCallback(() => {
    refetchBlocks();
    refetchSessions();
  }, [refetchBlocks, refetchSessions]);

  return {
    scheduleDay,
    blocks,
    sessions,
    freeSlots,
    planVsReality,
    conflicts,
    budget,
    loading: blocksLoading || sessionsLoading,
    refetch,
  };
}

// ── useScheduleWeek ─────────────────────────────────────────────────────────

export function useScheduleWeek(weekStart: string) {
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }, [weekStart]);

  const { data: blocks, loading: blocksLoading, refetch: refetchBlocks } = useSupabaseQuery<ScheduleBlock>({
    table: "schedule_blocks",
    select: "*, module:modules(name, color, code)",
    filter: (q) => q
      .gte("start_time", `${weekStart}T00:00:00`)
      .lte("start_time", `${weekEnd}T23:59:59`),
    order: { column: "start_time", ascending: true },
  });

  const { data: sessions, loading: sessionsLoading, refetch: refetchSessions } = useSupabaseQuery<TimerSession>({
    table: "timer_sessions",
    select: "*, module:modules(name, color)",
    filter: (q) => q
      .gte("started_at", `${weekStart}T00:00:00`)
      .lte("started_at", `${weekEnd}T23:59:59`),
    order: { column: "started_at", ascending: true },
  });

  const { preferences } = useSchedulePreferences();

  const scheduleWeek = useMemo<ScheduleWeek | null>(() => {
    if (blocksLoading || sessionsLoading) return null;
    const expanded = expandRecurringBlocks(blocks, weekStart, weekEnd);
    return buildScheduleWeek(expanded, sessions, preferences, weekStart);
  }, [blocks, sessions, preferences, weekStart, weekEnd, blocksLoading, sessionsLoading]);

  const refetch = useCallback(() => {
    refetchBlocks();
    refetchSessions();
  }, [refetchBlocks, refetchSessions]);

  return { scheduleWeek, blocks, sessions, loading: blocksLoading || sessionsLoading, refetch };
}

// ── useModuleSchedule ───────────────────────────────────────────────────────

export function useModuleSchedule(weekStart: string) {
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }, [weekStart]);

  const { data: blocks } = useSupabaseQuery<ScheduleBlock>({
    table: "schedule_blocks",
    select: "*, module:modules(name, color, code)",
    filter: (q) => q
      .gte("start_time", `${weekStart}T00:00:00`)
      .lte("start_time", `${weekEnd}T23:59:59`),
    order: { column: "start_time", ascending: true },
  });

  const { data: sessions } = useSupabaseQuery<TimerSession>({
    table: "timer_sessions",
    select: "*, module:modules(name, color)",
    filter: (q) => q
      .gte("started_at", `${weekStart}T00:00:00`)
      .lte("started_at", `${weekEnd}T23:59:59`),
  });

  const { data: modules } = useSupabaseQuery<{ id: string; name: string; color: string; exam_date: string | null }>({
    table: "modules",
    select: "id, name, color, exam_date",
    filter: (q) => q.eq("status", "active"),
  });

  const moduleStats = useMemo<ModuleScheduleStats[]>(() => {
    return computeModuleScheduleStats(blocks, sessions, modules, weekStart);
  }, [blocks, sessions, modules, weekStart]);

  return { moduleStats };
}

// ── Schedule Block CRUD ─────────────────────────────────────────────────────

export function useScheduleActions() {
  const [loading, setLoading] = useState(false);

  const createBlock = useCallback(async (block: Partial<ScheduleBlock>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(block),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return await res.json();
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBlock = useCallback(async (id: string, updates: Partial<ScheduleBlock>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return await res.json();
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteBlock = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    } finally {
      setLoading(false);
    }
  }, []);

  const skipBlock = useCallback(async (id: string) => {
    return updateBlock(id, { status: "skipped" } as Partial<ScheduleBlock>);
  }, [updateBlock]);

  const rescheduleBlock = useCallback(async (
    id: string,
    newStartTime: string,
    newEndTime: string,
    reason?: string,
  ) => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: "rescheduled",
          new_start_time: newStartTime,
          new_end_time: newEndTime,
          reschedule_reason: reason,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return await res.json();
    } finally {
      setLoading(false);
    }
  }, []);

  const importStundenplan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return await res.json();
    } finally {
      setLoading(false);
    }
  }, []);

  const autoPlan = useCallback(async (date?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto-plan", date }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return await res.json();
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    createBlock, updateBlock, deleteBlock,
    skipBlock, rescheduleBlock,
    importStundenplan, autoPlan,
  };
}
