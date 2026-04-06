"use client";
import { useState, useCallback } from "react";
import type { RescheduleProposal } from "@/lib/schedule";

interface MissedBlock {
  block: any;
  trigger: string;
}

interface RescheduleState {
  missedBlocks: MissedBlock[];
  proposals: RescheduleProposal[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook for auto-reschedule functionality.
 * Provides detection, proposals, and application of reschedules.
 */
export function useAutoReschedule(date?: string) {
  const [state, setState] = useState<RescheduleState>({
    missedBlocks: [],
    proposals: [],
    loading: false,
    error: null,
  });

  const targetDate = date || new Date().toISOString().slice(0, 10);

  /** Detect blocks that need rescheduling */
  const detectMissed = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/schedule/reschedule?date=${targetDate}`);
      if (!res.ok) throw new Error("Fehler bei der Erkennung");
      const data = await res.json();
      setState(s => ({
        ...s,
        missedBlocks: data.blocksNeedingReschedule || [],
        loading: false,
      }));
      return data.count || 0;
    } catch (err) {
      setState(s => ({
        ...s, loading: false,
        error: err instanceof Error ? err.message : "Fehler",
      }));
      return 0;
    }
  }, [targetDate]);

  /** Get optimization proposals for the day */
  const getOptimizationProposals = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/schedule/reschedule?view=optimize&date=${targetDate}`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setState(s => ({ ...s, proposals: data.proposals || [], loading: false }));
      return data.proposals || [];
    } catch (err) {
      setState(s => ({
        ...s, loading: false,
        error: err instanceof Error ? err.message : "Fehler",
      }));
      return [];
    }
  }, [targetDate]);

  /** Auto-reschedule all missed blocks */
  const autoReschedule = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/schedule/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto", date: targetDate }),
      });
      if (!res.ok) throw new Error("Fehler beim Umplanen");
      const data = await res.json();
      setState(s => ({ ...s, missedBlocks: [], loading: false }));
      return data;
    } catch (err) {
      setState(s => ({
        ...s, loading: false,
        error: err instanceof Error ? err.message : "Fehler",
      }));
      return null;
    }
  }, [targetDate]);

  /** Apply specific proposals */
  const applyProposals = useCallback(async (proposals: RescheduleProposal[]) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/schedule/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", proposals }),
      });
      if (!res.ok) throw new Error("Fehler beim Anwenden");
      const data = await res.json();
      setState(s => ({ ...s, proposals: [], loading: false }));
      return data;
    } catch (err) {
      setState(s => ({
        ...s, loading: false,
        error: err instanceof Error ? err.message : "Fehler",
      }));
      return null;
    }
  }, []);

  /** Optimize day schedule */
  const optimizeDay = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/schedule/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "optimize", date: targetDate }),
      });
      if (!res.ok) throw new Error("Fehler bei der Optimierung");
      return await res.json();
    } catch (err) {
      setState(s => ({
        ...s, loading: false,
        error: err instanceof Error ? err.message : "Fehler",
      }));
      return null;
    } finally {
      setState(s => ({ ...s, loading: false }));
    }
  }, [targetDate]);

  /** Manual reschedule of a specific block */
  const manualReschedule = useCallback(async (
    blockId: string, newStart: string, newEnd: string, reason?: string,
  ) => {
    const res = await fetch("/api/schedule/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "manual", blockId, newStart, newEnd, reason }),
    });
    if (!res.ok) throw new Error("Fehler beim Umplanen");
    return res.json();
  }, []);

  return {
    ...state,
    detectMissed,
    getOptimizationProposals,
    autoReschedule,
    applyProposals,
    optimizeDay,
    manualReschedule,
  };
}

/**
 * Hook for reschedule history log.
 */
export function useRescheduleLog(limit: number = 20) {
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule/reschedule?view=log&limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setLog(data || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [limit]);

  useState(() => { fetchLog(); });

  return { log, loading, refetch: fetchLog };
}
