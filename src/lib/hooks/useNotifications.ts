"use client";
/**
 * useNotifications — Persistent Notification Center Hook
 *
 * Fetches, caches, and manages user notifications.
 * Integrates with Supabase Realtime for live updates.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ──────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  priority: "critical" | "high" | "normal" | "low";
  title: string;
  message: string;
  module_id?: string | null;
  module_name?: string | null;
  module_color?: string | null;
  action_label?: string | null;
  action_href?: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
}

// ─── Hook ───────────────────────────────────────────────────────

export function useNotifications() {
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    loading: true,
    hasMore: false,
  });
  const mountedRef = useRef(true);
  const supabase = createClient();

  // Fetch notifications
  const fetchNotifications = useCallback(async (offset = 0, append = false) => {
    try {
      const res = await fetch(`/api/notifications?limit=30&offset=${offset}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!mountedRef.current) return;

      setState((prev) => ({
        notifications: append
          ? [...prev.notifications, ...data.notifications]
          : data.notifications,
        unreadCount: data.unreadCount,
        loading: false,
        hasMore: data.hasMore,
      }));
    } catch {
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }
  }, []);

  // Mark single/multiple as read
  const markRead = useCallback(async (ids: string[]) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        ids.includes(n.id) ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, prev.unreadCount - ids.filter((id) =>
        prev.notifications.find((n) => n.id === id && !n.is_read)
      ).length),
    }));

    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", ids }),
    });
  }, []);

  // Mark all as read
  const markAllRead = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));

    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
  }, []);

  // Dismiss single notification
  const dismiss = useCallback(async (ids: string[]) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.filter((n) => !ids.includes(n.id)),
      unreadCount: Math.max(0, prev.unreadCount - ids.filter((id) =>
        prev.notifications.find((n) => n.id === id && !n.is_read)
      ).length),
    }));

    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", ids }),
    });
  }, []);

  // Persist automation to notification center
  const persistAutomation = useCallback(async (automation: {
    type: string;
    priority: string;
    title: string;
    message: string;
    dedupeKey: string;
    moduleId?: string;
    moduleName?: string;
    moduleColor?: string;
    actionLabel?: string;
    actionHref?: string;
    metadata?: Record<string, unknown>;
  }) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: automation.type,
          priority: automation.priority,
          title: automation.title,
          message: automation.message,
          dedupe_key: automation.dedupeKey,
          module_id: automation.moduleId,
          module_name: automation.moduleName,
          module_color: automation.moduleColor,
          action_label: automation.actionLabel,
          action_href: automation.actionHref,
          metadata: automation.metadata,
        }),
      });

      // Refresh after persist
      if (mountedRef.current) {
        fetchNotifications();
      }
    } catch {
      // Silent fail — toast already shown
    }
  }, [fetchNotifications]);

  // Load more (pagination)
  const loadMore = useCallback(() => {
    fetchNotifications(state.notifications.length, true);
  }, [fetchNotifications, state.notifications.length]);

  // Initial fetch + Realtime subscription
  useEffect(() => {
    mountedRef.current = true;
    fetchNotifications();

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => {
          if (mountedRef.current) fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchNotifications]);

  return {
    ...state,
    markRead,
    markAllRead,
    dismiss,
    persistAutomation,
    loadMore,
    refetch: () => fetchNotifications(),
  };
}
