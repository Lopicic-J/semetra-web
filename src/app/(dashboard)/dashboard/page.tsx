"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { useModules } from "@/lib/hooks/useModules";
import { useTasks } from "@/lib/hooks/useTasks";
import { useGrades } from "@/lib/hooks/useGrades";
import { useTimeLogs } from "@/lib/hooks/useTimeLogs";
import { useStreaks } from "@/lib/hooks/useStreaks";
import { useProfile } from "@/lib/hooks/useProfile";
import { formatDate, formatDuration, ectsWeightedAvg, roundGrade } from "@/lib/utils";
import {
  BookOpen, CheckSquare, Clock, TrendingUp, AlertCircle, Calendar,
  GraduationCap, Brain, AlertTriangle, Flame, Target, Zap, Trophy,
  Timer, ArrowRight, ChevronDown, Paperclip, Link2, FileText,
} from "lucide-react";
import Link from "next/link";
import type { CalendarEvent, Topic } from "@/types/database";
import { useTheme } from "@/components/providers/ThemeProvider";
import { DK, dk } from "@/lib/design-tokens";

type Exam = CalendarEvent & { daysLeft?: number };

export default function DashboardPage() {
  const { t } = useTranslation();
  const { resolvedMode } = useTheme();
  const isDark = resolvedMode === "dark";
  const { modules, loading: ml } = useModules();
  const { tasks } = useTasks();
  const { grades } = useGrades();
  const { logs } = useTimeLogs();
  const streak = useStreaks();
  const { profile } = useProfile();
  const [exams, setExams] = useState<Exam[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);
  const [examAttachments, setExamAttachments] = useState<Record<string, any[]>>({});
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [taskAttachments, setTaskAttachments] = useState<Record<string, any[]>>({});
  const supabase = createClient();

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

  const fetchExamDetails = useCallback(async (examId: string) => {
    const { data } = await supabase
      .from("exam_attachments")
      .select("*")
      .eq("exam_id", examId)
      .order("created_at", { ascending: false });
    setExamAttachments(prev => ({ ...prev, [examId]: data ?? [] }));
  }, [supabase]);

  const toggleExamExpand = (examId: string) => {
    if (expandedExam === examId) {
      setExpandedExam(null);
    } else {
      setExpandedExam(examId);
      if (!examAttachments[examId]) {
        fetchExamDetails(examId);
      }
    }
  };

  const fetchTaskDetails = useCallback(async (taskId: string) => {
    const { data } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    setTaskAttachments(prev => ({ ...prev, [taskId]: data ?? [] }));
  }, [supabase]);

  const toggleTaskExpand = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
      if (!taskAttachments[taskId]) {
        fetchTaskDetails(taskId);
      }
    }
  };

  useEffect(() => { fetchExams(); fetchTopics(); }, [fetchExams, fetchTopics]);

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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900">{t("dashboard.title")}</h1>
        <p className="text-surface-500 text-sm mt-0.5">{t("dashboard.subtitle")}</p>
      </div>

      {/* ═══ Row 1: Streak Hero + ECTS Ring + GPA ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Streak Card */}
        <Link href="/timer" className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center gap-3 mb-3">
            <div className="inline-flex p-2.5 rounded-xl bg-orange-100 text-orange-600">
              <Flame size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-orange-800">{t("dashboard.streak")}</p>
              <p className="text-3xl font-bold text-orange-600">
                {streak.currentStreak === 1 ? t("dashboard.streakDay") : t("dashboard.streakDays", { count: String(streak.currentStreak) })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${streak.todayDone ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
              {streak.todayDone ? t("dashboard.streakToday") : t("dashboard.streakTodayMissing")}
            </span>
          </div>
          {!streak.todayDone && (
            <p className="text-[10px] text-orange-500/70 mt-1.5">{t("dashboard.streakThreshold")}</p>
          )}
          <div className="flex gap-4 mt-3 pt-3 border-t border-orange-200/50 text-xs text-orange-700/70">
            <span><Trophy size={11} className="inline mr-1" />{t("dashboard.longestStreak")}: <strong>{streak.longestStreak}</strong></span>
            <span>{t("dashboard.totalStudyDays")}: <strong>{streak.totalDays}</strong></span>
          </div>
        </Link>

        {/* ECTS Progress */}
        <Link href="/credits" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="inline-flex p-2.5 rounded-xl bg-brand-100 text-brand-600">
              <Target size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-surface-500">{t("dashboard.ectsProgress")}</p>
              <p className="text-3xl font-bold text-surface-900">{earnedEcts}<span className="text-lg text-surface-400">/{totalEcts || 180}</span></p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2.5 bg-surface-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((earnedEcts / (totalEcts || 180)) * 100, 100)}%` }} />
          </div>
          <p className="text-xs text-surface-400 mt-2">{t("dashboard.ectsOf", { current: String(earnedEcts), total: String(totalEcts || 180) })}</p>
        </Link>

        {/* GPA + Quick Stats */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="inline-flex p-2.5 rounded-xl bg-green-100 text-green-600">
              <TrendingUp size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-surface-500">{t("dashboard.gpa")}</p>
              <p className="text-3xl font-bold text-surface-900">{ectsAvg ? roundGrade(ectsAvg).toFixed(2) : "—"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-auto">
            <div className="bg-surface-50 rounded-lg px-3 py-2">
              <p className="text-lg font-bold text-surface-900">{modules.length}</p>
              <p className="text-[10px] text-surface-400">{t("dashboard.modules")}</p>
            </div>
            <div className="bg-surface-50 rounded-lg px-3 py-2">
              <p className="text-lg font-bold text-surface-900">{openTasks.length}</p>
              <p className="text-[10px] text-surface-400">{t("dashboard.openTasks")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Row 2: 30-Day Heatmap ═══ */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Calendar size={16} className="text-brand-500" /> {t("dashboard.studyHeatmap")}
          </h2>
          <div className="flex items-center gap-3 text-xs text-surface-400">
            <span>{t("dashboard.totalStudyTime")}: <strong className="text-surface-700">{fmtStudyTime(streak.totalSeconds)}</strong></span>
            <Link href="/timer" className="text-brand-600 hover:underline flex items-center gap-1">{t("dashboard.openTimer")} <ArrowRight size={10} /></Link>
          </div>
        </div>
        <HeatmapRow last30Days={streak.last30Days} />
      </div>

      {/* ═══ Row 3: Knowledge warnings ═══ */}
      {examKnowledgeWarnings.length > 0 && (
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
                <p className="text-sm font-semibold text-surface-900">
                  {t("dashboard.knowledgeWarning", { exam: w.exam.title, percent: w.understoodPct })}
                </p>
                <p className="text-xs text-surface-500">
                  {t("dashboard.examInDays", { days: w.exam.daysLeft ?? 0, topics: w.topicCount })}
                </p>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-surface-200 text-brand-600 shrink-0">
                <Brain size={12} /> {t("dashboard.review")}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ═══ Row 4: Exams + Tasks side by side ═══ */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        {/* Upcoming exams */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-900 flex items-center gap-2">
              <GraduationCap size={16} className="text-brand-500" /> {t("dashboard.upcomingExams")}
            </h2>
            <Link href="/exams" className="text-xs text-brand-600 hover:underline">{t("dashboard.showAll")}</Link>
          </div>
          {exams.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-4">{t("dashboard.allDone")}</p>
          ) : (
            <div className="space-y-2">
              {exams.slice(0, 5).map(exam => {
                const d = exam.daysLeft ?? 999;
                const isToday = d === 0;
                const isUrgent = d > 0 && d <= 3;
                const isSoon = d > 3 && d <= 7;
                const isExpanded = expandedExam === exam.id;
                const attachments = examAttachments[exam.id] ?? [];
                const examTopics = topics.filter(t => t.exam_id === exam.id);

                return (
                  <div key={exam.id}>
                    <button
                      onClick={() => toggleExamExpand(exam.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        isToday ? "bg-red-50 border border-red-200" :
                        isUrgent ? "bg-orange-50 border border-orange-200" :
                        isSoon ? "bg-yellow-50 border border-yellow-100" :
                        "bg-surface-50 hover:bg-surface-100"
                      } ${isExpanded ? "rounded-b-none border-b-0" : ""}`}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white"
                        style={{ background: exam.color ?? "#6d28d9" }}>
                        <GraduationCap size={16} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-surface-900 truncate">{exam.title}</p>
                        <p className="text-xs text-surface-500 mt-0.5">{formatDate(exam.start_dt)}{exam.location ? ` · ${exam.location}` : ""}</p>
                      </div>
                      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${
                        isToday ? "bg-red-100 text-red-700" :
                        isUrgent ? "bg-orange-100 text-orange-700" :
                        isSoon ? "bg-yellow-100 text-yellow-700" :
                        d <= 30 ? "bg-blue-100 text-blue-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        <Clock size={12} />
                        {isToday ? t("dashboard.today") : d === 1 ? t("dashboard.tomorrow") : `${d} ${t("dashboard.daysLeft")}`}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="bg-surface-50 border border-surface-200 border-t-0 rounded-b-xl p-3 text-sm space-y-2">
                        {exam.description && (
                          <div>
                            <p className="text-xs font-medium text-surface-500 mb-1">{t("dashboard.description")}</p>
                            <p className="text-xs text-surface-700">{exam.description}</p>
                          </div>
                        )}
                        {examTopics.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-surface-500 mb-1">{t("dashboard.relatedTopics")}</p>
                            <div className="space-y-1">
                              {examTopics.slice(0, 3).map(topic => (
                                <div key={topic.id} className="flex items-center justify-between text-xs">
                                  <span className="text-surface-700 truncate">{topic.title}</span>
                                  <span className="text-surface-400 text-[10px] ml-2 shrink-0">
                                    {topic.knowledge_level >= 3 ? "✓" : topic.knowledge_level === 2 ? "◐" : "○"}
                                  </span>
                                </div>
                              ))}
                              {examTopics.length > 3 && (
                                <p className="text-[10px] text-surface-400">+{examTopics.length - 3} {t("dashboard.more")}</p>
                              )}
                            </div>
                          </div>
                        )}
                        {attachments.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-surface-500 mb-1">{t("dashboard.attachments")}</p>
                            <div className="space-y-1">
                              {attachments.slice(0, 3).map(att => (
                                <div key={att.id} className="text-xs text-surface-600 truncate">
                                  {att.kind === "link" ? "🔗" : att.kind === "note" ? "📝" : "📎"} {att.label || att.url}
                                </div>
                              ))}
                              {attachments.length > 3 && (
                                <p className="text-[10px] text-surface-400">+{attachments.length - 3}</p>
                              )}
                            </div>
                          </div>
                        )}
                        {attachments.length === 0 && examTopics.length === 0 && !exam.description && (
                          <p className="text-xs text-surface-400">{t("dashboard.noDetails")}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Urgent tasks — expandable like exams */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-900 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" /> {t("dashboard.urgentTasks")}
            </h2>
            <Link href="/tasks" className="text-xs text-brand-600 hover:underline">{t("dashboard.showAll")}</Link>
          </div>
          {overdue.length === 0 && openTasks.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-4">{t("dashboard.allDone")}</p>
          ) : (
            <div className="space-y-2">
              {[...overdue, ...openTasks.filter(t => !overdue.includes(t))].slice(0, 6).map(task => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                const isExpanded = expandedTask === task.id;
                const attachments = taskAttachments[task.id] ?? [];
                const mod = modules.find(m => m.id === task.module_id);

                return (
                  <div key={task.id}>
                    <button
                      onClick={() => toggleTaskExpand(task.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        isOverdue ? "bg-red-50 border border-red-200" :
                        task.priority === "high" ? "bg-orange-50 border border-orange-200" :
                        "bg-surface-50 hover:bg-surface-100 border border-transparent"
                      } ${isExpanded ? "rounded-b-none border-b-0" : ""}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        task.priority === "high" ? "bg-red-500" :
                        task.priority === "medium" ? "bg-yellow-500" : "bg-surface-300"
                      }`} />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-surface-900 truncate">{task.title}</p>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {task.due_date && formatDate(task.due_date)}
                          {mod ? ` · ${mod.name}` : ""}
                        </p>
                      </div>
                      {isOverdue && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700 shrink-0">
                          {t("dashboard.taskOverdue")}
                        </span>
                      )}
                      <ChevronDown size={14} className={`text-surface-400 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>

                    {isExpanded && (
                      <div className={`border border-t-0 rounded-b-xl p-3 text-sm space-y-2 ${
                        isOverdue ? "bg-red-50/50 border-red-200" :
                        task.priority === "high" ? "bg-orange-50/50 border-orange-200" :
                        "bg-surface-50 border-surface-200"
                      }`}>
                        {task.description && (
                          <div>
                            <p className="text-xs font-medium text-surface-500 mb-1">{t("dashboard.description")}</p>
                            <p className="text-xs text-surface-700 whitespace-pre-line">{task.description}</p>
                          </div>
                        )}
                        {mod && (
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-surface-500">{t("dashboard.taskModule")}:</p>
                            <span className="flex items-center gap-1.5 text-xs text-surface-700">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: mod.color }} />
                              {mod.name}
                            </span>
                          </div>
                        )}
                        {attachments.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-surface-500 mb-1">{t("dashboard.attachments")}</p>
                            <div className="space-y-1">
                              {attachments.slice(0, 4).map((att: any) => (
                                <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-surface-600 hover:text-brand-600 transition-colors">
                                  {att.kind === "link" ? <Link2 size={11} /> : <Paperclip size={11} />}
                                  <span className="truncate">{att.label || att.url}</span>
                                </a>
                              ))}
                              {attachments.length > 4 && (
                                <p className="text-[10px] text-surface-400">+{attachments.length - 4} {t("dashboard.more")}</p>
                              )}
                            </div>
                          </div>
                        )}
                        {!task.description && !mod && attachments.length === 0 && (
                          <p className="text-xs text-surface-400">{t("dashboard.noDetails")}</p>
                        )}
                        <div className="pt-1">
                          <Link href="/tasks" className="text-xs text-brand-600 hover:underline font-medium">
                            {t("dashboard.taskOpenFull")} →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Row 5: Weekly Chart + Module Progress ═══ */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Study time this week */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-900 flex items-center gap-2">
              <Timer size={16} className="text-green-500" /> {t("dashboard.weeklyLearning")}
            </h2>
            <Link href="/timer" className="text-xs text-brand-600 hover:underline">{t("dashboard.openTimer")}</Link>
          </div>
          <WeeklyChart logs={logs} />
        </div>

        {/* Module progress */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-900 flex items-center gap-2">
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
    </div>
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
function WeeklyChart({ logs }: { logs: ReturnType<typeof useTimeLogs>["logs"] }) {
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
              className={`w-full rounded-t-lg transition-all ${d.isToday ? "bg-brand-500" : "bg-brand-200"}`}
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
