"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import {
  Flame, Target, TrendingUp, Clock, CheckSquare,
  AlertTriangle, GraduationCap,
} from "lucide-react";
import { memo } from "react";

interface Props {
  streak: { currentStreak: number; todayDone: boolean };
  earnedEcts: number;
  totalEcts: number;
  ectsAvg: number | null;
  moduleCount: number;
  todayStudyTime: string;
  openTaskCount: number;
  overdueCount: number;
  examCount: number;
  nextExamDaysLeft: number | null;
}

function DashboardStatCards({
  streak, earnedEcts, totalEcts, ectsAvg, moduleCount,
  todayStudyTime, openTaskCount, overdueCount, examCount, nextExamDaysLeft,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {/* Streak */}
      <Link href="/timer" className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-xl border border-orange-100 dark:border-orange-900/30 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-orange-100 dark:bg-orange-900/40 w-8 h-8 rounded-lg flex items-center justify-center">
            <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
        </div>
        <p className="text-2xl font-bold text-surface-900 dark:text-white">{streak.currentStreak}</p>
        <p className="text-xs text-surface-500 mt-0.5">{t("dashboard.streak")}</p>
        <p className="text-[10px] text-surface-400 mt-0.5">
          {streak.todayDone ? t("dashboard.streakToday") : t("dashboard.streakTodayMissing")}
        </p>
      </Link>

      {/* ECTS */}
      <Link href="/overview" className="bg-surface-100/50 rounded-xl border border-surface-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-brand-50 dark:bg-brand-950/30 w-8 h-8 rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          </div>
        </div>
        <p className="text-2xl font-bold text-surface-900 dark:text-white">{earnedEcts}<span className="text-sm text-surface-400">/{totalEcts || 180}</span></p>
        <p className="text-xs text-surface-500 mt-0.5">ECTS</p>
        <div className="w-full h-1.5 bg-surface-200 rounded-full overflow-hidden mt-1.5">
          <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((earnedEcts / (totalEcts || 180)) * 100, 100)}%` }} />
        </div>
      </Link>

      {/* GPA */}
      <div className="bg-surface-100/50 rounded-xl border border-surface-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-green-50 dark:bg-green-950/30 w-8 h-8 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <p className="text-2xl font-bold text-surface-900 dark:text-white">{ectsAvg ? ectsAvg.toFixed(2) : "—"}</p>
        <p className="text-xs text-surface-500 mt-0.5">{t("dashboard.gpa")}</p>
        <p className="text-[10px] text-surface-400 mt-0.5">{moduleCount} {t("dashboard.modules")}</p>
      </div>

      {/* Study Time Today */}
      <div className="bg-surface-100/50 rounded-xl border border-surface-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-emerald-50 dark:bg-emerald-950/30 w-8 h-8 rounded-lg flex items-center justify-center">
            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <p className="text-2xl font-bold text-surface-900 dark:text-white">{todayStudyTime}</p>
        <p className="text-xs text-surface-500 mt-0.5">{t("dashboard.studyToday") || "Heute gelernt"}</p>
      </div>

      {/* Open Tasks */}
      <div className={`rounded-xl border p-4 ${overdueCount > 0
        ? "bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30"
        : "bg-surface-100/50 border-surface-200"
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${overdueCount > 0
            ? "bg-red-100 dark:bg-red-900/40"
            : "bg-blue-50 dark:bg-blue-950/30"
          }`}>
            {overdueCount > 0
              ? <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              : <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            }
          </div>
        </div>
        <p className="text-2xl font-bold text-surface-900 dark:text-white">{openTaskCount}</p>
        <p className="text-xs text-surface-500 mt-0.5">{t("dashboard.openTasks")}</p>
        {overdueCount > 0 && (
          <p className="text-[10px] text-red-600 dark:text-red-400 font-medium mt-0.5">{overdueCount} {t("dashboard.taskOverdue")}</p>
        )}
      </div>

      {/* Upcoming Exams */}
      <Link href="/exams" className={`rounded-xl border p-4 hover:shadow-md transition-shadow ${examCount > 0 && (nextExamDaysLeft ?? 999) <= 7
        ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30"
        : "bg-surface-100/50 border-surface-200"
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-indigo-50 dark:bg-indigo-950/30 w-8 h-8 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>
        <p className="text-2xl font-bold text-surface-900 dark:text-white">{examCount}</p>
        <p className="text-xs text-surface-500 mt-0.5">{t("dashboard.upcomingExams")}</p>
        {examCount > 0 && nextExamDaysLeft !== null && (
          <p className="text-[10px] text-surface-400 mt-0.5">
            {t("dashboard.nextIn") || "Nächste in"} {nextExamDaysLeft} {t("dashboard.daysLeft")}
          </p>
        )}
      </Link>
    </div>
  );
}

export default memo(DashboardStatCards);
