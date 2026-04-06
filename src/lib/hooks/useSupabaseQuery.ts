"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

/**
 * Einheitlicher Hook für Supabase-Queries mit optionalem Realtime.
 *
 * Löst folgende Probleme:
 * - Verschiedene Fetch-Patterns (useModules vs useGrades vs useTasks)
 * - Fehlende Realtime-Subscriptions bei einigen Hooks
 * - Inkonsistentes Error-Handling
 * - Doppelte Supabase-Client-Initialisierung
 *
 * Verwendung:
 *   const { data, loading, error, refetch } = useSupabaseQuery({
 *     table: "modules",
 *     select: "*",
 *     order: { column: "created_at", ascending: false },
 *     realtime: true,
 *   });
 *
 *   // Mit Filter:
 *   const { data } = useSupabaseQuery({
 *     table: "tasks",
 *     select: "*, modules(name, color)",
 *     filter: (q) => q.eq("module_id", moduleId),
 *     order: { column: "due_date", ascending: true, nullsFirst: false },
 *     realtime: true,
 *     enabled: !!moduleId,
 *   });
 */

export interface QueryOrder {
  column: string;
  ascending?: boolean;
  nullsFirst?: boolean;
}

export interface UseSupabaseQueryOptions<T> {
  /** Supabase table name */
  table: string;
  /** Select clause (default: "*") */
  select?: string;
  /** Apply filters to the query */
  filter?: (query: PostgrestFilterBuilder<any, any, any>) => PostgrestFilterBuilder<any, any, any>;
  /** Order by */
  order?: QueryOrder;
  /** Limit results */
  limit?: number;
  /** Enable realtime subscription for this table (default: false) */
  realtime?: boolean;
  /** Only run query when enabled (default: true) */
  enabled?: boolean;
  /** Transform data after fetch */
  transform?: (data: any[]) => T[];
}

export interface UseSupabaseQueryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSupabaseQuery<T = any>(
  options: UseSupabaseQueryOptions<T>,
): UseSupabaseQueryResult<T> {
  const {
    table,
    select = "*",
    filter,
    order,
    limit,
    realtime = false,
    enabled = true,
    transform,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const initialLoadDone = useRef(false);

  // Stabilize references that change on every render (functions, objects)
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const orderRef = useRef(order);
  orderRef.current = order;
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Only show loading skeleton on initial load, not on refetch/realtime updates
    if (!initialLoadDone.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const supabase = createClient();
      let query = supabase.from(table).select(select);

      if (filterRef.current) {
        query = filterRef.current(query);
      }

      if (orderRef.current) {
        query = query.order(orderRef.current.column, {
          ascending: orderRef.current.ascending ?? true,
          nullsFirst: orderRef.current.nullsFirst,
        });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data: result, error: queryError } = await query;

      if (!mountedRef.current) return;

      if (queryError) {
        setError(queryError.message);
        setData([]);
      } else {
        const processed = transformRef.current ? transformRef.current(result ?? []) : (result ?? []) as T[];
        setData(processed);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setData([]);
    } finally {
      if (mountedRef.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, select, limit, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!realtime || !enabled) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`${table}-realtime`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, realtime, enabled]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook für eine einzelne Zeile (z.B. Profil).
 *
 * Verwendung:
 *   const { data: profile, loading } = useSupabaseSingle<Profile>({
 *     table: "profiles",
 *     filter: (q) => q.eq("id", userId),
 *     realtime: true,
 *   });
 */
export interface UseSupabaseSingleResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSupabaseSingle<T = any>(
  options: Omit<UseSupabaseQueryOptions<T>, "transform" | "limit">,
): UseSupabaseSingleResult<T> {
  const {
    table,
    select = "*",
    filter,
    realtime = false,
    enabled = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const initialLoadDone = useRef(false);

  // Stabilize filter reference
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (!initialLoadDone.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const supabase = createClient();
      let query = supabase.from(table).select(select);
      if (filterRef.current) query = filterRef.current(query);

      const { data: result, error: queryError } = await query.single();

      if (!mountedRef.current) return;

      if (queryError) {
        setError(queryError.message);
        setData(null);
      } else {
        setData(result as T);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setData(null);
    } finally {
      if (mountedRef.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, select, enabled]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!realtime || !enabled) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`${table}-single-realtime`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, realtime, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook für Mutations (POST/PATCH/DELETE) via api-client.
 * Kombiniert api-client Retry-Logik mit Hook-basiertem State.
 *
 * Verwendung:
 *   const { mutate, loading } = useApiMutation<Grade>("/api/grades");
 *   await mutate({ name: "...", grade: 5.5 }); // POST
 *   await mutate({ id: "...", grade: 6.0 }, "PATCH");
 *   await mutate({ id: "..." }, "DELETE");
 */
export interface UseApiMutationResult<T> {
  mutate: (body?: unknown, method?: "POST" | "PATCH" | "DELETE") => Promise<{ data: T | null; error: string | null }>;
  loading: boolean;
}

export function useApiMutation<T = any>(
  url: string,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
    successMessage?: string;
  },
): UseApiMutationResult<T> {
  const [loading, setLoading] = useState(false);

  // Stabilize options reference
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutate = useCallback(
    async (body?: unknown, method: "POST" | "PATCH" | "DELETE" = "POST") => {
      setLoading(true);
      try {
        const { api } = await import("@/lib/api-client");
        const fn = method === "POST" ? api.post<T> : method === "PATCH" ? api.patch<T> : api.del<T>;
        const result = await fn(url, body, {
          successMessage: optionsRef.current?.successMessage,
          showSuccessToast: !!optionsRef.current?.successMessage,
        });

        if (result.data && optionsRef.current?.onSuccess) {
          optionsRef.current.onSuccess(result.data);
        }
        if (result.error && optionsRef.current?.onError) {
          optionsRef.current.onError(result.error);
        }

        return { data: result.data, error: result.error };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Fehler";
        optionsRef.current?.onError?.(msg);
        return { data: null, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [url],
  );

  return { mutate, loading };
}
