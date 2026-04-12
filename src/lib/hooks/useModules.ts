"use client";
import { useSupabaseQuery } from "./useSupabaseQuery";
import type { Module } from "@/types/database";

/**
 * Modules mit Realtime-Subscription.
 *
 * Loads ONLY the authenticated user's own modules (RLS enforced).
 * Template modules (user_id=NULL) are NOT returned — they are only
 * accessible server-side via the Academic Builder API routes.
 *
 * Filters out soft-deleted (hidden) institution modules by default.
 */
export function useModules(includeHidden = false) {
  const { data: modules, loading, refetch } = useSupabaseQuery<Module>({
    table: "modules",
    select: "*",
    order: { column: "created_at", ascending: false },
    filter: includeHidden
      ? undefined
      : (q) => q.is("hidden_at", null),
    realtime: true,
  });

  return { modules, loading, refetch };
}
