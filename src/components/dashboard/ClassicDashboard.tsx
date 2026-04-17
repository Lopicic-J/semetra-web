"use client";
/**
 * UnifiedDashboard — Combines Classic Overview + Command Center Intelligence
 *
 * Layout:
 * 1. Header with greeting + date + refresh
 * 2. StudyStatusBanner (if enrolled)
 * 3. Alert Banner (Decision Engine warnings)
 * 4. Stat Cards (6 KPIs)
 * 5. Daily Actions + Module Priorities (2-col)
 * 6. 30-Day Heatmap
 * 7. Exams + Tasks (2-col, expandable)
 * 8. Risk Monitor + Predictions (2-col)
 * 9. Weekly Chart + Module Progress (2-col)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { useModules } from "@/lib/hooks/useModules";
import { useTasks } from "@/lib/hooks/useTasks";
import { useGrades } from "@/lib/hooks/useGrades";
import { useTimeLogs } from "@/lib/hooks/useTimeLogs";
import { useStreaks } from "@/lib/hooks/useStreaks";
import { useProfile } from "@/lib/hooks/useProfile";
import { useCommandCenter } from "@/lib/hooks/useCommandCenter";
import { useSmartAutomations } from "@/lib/hooks/useSmartAutomations";
import { ectsWeightedAvg } from "@/lib/utils";
import PageBlocks, { type BlockDef } from "@/components/ui/PageBlocks";
import {
  BookOpen, Calendar, Brain, AlertTriangle,
  Timer, ArrowRight, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import type { CalendarEvent, Topic } from "@/types/database";
import { useTheme } from "@/components/providers/ThemeProvider";
import StudyStatusBanner from "@/components/dashboard/StudyStatusBanner";
import StarterGuide from "@/components/dashboard/StarterGuide";
import { SemesterTransitionBanner } from "@/components/dashboard/SemesterTransitionBanner";
import { DailyNudgeCard } from "@/components/notifications/DailyNudgeCard";
import { NudgeBanner } from "@/components/dashboard/NudgeBanner";
import DashboardStatCards from "@/components/dashboard/DashboardStatCards";
import DashboardExamList from "@/components/dashboard/DashboardExamList";
import SmartStartCard from "@/components/dashboard/SmartStartCard";
import DashboardTaskList from "@/components/dashboard/DashboardTaskList";

// Command Center sub-components
import AlertBanner from "@/components/command-center/AlertBanner";
import DailyActions from "@/components/command-center/DailyActions";
import ModulePriorityList from "@/components/command-center/ModulePriorityList";
import RiskOverview from "@/components/command-center/RiskOverview";
import PredictionPanel from "@/components/command-center/PredictionPanel";

type Exam = CalendarEvent & { daysLeft?: number };

export default function ClassicDashboard() {
  const { t } = useTranslation();
  const { resolvedMode } = useTheme();
  const isDark = resolvedMode === "dark";

  // Classic hooks
  const { modules, loading: ml } = useModules();
  const { tasks } = useTasks();
  const { grades, triggerMigration } = useGrades();
  const { logs } = useTimeLogs();
  const streak = useStreaks();
  const { profile } = useProfile();
  const [exams, setExams] = useState<Exam[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [focusMode, setFocusMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("semetra_dashboard_mode") !== "detail";
    }
    return true;
  });
  const supabase = createClient();

  // Command Center hooks (wrapped in try-catch via useCommandCenter)
  const { state: ccState, modules: ccModules, loading: ccLoading, refetch: ccRefetch, computedAt } = useCommandCenter();
  useSmartAutomations({ state: ccState, modules: ccModules });

  const fetchExams = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("event_type", "exam")
      .order("start_dt", { ascending: true });
    const now = new Date();
    setExams(
      (data ?? [])
        .map(e => ({
          ...e,
          daysLeft: Math.ceil((new Date(e.start_dt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        }))
        .filter(e => (e.daysLeft ?? 0) >= 0)
    );
  }, [supabase]);

  const fetchTopics = useCallback(async () => {
    const { data } = await supabase.from("topics").select("*");
    setTopics(data ?? []);
  }, [supabase]);

  useEffect(() => { fetchExams(); fetchTopics(); }, [fetchExams, fetchTopics]);
  useEffect(() => { triggerMigration(); }, [triggerMigration]);

  // ECTS calculations
  const totalEcts = useMemo(() => modules.reduce((s, m) => s + (m.ects ?? 0), 0), [modules]);
  const earnedEcts = useMemo(() => {
    return modules
      .filter(m => m.status === "completed" || grades.some(g => g.module_id === m.id && g.grade != null && g.grade >= 4))
      .reduce((s, m) => s + (m.ects ?? 0), 0);
  }, [modules, grades]);

  // GPA
  const ectsAvg = useMemo(() => {
    const moduleGrades = modules
      .map(m => {
        const mg = grades.filter(g => g.module_id === m.id && g.grade != null);
        if (mg.length === 0) return null;
        const best = Math.max(...mg.map(g => g.grade!));
        return { grade: best, ects: m.ects ?? 0 };
      })
      .filter((x): x is { grade: number; ects: number } => x !== null && x.ects > 0);
    return ectsWeightedAvg(moduleGrades);
  }, [modules, grades]);

  // Exam knowledge warnings
  const examKnowledgeWarnings = useMemo(() =>
    exams
      .filter(e => (e.daysLeft ?? 999) > 0 && (e.daysLeft ?? 999) <= 30)
      .map(exam => {
        const examTopics = topics.filter(t => t.exam_id === exam.id);
        if (examTopics.length === 0) return null;
        const understoodPct = Math.round((examTopics.filter(t => (t.knowledge_level ?? 0) >= 3).length / examTopics.length) * 100);
        if (understoodPct >= 80) return null;
        return { exam, understoodPct, topicCount: examTopics.length };
      })
      .filter(Boolean) as { exam: Exam; understoodPct: number; topicCount: number }[]
  , [exams, topics]);

  // Tasks
  const openTasks = tasks.filter(t => t.status !== "done");
  const overdue = tasks.filter(t => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date());

  // Today's study time
  const todayLogs = logs.filter(l => new Date(l.started_at).toDateString() === new Date().toDateString());
  const todaySecs = todayLogs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0);

  // Module progress (topics per module)
  const moduleProgress = useMemo(() => {
    return modules.slice(0, 6).map(m => {
      const mTopics = topics.filter(t => t.module_id === m.id);
      const understood = mTopics.filter(t => (t.knowledge_level ?? 0) >= 3).length;
      return { ...m, topicCount: mTopics.length, understood };
    });
  }, [modules, topics]);

  // Format helper
  const fmtStudyTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h === 0) return t("dashboard.minutesShort", { min: String(m) });
    return t("dashboard.hoursShort", { h: String(h), min: String(m) });
  };

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dashboard.greetingMorning") : hour < 18 ? t("dashboard.greetingAfternoon") : t("dashboard.greetingEvening");

  // ─── Block definitions for drag & drop reordering ───
  const dashboardBlocks: BlockDef[] = useMemo(() => [
    {
      id: "knowledge-warnings",
      label: "Wissenslücken",
      hidden: examKnowledgeWarnings.length === 0,
      content: (
        <div className="space-y-2 mb-6">
          {examKnowledgeWarnings.map(w => (
            <Link key={w.exam.id} href="/knowledge" className="flex items-center gap-3 p-3 rounded-xl border transition-colors hover:shadow-sm no-underline"
              style={{
                background: w.understoodPct < 30 ? (isDark ? "rgba(220,38,38,0.12)" : "#fef2f2") : w.understoodPct < 60 ? (isDark ? "rgba(234,88,12,0.12)" : "#fff7ed") : (isDark ? "rgba(202,138,4,0.12)" : "#fefce8"),
                borderColor: w.understoodPct < 30 ? (isDark ? "rgba(220,38,38,0.25)" : "#fecaca") : w.understoodPct < 60 ? (isDark ? "rgba(234,88,12,0.25)" : "#fed7aa") : (isDark ? "rgba(202,138,4,0.25)" : "#fef08a"),
              }}>
              <AlertTriangle size={18} className={
                w.understoodPct < 30 ? "text-red-500" : w.understoodPct < 60 ? "text-orange-500" : "text-yellow-500"
              } />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-900 dark:text-white">
                  {t("dashboard.knowledgeWarning", { exam: w.exam.title, percent: w.understoodPct })}
                </p>
 <p className="text-xs text-surface-500">
                  {t("dashboard.examInDays", { days: w.exam.daysLeft ?? 0, topics: w.topicCount })}
                </p>
              </div>
 <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[rgb(var(--card-bg))] border border-surface-200 text-brand-600 dark:text-brand-400 shrink-0">
                <Brain size={12} /> {t("dashboard.review")}
              </div>
            </Link>
          ))}
        </div>
      ),
    },
    {
      id: "stat-cards",
      label: "KPI-Karten",
      content: (
        <DashboardStatCards
          streak={{ currentStreak: streak.currentStreak, todayDone: streak.todayDone }}
          earnedEcts={earnedEcts}
          totalEcts={totalEcts}
          ectsAvg={ectsAvg}
          moduleCount={modules.length}
          todayStudyTime={fmtStudyTime(todaySecs)}
          openTaskCount={openTasks.length}
          overdueCount={overdue.length}
          examCount={exams.length}
          nextExamDaysLeft={exams.length > 0 ? (exams[0].daysLeft ?? null) : null}
        />
      ),
    },
    {
      id: "daily-actions",
      label: "Tages-Aktionen",
      hidden: !ccState,
      content: ccState ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <DailyActions
            actions={ccState.today.actions}
            totalMinutes={ccState.today.totalMinutes}
            focusModule={ccState.today.focusModule}
          />
          <ModulePriorityList
            rankings={ccState.moduleRankings}
            modules={ccModules}
          />
        </div>
      ) : null,
    },
    {
      id: "heatmap",
      label: "Lern-Heatmap",
      content: (
        <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
            <Calendar size={16} className="text-brand-500" /> {t("dashboard.studyHeatmap")}
          </h2>
 <div className="flex items-center gap-3 text-xs text-surface-400">
 <span>{t("dashboard.totalStudyTime")}: <strong className="text-surface-700">{fmtStudyTime(streak.totalSeconds)}</strong></span>
            <Link href="/timer" className="text-brand-600 hover:underline flex items-center gap-1">{t("dashboard.openTimer")} <ArrowRight size={10} /></Link>
          </div>
        </div>
        <HeatmapRow last30Days={streak.last30Days} />
      </div>
      ),
    },
    {
      id: "exams-tasks",
      label: "Prüfungen & Aufgaben",
      content: (
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <DashboardExamList exams={exams} topics={topics} />
          <DashboardTaskList tasks={tasks} modules={modules} />
        </div>
      ),
    },
    {
      id: "risk-predictions",
      label: "Risiko & Prognosen",
      hidden: !ccState,
      content: ccState ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <RiskOverview
            risks={ccState.risks}
            modules={ccModules}
          />
          <PredictionPanel
            predictions={ccState.predictions}
            modules={ccModules}
          />
        </div>
      ) : null,
    },
    {
      id: "weekly-progress",
      label: "Wochenfortschritt",
      content: (
        <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <Timer size={16} className="text-green-500" /> {t("dashboard.weeklyLearning")}
            </h2>
            <Link href="/timer" className="text-xs text-brand-600 hover:underline">{t("dashboard.openTimer")}</Link>
          </div>
          <WeeklyChart logs={logs} />
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <BookOpen size={16} className="text-brand-500" /> {t("dashboard.moduleProgress")}
            </h2>
            <Link href="/modules" className="text-xs text-brand-600 hover:underline">{t("dashboard.manage")}</Link>
          </div>
          {ml ? (
            <div className="space-y-3">
 {[1,2,3].map(i => <div key={i} className="h-10 bg-surface-100 rounded-lg animate-pulse" />)}
            </div>
          ) : moduleProgress.length === 0 ? (
 <p className="text-sm text-surface-400 text-center py-4">{t("dashboard.noModules")}</p>
          ) : (
            <div className="space-y-3">
              {moduleProgress.map(mod => (
                <div key={mod.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: mod.color ?? "#6d28d9" }} />
 <span className="text-sm font-medium text-surface-800 truncate">{mod.name}</span>
                    </div>
 <span className="text-[10px] text-surface-400 shrink-0 ml-2">
                      {mod.topicCount > 0
                        ? t("dashboard.topicsUnderstood", { count: String(mod.understood), total: String(mod.topicCount) })
                        : t("dashboard.noTopics")
                      }
                    </span>
                  </div>
 <div className="w-full h-1.5 bg-surface-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: mod.topicCount > 0 ? `${(mod.understood / mod.topicCount) * 100}%` : "0%",
                        background: mod.color ?? "#6d28d9",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      ),
    },
  ], [
    examKnowledgeWarnings, isDark, t, ccState, ccModules, streak,
    earnedEcts, totalEcts, ectsAvg, modules, todaySecs, overdue, openTasks,
    exams, topics, tasks, logs, moduleProgress, ml, fmtStudyTime,
  ]);

  return (
    <>
      {/* ═══ HEADER (fixed) ═══ */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
            {greeting || t("dashboard.title")}
          </h1>
 <p className="text-surface-500 text-sm mt-0.5">
            {new Date().toLocaleDateString("de-CH", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={ccRefetch}
 className="p-2 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
          title="Dashboard aktualisieren"
        >
          <RefreshCw className={`w-4 h-4 ${ccLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ═══ SEMESTER TRANSITION (auto-reset) ═══ */}
      <SemesterTransitionBanner />

      {/* ═══ SMART NUDGES (DNA-based) ═══ */}
      <NudgeBanner />

      {/* ═══ STARTER GUIDE (new users) ═══ */}
      <StarterGuide />

      {/* ═══ STUDY STATUS BANNER (fixed) ═══ */}
      <StudyStatusBanner />

      {/* ═══ ALERT BANNER (fixed) ═══ */}
      {ccState && ccState.today.alerts.length > 0 && (
        <div className="mb-6">
          <AlertBanner alerts={ccState.today.alerts} />
        </div>
      )}

      {/* ═══ DAILY NUDGE (personalized) ═══ */}
      {ccState && ccModules.length > 0 && (
        <div className="mb-6">
          <DailyNudgeCard
            state={ccState}
            modules={ccModules}
            streakData={streak ? {
              currentStreak: streak.currentStreak,
              longestStreak: streak.longestStreak,
              todayDone: streak.todayDone,
            } : undefined}
          />
        </div>
      )}

      {/* ═══ SMART START (One-Click Learning) ═══ */}
      {ccState && ccState.today.actions.length > 0 && (
        <SmartStartCard state={ccState} />
      )}

      {/* ═══ FOCUS/DETAIL TOGGLE ═══ */}
      <button
        onClick={() => {
          const newMode = !focusMode;
          setFocusMode(newMode);
          localStorage.setItem("semetra_dashboard_mode", newMode ? "focus" : "detail");
        }}
        className="flex items-center gap-1.5 mx-auto mb-4 px-4 py-1.5 rounded-full text-xs font-medium text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
      >
        {focusMode ? (
          <><ChevronDown size={14} /> Detailansicht anzeigen</>
        ) : (
          <><ChevronUp size={14} /> Fokus-Modus</>
        )}
      </button>

      {/* ═══ SORTABLE BLOCKS (hidden in focus mode) ═══ */}
      {!focusMode && <PageBlocks blocks={dashboardBlocks} />}

      {/* ═══ COMPUTED AT (fixed) ═══ */}
      {computedAt && (
        <p className="text-xs text-surface-400 text-right mt-4">
          Decision Engine: {new Date(computedAt).toLocaleTimeString("de-CH")}
        </p>
      )}
    </>
  );
}

/* ═══ 30-Day Heatmap ═══ */
function HeatmapRow({ last30Days }: { last30Days: Record<string, number> }) {
  const { t } = useTranslation();
  const { resolvedMode } = useTheme();
  const isDark = resolvedMode === "dark";
  const days = Object.entries(last30Days);
  if (days.length === 0) {
    return <p className="text-sm text-surface-400 text-center py-4">{t("dashboard.noStudyData")}</p>;
  }

  const maxSecs = Math.max(...days.map(([, s]) => s), 1);

  return (
    <div className="flex gap-1 items-end">
      {days.map(([date, secs]) => {
        const d = new Date(date + "T00:00:00");
        const isToday = d.toDateString() === new Date().toDateString();
        const intensity = secs > 0 ? Math.max(0.15, secs / maxSecs) : 0;
        const mins = Math.round(secs / 60);
        const dayLabel = t("dashboard.weekDays").split("|")[((d.getDay() + 6) % 7)];

        return (
          <div key={date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div
              className={`w-full rounded-md transition-all ${isToday ? "ring-2 ring-brand-400 ring-offset-1" : ""}`}
              style={{
                height: `${Math.max(secs > 0 ? (secs / maxSecs) * 56 + 8 : 6, 6)}px`,
                background: secs > 0
                  ? `rgba(79, 70, 229, ${intensity})`
                  : isDark ? "#27272a" : "#f1f5f9",
              }}
            />
            {d.getDate() === 1 || d.getDay() === 1 || isToday ? (
              <span className={`text-[8px] ${isToday ? "text-brand-600 font-bold" : "text-surface-300"}`}>
                {d.getDate()}.{d.getMonth() + 1}
              </span>
            ) : (
              <span className="text-[8px] text-transparent">.</span>
            )}
            {/* Tooltip */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-surface-900 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
              {dayLabel} {d.getDate()}.{d.getMonth() + 1} — {mins > 0 ? `${mins} min` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ Weekly Chart ═══ */
function WeeklyChart({ logs }: { logs: Array<{ started_at: string; duration_seconds: number | null }> }) {
  const { t } = useTranslation();
  const days = t("dashboard.weekDays").split("|");
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const weekData = days.map((label, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayStr = day.toDateString();
    const secs = logs
      .filter(l => new Date(l.started_at).toDateString() === dayStr)
      .reduce((s, l) => s + (l.duration_seconds ?? 0), 0);
    return { label, hours: secs / 3600, isToday: dayStr === now.toDateString() };
  });

  const maxH = Math.max(...weekData.map(d => d.hours), 1);

  return (
    <div className="flex items-end gap-3 h-28">
      {weekData.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
            <div
              className={`w-full rounded-t-lg transition-all ${d.isToday ? "bg-brand-500" : "bg-brand-200 dark:bg-brand-800"}`}
              style={{ height: `${Math.max((d.hours / maxH) * 80, d.hours > 0 ? 4 : 0)}px` }}
            />
          </div>
          <span className={`text-[10px] font-medium ${d.isToday ? "text-brand-600" : "text-surface-400"}`}>{d.label}</span>
          {d.hours > 0 && <span className="text-[9px] text-surface-400">{d.hours.toFixed(1)}h</span>}
        </div>
      ))}
    </div>
  );
}
