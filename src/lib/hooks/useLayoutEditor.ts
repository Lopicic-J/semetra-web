"use client";

import { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { NAV_GROUPS, type NavGroup, type NavItem } from "@/components/sidebar/nav-config";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SidebarGroupOrder {
  labelKey: string;
  itemKeys: string[]; // labelKeys of NavItems in order
}

export interface LayoutPreferences {
  sidebar_order: SidebarGroupOrder[];
  children_order: Record<string, string[]>; // parentLabelKey → child labelKeys in order
  tab_order: Record<string, string[]>;      // parentHref → child hrefs in order
}

interface LayoutEditorState {
  /** Is the editor mode active? */
  editing: boolean;
  /** Toggle editor mode on/off */
  toggleEditing: () => void;
  /** Current layout preferences (merged with defaults) */
  preferences: LayoutPreferences;
  /** Get ordered nav groups respecting user prefs */
  getOrderedGroups: () => NavGroup[];
  /** Get ordered children for a parent item */
  getOrderedChildren: (parentLabelKey: string, defaultChildren: { href: string; labelKey: string }[]) => { href: string; labelKey: string }[];
  /** Reorder sidebar groups */
  reorderGroups: (fromIndex: number, toIndex: number) => void;
  /** Reorder items within a group */
  reorderItems: (groupLabelKey: string, fromIndex: number, toIndex: number) => void;
  /** Reorder children within a parent item */
  reorderChildren: (parentLabelKey: string, fromIndex: number, toIndex: number) => void;
  /** Move a child from one parent to another */
  moveChild: (fromParent: string, toParent: string, childLabelKey: string, toIndex: number) => void;
  /** Reset to default layout */
  resetLayout: () => void;
  /** Whether preferences are loading */
  loading: boolean;
}

// ── Default preferences from nav-config ────────────────────────────────────

function buildDefaults(): LayoutPreferences {
  const sidebar_order: SidebarGroupOrder[] = NAV_GROUPS.map((g) => ({
    labelKey: g.labelKey,
    itemKeys: g.items.map((i) => i.labelKey),
  }));

  const children_order: Record<string, string[]> = {};
  const tab_order: Record<string, string[]> = {};

  NAV_GROUPS.forEach((g) =>
    g.items.forEach((item) => {
      if (item.children?.length) {
        children_order[item.labelKey] = item.children.map((c) => c.labelKey);
        tab_order[item.labelKey] = item.children.map((c) => c.href);
      }
    }),
  );

  return { sidebar_order, children_order, tab_order };
}

// ── Helper: reorder array ──────────────────────────────────────────────────

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}

// ── Context ────────────────────────────────────────────────────────────────

const LayoutEditorContext = createContext<LayoutEditorState | null>(null);

export const LayoutEditorProvider = LayoutEditorContext.Provider;

export function useLayoutEditor(): LayoutEditorState {
  const ctx = useContext(LayoutEditorContext);
  if (!ctx) throw new Error("useLayoutEditor must be used within LayoutEditorProvider");
  return ctx;
}

// ── Hook implementation (used by the provider) ─────────────────────────────

