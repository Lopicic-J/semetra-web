"use client";
import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExamRisk {
  level: "critical" | "high" | "medium" | "low" | "none";
  score: number;
  readiness: number;
  trend: "improving" | "stable" | "worsening";
}

export interface ExamPrediction {
  grade: number;
  best: number;
  worst: number;
  confidence: number;
  pass_prob: number;
}

export interface ExamIntelligenceItem {
  event_id: string;
  title: string;
  date: string;
  module_id: string | null;
  module_name: string | null;
  module_color: string | null;
  exam_format: string;
  difficulty: number;
  days_until: number;
  risk: ExamRisk | null;
  prediction: ExamPrediction | null;
}

export interface PredictionAccuracy {
  total_predictions: number;
  with_outcome: number;
  avg_error: number | null;
  calibration_rate: number | null;
}

export interface ExamRecommendation {
  id: string;
  event_id: string;
  module_id: string | null;
  type: string;
  urgency: string;
  title: string;
  message: string;
  days_before_exam: number;
  readiness_at_creation: number;
  status: string;
  created_at: string;
}

export interface ExamIntelligenceData {
  exams: ExamIntelligenceItem[];
  accuracy: PredictionAccuracy;
  recommendations: ExamRecommendation[];
  generated_at: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useExamIntelligence() {
  const [data, setData] = useState<ExamIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/exam-intelligence");
      if (!res.ok) throw new Error("Laden fehlgeschlagen");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/exam-intelligence", { method: "POST" });
      if (!res.ok) throw new Error("Aktualisierung fehlgeschlagen");
      // Reload fresh data after refresh
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const recordOutcome = useCallback(async (eventId: string, actualGrade: number, passed: boolean) => {
    const res = await fetch("/api/exam-intelligence", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, actual_grade: actualGrade, passed }),
    });
    if (!res.ok) throw new Error("Aktualisierung fehlgeschlagen");
    await load();
  }, [load]);

  const dismissRecommendation = useCallback(async (id: string) => {
    // Direct supabase update would need client; use a simple fetch approach
    // For now we optimistically remove from local state
    setData((prev) => prev ? {
      ...prev,
      recommendations: prev.recommendations.filter((r) => r.id !== id),
    } : prev);
  }, []);

  return { data, loading, refreshing, error, refresh, recordOutcome, dismissRecommendation, refetch: load };
}
