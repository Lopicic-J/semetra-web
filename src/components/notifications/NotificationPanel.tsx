"use client";
/**
 * NotificationPanel — Dropdown panel with notification list
 *
 * Shows recent notifications with:
 * - Type icon + colored indicator
 * - Title + message + timestamp
 * - Mark read / dismiss actions
 * - Bulk "mark all read" button
 * - Load more pagination
 */

import { useMemo } from "react";
import {
  Bell, CheckCheck, X, ChevronDown,
  AlertTriangle, BookOpen, Flame, Target,
  ClipboardList, Brain, Trophy, Zap, Sparkles, Calendar
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import type { Notification } from "@/lib/hooks/useNotifications";

interface NotificationPanelProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  onMarkRead: (ids: string[]) => void;
  onMarkAllRead: () => void;
  onDismiss: (ids: string[]) => void;
  onLoadMore: () => void;
  onClose: () => void;
}

// ─── Type → Icon mapping ────────────────────────────────────────

const TYPE_META: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  exam_warning:       { icon: AlertTriangle, color: "text-red-500 dark:text-red-400",       label: "Prüfung" },
  grade_alert:        { icon: AlertTriangle, color: "text-amber-500 dark:text-amber-400",   label: "Note" },
  study_nudge:        { icon: BookOpen,      color: "text-blue-500 dark:text-blue-400",      label: "Lernen" },
  streak_celebration: { icon: Flame,         color: "text-orange-500 dark:text-orange-400",  label: "Streak" },
  task_reminder:      { icon: ClipboardList, color: "text-purple-500 dark:text-purple-400",  label: "Aufgabe" },
  knowledge_review:   { icon: Brain,         color: "text-teal-500 dark:text-teal-400",      label: "Wissen" },
  milestone_reached:  { icon: Trophy,        color: "text-green-500 dark:text-green-400",    label: "Meilenstein" },
  risk_escalation:    { icon: Zap,           color: "text-red-600 dark:text-red-500",        label: "Risiko" },
  daily_nudge:        { icon: Sparkles,      color: "text-brand-500 dark:text-brand-400",    label: "Tagesplan" },
  weekly_briefing:    { icon: Calendar,       color: "text-indigo-500 dark:text-indigo-400", label: "Wochenbericht" },
  system:             { icon: Bell,          color: "text-surface-500 dark:text-surface-400", label: "System" },
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  normal: "bg-blue-400",
  low: "bg-surface-300 dark:bg-surface-500",
};

// ─── Time Ago ──────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return new Date(dateStr).toLocaleDateString("de-CH", { day: "numeric", month: "short" });
}

// ─── Component ─────────────────────────────────────────────────

export function NotificationPanel({
  notifications,
  unreadCount,
  loading,
  hasMore,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onLoadMore,
  onClose,
}: NotificationPanelProps) {
  const { t } = useTranslation();
  const router = useRouter();

  // Group by date
  const groups = useMemo(() => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const grouped: { label: string; items: Notification[] }[] = [];
    let currentLabel = "";
    let currentItems: Notification[] = [];

    for (const n of notifications) {
      const dateStr = new Date(n.created_at).toDateString();
      const label = dateStr === today ? "Heute" : dateStr === yesterday ? "Gestern" : "Früher";

      if (label !== currentLabel) {
        if (currentItems.length > 0) {
          grouped.push({ label: currentLabel, items: currentItems });
        }
        currentLabel = label;
        currentItems = [n];
      } else {
        currentItems.push(n);
      }
    }
    if (currentItems.length > 0) {
      grouped.push({ label: currentLabel, items: currentItems });
    }

    return grouped;
  }, [notifications]);

  function handleClick(n: Notification) {
    if (!n.is_read) onMarkRead([n.id]);
    if (n.action_href) {
      router.push(n.action_href);
      onClose();
    }
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[520px]
      bg-white dark:bg-surface-800 rounded-xl shadow-lg border border-surface-200 dark:border-surface-700
      overflow-hidden z-50 flex flex-col
      animate-in fade-in slide-in-from-top-2 duration-200"
      role="dialog"
      aria-label={t("notifications.title")}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3
        border-b border-surface-100 dark:border-surface-700">
        <h3 className="font-semibold text-surface-900 dark:text-white text-sm">
          {t("notifications.title")}
          {unreadCount > 0 && (
            <span className="ml-2 text-xs font-normal text-surface-500 dark:text-surface-400">
              {unreadCount} {t("notifications.unread")}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600
                dark:text-surface-500 dark:hover:text-brand-400 transition-colors"
              title={t("notifications.mark_all_read")}
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600
              dark:text-surface-500 dark:hover:text-surface-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading && notifications.length === 0 ? (
          <div className="py-12 text-center text-surface-400 dark:text-surface-500 text-sm">
            {t("notifications.loading")}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Bell className="w-8 h-8 mx-auto mb-2 text-surface-300 dark:text-surface-600" />
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t("notifications.empty")}
            </p>
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <div key={group.label}>
                <div className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider
                  text-surface-400 dark:text-surface-500 bg-surface-50 dark:bg-surface-900">
                  {group.label}
                </div>
                {group.items.map((n) => {
                  const meta = TYPE_META[n.type] || TYPE_META.system;
                  const Icon = meta.icon;

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`group flex gap-3 px-4 py-3 cursor-pointer transition-colors
                        border-b border-surface-50 dark:border-surface-800 last:border-0
                        ${n.is_read
                          ? "bg-transparent hover:bg-surface-50 dark:hover:bg-surface-800"
                          : "bg-brand-50/30 dark:bg-brand-950/20 hover:bg-brand-50/50 dark:hover:bg-brand-950/30"
                        }`}
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        <div className={`relative ${meta.color}`}>
                          <Icon className="w-5 h-5" />
                          {!n.is_read && (
                            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${PRIORITY_DOT[n.priority]}`} />
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-tight ${
                            n.is_read
                              ? "text-surface-700 dark:text-surface-300"
                              : "text-surface-900 dark:text-white font-medium"
                          }`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-surface-400 dark:text-surface-500 whitespace-nowrap flex-shrink-0">
                            {timeAgo(n.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        {n.module_name && (
                          <div className="flex items-center gap-1.5 mt-1">
                            {n.module_color && (
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: n.module_color }}
                              />
                            )}
                            <span className="text-[11px] text-surface-400 dark:text-surface-500">
                              {n.module_name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Dismiss */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismiss([n.id]);
                        }}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity
                          p-1 rounded text-surface-300 hover:text-surface-500
                          dark:text-surface-600 dark:hover:text-surface-400"
                        title="Entfernen"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <button
                onClick={onLoadMore}
                className="w-full py-2.5 text-xs text-surface-500 dark:text-surface-400
                  hover:text-brand-600 dark:hover:text-brand-400 transition-colors
                  flex items-center justify-center gap-1"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                {t("notifications.load_more")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
