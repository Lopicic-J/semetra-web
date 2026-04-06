"use client";
import { useState, useEffect, useCallback } from "react";
import type {
  StudyPatterns, PatternInsight,
} from "@/lib/schedule";

/**
 * Hook for study pattern analysis.
 * Loads learned patterns and insights from the patterns API.
 */
export function useStudyPatterns(days: number = 30) {
  const [patterns, setPatterns] = useState<StudyPatterns | null>(null);
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/schedule/patterns?days=${days}`);
      if (!res.ok) throw new Error("Fehler beim Laden der Muster");
      const data = await res.json();
      setPatterns(data);

      // Also fetch insights
      const insightsRes = await fetch(`/api/schedule/patterns?view=insights&days=${days}`);
      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        setInsights(insightsData.insights || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  const refreshPatterns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      if (!res.ok) throw new Error("Fehler beim Aktualisieren");
      const data = await res.json();
      setPatterns(data.patterns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  return { patterns, insights, loading, error, refetch: fetchPatterns, refreshPatterns };
}

/**
 * Hook for hourly study distribution only.
 * Lightweight version for heatmap/visualization components.
 */
export function useHourlyPatterns(days: number = 30) {
  const [data, setData] = useState<{
    bestHours: StudyPatterns["bestHours"];
    worstHours: StudyPatterns["worstHours"];
    allHours: StudyPatterns["allHours"];
    energyCurve: StudyPatterns["energyCurve"];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/schedule/patterns?view=hours&days=${days}`)
      .then(res => res.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  return { data, loading };
}
