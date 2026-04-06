"use client";
import { useState, useEffect, useCallback } from "react";
import type { WeeklyReview } from "@/lib/schedule";

interface ReviewListItem {
  id: string;
  week_start: string;
  week_end: string;
  overall_adherence: number;
  sessions_completed: number;
  total_effective_minutes: number;
  is_read: boolean;
  mood_rating: number | null;
  created_at: string;
}

/**
 * Hook for weekly review functionality.
 */
export function useWeeklyReview(weekStart?: string) {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const param = weekStart ? `?week=${weekStart}` : "";
      const res = await fetch(`/api/schedule/review${param}`);
      if (!res.ok) throw new Error("Fehler beim Laden des Reviews");
      const data = await res.json();
      setReview(data._computed || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  const generateReview = useCallback(async (week?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", week: week || weekStart }),
      });
      if (!res.ok) throw new Error("Fehler beim Generieren");
      const data = await res.json();
      setReview(data._computed || data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      return null;
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  const updateReflection = useCallback(async (
    reviewId: string,
    updates: { user_reflection?: string; mood_rating?: number; is_read?: boolean },
  ) => {
    const res = await fetch("/api/schedule/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reviewId, ...updates }),
    });
    if (!res.ok) throw new Error("Fehler beim Speichern");
    return res.json();
  }, []);

  return { review, loading, error, fetchReview, generateReview, updateReflection };
}

/**
 * Hook for the review list (sidebar/overview).
 */
export function useReviewList() {
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/schedule/review?list=true")
      .then(res => res.json())
      .then(data => setReviews(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { reviews, loading };
}
