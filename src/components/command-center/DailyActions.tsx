"use client";

import {
  BookOpen, CheckSquare, Brain, FileText, Play, Clock, TrendingUp,
  HelpCircle, Layers, Send, Zap,
} from "lucide-react";
import type { Action, ActionType, ActionUrgency } from "@/lib/decision/types";
import Link from "next/link";

interface DailyActionsProps {
  actions: Action[];
  totalMinutes: number;
  focusModule: { id: string; name: string; color?: string; reason: string } | null;
}

const actionIcons: Record<ActionType, typeof BookOpen> = {
  study_topic: BookOpen,
  complete_task: CheckSquare,
  review_flashcards: Brain,
  prepare_exam: FileText,
  start_studying: Play,
  increase_time: Clock,
  seek_help: HelpCircle,
  create_material: Layers,
  review_weak_topics: TrendingUp,
  submit_component: Send,
};

const urgencyStyles: Record<ActionUrgency, { badge: string; label: string }> = {
  now: { badge: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300", label: "Jetzt" },
  today: { badge: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300", label: "Heute" },
  this_week: { badge: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300", label: "Diese Woche" },
  soon: { badge: "bg-surface-200 text-surface-600", label: "Bald" },
  later: { badge: "bg-surface-200 text-surface-600", label: "Später" },
};

export default function DailyActions({ actions, totalMinutes, focusModule }: DailyActionsProps) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return (
    <div className="bg-surface-100/50 rounded-xl border border-surface-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-brand-500" />
          <h3 className="font-semibold text-surface-900">Tagesplan</h3>
        </div>
        <span className="text-xs font-medium text-surface-500">
          {hours > 0 ? `~${hours}h ${mins > 0 ? `${mins}min` : ""}` : `~${mins}min`} geplant
        </span>
      </div>

      {/* Focus Module */}
      {focusModule && (
        <Link
          href={`/modules/${focusModule.id}`}
          className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-950/30 transition-colors"
        >
          <div
            className="w-3 h-8 rounded-full flex-shrink-0"
            style={{ backgroundColor: focusModule.color ?? "#6366f1" }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wide">
              Heutiger Fokus
            </p>
            <p className="text-sm font-semibold text-surface-900">{focusModule.name}</p>
          </div>
          <span className="text-xs text-brand-600 dark:text-brand-400">{focusModule.reason}</span>
        </Link>
      )}

      {/* Action List */}
      <div className="space-y-2">
        {actions.slice(0, 8).map((action) => {
          const Icon = actionIcons[action.type] ?? BookOpen;
          const urgency = urgencyStyles[action.urgency];
          return (
            <div
              key={action.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-200/50 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: (action.moduleColor ?? "#6b7280") + "20" }}
              >
                <Icon className="w-4 h-4" style={{ color: action.moduleColor ?? "#6b7280" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-surface-900 truncate">{action.title}</p>
                  <span className={`${urgency.badge} text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0`}>
                    {urgency.label}
                  </span>
                </div>
                <p className="text-xs text-surface-500 line-clamp-1">{action.reason}</p>
              </div>
              <span className="text-xs text-surface-400 flex-shrink-0 mt-1">
                {action.estimatedMinutes}min
              </span>
            </div>
          );
        })}
        {actions.length === 0 && (
          <div className="text-center py-6 text-sm text-surface-500">
            Keine Aktionen für heute — gut gemacht!
          </div>
        )}
      </div>
    </div>
  );
}
