"use client";
import { useState, useCallback, useRef } from "react";
import { useSupabaseQuery, useApiMutation } from "./useSupabaseQuery";
import type { Grade } from "@/types/database";

/**
 * Grades mit Realtime-Subscription + CRUD via api-client.
 * Migriert auf einheitlichen useSupabaseQuery-Hook.
 *
 * Reads: Supabase Realtime (sofortige Updates)
 * Writes: API-Routes (für Dual-Write Academic Engine)
 */
export function useGrades() {
  const { data: grades, loading, refetch } = useSupabaseQuery<Grade>({
    table: "grades",
    select: "*, modules(name, color)",
    order: { column: "date", ascending: false },
    realtime: true,
  });

  const [migrated, setMigrated] = useState(false);
  const migrationTriggered = useRef(false);

  const { mutate: createMutate, loading: creating } = useApiMutation<Grade>("/api/grades", {
    onSuccess: () => refetch(),
    successMessage: "Note gespeichert",
  });

  const createGrade = useCallback(
    async (payload: Record<string, unknown>) => {
      const result = await createMutate(payload, "POST");
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    [createMutate],
  );

  const updateGrade = useCallback(
    async (id: string, payload: Record<string, unknown>) => {
      const { api } = await import("@/lib/api-client");
      const result = await api.patch("/api/grades", { id, ...payload });
      if (result.error) throw new Error(result.error);
      await refetch();
      return result.data;
    },
    [refetch],
  );

  const deleteGrade = useCallback(
    async (id: string) => {
      const { api } = await import("@/lib/api-client");
      const result = await api.del(`/api/grades?id=${id}`);
      if (result.error) throw new Error(result.error);
      await refetch();
    },
    [refetch],
  );

  const triggerMigration = useCallback(async () => {
    if (migrationTriggered.current) return { migrated: 0, errors: 0 };
    migrationTriggered.current = true;
    try {
      const { api } = await import("@/lib/api-client");
      const result = await api.post<{ migrated: number; errors: number }>("/api/grades/migrate", undefined, {
        showErrorToast: false,
      });
      if (result.data) {
        setMigrated(true);
        return { migrated: result.data.migrated || 0, errors: result.data.errors || 0 };
      }
      return { migrated: 0, errors: 1 };
    } catch {
      return { migrated: 0, errors: 1 };
    }
  }, []);

  return {
    grades,
    loading,
    creating,
    migrated,
    refetch,
    createGrade,
    updateGrade,
    deleteGrade,
    triggerMigration,
  };
}
