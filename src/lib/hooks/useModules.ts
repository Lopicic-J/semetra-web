"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Module } from "@/types/database";

export function useModules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("modules")
      .select("*")
      .order("created_at", { ascending: false });
    setModules(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel("modules")
      .on("postgres_changes", { event: "*", schema: "public", table: "modules" }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetch, supabase]);

  return { modules, loading, refetch: fetch };
}
