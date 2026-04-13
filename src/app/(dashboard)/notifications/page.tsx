"use client";

/**
 * Notification Center — Full-page notification management
 *
 * Features:
 * - Category filter tabs (All, Exams, Tasks, Study, Streaks, System)
 * - Unread / Read toggle
 * - Bulk actions (mark all read, dismiss all)
 * - Infinite scroll
 * - Notification details with action links
 */

import { useState, useMemo, useCallback } from "react";
import { clsx } from "clsx";
import {
  Bell,
  CheckCheck,
  Trash2,
  Filter,
  AlertTriangle,
  BookOpen,
  Flame,
  ClipboardList,
  Brain,
  Trophy,
  Zap,
  Sparkles,
  Calendar,
  Loader2,
  Inbox,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useNotifications, type Notification } from "@/lib/hooks/useNotifications";
import Link from "next/link";

// ── Type Config ──────────────────────────────────────────────────────────────

interface TypeMeta {
  icon: typeof Bell;
  color: string;
  label: string;
  category: string;
}

const TYPE_META: Record<string, TypeMeta> = {
  exam_warning:       { icon: AlertTriangle, color: "text-red-500",     label: "Prüfung",      category: "exams" },
  grade_alert:        { icon: AlertTriangle, color: "text-amber-500",   label: "Note",          category: "exams" },
  study_nudge:        { icon: BookOpen,      color: "text-blue-500",    label: "Lernen",        category: "study" },
  streak_celebration: { icon: Flame,         color: "text-orange-500",  label: "Streak",        category: "streaks" },
  task_reminder:      { icon: ClipboardList, color: "text-purple-500",  label: "Aufgabe",       category: "tasks" },
  knowledge_review:   { icon: Brain,         color: "text-teal-500",    label: "Wissen",        category: "study" },
  milestone_reached:  { icon: Trophy,        color: "text-green-500",   label: "Meilenstein",   category: "streaks" },
  risk_escalation:    { icon: Zap,           color: "text-red-600",     label: "Risiko",        category: "exams" },
  daily_nudge:        { icon: Sparkles,      color: "text-brand-500",   label: "Tagesplan",     category: "study" },
  weekly_briefing:    { icon: Calendar,      color: "text-indigo-500",  label: "Wochenbericht", category: "study" },
  system:             { icon: Bell,          color: "text-surface-500", label: "System",        category: "system" },
};

const CATEGORIES = [
  { id: "all", label: "Alle" },
  { id: "exams", label: "Prüfungen" },
  { id: "tasks", label: "Aufgaben" },
  { id: "study", label: "Lernen" },
  { id: "streaks", label: "Streaks" },
  { id: "system", label: "System" },
];

// ── Time Formatter ───────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days}d`;
  return new Date(dateStr).toLocaleDateString("de-CH", { day: "numeric", month: "short" });
}

// ── Notification Row ─────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  onMarkRead,
  onDismiss,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const meta = TYPE_META[notification.type] ?? TYPE_META.system;
  const Icon = meta.icon;

  return (
    <div
      className={clsx(
        "flex items-start gap-3 p-3 sm:p-4 rounded-xl border transition-all",
        notification.read_at
          ? "bg-surface-50 dark:bg-surface-900 border-surface-200 dark:border-surface-700 opacity-70"
          : "bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700"
      )}
    >
      {/* Icon */}
      <div className={clsx("shrink-0 mt-0.5", meta.color)}>
        <Icon size={18} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-surface-500">{meta.label}</span>
          <span className="text-xs text-surface-400">{timeAgo(notification.created_at)}</span>
          {!notification.read_at && (
            <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
          )}
        </div>
        <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5 leading-relaxed">
            {notification.message}
          </p>
        )}
        {notification.action_href && (
          <Link
            href={notification.action_href}
            className="inline-block text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 mt-1"
          >
            Anzeigen →
          </Link>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {!notification.read_at && (
          <button
            onClick={() => onMarkRead(notification.id)}
            className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-400 hover:text-surface-600 transition-colors"
            title="Als gelesen markieren"
          >
            <CheckCheck size={14} />
          </button>
        )}
        <button
          onClick={() => onDismiss(notification.id)}
          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-surface-400 hover:text-red-500 transition-colors"
          title="Entfernen"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    loading,
    hasMore,
    markRead,
    markAllRead,
    dismiss,
    loadMore,
  } = useNotifications();

  const [activeCategory, setActiveCategory] = useState("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = notifications;

    // Category filter
    if (activeCategory !== "all") {
      list = list.filter((n) => {
        const meta = TYPE_META[n.type];
        return meta?.category === activeCategory;
      });
    }

    // Unread filter
    if (showUnreadOnly) {
      list = list.filter((n) => !n.read_at);
    }

    return list;
  }, [notifications, activeCategory, showUnreadOnly]);

  const handleMarkRead = useCallback(
    (id: string) => markRead([id]),
    [markRead]
  );

  const handleDismiss = useCallback(
    (id: string) => dismiss([id]),
    [dismiss]
  );

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <Bell size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-surface-900 dark:text-white">
              Benachrichtigungen
            </h1>
            <p className="text-xs text-surface-500">
              {unreadCount > 0
                ? `${unreadCount} ungelesen`
                : "Alles gelesen"}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={markAllRead}>
            <CheckCheck size={14} />
            Alle gelesen
          </Button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors",
              activeCategory === cat.id
                ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400"
                : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
            )}
          >
            {cat.label}
          </button>
        ))}

        {/* Unread toggle */}
        <button
          onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          className={clsx(
            "ml-auto flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors",
            showUnreadOnly
              ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400"
              : "bg-surface-100 dark:bg-surface-800 text-surface-600 hover:bg-surface-200"
          )}
        >
          <Filter size={12} />
          Ungelesen
        </button>
      </div>

      {/* Notification List */}
      {loading && notifications.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-brand-500" />
        </div>
      ) : filtered.length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="py-8 space-y-3">
            <div className="w-14 h-14 rounded-full bg-surface-100 text-surface-400 flex items-center justify-center mx-auto">
              <Inbox size={28} />
            </div>
            <h2 className="text-base font-semibold text-surface-700">
              {showUnreadOnly ? "Keine ungelesenen Benachrichtigungen" : "Keine Benachrichtigungen"}
            </h2>
            <p className="text-xs text-surface-500">
              Hier erscheinen Prüfungs-Warnungen, Streak-Updates und Empfehlungen.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onMarkRead={handleMarkRead}
              onDismiss={handleDismiss}
            />
          ))}

          {hasMore && (
            <div className="text-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                loading={loading}
              >
                Mehr laden
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
