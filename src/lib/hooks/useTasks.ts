"use client";
import { useMemo } from "react";
import { useSupabaseQuery } from "./useSupabaseQuery";
import type { Task } from "@/types/database";

/**
 * Tasks mit Realtime-Subscription und optionalem Modul-Filter.
 * Migriert auf einheitlichen useSupabaseQuery-Hook.
 */
export function useTasks(moduleId?: string) {
  const filter = useMemo(() => {
    if (!moduleId) return undefined;
    return (q: any) => q.eq("module_id", moduleId);
  }, [moduleId]);

  const { data: tasks, loading, refetch } = useSupabaseQuery<Task>({
    table: "tasks",
    select: "*, modules(name, color)",
    filter,
    order: { column: "due_date", ascending: true, nullsFirst: false },
    realtime: true,
  });

  return { tasks, loading, refetch };
}
