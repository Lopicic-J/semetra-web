"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TimeLog } from "@/types/database";

/**
 * Extended time log with rich data from timer_sessions.
 * Falls back to basic time_logs if timer_sessions doesn't match.
 */
export interface EnrichedTimeLog extends TimeLog {
  session_type?: string | null;
  focus_rating?: number | null;
  energy_level?: number | null;
  pause_count?: number | null;
  total_pause_seconds?: number | null;
  effective_seconds?: number | null;
  alignment?: string | null;
  schedule_block_id?: string | null;
}

export function useTimeLogs(options?: { enriched?: boolean; moduleId?: string; limit?: number }) {
  const [logs, setLogs] = useState<EnrichedTimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const enriched = options?.enriched ?? true;
  const limit = options?.limit ?? 200;

  const fetch = useCallback(async () => {
    setLoading(true);

    if (enriched) {
      // Prefer timer_sessions for richer data
      let query = supabase
        .from("timer_sessions")
        .select("id, user_id, module_id, started_at, ended_at, actual_duration_seconds, effective_seconds, note, session_type, focus_rating, energy_level, pause_count, total_pause_seconds, alignment, schedule_block_id, status, modules(name, color)")
        .in("status", ["completed"])
        .order("started_at", { ascending: false })
        .limit(limit);

      if (options?.moduleId) query = query.eq("module_id", options.moduleId);

      const { data: sessions, error } = await query;

      if (!error && sessions && sessions.length > 0) {
        // Map timer_sessions to EnrichedTimeLog shape
        const enrichedLogs: EnrichedTimeLog[] = sessions.map((s: Record<string, unknown>) => ({
          id: s.id as string,
          user_id: s.user_id as string,
          module_id: (s.module_id as string) ?? null,
          exam_id: null,
          topic_id: null,
          task_id: null,
          duration_seconds: (s.effective_seconds as number) ?? (s.actual_duration_seconds as number) ?? 0,
          started_at: s.started_at as string,
          note: (s.note as string) ?? null,
          created_at: s.started_at as string,
          module: s.modules as TimeLog["module"],
          // Enriched fields
          session_type: s.session_type as string | null,
          focus_rating: s.focus_rating as number | null,
          energy_level: s.energy_level as number | null,
          pause_count: s.pause_count as number | null,
          total_pause_seconds: s.total_pause_seconds as number | null,
          effective_seconds: s.effective_seconds as number | null,
          alignment: s.alignment as string | null,
          schedule_block_id: s.schedule_block_id as string | null,
        }));
        setLogs(enrichedLogs);
        setLoading(false);
        return;
      }
    }

    // Fallback to basic time_logs
    let fallback = supabase
      .from("time_logs")
      .select("*, modules(name, color)")
      .order("started_at", { ascending: false })
      .limit(limit);

    if (options?.moduleId) fallback = fallback.eq("module_id", options.moduleId);

    const { data } = await fallback;
    setLogs(data ?? []);
    setLoading(false);
  }, [supabase, enriched, limit, options?.moduleId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { logs, loading, refetch: fetch };
}
