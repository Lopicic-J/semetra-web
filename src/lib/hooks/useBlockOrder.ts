"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { useLayoutEditor } from "@/lib/hooks/useLayoutEditor";

/**
 * useBlockOrder — manages per-page block ordering.
 * Blocks are identified by string IDs. The hook returns the ordered IDs
 * and a reorder function.
 */
export function useBlockOrder(defaultOrder: string[]) {
  const pathname = usePathname();
  const { profile } = useProfile();
  const { editing } = useLayoutEditor();
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [loaded, setLoaded] = useState(false);

  // Load from Supabase
  useEffect(() => {
    if (!profile?.id) return;
    const supabase = createClient();

    (async () => {
      const { data } = await supabase
        .from("user_layout_preferences")
        .select("block_order")
        .eq("user_id", profile.id)
        .single();

      if (data?.block_order) {
        const pageOrder = (data.block_order as Record<string, string[]>)[pathname];
        if (pageOrder?.length) {
          // Merge: use saved order but include any new blocks from defaults
          const savedSet = new Set(pageOrder);
          const missing = defaultOrder.filter((id) => !savedSet.has(id));
          setOrder([...pageOrder.filter((id) => defaultOrder.includes(id)), ...missing]);
        }
      }
      setLoaded(true);
    })();
  }, [profile?.id, pathname, defaultOrder]);

  // Save to Supabase
  const save = useCallback(
    async (newOrder: string[]) => {
      if (!profile?.id) return;
      const supabase = createClient();

      // First read current block_order, then merge
      const { data } = await supabase
        .from("user_layout_preferences")
        .select("block_order")
        .eq("user_id", profile.id)
        .single();

      const current = (data?.block_order as Record<string, string[]>) ?? {};
      const updated = { ...current, [pathname]: newOrder };

      await supabase.from("user_layout_preferences").upsert(
        {
          user_id: profile.id,
          block_order: updated,
        },
        { onConflict: "user_id" },
      );
    },
    [profile?.id, pathname],
  );

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setOrder((prev) => {
        const result = [...prev];
        const [moved] = result.splice(fromIndex, 1);
        result.splice(toIndex, 0, moved);
        save(result);
        return result;
      });
    },
    [save],
  );

  const reset = useCallback(() => {
    setOrder(defaultOrder);
    save(defaultOrder);
  }, [defaultOrder, save]);

  return { order, reorder, reset, editing, loaded };
}
