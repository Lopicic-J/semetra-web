"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/types/database";

export function useTasks(moduleId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("tasks").select("*, modules(name, color)").order("due_date", { ascending: true, nullsFirst: false });
    if (moduleId) q = q.eq("module_id", moduleId);
    const { data } = await q;
    setTasks(data ?? []);
    setLoading(false);
  }, [supabase, moduleId]);

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel("tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetch, supabase]);

  return { tasks, loading, refetch: fetch };
}