export function useLayoutEditorState(): LayoutEditorState {
  const { profile } = useProfile();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<LayoutPreferences>(buildDefaults);

  // Load from Supabase
  useEffect(() => {
    if (!profile?.id) return;
    const supabase = createClient();

    (async () => {
      const { data } = await supabase
        .from("user_layout_preferences")
        .select("sidebar_order, children_order, tab_order")
        .eq("user_id", profile.id)
        .single();

      if (data) {
        const defaults = buildDefaults();
        setPreferences({
          sidebar_order: (data.sidebar_order as SidebarGroupOrder[])?.length
            ? (data.sidebar_order as SidebarGroupOrder[])
            : defaults.sidebar_order,
          children_order: {
            ...defaults.children_order,
            ...(data.children_order as Record<string, string[]> || {}),
          },
          tab_order: {
            ...defaults.tab_order,
            ...(data.tab_order as Record<string, string[]> || {}),
          },
        });
      }
      setLoading(false);
    })();
  }, [profile?.id]);

  // Save to Supabase (debounced on preferences change)
  const save = useCallback(
    async (prefs: LayoutPreferences) => {
      if (!profile?.id) return;
      const supabase = createClient();
      await supabase.from("user_layout_preferences").upsert(
        {
          user_id: profile.id,
          sidebar_order: prefs.sidebar_order as unknown as Record<string, unknown>[],
          children_order: prefs.children_order,
          tab_order: prefs.tab_order,
        },
        { onConflict: "user_id" },
      );
    },
    [profile?.id],
  );

  // Build a lookup of all items by labelKey for reordering
  const itemsByKey = useMemo(() => {
    const map = new Map<string, NavItem>();
    NAV_GROUPS.forEach((g) => g.items.forEach((i) => map.set(i.labelKey, i)));
    return map;
  }, []);

  const groupsByKey = useMemo(() => {
    const map = new Map<string, NavGroup>();
    NAV_GROUPS.forEach((g) => map.set(g.labelKey, g));
    return map;
  }, []);

  // ── Ordered groups ─────────────────────────────────────────────────────

  const getOrderedGroups = useCallback((): NavGroup[] => {
    const ordered = preferences.sidebar_order.map((so) => {
      const original = groupsByKey.get(so.labelKey);
      if (!original) return null;

      const orderedItems = so.itemKeys
        .map((key) => itemsByKey.get(key))
        .filter(Boolean) as NavItem[];

      // Include items that are in the original but not in the saved order
      const missing = original.items.filter(
        (i) => !so.itemKeys.includes(i.labelKey),
      );

      return {
        ...original,
        items: [...orderedItems, ...missing],
      };
    }).filter(Boolean) as NavGroup[];

    // Append any NAV_GROUPS that aren't in the saved order yet (e.g. newly added groups)
    const savedKeys = new Set(preferences.sidebar_order.map((so) => so.labelKey));
    const newGroups = NAV_GROUPS.filter((g) => !savedKeys.has(g.labelKey));
    return [...ordered, ...newGroups];
  }, [preferences.sidebar_order, groupsByKey, itemsByKey]);

  // ── Ordered children ───────────────────────────────────────────────────

  const getOrderedChildren = useCallback(
    (parentLabelKey: string, defaultChildren: { href: string; labelKey: string }[]) => {
      const order = preferences.children_order[parentLabelKey];
      if (!order?.length) return defaultChildren;

      const childByKey = new Map(defaultChildren.map((c) => [c.labelKey, c]));
      const ordered = order.map((key) => childByKey.get(key)).filter(Boolean) as typeof defaultChildren;
      const missing = defaultChildren.filter((c) => !order.includes(c.labelKey));
      return [...ordered, ...missing];
    },
    [preferences.children_order],
  );

  // ── Mutations ──────────────────────────────────────────────────────────

  const reorderGroups = useCallback(
    (from: number, to: number) => {
      setPreferences((prev) => {
        const next = {
          ...prev,
          sidebar_order: reorder(prev.sidebar_order, from, to),
        };
        save(next);
        return next;
      });
    },
    [save],
  );

  const reorderItems = useCallback(
    (groupLabelKey: string, from: number, to: number) => {
      setPreferences((prev) => {
        const next = {
          ...prev,
          sidebar_order: prev.sidebar_order.map((g) =>
            g.labelKey === groupLabelKey
              ? { ...g, itemKeys: reorder(g.itemKeys, from, to) }
              : g,
          ),
        };
        save(next);
        return next;
      });
    },
    [save],
  );

  const reorderChildren = useCallback(
    (parentLabelKey: string, from: number, to: number) => {
      setPreferences((prev) => {
        const currentOrder =
          prev.children_order[parentLabelKey] ??
          (itemsByKey.get(parentLabelKey)?.children?.map((c) => c.labelKey) || []);

        const next = {
          ...prev,
          children_order: {
            ...prev.children_order,
            [parentLabelKey]: reorder(currentOrder, from, to),
          },
          tab_order: {
            ...prev.tab_order,
            [parentLabelKey]: reorder(
              prev.tab_order[parentLabelKey] ??
                (itemsByKey.get(parentLabelKey)?.children?.map((c) => c.href) || []),
              from,
              to,
            ),
          },
        };
        save(next);
        return next;
      });
    },
    [save, itemsByKey],
  );

  const moveChild = useCallback(
    (fromParent: string, toParent: string, childLabelKey: string, toIndex: number) => {
      setPreferences((prev) => {
        const fromOrder = [...(prev.children_order[fromParent] ?? [])];
        const toOrder = [...(prev.children_order[toParent] ?? [])];
        const idx = fromOrder.indexOf(childLabelKey);
        if (idx > -1) fromOrder.splice(idx, 1);
        toOrder.splice(toIndex, 0, childLabelKey);

        const next = {
          ...prev,
          children_order: {
            ...prev.children_order,
            [fromParent]: fromOrder,
            [toParent]: toOrder,
          },
        };
        save(next);
        return next;
      });
    },
    [save],
  );

  const resetLayout = useCallback(async () => {
    const defaults = buildDefaults();
    setPreferences(defaults);
    await save(defaults);

    // Also clear block_order for all pages
    if (profile?.id) {
      const supabase = createClient();
      await supabase
        .from("user_layout_preferences")
        .update({ block_order: {} })
        .eq("user_id", profile.id);
    }

    // Force page reload so useBlockOrder re-reads defaults
    window.location.reload();
  }, [save, profile?.id]);

  const toggleEditing = useCallback(() => setEditing((p) => !p), []);

  return {
    editing,
    toggleEditing,
    preferences,
    getOrderedGroups,
    getOrderedChildren,
    reorderGroups,
    reorderItems,
    reorderChildren,
    moveChild,
    resetLayout,
    loading,
  };
}
