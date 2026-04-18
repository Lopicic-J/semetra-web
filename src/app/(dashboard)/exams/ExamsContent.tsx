"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { useExamAttachments } from "@/lib/hooks/useExamAttachments";
import { ProGate, ProBadge } from "@/components/ui/ProGate";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  Plus, X, Trash2, Pencil, GraduationCap, Clock, Paperclip, Link2, Upload,
  ExternalLink, FileText, StickyNote, ChevronDown, ChevronUp, Target,
  AlertTriangle, CheckCircle2, Timer, Brain, TrendingUp, Sparkles, Lock, Zap,
  CalendarDays, BarChart3, Play
} from "lucide-react";
import type { CalendarEvent, ExamAttachment, Topic } from "@/types/database";

type Exam = CalendarEvent & { daysLeft?: number };

interface ExamWithReadiness extends Exam {
  topics: Topic[];
  readinessPercent: number;
  readinessLevel: "good" | "ok" | "warning" | "critical" | "none";
}

interface StudyPlanItem {
  examId: string;
  examTitle: string;
  examColor: string;
  topic: Topic;
  priority: "high" | "medium" | "low";
  daysUntilExam: number;
}

const FILE_ICONS: Record<string, string> = {
  pdf: "📄", docx: "📝", doc: "📝", xlsx: "📊", xls: "📊", csv: "📊",
  pptx: "📽️", ppt: "📽️", png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️",
  zip: "📦", rar: "📦", txt: "📃", py: "🐍", js: "📜", ts: "📜",
  html: "🌐", mp4: "🎬", mp3: "🎵",
};

