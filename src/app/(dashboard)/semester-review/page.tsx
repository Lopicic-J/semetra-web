"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  GraduationCap, Clock, Trophy, Target, TrendingUp, BookOpen,
  Award, Flame, CheckSquare, Star, RefreshCw,
} from "lucide-react";

interface SemesterReview {
  semester: string;
  generatedAt: string;
  ects: { earned: number; total: number; progressPercent: number };
  grades: {
    gpa: number | null;
    modulesGraded: number;
    modulesPassed: number;
    modulesFailed: number;
    bestModules: { name: string; grade: number | null }[];
    weakestModules: { name: string; grade: number | null }[];
  };
  studyTime: {
    totalHours: number;
    totalDays: number;
    averagePerDay: number;
    mostStudied: { name: string; hours: number }[];
  };
  tasks: { total: number; completed: number; completionRate: number };
  streaks: { longestStreak: number; totalStudyDays: number };
  achievements: {
    total: number;
    recent: { id: string; name: string; icon: string; tier: string; xp: number }[];
    totalXP: number;
  };
}

export default function SemesterReviewPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<SemesterReview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/semester-review");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse space-y-6">
      <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-surface-200 dark:bg-surface-700 rounded-xl" />)}
      </div>
    </div>
  );

  if (!data) return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-center text-surface-500">
      {t("semesterReview.noData") || "Keine Daten verfügbar"}
    </div>
  );

  const tierColors: Record<string, string> = {
    bronze: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
    silver: "text-surface-500 bg-surface-100 dark:bg-surface-800",
    gold: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30",
    diamond: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
            <GraduationCap size={28} className="text-brand-500" />
            {t("semesterReview.title") || "Semester-Rückblick"}
          </h1>
          <p className="text-surface-500 mt-1">{data.semester}</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
          <RefreshCw size={18} className="text-surface-400" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Target size={20} />}
          label={t("semesterReview.ectsProgress") || "ECTS-Fortschritt"}
          value={`${data.ects.earned}/${data.ects.total}`}
          sub={`${data.ects.progressPercent}%`}
          color="text-brand-500 bg-brand-50 dark:bg-brand-950/30"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label={t("semesterReview.gpa") || "Notendurchschnitt"}
          value={data.grades.gpa?.toFixed(2) ?? "—"}
          sub={`${data.grades.modulesPassed} bestanden`}
          color="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
        />
        <StatCard
          icon={<Clock size={20} />}
          label={t("semesterReview.studyHours") || "Lernstunden"}
          value={`${data.studyTime.totalHours}h`}
          sub={`${data.studyTime.totalDays} Tage`}
          color="text-violet-600 bg-violet-50 dark:bg-violet-950/30"
        />
        <StatCard
          icon={<Flame size={20} />}
          label={t("semesterReview.longestStreak") || "Längste Streak"}
          value={`${data.streaks.longestStreak}`}
          sub={t("semesterReview.days") || "Tage"}
          color="text-orange-500 bg-orange-50 dark:bg-orange-950/30"
        />
      </div>

      {/* Two Column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Modules */}
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-5">
          <h3 className="font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2 mb-4">
            <Star size={18} className="text-yellow-500" />
            {t("semesterReview.bestModules") || "Beste Module"}
          </h3>
          <div className="space-y-3">
            {data.grades.bestModules.map((m, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-surface-700 dark:text-surface-300">{m.name}</span>
                <span className="text-sm font-semibold text-emerald-600">{m.grade?.toFixed(1)}</span>
              </div>
            ))}
            {data.grades.bestModules.length === 0 && (
              <p className="text-sm text-surface-400">{t("semesterReview.noGrades") || "Noch keine Noten"}</p>
            )}
          </div>
        </div>

        {/* Most Studied */}
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-5">
          <h3 className="font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-brand-500" />
            {t("semesterReview.mostStudied") || "Am meisten gelernt"}
          </h3>
          <div className="space-y-3">
            {data.studyTime.mostStudied.map((m, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-surface-700 dark:text-surface-300">{m.name}</span>
                <span className="text-sm font-semibold text-violet-600">{m.hours}h</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-5">
          <h3 className="font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2 mb-4">
            <CheckSquare size={18} className="text-blue-500" />
            {t("semesterReview.tasks") || "Aufgaben"}
          </h3>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-3xl font-bold text-surface-900 dark:text-surface-50">{data.tasks.completed}</p>
              <p className="text-sm text-surface-500">von {data.tasks.total} erledigt</p>
            </div>
            <div className="flex-1">
              <div className="h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${data.tasks.completionRate}%` }}
                />
              </div>
              <p className="text-xs text-surface-400 mt-1">{data.tasks.completionRate}%</p>
            </div>
          </div>
        </div>

        {/* Achievements */}
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-5">
          <h3 className="font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-amber-500" />
            {t("semesterReview.achievements") || "Achievements"}
            <span className="text-xs bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full text-surface-500">
              {data.achievements.totalXP} XP
            </span>
          </h3>
          <div className="space-y-2">
            {data.achievements.recent.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <span className={`text-lg w-7 h-7 flex items-center justify-center rounded-lg ${tierColors[a.tier] || ""}`}>
                  {a.icon || <Award size={14} />}
                </span>
                <span className="text-sm text-surface-700 dark:text-surface-300 flex-1">{a.name}</span>
                <span className="text-xs text-surface-400">+{a.xp} XP</span>
              </div>
            ))}
            {data.achievements.recent.length === 0 && (
              <p className="text-sm text-surface-400">{t("semesterReview.noAchievements") || "Noch keine Achievements"}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-xs text-surface-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-surface-900 dark:text-surface-50">{value}</p>
      <p className="text-xs text-surface-400">{sub}</p>
    </div>
  );
}
