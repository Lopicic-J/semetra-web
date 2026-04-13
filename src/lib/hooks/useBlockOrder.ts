"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { useLayoutEditor } from "@/lib/hooks/useLayoutEditor";

/**
 * useBlockOrder — manages per-page block ordering and visibility.
 * Blocks are identified by string IDs. The hook returns the ordered IDs,
 * hidden set, a reorder function, and toggle visibility.
 */
export function useBlockOrder(defaultOrder: string[]) {
  const pathname = usePathname();
  const { profile } = useProfile();
  const { editing } = useLayoutEditor();
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [hiddenBlocks, setHiddenBlocks] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Load from Supabase
  useEffect(() => {
    if (!profile?.id) return;
    const supabase = createClient();

    (async () => {
      const { data } = await supabase
        .from("user_layout_preferences")
        .select("block_order, hidden_blocks")
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
      if (data?.hidden_blocks) {
        const pageHidden = (data.hidden_blocks as Record<string, string[]>)?.[pathname];
        if (pageHidden?.length) {
          setHiddenBlocks(new Set(pageHidden));
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

  // Save hidden blocks to Supabase
  const saveHidden = useCallback(
    async (newHidden: Set<string>) => {
      if (!profile?.id) return;
      const supabase = createClient();

      const { data } = await supabase
        .from("user_layout_preferences")
        .select("hidden_blocks")
        .eq("user_id", profile.id)
        .single();

      const current = (data?.hidden_blocks as Record<string, string[]>) ?? {};
      const updated = { ...current, [pathname]: Array.from(newHidden) };

      await supabase.from("user_layout_preferences").upsert(
        {
          user_id: profile.id,
          hidden_blocks: updated,
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

  const toggleBlock = useCallback(
    (blockId: string) => {
      setHiddenBlocks((prev) => {
        const next = new Set(prev);
        if (next.has(blockId)) {
          next.delete(blockId);
        } else {
          next.add(blockId);
        }
        saveHidden(next);
        return next;
      });
    },
    [saveHidden],
  );

  const reset = useCallback(() => {
    setOrder(defaultOrder);
    setHiddenBlocks(new Set());
    save(defaultOrder);
    saveHidden(new Set());
  }, [defaultOrder, save, saveHidden]);

  return { order, reorder, reset, editing, loaded, hiddenBlocks, toggleBlock };
}
