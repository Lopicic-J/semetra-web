"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import {
  Play, Clock, GraduationCap, BookOpen, CheckSquare,
  Brain, Zap, ArrowRight, Target,
} from "lucide-react";
import type { CommandCenterState } from "@/lib/decision/types";
import type { Action } from "@/lib/decision/types";

interface Props {
  state: CommandCenterState;
}

/**
 * Builds a deep-link URL for a Decision Engine action.
 * Routes to the most relevant page with pre-filled context.
 */
function getActionLink(action: Action): string {
  const params = new URLSearchParams();
  params.set("module", action.moduleId);

  switch (action.type) {
    case "prepare_exam":
    case "start_studying":
    case "increase_time":
      if (action.relatedEntityId && action.relatedEntityType === "exam") {
        params.set("exam", action.relatedEntityId);
      }
      return `/timer?${params.toString()}`;

    case "review_weak_topics":
      if (action.relatedEntityId && action.relatedEntityType === "topic") {
        params.set("topic", action.relatedEntityId);
      }
      return `/timer?${params.toString()}`;

    case "review_flashcards":
      return `/flashcards?module=${action.moduleId}`;

    case "complete_task":
      return "/tasks";

    case "seek_help":
      return `/ki?module=${action.moduleId}`;

    case "create_material":
      return `/notes`;

    default:
      return `/timer?${params.toString()}`;
  }
}

function getActionIcon(type: string) {
  switch (type) {
    case "prepare_exam": return GraduationCap;
    case "review_flashcards": return Zap;
    case "complete_task": return CheckSquare;
    case "review_weak_topics": return Brain;
    case "seek_help": return BookOpen;
    default: return Target;
  }
}

function SmartStartCard({ state }: Props) {
  const { t } = useTranslation();

  const topActions = useMemo(() => {
    return state.today.actions.slice(0, 3);
  }, [state.today.actions]);

  const primaryAction = topActions[0];
  const nextActions = topActions.slice(1);

  if (!primaryAction) {
    return (
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <CheckSquare size={20} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-semibold text-emerald-800 dark:text-emerald-200">
              {t("dashboard.allDoneToday") || "Alles erledigt!"}
            </p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {t("dashboard.noActionsLeft") || "Keine offenen Aktionen für heute. Geniess die freie Zeit!"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const PrimaryIcon = getActionIcon(primaryAction.type);
  const primaryLink = getActionLink(primaryAction);

  return (
    <div className="rounded-2xl border border-brand-200 dark:border-brand-800/40 bg-gradient-to-br from-brand-50 via-indigo-50 to-violet-50 dark:from-brand-950/30 dark:via-indigo-950/20 dark:to-violet-950/20 p-5 mb-6">
      {/* Header */}
      <p className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-3">
        {t("dashboard.nextStep") || "Dein nächster Schritt"}
      </p>

      {/* Primary Action */}
      <Link
        href={primaryLink}
        className="group flex items-center gap-4 p-4 rounded-xl bg-white/80 dark:bg-surface-800/80 border border-brand-100 dark:border-brand-800/30 hover:shadow-lg hover:border-brand-300 dark:hover:border-brand-600 transition-all no-underline"
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md group-hover:scale-105 transition-transform"
          style={{ background: primaryAction.moduleColor ?? "#6d28d9" }}
        >
          <Play size={22} fill="white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-surface-900 dark:text-white text-base truncate">
            {primaryAction.title}
          </p>
          <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">
            {primaryAction.impact}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-surface-500">
              <Clock size={11} /> {primaryAction.estimatedMinutes} Min
            </span>
            {primaryAction.reason && (
              <span className="flex items-center gap-1 text-xs text-surface-400">
                {primaryAction.reason}
              </span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              primaryAction.urgency === "now"
                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
            }`}>
              {primaryAction.urgency === "now" ? "Jetzt" : "Heute"}
            </span>
          </div>
        </div>
        <ArrowRight size={20} className="text-brand-400 group-hover:translate-x-1 transition-transform shrink-0" />
      </Link>

      {/* Next Actions Preview */}
      {nextActions.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider font-medium px-1">Danach</p>
          {nextActions.map(action => {
            const Icon = getActionIcon(action.type);
            return (
              <Link
                key={action.id}
                href={getActionLink(action)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/60 dark:hover:bg-surface-800/40 transition-colors no-underline"
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${action.moduleColor ?? "#6d28d9"}20` }}
                >
                  <Icon size={12} style={{ color: action.moduleColor ?? "#6d28d9" }} />
                </div>
                <span className="text-sm text-surface-600 dark:text-surface-400 truncate flex-1">
                  {action.moduleName}: {action.title}
                </span>
                <span className="text-xs text-surface-400 shrink-0">{action.estimatedMinutes} Min</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Daily Summary */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-brand-100/50 dark:border-brand-800/20">
        <span className="text-xs text-surface-500">
          {state.today.actions.length} Aktionen · {state.today.totalMinutes} Min geplant
        </span>
        {state.today.focusModule && (
          <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">
            Fokus: {state.today.focusModule.name}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(SmartStartCard);
export { getActionLink };
