"use client";

import {
  BookOpen, GraduationCap, Clock, Flame, AlertTriangle,
  CheckSquare, Calendar, TrendingUp,
} from "lucide-react";
import type { CommandCenterState } from "@/lib/decision/types";

interface OverviewCardsProps {
  overview: CommandCenterState["overview"];
  studyStreak: number;
}

interface StatCard {
  label: string;
  value: string;
  subtext?: string;
  icon: typeof BookOpen;
  color: string;
  bgColor: string;
}

export default function OverviewCards({ overview, studyStreak }: OverviewCardsProps) {
  const hours = Math.floor(overview.totalStudyMinutesThisWeek / 60);
  const mins = overview.totalStudyMinutesThisWeek % 60;

  const cards: StatCard[] = [
    {
      label: "Module",
      value: `${overview.activeModules}`,
      subtext: `${overview.totalModules} total · ${overview.atRiskModules > 0 ? `${overview.atRiskModules} at risk` : "alle sicher"}`,
      icon: BookOpen,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Notenschnitt",
      value: overview.overallGPA !== null ? overview.overallGPA.toFixed(2) : "–",
      subtext: `${overview.ectsEarned}/${overview.ectsTarget} ECTS`,
      icon: GraduationCap,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
    },
    {
      label: "Lernzeit",
      value: hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ""}` : `${mins}m`,
      subtext: "diese Woche",
      icon: Clock,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: "Streak",
      value: `${studyStreak}`,
      subtext: studyStreak === 1 ? "Tag" : "Tage",
      icon: Flame,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      label: "Überfällig",
      value: `${overview.tasksOverdue}`,
      subtext: overview.tasksOverdue === 0 ? "Alles erledigt" : "Aufgaben",
      icon: overview.tasksOverdue > 0 ? AlertTriangle : CheckSquare,
      color: overview.tasksOverdue > 0
        ? "text-red-600 dark:text-red-400"
        : "text-green-600 dark:text-green-400",
      bgColor: overview.tasksOverdue > 0
        ? "bg-red-50 dark:bg-red-950/30"
        : "bg-green-50 dark:bg-green-950/30",
    },
    {
      label: "Prüfungen",
      value: `${overview.examsThisWeek.length}`,
      subtext: overview.examsThisWeek.length === 0 ? "keine diese Woche" : "diese Woche",
      icon: Calendar,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-surface-100/50 rounded-xl border border-surface-200 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`${card.bgColor} w-8 h-8 rounded-lg flex items-center justify-center`}>
                <Icon className={`${card.color} w-4 h-4`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-surface-900">{card.value}</p>
            <p className="text-xs text-surface-500 mt-0.5">{card.label}</p>
            {card.subtext && <p className="text-[10px] text-surface-400 mt-0.5">{card.subtext}</p>}
          </div>
        );
      })}
    </div>
  );
}
