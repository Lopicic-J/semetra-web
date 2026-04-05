"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Grade } from "@/types/database";

export function useGrades() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrated, setMigrated] = useState(false);
  const supabase = createClient();
  const migrationTriggered = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("grades")
      .select("*, modules(name, color)")
      .order("date", { ascending: false });
    setGrades(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Trigger lazy migration of existing grades to the Academic Engine.
   * Safe to call multiple times — already-synced grades are skipped.
   * Returns { migrated, errors } count.
   */
  const triggerMigration = useCallback(async () => {
    if (migrationTriggered.current) return { migrated: 0, errors: 0 };
    migrationTriggered.current = true;

    try {
      const res = await fetch("/api/grades/migrate", { method: "POST" });
      if (!res.ok) return { migrated: 0, errors: 1 };
      const data = await res.json();
      setMigrated(true);
      return { migrated: data.migrated || 0, errors: data.errors || 0 };
    } catch {
      return { migrated: 0, errors: 1 };
    }
  }, []);

  /**
   * Create a grade via API (with dual-write to Academic Engine).
   */
  const createGrade = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      await load(); // refresh list
      return data;
    },
    [load]
  );

  /**
   * Update a grade via API (with dual-write to Academic Engine).
   */
  const updateGrade = useCallback(
    async (id: string, payload: Record<string, unknown>) => {
      const res = await fetch("/api/grades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      await load();
      return data;
    },
    [load]
  );

  /**
   * Delete a grade via API (with engine cleanup).
   */
  const deleteGrade = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/grades?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await load();
    },
    [load]
  );

  return {
    grades,
    loading,
    migrated,
    refetch: load,
    createGrade,
    updateGrade,
    deleteGrade,
    triggerMigration,
  };
}
