"use client";
/**
 * Lernnachweis — Learning Proof & Output Tracking Dashboard
 *
 * Phase 5: Aggregated view of all learning metrics with export options.
 * Shows: study time, grades, ECTS progress, streaks, sessions, module breakdown.
 */

import { useState, useEffect, useMemo } from "react";
import {
  FileText, Download, Clock, GraduationCap, Target, Flame,
  TrendingUp, BookOpen, Award, BarChart3, Calendar
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { useModules } from "@/lib/hooks/useModules";
import { useGrades } from "@/lib/hooks/useGrades";
import { useStreaks } from "@/lib/hooks/useStreaks";
import { useTimeLogs } from "@/lib/hooks/useTimeLogs";
import { ExportButton } from "@/components/reports/ExportButton";

interface ModuleOutput {
  id: string;
  name: string;
  code?: string | null;
  color?: string | null;
  ects: number;
  grade: number | null;
  passed: boolean;
  studyHours: number;
  sessions: number;
  tasks: { total: number; completed: number };
}

export default function LernnachweisPage() {
  const { t } = useTranslation();
  const { modules } = useModules();
  const { grades } = useGrades();
  const streak = useStreaks();
  const { logs } = useTimeLogs();
  const supabase = createClient();

  const [tasks, setTasks] = useState<Array<{ module_id: string; status: string }>>([]);

  // Fetch tasks
  useEffect(() => {
    async function loadTasks() {
      const { data } = await supabase
        .from("tasks")
        .select("module_id, status")
        .not("module_id", "is", null);
      setTasks(data || []);
    }
    loadTasks();
  }, [supabase]);

  // Aggregate per-module output metrics
  const moduleOutputs: ModuleOutput[] = useMemo(() => {
    if (!modules) return [];

    return modules
      .filter((m) => m.status === "active" || m.status === "completed")
      .map((m) => {
        const modGrades = (grades || []).filter((g) => g.module_id === m.id);
        const bestGrade = modGrades.length > 0
          ? Math.max(...modGrades.map((g) => g.grade || 0))
          : null;

        const modLogs = (logs || []).filter((l) => l.module_id === m.id);
        const totalSecs = modLogs.reduce((s, l) => s + (l.duration_seconds || 0), 0);

        const modTasks = tasks.filter((t) => t.module_id === m.id);

        return {
          id: m.id,
          name: m.name,
          code: m.code,
          color: m.color,
          ects: m.ects || 0,
          grade: bestGrade,
          passed: bestGrade != null ? bestGrade >= 4.0 : false,
          studyHours: Math.round(totalSecs / 3600 * 10) / 10,
          sessions: modLogs.filter((l) => (l.duration_seconds || 0) >= 900).length,
          tasks: {
            total: modTasks.length,
            completed: modTasks.filter((t) => t.status === "done").length,
          },
        };
      })
      .sort((a, b) => b.studyHours - a.studyHours);
  }, [modules, grades, logs, tasks]);

  // Global metrics
  const metrics = useMemo(() => {
    const totalHours = moduleOutputs.reduce((s, m) => s + m.studyHours, 0);
    const totalSessions = moduleOutputs.reduce((s, m) => s + m.sessions, 0);
    const passedModules = moduleOutputs.filter((m) => m.passed).length;
    const ectsEarned = moduleOutputs.filter((m) => m.passed).reduce((s, m) => s + m.ects, 0);
    const totalEcts = moduleOutputs.reduce((s, m) => s + m.ects, 0);
    const gradedModules = moduleOutputs.filter((m) => m.grade != null);
    const avgGrade = gradedModules.length > 0
      ? Math.round(gradedModules.reduce((s, m) => s + (m.grade || 0), 0) / gradedModules.length * 100) / 100
      : null;
    const tasksCompleted = moduleOutputs.reduce((s, m) => s + m.tasks.completed, 0);
    const tasksTotal = moduleOutputs.reduce((s, m) => s + m.tasks.total, 0);

    return {
      totalHours, totalSessions, passedModules, ectsEarned, totalEcts,
      avgGrade, tasksCompleted, tasksTotal,
      totalModules: moduleOutputs.length,
    };
  }, [moduleOutputs]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            {t("lernnachweis.title")}
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {t("lernnachweis.subtitle")}
          </p>
        </div>
        <ExportButton />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          icon={Clock}
          label={t("lernnachweis.total_hours")}
          value={`${metrics.totalHours.toFixed(0)}h`}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-50 dark:bg-blue-950/30"
        />
        <KPICard
          icon={GraduationCap}
          label={t("lernnachweis.ects")}
          value={`${metrics.ectsEarned}/${metrics.totalEcts}`}
          color="text-green-600 dark:text-green-400"
          bg="bg-green-50 dark:bg-green-950/30"
        />
        <KPICard
          icon={Target}
          label={t("lernnachweis.gpa")}
          value={metrics.avgGrade?.toFixed(2) || "—"}
          color="text-brand-600 dark:text-brand-400"
          bg="bg-brand-50 dark:bg-brand-950/30"
        />
        <KPICard
          icon={Flame}
          label={t("lernnachweis.streak")}
          value={`${streak?.currentStreak || 0} ${t("lernnachweis.days")}`}
          color="text-orange-600 dark:text-orange-400"
          bg="bg-orange-50 dark:bg-orange-950/30"
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <MiniStat icon={BarChart3} label={t("lernnachweis.sessions")} value={metrics.totalSessions} />
        <MiniStat icon={BookOpen} label={t("lernnachweis.modules_passed")} value={`${metrics.passedModules}/${metrics.totalModules}`} />
        <MiniStat icon={TrendingUp} label={t("lernnachweis.tasks_done")} value={`${metrics.tasksCompleted}/${metrics.tasksTotal}`} />
      </div>

      {/* Module Breakdown */}
      <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-surface-400" />
            {t("lernnachweis.module_breakdown")}
          </h2>
          <span className="text-xs text-surface-400 dark:text-surface-500">
            {moduleOutputs.length} {t("lernnachweis.modules")}
          </span>
        </div>

        {moduleOutputs.length === 0 ? (
          <div className="py-12 text-center text-surface-400 dark:text-surface-500 text-sm">
            {t("lernnachweis.no_data")}
          </div>
        ) : (
          <div className="divide-y divide-surface-50 dark:divide-surface-800">
            {moduleOutputs.map((mod) => (
              <div key={mod.id} className="px-3 sm:px-5 py-3 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                {/* Color dot */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: mod.color || "#6366f1" }}
                />

                {/* Module info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                    {mod.name}
                  </p>
                  <p className="text-xs text-surface-400 dark:text-surface-500">
                    {mod.code || ""} · {mod.ects} ECTS · {mod.studyHours}h · {mod.sessions} Sessions
                  </p>
                </div>

                {/* Grade + Tasks on same line on mobile */}
                <div className="flex items-center gap-3 flex-shrink-0 ml-5 sm:ml-0">
                  {/* Grade */}
                  <div className="text-right">
                    {mod.grade != null ? (
                      <span className={`text-sm font-bold ${
                        mod.grade >= 4.0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {mod.grade.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-xs text-surface-400">—</span>
                    )}
                  </div>

                  {/* Tasks progress */}
                  <div className="w-16 hidden sm:block">
                    {mod.tasks.total > 0 ? (
                      <div>
                        <div className="h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all"
                            style={{ width: `${(mod.tasks.completed / mod.tasks.total) * 100}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-surface-400 mt-0.5 text-center">
                          {mod.tasks.completed}/{mod.tasks.total}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[10px] text-surface-300">—</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Longest streak info */}
      {streak && streak.longestStreak > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800/30 px-5 py-3 flex items-center gap-3">
          <Flame className="w-5 h-5 text-orange-500" />
          <div>
            <p className="text-sm font-medium text-surface-900 dark:text-white">
              {t("lernnachweis.longest_streak")}: {streak.longestStreak} {t("lernnachweis.days")}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {t("lernnachweis.total_study_days")}: {streak.totalDays || 0}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, color, bg }: {
  icon: typeof Clock;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-2xl ${bg} border border-surface-200/50 dark:border-surface-700/50 p-4`}>
      <Icon className={`w-5 h-5 ${color} mb-2`} />
      <p className="text-2xl font-bold text-surface-900 dark:text-white">{value}</p>
      <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{label}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: {
  icon: typeof BarChart3;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 px-4 py-3 flex items-center gap-3">
      <Icon className="w-4 h-4 text-surface-400 flex-shrink-0" />
      <div>
        <p className="text-lg font-bold text-surface-900 dark:text-white">{value}</p>
        <p className="text-[11px] text-surface-400 dark:text-surface-500">{label}</p>
      </div>
    </div>
  );
}
