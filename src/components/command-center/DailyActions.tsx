"use client";

import { useState } from "react";
import {
  BookOpen, CheckSquare, Brain, FileText, Play, Clock, TrendingUp,
  HelpCircle, Layers, Send, Zap, ArrowRight, Calendar,
} from "lucide-react";
import type { Action, ActionType, ActionUrgency } from "@/lib/decision/types";
import { getActionLink } from "@/components/dashboard/SmartStartCard";
import Link from "next/link";

interface DailyActionsProps {
  actions: Action[];
  totalMinutes: number;
  focusModule: { id: string; name: string; color?: string; reason: string } | null;
  /** If true, show "Plan my day" button at the top */
  showPlanButton?: boolean;
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

export default function DailyActions({ actions, totalMinutes, focusModule, showPlanButton = true }: DailyActionsProps) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const [planning, setPlanning] = useState(false);
  const [planResult, setPlanResult] = useState<string | null>(null);

  const handlePlanDay = async () => {
    setPlanning(true);
    setPlanResult(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto-plan" }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlanResult(`${data.scheduled} Blöcke eingeplant`);
        setTimeout(() => setPlanResult(null), 4000);
      }
    } catch { /* ignore */ }
    setPlanning(false);
  };

  return (
    <div className="bg-surface-100/50 dark:bg-surface-800/30 rounded-xl border border-surface-200 dark:border-surface-700 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-brand-500" />
          <h3 className="font-semibold text-surface-900 dark:text-surface-50">Tagesplan</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-surface-500">
            {hours > 0 ? `~${hours}h ${mins > 0 ? `${mins}min` : ""}` : `~${mins}min`} geplant
          </span>
          {showPlanButton && actions.length > 0 && (
            <button
              onClick={handlePlanDay}
              disabled={planning}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              <Calendar size={10} />
              {planning ? "Plane..." : "Tag planen"}
            </button>
          )}
        </div>
      </div>

      {/* Plan result */}
      {planResult && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-xs text-brand-700 dark:text-brand-300">
          <Zap size={12} className="text-brand-500" />
          {planResult} — <Link href="/smart-schedule" className="font-semibold underline">Anzeigen</Link>
        </div>
      )}

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
          const link = getActionLink(action);
          return (
            <Link
              key={action.id}
              href={link}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-200/50 dark:hover:bg-surface-700/30 transition-colors group no-underline"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: (action.moduleColor ?? "#6b7280") + "20" }}
              >
                <Icon className="w-4 h-4" style={{ color: action.moduleColor ?? "#6b7280" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-50 truncate">{action.title}</p>
                  <span className={`${urgency.badge} text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0`}>
                    {urgency.label}
                  </span>
                </div>
                <p className="text-xs text-surface-500 line-clamp-1">{action.reason}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                <span className="text-xs text-surface-400">
                  {action.estimatedMinutes}min
                </span>
                <ArrowRight size={14} className="text-surface-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
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