function fileIcon(kind: string, fileType?: string | null) {
  if (kind === "link") return "🔗";
  if (kind === "note") return "📝";
  return FILE_ICONS[fileType?.toLowerCase() ?? ""] ?? "📎";
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Calculate readiness based on topic knowledge_levels */
function calcReadiness(topics: Topic[]): { percent: number; level: "good" | "ok" | "warning" | "critical" | "none" } {
  if (topics.length === 0) return { percent: 0, level: "none" };
  const totalPoints = topics.reduce((sum, t) => sum + (t.knowledge_level ?? 0), 0);
  const maxPoints = topics.length * 4; // max knowledge_level is 4
  const percent = Math.round((totalPoints / maxPoints) * 100);
  const level = percent >= 75 ? "good" : percent >= 50 ? "ok" : percent >= 25 ? "warning" : "critical";
  return { percent, level };
}

/** Generate study plan: prioritize topics by knowledge gap + urgency */
function generateStudyPlan(examsWithTopics: ExamWithReadiness[]): StudyPlanItem[] {
  const items: StudyPlanItem[] = [];

  for (const exam of examsWithTopics) {
    if ((exam.daysLeft ?? -1) < 0) continue; // skip past exams
    for (const topic of exam.topics) {
      if (topic.knowledge_level >= 4) continue; // already mastered
      const daysLeft = exam.daysLeft ?? 999;
      const gap = 4 - (topic.knowledge_level ?? 0); // how much left to learn
      const urgencyScore = gap * (daysLeft <= 3 ? 3 : daysLeft <= 7 ? 2 : daysLeft <= 14 ? 1.5 : 1);
      const priority: "high" | "medium" | "low" =
        (daysLeft <= 7 && gap >= 2) || (daysLeft <= 3) ? "high" :
        (daysLeft <= 14 && gap >= 2) || (daysLeft <= 7) ? "medium" : "low";

      items.push({
        examId: exam.id,
        examTitle: exam.title,
        examColor: exam.color ?? "#6d28d9",
        topic,
        priority,
        daysUntilExam: daysLeft,
      });
    }
  }

  // Sort: high priority first, then by days remaining, then by knowledge gap
  items.sort((a, b) => {
    const pOrder = { high: 0, medium: 1, low: 2 };
    if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
    if (a.daysUntilExam !== b.daysUntilExam) return a.daysUntilExam - b.daysUntilExam;
    return (a.topic.knowledge_level ?? 0) - (b.topic.knowledge_level ?? 0);
  });

  return items;
}

export default function ExamsPage() {
  const { t } = useTranslation();
  const [exams, setExams] = useState<Exam[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);
  const [showStudyPlan, setShowStudyPlan] = useState(false);
  const { modules } = useModules();
  const { isPro } = useProfile();
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [examRes, topicRes] = await Promise.all([
      supabase.from("events").select("*").eq("event_type", "exam").order("start_dt", { ascending: true }),
      supabase.from("topics").select("*").order("created_at", { ascending: true }),
    ]);
    const now = new Date();
    setExams((examRes.data ?? []).map(e => ({
      ...e,
      daysLeft: Math.ceil((new Date(e.start_dt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    })));
    setTopics(topicRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build exams with readiness data
  const examsWithReadiness: ExamWithReadiness[] = useMemo(() => {
    return exams.map(exam => {
      const examTopics = topics.filter(t => t.exam_id === exam.id);
      const { percent, level } = calcReadiness(examTopics);
      return { ...exam, topics: examTopics, readinessPercent: percent, readinessLevel: level };
    });
  }, [exams, topics]);

  const upcoming = examsWithReadiness.filter(e => (e.daysLeft ?? 0) >= 0);
  const past = examsWithReadiness.filter(e => (e.daysLeft ?? 0) < 0);

  // Study plan items
  const studyPlan = useMemo(() => generateStudyPlan(upcoming), [upcoming]);
  const todayPlan = studyPlan.filter(item => item.priority === "high").slice(0, 8);
  const weekPlan = studyPlan.slice(0, 20);

  async function handleDelete(id: string) {
    if (!confirm(t("exams.deleteConfirm"))) return;
    await supabase.from("events").delete().eq("id", id);
    fetchData();
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t("nav.exams")}</h1>
          <p className="text-surface-500 text-sm mt-0.5">{t("exams.subtitle", { upcoming: upcoming.length, past: past.length })}</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary gap-2">
          <Plus size={16} /> {t("exams.addExam")}
        </button>
      </div>

      {/* Quick Actions */}
      {upcoming.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Link href="/exam-prep" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/20 hover:bg-brand-100 dark:hover:bg-brand-950/30 border border-brand-200 dark:border-brand-800/40 no-underline transition-colors">
            📋 {t("nav.examPrep") || "Vorbereitungsplan"}
          </Link>
          <Link href={`/exam-simulator?module=${upcoming[0]?.module_id ?? ""}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 hover:bg-violet-100 dark:hover:bg-violet-950/30 border border-violet-200 dark:border-violet-800/40 no-underline transition-colors">
            🎯 {t("nav.examSimulator") || "Prüfungssimulator"}
          </Link>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-surface-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <>
          {/* ─── Countdown Dashboard ─── */}
          {upcoming.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Target size={14} /> {t("exams.countdown")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {upcoming.slice(0, 6).map(exam => (
                  <CountdownCard key={exam.id} exam={exam} />
                ))}
              </div>
            </div>
          )}

          {/* ─── Study Plan Section (Pro-gated) ─── */}
          {upcoming.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-2">
                  <Brain size={14} /> {t("exams.studyPlan")}
                  {!isPro && <ProBadge />}
                </h2>
                {isPro && studyPlan.length > 0 && (
                  <button
                    onClick={() => setShowStudyPlan(!showStudyPlan)}
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                  >
                    {showStudyPlan ? t("exams.focusToday") : t("exams.focusThisWeek")}
                    {showStudyPlan ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}
              </div>

              {isPro ? (
                studyPlan.length === 0 ? (
                  <div className="card p-6 text-center text-surface-400">
                    <Brain size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t("exams.planEmpty")}</p>
                    <p className="text-xs mt-1">{t("exams.noTopicsLinked")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(showStudyPlan ? weekPlan : todayPlan).map((item, i) => (
                      <StudyPlanCard key={`${item.topic.id}-${i}`} item={item} />
                    ))}
                    {!showStudyPlan && studyPlan.length > todayPlan.length && (
                      <button
                        onClick={() => setShowStudyPlan(true)}
                        className="w-full text-center py-2 text-xs text-brand-600 hover:text-brand-700 font-medium"
                      >
                        {t("exams.topicsDone", { done: todayPlan.length, total: studyPlan.length })}
                      </button>
                    )}
                    {/* Link to persistent Lernplan */}
                    <Link
                      href="/lernplan"
                      className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 bg-brand-50 text-brand-600 rounded-xl text-sm font-medium hover:bg-brand-100 transition-colors"
                    >
                      <CalendarDays size={15} />
                      {t("exams.openLernplan")}
                    </Link>
                  </div>
                )
              ) : (
                <div className="card p-6 relative overflow-hidden">
                  {/* Blurred preview */}
                  <div className="opacity-20 pointer-events-none select-none blur-[2px] space-y-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="h-12 bg-surface-100 rounded-lg" />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Lock size={20} className="text-surface-400 mb-2" />
                    <p className="text-sm font-semibold text-surface-700">{t("exams.proFeature")}</p>
                    <p className="text-xs text-surface-500 mb-3">{t("exams.upgradeForPlan")}</p>
                    <Link href="/upgrade" className="flex items-center gap-1.5 bg-brand-600 text-white px-4 py-2 rounded-full text-xs font-semibold hover:bg-brand-500 transition-all">
                      <Zap size={12} /> Upgrade
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Exam List ─── */}
          {upcoming.length === 0 && past.length === 0 ? (
            <div className="text-center py-20 text-surface-400">
              <GraduationCap size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t("exams.noExams")}</p>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-3">{t("exams.upcoming")}</h2>
                  <div className="space-y-3">
                    {upcoming.map(exam => (
                      <div key={exam.id}>
                        <ExamCard exam={exam} modules={modules}
                          onEdit={e => { setEditing(e); setShowForm(true); }}
                          onDelete={handleDelete}
                          isExpanded={expandedExam === exam.id}
                          onToggleExpand={() => setExpandedExam(expandedExam === exam.id ? null : exam.id)}
                        />
                        {expandedExam === exam.id && (
                          <ExamAttachmentsPanel examId={exam.id} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-3">{t("exams.past")}</h2>
                  <div className="space-y-3 opacity-60">
                    {past.map(exam => (
                      <div key={exam.id}>
                        <ExamCard exam={exam} modules={modules}
                          onEdit={e => { setEditing(e); setShowForm(true); }}
                          onDelete={handleDelete}
                          isExpanded={expandedExam === exam.id}
                          onToggleExpand={() => setExpandedExam(expandedExam === exam.id ? null : exam.id)}
                        />
                        {expandedExam === exam.id && (
                          <ExamAttachmentsPanel examId={exam.id} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {showForm && (
        <ExamModal
          initial={editing}
          modules={modules}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData(); }}
        />
      )}
    </div>
  );
}

/* ─── Countdown Card ─── */
function CountdownCard({ exam }: { exam: ExamWithReadiness }) {
  const { t } = useTranslation();
  const days = exam.daysLeft ?? 0;
  const isToday = days === 0;
  const isUrgent = days <= 7;

  const readinessLabel =
    exam.readinessLevel === "good" ? t("exams.readinessGood") :
    exam.readinessLevel === "ok" ? t("exams.readinessOk") :
    exam.readinessLevel === "warning" ? t("exams.readinessWarning") :
    exam.readinessLevel === "critical" ? t("exams.readinessCritical") :
    t("exams.noTopicsLinked");

  const readinessColor =
    exam.readinessLevel === "good" ? "text-green-600" :
    exam.readinessLevel === "ok" ? "text-blue-600" :
    exam.readinessLevel === "warning" ? "text-orange-600" :
    exam.readinessLevel === "critical" ? "text-red-600" :
    "text-surface-400";

  const readinessIcon =
    exam.readinessLevel === "good" ? <CheckCircle2 size={12} /> :
    exam.readinessLevel === "ok" ? <TrendingUp size={12} /> :
    exam.readinessLevel === "warning" ? <AlertTriangle size={12} /> :
    exam.readinessLevel === "critical" ? <AlertTriangle size={12} /> :
    <Brain size={12} />;

  return (
    <div className={`card p-4 border-l-4 transition-shadow hover:shadow-md ${
      isToday ? "border-l-red-500 bg-red-50/30" :
      isUrgent ? "border-l-orange-400" :
      days <= 30 ? "border-l-yellow-400" :
      "border-l-green-400"
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white text-xs"
            style={{ background: exam.color ?? "#6d28d9" }}>
            <GraduationCap size={14} />
          </div>
          <p className="font-semibold text-surface-900 text-sm truncate">{exam.title}</p>
        </div>
      </div>

      {/* Countdown */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${isToday ? "text-red-600" : isUrgent ? "text-orange-600" : "text-surface-800"}`}>
            {isToday ? t("exams.todayExam") : days}
          </span>
          {!isToday && <span className="text-xs text-surface-500">{t("exams.daysUntil", { days: "" }).trim()}</span>}
        </div>
        <span className="text-[10px] text-surface-500">{formatDate(exam.start_dt)}</span>
      </div>

      {/* Readiness bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1 text-[10px] font-medium ${readinessColor}`}>
            {readinessIcon}
            <span>{t("exams.readiness")}</span>
          </div>
          {exam.readinessLevel !== "none" && (
            <span className="text-[10px] font-semibold text-surface-600">{exam.readinessPercent}%</span>
          )}
        </div>
        {exam.readinessLevel !== "none" ? (
          <div className="w-full h-1.5 bg-surface-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                exam.readinessLevel === "good" ? "bg-green-500" :
                exam.readinessLevel === "ok" ? "bg-blue-500" :
                exam.readinessLevel === "warning" ? "bg-orange-500" :
                "bg-red-500"
              }`}
              style={{ width: `${exam.readinessPercent}%` }}
            />
          </div>
        ) : (
          <p className="text-[10px] text-surface-400 italic">{readinessLabel}</p>
        )}
        {exam.readinessLevel !== "none" && (
          <p className={`text-[10px] ${readinessColor}`}>{readinessLabel}</p>
        )}
        {exam.topics.length > 0 && (
          <p className="text-[10px] text-surface-400">
            {t("exams.topicsDone", {
              done: exam.topics.filter(tp => tp.knowledge_level >= 3).length,
              total: exam.topics.length,
            })}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Study Plan Card ─── */
function StudyPlanCard({ item }: { item: StudyPlanItem }) {
  const { t } = useTranslation();

  const priorityConfig = {
    high:   { label: t("exams.priorityHigh"),   bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
    medium: { label: t("exams.priorityMedium"), bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
    low:    { label: t("exams.priorityLow"),    bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  };

  const cfg = priorityConfig[item.priority];
  const knowledgeLabels = [
    t("knowledge.statusUnknown"),
    t("knowledge.statusSeen"),
    t("knowledge.levelBasics"),
    t("knowledge.levelUnderstood"),
    t("knowledge.levelMastered"),
  ];

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border border-surface-100 ${cfg.bg} transition-all hover:shadow-sm`}>
      {/* Priority dot */}
      <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />

      {/* Topic info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-800 truncate">{item.topic.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: item.examColor + "20", color: item.examColor }}>
            {item.examTitle}
          </span>
          <span className="text-[10px] text-surface-400">
            {knowledgeLabels[item.topic.knowledge_level ?? 0]}
          </span>
        </div>
      </div>

      {/* Priority + Days */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cfg.text} ${cfg.bg}`}>
          {cfg.label}
        </span>
        <span className="text-[10px] text-surface-500 flex items-center gap-0.5">
          <Clock size={10} /> {item.daysUntilExam}d
        </span>
      </div>

      {/* Start timer link */}
      <Link
        href={`/timer?exam=${item.examId}&topic=${item.topic.id}${item.topic.module_id ? `&module=${item.topic.module_id}` : ""}`}
        className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50 transition-colors shrink-0"
        title={t("exams.startTimer")}
      >
        <Play size={14} />
      </Link>
    </div>
  );
}

/* ─── Exam Card (enhanced with readiness) ─── */
function ExamCard({ exam, modules, onEdit, onDelete, isExpanded, onToggleExpand }: {
  exam: ExamWithReadiness;
  modules: ReturnType<typeof useModules>["modules"];
  onEdit: (e: Exam) => void;
  onDelete: (id: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const { t } = useTranslation();
  const urgent = (exam.daysLeft ?? 999) >= 0 && (exam.daysLeft ?? 999) <= 7;
  const mod = modules.find(m => exam.title.toLowerCase().includes(m.name.toLowerCase().split(" ")[0]));

  return (
    <div className={`card hover:shadow-md transition-shadow group flex items-center gap-4 ${urgent ? "border-l-4 border-l-red-400" : ""} ${isExpanded ? "rounded-b-none border-b-0" : ""}`}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
        style={{ background: exam.color ?? mod?.color ?? "#6d28d9" }}>
        <GraduationCap size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-surface-900">{exam.title}</p>
        <div className="flex flex-wrap gap-3 mt-1">
          <span className="text-xs text-surface-500 flex items-center gap-1">
            <CalendarDays size={11} /> {formatDate(exam.start_dt)}
            {" "}
            {new Date(exam.start_dt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {exam.location && <span className="text-xs text-surface-500 flex items-center gap-1">📍 {exam.location}</span>}
          {exam.topics.length > 0 && (
            <span className="text-xs text-surface-400 flex items-center gap-1">
              <Brain size={11} />
              {t("exams.topicsDone", {
                done: exam.topics.filter(tp => tp.knowledge_level >= 3).length,
                total: exam.topics.length,
              })}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Readiness mini-badge */}
        {exam.readinessLevel !== "none" && (exam.daysLeft ?? -1) >= 0 && (
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
            exam.readinessLevel === "good" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
            exam.readinessLevel === "ok" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
            exam.readinessLevel === "warning" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" :
            "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
          }`} title={`${t("exams.readiness")}: ${exam.readinessPercent}%`}>
            {exam.readinessPercent}
          </div>
        )}
        <button onClick={onToggleExpand}
          className={`p-1.5 rounded-lg transition-colors ${isExpanded ? "bg-brand-100 text-brand-600" : "text-surface-400 hover:bg-surface-100"}`}
          title={t("exams.materials")}>
          <Paperclip size={14} />
        </button>
        {exam.daysLeft !== undefined && exam.daysLeft >= 0 && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
            exam.daysLeft === 0 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
            exam.daysLeft <= 7 ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" :
            exam.daysLeft <= 30 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" :
            "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
          }`}>
            <Clock size={12} />
            {exam.daysLeft === 0 ? t("exams.todayExam") : `${exam.daysLeft}d`}
          </div>
        )}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(exam)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400"><Pencil size={13} /></button>
          <button onClick={() => onDelete(exam.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

/** Expandable panel showing notes, links, and files for an exam */
function ExamAttachmentsPanel({ examId }: { examId: string }) {
  const { t } = useTranslation();
  const { attachments, loading, addNote, updateNote, addLink, uploadFile, remove, getDownloadUrl } = useExamAttachments(examId);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [noteText, setNoteText] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notes = attachments.filter(a => a.kind === "note");
  const links = attachments.filter(a => a.kind === "link");
  const files = attachments.filter(a => a.kind === "file");

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    const url = linkUrl.trim().startsWith("http") ? linkUrl.trim() : `https://${linkUrl.trim()}`;
    await addLink(linkLabel.trim() || url, url);
    setLinkUrl("");
    setLinkLabel("");
    setShowLinkForm(false);
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    await addNote(noteText.trim());
    setNoteText("");
    setShowNoteForm(false);
  }

  async function handleUpdateNote(id: string) {
    if (!editNoteText.trim()) return;
    await updateNote(id, editNoteText.trim());
    setEditingNote(null);
    setEditNoteText("");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList) return;
    for (let i = 0; i < fileList.length; i++) {
      await uploadFile(fileList[i]);
    }
    e.target.value = "";
  }

  return (
    <div className="bg-surface-50 border border-t-0 border-surface-100 rounded-b-xl p-4 space-y-4">
      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip size={12} /> {t("exams.materials")}
        </h3>
        <div className="flex gap-2">
          <button onClick={() => { setShowNoteForm(!showNoteForm); setShowLinkForm(false); }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-100 border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
            <StickyNote size={12} /> {t("exams.note")}
          </button>
          <button onClick={() => { setShowLinkForm(!showLinkForm); setShowNoteForm(false); }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-100 border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
            <Link2 size={12} /> {t("exams.link")}
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-100 border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
            <Upload size={12} /> {t("exams.file")}
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload}
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.png,.jpg,.jpeg,.gif,.svg,.zip,.rar,.txt,.py,.js,.ts,.html,.mp4,.mp3" />
        </div>
      </div>

      {/* Note form */}
      {showNoteForm && (
        <form onSubmit={handleAddNote} className="space-y-2">
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
            placeholder={t("exams.notePlaceholder")}
            className="input resize-none text-sm w-full" rows={3} required />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowNoteForm(false)}
              className="px-3 py-1.5 text-xs rounded-lg hover:bg-surface-200 text-surface-500">{t("calendar.modal.cancel")}</button>
            <button type="submit" className="btn-primary text-xs px-3 py-1.5">{t("exams.addNote")}</button>
          </div>
        </form>
      )}

      {/* Link form */}
      {showLinkForm && (
        <form onSubmit={handleAddLink} className="flex gap-2">
          <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            placeholder={t("exams.linkPlaceholder")} className="input flex-1 text-sm" required />
          <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)}
            placeholder={t("exams.linkLabel")} className="input w-40 text-sm" />
          <button type="submit" className="btn-primary text-xs px-3 py-1.5">{t("exams.addLink")}</button>
          <button type="button" onClick={() => setShowLinkForm(false)}
            className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-400"><X size={14} /></button>
        </form>
      )}

      {loading ? (
        <div className="h-8 bg-surface-200 rounded animate-pulse" />
      ) : attachments.length === 0 ? (
        <p className="text-xs text-surface-400 text-center py-3">{t("exams.noMaterials")}</p>
      ) : (
        <div className="space-y-3">
          {/* Notes section */}
          {notes.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">{t("exams.notesSection")}</p>
              <div className="space-y-1.5">
                {notes.map(att => (
                  <div key={att.id} className="p-3 rounded-lg bg-yellow-50 border border-yellow-100 group/att">
                    {editingNote === att.id ? (
                      <div className="space-y-2">
                        <textarea value={editNoteText} onChange={e => setEditNoteText(e.target.value)}
                          className="input resize-none text-sm w-full" rows={3} />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingNote(null)}
                            className="px-2 py-1 text-xs rounded hover:bg-surface-200 text-surface-500">{t("calendar.modal.cancel")}</button>
                          <button onClick={() => handleUpdateNote(att.id)}
                            className="btn-primary text-xs px-2 py-1">{t("calendar.modal.save")}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <span className="text-sm shrink-0 mt-0.5">📝</span>
                        <p className="text-sm text-surface-700 flex-1 whitespace-pre-wrap">{att.content}</p>
                        <div className="flex gap-1 opacity-0 group-hover/att:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => { setEditingNote(att.id); setEditNoteText(att.content ?? ""); }}
                            className="p-1 rounded hover:bg-yellow-200 text-surface-400 hover:text-surface-600">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => remove(att)}
                            className="p-1 rounded hover:bg-red-50 text-surface-300 hover:text-red-500">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links section */}
          {links.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">{t("exams.linksSection")}</p>
              <div className="space-y-1.5">
                {links.map(att => (
                  <div key={att.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-100 border border-surface-100 group/att hover:border-brand-200 transition-colors">
                    <span className="text-sm shrink-0">🔗</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-surface-800 truncate">{att.label || att.url}</p>
                      <p className="text-[10px] text-surface-400 truncate">{att.url}</p>
                    </div>
                    <a href={att.url} target="_blank" rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-surface-100 text-surface-400 hover:text-brand-600 transition-colors">
                      <ExternalLink size={13} />
                    </a>
                    <button onClick={() => remove(att)}
                      className="p-1 rounded hover:bg-red-50 text-surface-300 hover:text-red-500 opacity-0 group-hover/att:opacity-100 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files section */}
          {files.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">{t("exams.filesSection")}</p>
              <div className="space-y-1.5">
                {files.map(att => (
                  <div key={att.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-100 border border-surface-100 group/att hover:border-brand-200 transition-colors">
                    <span className="text-sm shrink-0">{fileIcon(att.kind, att.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-surface-800 truncate">{att.label || att.url}</p>
                      {att.file_size > 0 && (
                        <p className="text-[10px] text-surface-400">{att.file_type?.toUpperCase()} · {humanSize(att.file_size)}</p>
                      )}
                    </div>
                    <a href={getDownloadUrl(att) ?? att.url} target="_blank" rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-surface-100 text-surface-400 hover:text-brand-600 transition-colors"
                      title={t("exams.open")}>
                      <ExternalLink size={13} />
                    </a>
                    <button onClick={() => remove(att)}
                      className="p-1 rounded hover:bg-red-50 text-surface-300 hover:text-red-500 opacity-0 group-hover/att:opacity-100 transition-all"
                      title={t("documents.delete")}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExamModal({ initial, modules, onClose, onSaved }: {
  initial: Exam | null;
  modules: ReturnType<typeof useModules>["modules"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const COLORS = ["#6d28d9","#2563eb","#dc2626","#059669","#d97706","#db2777"];
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    date: initial?.start_dt ? initial.start_dt.split("T")[0] : "",
    time: initial?.start_dt ? initial.start_dt.split("T")[1]?.slice(0, 5) ?? "09:00" : "09:00",
    module_id: initial?.module_id ?? "",
    exam_format: (initial as any)?.exam_format ?? "",
    difficulty_estimate: (initial as any)?.difficulty_estimate ?? 3,
    location: initial?.location ?? "",
    description: initial?.description ?? "",
    color: initial?.color ?? COLORS[2],
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const selectedModule = modules.find(m => m.id === form.module_id);
    const payload = {
      title: form.title,
      start_dt: `${form.date}T${form.time}:00`,
      module_id: form.module_id || null,
      exam_format: form.exam_format || null,
      difficulty_estimate: form.difficulty_estimate || null,
      location: form.location || null,
      description: form.description || null,
      color: selectedModule?.color || form.color,
      event_type: "exam",
    };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    if (initial) {
      await supabase.from("events").update(payload).eq("id", initial.id);
    } else {
      await supabase.from("events").insert({ ...payload, user_id: user.id });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface-100 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">{initial ? t("exams.modal.editTitle") : t("exams.modal.title")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("exams.modal.nameLabel")} *</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder={t("exams.modal.namePlaceholder")} />
          </div>
          {/* Module selector */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Modul</label>
            <select
              className="input"
              value={form.module_id}
              onChange={e => {
                const mod = modules.find(m => m.id === e.target.value);
                setForm(f => ({
                  ...f,
                  module_id: e.target.value,
                  color: mod?.color || f.color,
                }));
              }}
            >
              <option value="">— Kein Modul —</option>
              {modules.map(m => (
                <option key={m.id} value={m.id}>
                  {m.code ? `${m.code} – ` : ""}{m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("exams.modal.dateLabel")} *</label>
              <input className="input" type="date" required value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("exams.modal.timeLabel")}</label>
              <input className="input" type="time" value={form.time} onChange={e => set("time", e.target.value)} />
            </div>
          </div>
          {/* Exam format & difficulty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Format</label>
              <select className="input" value={form.exam_format} onChange={e => set("exam_format", e.target.value)}>
                <option value="">— Wählen —</option>
                <option value="written">Schriftlich</option>
                <option value="oral">Mündlich</option>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="open_book">Open Book</option>
                <option value="project">Projekt</option>
                <option value="presentation">Präsentation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Schwierigkeit (1-5)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={5}
                value={form.difficulty_estimate}
                onChange={e => setForm(f => ({ ...f, difficulty_estimate: parseInt(e.target.value) || 3 }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("exams.modal.locationLabel")}</label>
            <input className="input" value={form.location} onChange={e => set("location", e.target.value)} placeholder={t("exams.modal.locationPlaceholder")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("exams.modal.notesLabel")}</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder={t("exams.modal.notesPlaceholder")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">{t("exams.modal.colorLabel")}</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => set("color", c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-surface-800 scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t("exams.modal.cancel")}</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? t("exams.modal.saving") : t("exams.modal.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
