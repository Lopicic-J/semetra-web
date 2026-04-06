"use client";

import { ArrowRight, Clock, Target } from "lucide-react";
import type { ModulePriority, ModuleIntelligence } from "@/lib/decision/types";
import Link from "next/link";

interface ModulePriorityListProps {
  rankings: ModulePriority[];
  modules: ModuleIntelligence[];
}

function priorityBadge(rank: number): { bg: string; text: string } {
  if (rank === 1) return { bg: "bg-brand-500", text: "text-white" };
  if (rank === 2) return { bg: "bg-brand-400", text: "text-white" };
  if (rank === 3) return { bg: "bg-brand-300", text: "text-surface-900" };
  return { bg: "bg-surface-200", text: "text-surface-600" };
}

export default function ModulePriorityList({ rankings, modules }: ModulePriorityListProps) {
  if (rankings.length === 0) return null;

  return (
    <div className="bg-surface-100/50 rounded-xl border border-surface-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-surface-600" />
          <h3 className="font-semibold text-surface-900">Modul-Prioritäten</h3>
        </div>
        <span className="text-xs text-surface-500">nach Dringlichkeit</span>
      </div>

      <div className="space-y-2">
        {rankings.slice(0, 6).map((priority) => {
          const mod = modules.find((m) => m.moduleId === priority.moduleId);
          if (!mod) return null;
          const badge = priorityBadge(priority.rank);
          const topReason = priority.reasons[0];

          return (
            <Link
              key={priority.moduleId}
              href={`/modules/${priority.moduleId}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-200/50 transition-colors group"
            >
              {/* Rank Badge */}
              <span className={`${badge.bg} ${badge.text} w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                {priority.rank}
              </span>

              {/* Module Color + Name */}
              <div
                className="w-1 h-10 rounded-full flex-shrink-0"
                style={{ backgroundColor: mod.color ?? "#6b7280" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 truncate group-hover:text-brand-600">
                  {mod.moduleName}
                </p>
                {topReason && (
                  <p className="text-xs text-surface-500 truncate">{topReason.description}</p>
                )}
              </div>

              {/* Suggested Time */}
              <div className="flex items-center gap-1.5 text-xs text-surface-500 flex-shrink-0">
                <Clock className="w-3.5 h-3.5" />
                <span>{priority.suggestedMinutesToday} Min</span>
              </div>

              {/* Score */}
              <div className="w-10 text-right flex-shrink-0">
                <span className="text-sm font-semibold text-surface-700">{priority.score}</span>
              </div>

              <ArrowRight className="w-4 h-4 text-surface-400 group-hover:text-brand-500 flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
