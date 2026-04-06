"use client";
import { useSupabaseQuery } from "./useSupabaseQuery";
import type { Module } from "@/types/database";

/**
 * Modules mit Realtime-Subscription.
 * Filters out soft-deleted (hidden) institution modules by default.
 */
export function useModules(includeHidden = false) {
  const { data: modules, loading, refetch } = useSupabaseQuery<Module>({
    table: "modules",
    select: "*",
    order: { column: "created_at", ascending: false },
    filter: includeHidden ? undefined : (q) => q.is("hidden_at", null),
    realtime: true,
  });

  return { modules, loading, refetch };
}
