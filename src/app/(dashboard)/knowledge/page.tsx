"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useTasks } from "@/lib/hooks/useTasks";
import { formatDate } from "@/lib/utils";
import { Plus, X, Trash2, Pencil, Brain, ChevronDown, ChevronRight, RotateCcw, Zap, Check, GraduationCap, AlertTriangle, Clock, Filter } from "lucide-react";
import type { Topic, CalendarEvent } from "@/types/database";
import { useTranslation } from "@/lib/i18n";

type Exam = CalendarEvent & { daysLeft?: number };

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-surface-200 text-surface-600",
  in_progress: "bg-blue-100 text-blue-700",
  understood: "bg-green-100 text-green-700",
  needs_review: "bg-yellow-100 text-yellow-700",
};

function getStatusLabels(t: (key: string) => string): Record<string, string> {
  return {
    not_started: t("knowledge.statusNotStarted"),
    in_progress: t("knowledge.statusInProgress"),
    understood: t("knowledge.statusUnderstood"),
    needs_review: t("knowledge.statusRetry"),
  };
}

function getKnowledgeLevels(t: (key: string) => string) {
  return [
    { level: 0, label: t("knowledge.statusUnknown"), color: "bg-surface-300" },
    { level: 1, label: t("knowledge.statusSeen"), color: "bg-red-400" },
    { level: 2, label: t("knowledge.levelBasics"), color: "bg-orange-400" },
    { level: 3, label: t("knowledge.statusUnderstood"), color: "bg-yellow-400" },
    { level: 4, label: t("knowledge.levelMastered"), color: "bg-green-500" },
  ];
}

// SM-2 Algorithm
function sm2(quality: number, easiness: number, interval: number, repetitions: number) {
  let newEasiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEasiness < 1.3) newEasiness = 1.3;

  let newInterval: number;
  let newReps: number;

  if (quality < 3) {
    newReps = 0;
    newInterval = 1;
  } else {
    newReps = repetitions + 1;
    if (newReps === 1) newInterval = 1;
    else if (newReps === 2) newInterval = 6;
    else newInterval = Math.round(interval * newEasiness);
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  return { easiness: newEasiness, interval: newInterval, repetitions: newReps, nextReview };
}

export default function KnowledgePage() {
  const { t } = useTranslation();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [parentForNew, setParentForNew] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState<string>("all");
  const [filterExam, setFilterExam] = useState<string>("all");
  const [filterTask, setFilterTask] = useState<string>("all");
  const [showReview, setShowReview] = useState(false);
  const [reviewContext, setReviewContext] = useState<"all" | "exam" | "task">("all");
  const { modules } = useModules();
  const { tasks } = useTasks();
  const supabase = createClient();

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("topics").select("*").order("created_at", { ascending: true });
    setTopics(data ?? []);
    setLoading(false);
  }, [supabase]);

  const fetchExams = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("event_type", "exam")
      .order("start_dt", { ascending: true });
    const now = new Date();
    setExams((data ?? []).map(e => ({
      ...e,
      daysLeft: Math.ceil((new Date(e.start_dt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    })));
  }, [supabase]);

  useEffect(() => { fetchTopics(); fetchExams(); }, [fetchTopics, fetchExams]);

  // Auto-complete: mark topics as "understood" when their exam is past
  useEffect(() => {
    if (topics.length === 0 || exams.length === 0) return;
    const pastExamIds = new Set(exams.filter(e => (e.daysLeft ?? 0) < 0).map(e => e.id));
    const toComplete = topics.filter(t =>
      t.exam_id && pastExamIds.has(t.exam_id) && t.status !== "understood"
    );
    if (toComplete.length > 0) {
      Promise.all(toComplete.map(t =>
        supabase.from("topics").update({ status: "understood" }).eq("id", t.id)
      )).then(() => fetchTopics());
    }
  }, [exams]); // Only run when exams change

  // Filtered topics based on all active filters
  const filteredTopics = topics.filter(t => {
    if (filterModule !== "all" && t.module_id !== filterModule) return false;
    if (filterExam !== "all" && t.exam_id !== filterExam) return false;
    if (filterTask !== "all" && t.task_id !== filterTask) return false;
    return true;
  });

  // Due topics for SR (respecting current filters)
  const dueTopics = filteredTopics.filter(t => {
    if (!t.sr_next_review) return t.knowledge_level < 4;
    return new Date(t.sr_next_review) <= new Date();
  });

  // Exam-specific due topics for contextual review
  const examDueTopics = filterExam !== "all"
    ? topics.filter(t => t.exam_id === filterExam && (!t.sr_next_review ? t.knowledge_level < 4 : new Date(t.sr_next_review) <= new Date()))
    : [];

  // Upcoming exams with low knowledge scores (for warnings)
  const examWarnings = exams
    .filter(e => (e.daysLeft ?? 999) > 0 && (e.daysLeft ?? 999) <= 30)
    .map(exam => {
      const examTopics = topics.filter(t => t.exam_id === exam.id);
      if (examTopics.length === 0) return null;
      const avgKnowledge = examTopics.reduce((s, t) => s + (t.knowledge_level ?? 0), 0) / examTopics.length;
      const understoodPct = Math.round((examTopics.filter(t => (t.knowledge_level ?? 0) >= 3).length / examTopics.length) * 100);
      if (understoodPct >= 80) return null; // OK, no warning needed
      return { exam, avgKnowledge, understoodPct, topicCount: examTopics.length };
    })
    .filter(Boolean) as { exam: Exam; avgKnowledge: number; understoodPct: number; topicCount: number }[];

  async function handleDelete(id: string) {
    if (!confirm(t("knowledge.deleteConfirm"))) return;
    await supabase.from("topics").delete().eq("id", id);
    fetchTopics();
  }

  async function toggleStatus(topic: Topic) {
    const cycle = ["not_started", "in_progress", "understood", "needs_review"];
    const idx = cycle.indexOf(topic.status ?? "not_started");
    const next = cycle[(idx + 1) % cycle.length];
    await supabase.from("topics").update({ status: next }).eq("id", topic.id);
    fetchTopics();
  }

  async function setKnowledgeLevel(topic: Topic, level: number) {
    await supabase.from("topics").update({
      knowledge_level: level,
      last_reviewed: new Date().toISOString(),
    }).eq("id", topic.id);
    fetchTopics();
  }

  const rootTopics = filteredTopics.filter(t => !t.parent_id);

  function getChildren(parentId: string) {
    return filteredTopics.filter(t => t.parent_id === parentId);
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // Knowledge level distribution (filtered)
  const knowledgeLevels = getKnowledgeLevels(t);
  const levelDist = knowledgeLevels.map(kl => ({
    ...kl,
    count: filteredTopics.filter(t => (t.knowledge_level ?? 0) === kl.level).length,
  }));

  const upcomingExams = exams.filter(e => (e.daysLeft ?? 0) >= 0);
  const openTasks = tasks.filter(t => t.status !== "done");

  // Get exam/task name helpers
  const examName = (id: string) => exams.find(e => e.id === id)?.title ?? "?";
  const taskName = (id: string) => tasks.find(t => t.id === id)?.title ?? "?";

  function startExamReview(examId: string) {
    setFilterExam(examId);
    setReviewContext("exam");
    setShowReview(true);
  }

  return (
    <div className="p-3 sm:p-5 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white">{t("knowledge.title")}</h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">
            {filteredTopics.filter(t => t.status === "understood").length}/{filteredTopics.length} verstanden
            {dueTopics.length > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-medium ml-2">· {dueTopics.length} {t("knowledge.dueSoon")}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {dueTopics.length > 0 && (
            <button onClick={() => { setReviewContext("all"); setShowReview(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 dark:bg-amber-700 hover:bg-amber-600 dark:hover:bg-amber-600 text-white text-sm font-medium transition-colors">
              <RotateCcw size={16} /> {t("knowledge.title")} ({dueTopics.length})
            </button>
          )}
          <button onClick={() => { setParentForNew(null); setEditingTopic(null); setShowForm(true); }} className="btn-primary gap-2">
            <Plus size={16} /> {t("knowledge.newTopic")}
          </button>
        </div>
      </div>

      {/* ── Exam readiness warnings ────────────────────────────────────── */}
      {examWarnings.length > 0 && (
        <div className="space-y-2 mb-5">
          {examWarnings.map(w => (
            <div key={w.exam.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border ${
              w.understoodPct < 30 ? "bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800" :
              w.understoodPct < 60 ? "bg-orange-50 dark:bg-orange-900 border-orange-200 dark:border-orange-800" :
              "bg-yellow-50 dark:bg-yellow-900 border-yellow-100 dark:border-yellow-800"
            }`}>
              <AlertTriangle size={18} className={
                w.understoodPct < 30 ? "text-red-500 dark:text-red-400" :
                w.understoodPct < 60 ? "text-orange-500 dark:text-orange-400" : "text-yellow-500 dark:text-yellow-400"
              } />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-900 dark:text-white">
                  {w.exam.title} — {w.understoodPct}% {t("knowledge.title")}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Prüfung in {w.exam.daysLeft} Tagen · {w.topicCount} Themen zugeordnet
                </p>
              </div>
              <button onClick={() => startExamReview(w.exam.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 hover:border-brand-300 dark:hover:border-brand-700 hover:text-brand-600 dark:hover:text-brand-400 transition-colors shrink-0">
                <Brain size={12} /> {t("knowledge.title")}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Knowledge level bar */}
      {filteredTopics.length > 0 && (
        <div className="card mb-5 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
          <div className="flex justify-between text-sm mb-3">
            <span className="font-medium text-surface-700 dark:text-surface-500">{t("knowledge.title")}</span>
            <span className="text-surface-500 dark:text-surface-400">{Math.round((filteredTopics.filter(t => (t.knowledge_level ?? 0) >= 3).length / filteredTopics.length) * 100)}% gut oder besser</span>
          </div>
          <div className="h-3 bg-surface-100 dark:bg-surface-900 rounded-full overflow-hidden flex">
            {levelDist.map(ld => (
              ld.count > 0 && (
                <div key={ld.level} className={`h-full ${ld.color} transition-all`}
                  style={{ width: `${(ld.count / filteredTopics.length) * 100}%` }}
                  title={`${ld.label}: ${ld.count}`}
                />
              )
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-surface-500 dark:text-surface-400 flex-wrap">
            {levelDist.map(ld => (
              <span key={ld.level} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${ld.color}`} />
                {ld.count} {ld.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters: Module + Exam + Task ──────────────────────────────── */}
      <div className="space-y-2 mb-5">
        {/* Module filter */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-surface-400 dark:text-surface-500 font-medium w-14 shrink-0">{t("nav.modules")}:</span>
          <button onClick={() => { setFilterModule("all"); setFilterExam("all"); setFilterTask("all"); }}
            className={`badge cursor-pointer text-xs ${filterModule === "all" ? "bg-brand-600 dark:bg-brand-700 text-white" : "badge-gray dark:bg-surface-700 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-600"}`}>
            {t("grades.filterAll")}
          </button>
          {modules.map(m => (
            <button key={m.id} onClick={() => { setFilterModule(m.id); setFilterExam("all"); setFilterTask("all"); }}
              className={`badge cursor-pointer text-xs ${filterModule === m.id ? "text-white" : "badge-gray dark:bg-surface-700 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-600"}`}
              style={filterModule === m.id ? { background: m.color ?? "#6d28d9" } : {}}>
              {m.name}
            </button>
          ))}
        </div>

        {/* Exam filter */}
        {upcomingExams.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-surface-400 dark:text-surface-500 font-medium w-14 shrink-0">{t("knowledge.examLabel")}</span>
            <button onClick={() => setFilterExam("all")}
              className={`badge cursor-pointer text-xs ${filterExam === "all" ? "bg-brand-600 dark:bg-brand-700 text-white" : "badge-gray dark:bg-surface-700 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-600"}`}>
              {t("grades.filterAll")}
            </button>
            {upcomingExams.map(e => {
              const count = topics.filter(t => t.exam_id === e.id).length;
              return (
                <button key={e.id} onClick={() => setFilterExam(e.id)}
                  className={`badge cursor-pointer text-xs flex items-center gap-1 ${filterExam === e.id ? "text-white" : "badge-gray dark:bg-surface-700 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-600"}`}
                  style={filterExam === e.id ? { background: e.color ?? "#dc2626" } : {}}>
                  <GraduationCap size={10} /> {e.title}
                  {count > 0 && <span className="opacity-70">({count})</span>}
                  {(e.daysLeft ?? 999) <= 7 && <Clock size={10} className="ml-0.5" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Task filter */}
        {openTasks.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-surface-400 dark:text-surface-500 font-medium w-14 shrink-0">{t("nav.tasks")}:</span>
            <button onClick={() => setFilterTask("all")}
              className={`badge cursor-pointer text-xs ${filterTask === "all" ? "bg-brand-600 dark:bg-brand-700 text-white" : "badge-gray dark:bg-surface-700 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-600"}`}>
              {t("grades.filterAll")}
            </button>
            {openTasks.slice(0, 8).map(t => {
              const count = topics.filter(tp => tp.task_id === t.id).length;
              return (
                <button key={t.id} onClick={() => setFilterTask(t.id)}
                  className={`badge cursor-pointer text-xs ${filterTask === t.id ? "bg-blue-600 dark:bg-blue-700 text-white" : "badge-gray dark:bg-surface-700 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-600"}`}>
                  {t.title.length > 25 ? t.title.slice(0, 25) + "…" : t.title}
                  {count > 0 && <span className="opacity-70 ml-1">({count})</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {filteredTopics.length > 0 && (
        <div className="card mb-5 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
          <div className="flex flex-col sm:flex-row sm:justify-between text-sm mb-2 gap-1">
            <span className="font-medium text-surface-700 dark:text-surface-500 truncate">
              {t("knowledge.title")}
              {filterExam !== "all" && <span className="text-brand-600 dark:text-brand-400 ml-1">· {examName(filterExam)}</span>}
              {filterTask !== "all" && <span className="text-blue-600 dark:text-blue-400 ml-1">· {taskName(filterTask)}</span>}
            </span>
            <span className="text-surface-500 dark:text-surface-400">{Math.round((filteredTopics.filter(t => t.status === "understood").length / filteredTopics.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-surface-100 dark:bg-surface-900 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full transition-all"
              style={{ width: `${(filteredTopics.filter(t => t.status === "understood").length / filteredTopics.length) * 100}%` }} />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-surface-500 dark:text-surface-400 flex-wrap">
            {Object.entries(getStatusLabels(t)).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${k === "not_started" ? "bg-surface-400 dark:bg-surface-600" : k === "in_progress" ? "bg-blue-500 dark:bg-blue-400" : k === "understood" ? "bg-green-500 dark:bg-green-400" : "bg-yellow-500 dark:bg-yellow-400"}`} />
                {filteredTopics.filter(t => t.status === k).length} {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />)}</div>
      ) : rootTopics.length === 0 ? (
        <div className="text-center py-16 text-surface-400 dark:text-surface-500">
          <Brain size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("knowledge.noGoals")}</p>
          <p className="text-sm mt-1">{t("knowledge.addTopicsHint")}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {rootTopics.map(topic => (
            <TopicNode
              key={topic.id}
              topic={topic}
              children={getChildren(topic.id)}
              allTopics={filteredTopics}
              expanded={expanded}
              onToggleExpand={toggle}
              onToggleStatus={toggleStatus}
              onEdit={t => { setEditingTopic(t); setShowForm(true); }}
              onDelete={handleDelete}
              onAddChild={id => { setParentForNew(id); setEditingTopic(null); setShowForm(true); }}
              onSetLevel={setKnowledgeLevel}
              exams={exams}
              depth={0}
            />
          ))}
        </div>
      )}

      {showForm && (
        <TopicModal
          initial={editingTopic}
          parentId={parentForNew}
          modules={modules}
          exams={upcomingExams}
          tasks={openTasks}
          presetExam={filterExam !== "all" ? filterExam : undefined}
          presetTask={filterTask !== "all" ? filterTask : undefined}
          presetModule={filterModule !== "all" ? filterModule : undefined}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchTopics(); }}
        />
      )}

      {showReview && (
        <SRReviewModal
          topics={reviewContext === "exam" ? examDueTopics : dueTopics}
          contextLabel={filterExam !== "all" ? examName(filterExam) : undefined}
          onClose={() => { setShowReview(false); setReviewContext("all"); fetchTopics(); }}
        />
      )}
    </div>
  );
}

function TopicNode({ topic, children, allTopics, expanded, onToggleExpand, onToggleStatus, onEdit, onDelete, onAddChild, onSetLevel, exams, depth }: {
  topic: Topic;
  children: Topic[];
  allTopics: Topic[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleStatus: (t: Topic) => void;
  onEdit: (t: Topic) => void;
  onDelete: (id: string) => void;
  onAddChild: (id: string) => void;
  onSetLevel: (t: Topic, level: number) => void;
  exams: Exam[];
  depth: number;
}) {
  const { t } = useTranslation();
  const isExpanded = expanded.has(topic.id);
  const hasChildren = children.length > 0;
  const kl = topic.knowledge_level ?? 0;
  const linkedExam = topic.exam_id ? exams.find(e => e.id === topic.exam_id) : null;
  const statusLabels = getStatusLabels(t);
  const knowledgeLevels = getKnowledgeLevels(t);

  return (
    <div>
      <div className={`flex items-center gap-2 p-2.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-700 group ${depth > 0 ? "ml-4 sm:ml-6" : ""}`}>
        <button onClick={() => hasChildren && onToggleExpand(topic.id)} className="w-5 h-5 flex items-center justify-center shrink-0 text-surface-400 dark:text-surface-500">
          {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-2 h-2 rounded-full bg-surface-200 dark:bg-surface-700" />}
        </button>

        <button onClick={() => onToggleStatus(topic)}
          className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 cursor-pointer ${STATUS_COLORS[topic.status ?? "not_started"]} dark:${topic.status === "understood" ? "dark:bg-green-900 dark:text-green-200" : topic.status === "in_progress" ? "dark:bg-blue-900 dark:text-blue-200" : topic.status === "needs_review" ? "dark:bg-yellow-900 dark:text-yellow-200" : "dark:bg-surface-700 dark:text-surface-500"}`}>
          {statusLabels[topic.status ?? "not_started"]}
        </button>

        <span className="flex-1 text-sm text-surface-800 dark:text-surface-800 font-medium truncate">{topic.title}</span>

        {/* Exam badge */}
        {linkedExam && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 shrink-0">
            <GraduationCap size={10} /> <span className="hidden sm:inline">{linkedExam.title.length > 15 ? linkedExam.title.slice(0, 15) + "…" : linkedExam.title}</span>
          </span>
        )}

        {/* Knowledge level indicator */}
        <div className="flex gap-0.5 shrink-0">
          {knowledgeLevels.map(l => (
            <button key={l.level} onClick={() => onSetLevel(topic, l.level)}
              className={`w-3 h-3 rounded-sm transition-all ${kl >= l.level ? l.color : "bg-surface-200 dark:bg-surface-700"} hover:scale-125`}
              title={l.label}
            />
          ))}
        </div>

        {topic.description && <span className="text-xs text-surface-400 dark:text-surface-500 truncate max-w-[150px] hidden sm:block">{topic.description}</span>}

        {/* SR info */}
        {topic.sr_next_review && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            new Date(topic.sr_next_review) <= new Date() ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300" : "bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400"
          }`}>
            {new Date(topic.sr_next_review) <= new Date() ? t("knowledge.dueSoon") : new Date(topic.sr_next_review).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}
          </span>
        )}

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onAddChild(topic.id)} className="p-1.5 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 dark:text-surface-500 hover:text-brand-500 dark:hover:text-brand-400" title={t("knowledge.subTopic")}>
            <Plus size={13} />
          </button>
          <button onClick={() => onEdit(topic)} className="p-1.5 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 dark:text-surface-500" title={t("documents.edit")}>
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(topic.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900 text-surface-400 dark:text-surface-500 hover:text-red-500 dark:hover:text-red-400" title={t("documents.delete")}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {isExpanded && children.map(child => (
        <TopicNode
          key={child.id}
          topic={child}
          children={allTopics.filter(t => t.parent_id === child.id)}
          allTopics={allTopics}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onToggleStatus={onToggleStatus}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onSetLevel={onSetLevel}
          exams={exams}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

/* ── SR Review Modal ──────────────────────────────────────────────────────── */
function SRReviewModal({ topics, contextLabel, onClose }: { topics: Topic[]; contextLabel?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ good: 0, again: 0 });

  const current = topics[idx];

  async function rate(quality: number) {
    if (!current) return;
    const result = sm2(
      quality,
      current.sr_easiness ?? 2.5,
      current.sr_interval ?? 1,
      current.sr_repetitions ?? 0
    );

    await supabase.from("topics").update({
      sr_easiness: result.easiness,
      sr_interval: result.interval,
      sr_repetitions: result.repetitions,
      sr_next_review: result.nextReview.toISOString(),
      last_reviewed: new Date().toISOString(),
      knowledge_level: Math.min(4, Math.max(current.knowledge_level ?? 0, quality >= 3 ? (current.knowledge_level ?? 0) + 1 : Math.max(0, (current.knowledge_level ?? 0) - 1))),
    }).eq("id", current.id);

    setStats(s => quality >= 3 ? { ...s, good: s.good + 1 } : { ...s, again: s.again + 1 });

    if (idx + 1 >= topics.length) {
      setDone(true);
    } else {
      setIdx(i => i + 1);
      setShowAnswer(false);
    }
  }

  if (topics.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-surface-50 dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-md text-center p-4 sm:p-8">
          <Check size={32} className="mx-auto mb-4 text-green-500" />
          <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">{t("knowledge.title")}</h2>
          <p className="text-surface-500 dark:text-surface-400 text-sm mb-4">{t("knowledge.statusUnderstood")}</p>
          <button onClick={onClose} className="btn-primary w-full justify-center">{t("tasks.modal.cancel")}</button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-surface-50 dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-md text-center p-4 sm:p-8">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">{t("knowledge.title")}</h2>
          {contextLabel && <p className="text-brand-600 dark:text-brand-400 text-sm font-medium mb-1">{contextLabel}</p>}
          <p className="text-surface-500 dark:text-surface-400 mb-4">
            {stats.good + stats.again} {t("knowledge.title")}
          </p>
          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.good}</p>
              <p className="text-xs text-surface-500 dark:text-surface-400">{t("knowledge.statusUnderstood")}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500 dark:text-red-400">{stats.again}</p>
              <p className="text-xs text-surface-500 dark:text-surface-400">{t("knowledge.statusRetry")}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-primary w-full justify-center">Fertig</button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface-50 dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-surface-100 dark:border-surface-700">
          <div className="flex items-center gap-3">
            <Brain size={18} className="text-brand-600" />
            <div>
              <span className="font-semibold text-surface-900 dark:text-white">Spaced Repetition Review</span>
              {contextLabel && <p className="text-xs text-brand-600 dark:text-brand-400">{contextLabel}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-surface-400 dark:text-surface-500">{idx + 1} / {topics.length}</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700"><X size={16} /></button>
          </div>
        </div>

        <div className="h-1 bg-surface-100 dark:bg-surface-900">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${((idx) / topics.length) * 100}%` }} />
        </div>

        <div className="p-6 sm:p-8 text-center min-h-[200px] flex flex-col items-center justify-center">
          <h3 className="text-lg sm:text-xl font-bold text-surface-900 dark:text-white mb-2">{current.title}</h3>
          {current.description && !showAnswer && (
            <p className="text-surface-400 dark:text-surface-500 text-sm">{t("knowledge.canYouExplain")}</p>
          )}
          {showAnswer && current.description && (
            <p className="text-surface-600 dark:text-surface-500 mt-3 text-sm bg-surface-100 dark:bg-surface-900 rounded-xl p-4">{current.description}</p>
          )}
        </div>

        <div className="p-5 border-t border-surface-100 dark:border-surface-700">
          {!showAnswer ? (
            <button onClick={() => setShowAnswer(true)}
              className="w-full py-3 rounded-xl bg-brand-600 dark:bg-brand-700 hover:bg-brand-700 dark:hover:bg-brand-600 text-white font-medium transition-colors">
              Antwort zeigen
            </button>
          ) : (
            <div>
              <p className="text-xs text-surface-500 dark:text-surface-400 text-center mb-3">Wie gut wusstest du es?</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button onClick={() => rate(1)} className="py-2.5 rounded-xl bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300 text-sm font-medium transition-colors">Nochmal</button>
                <button onClick={() => rate(3)} className="py-2.5 rounded-xl bg-orange-100 dark:bg-orange-900 hover:bg-orange-200 dark:hover:bg-orange-800 text-orange-700 dark:text-orange-300 text-sm font-medium transition-colors">Schwer</button>
                <button onClick={() => rate(4)} className="py-2.5 rounded-xl bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800 text-green-700 dark:text-green-300 text-sm font-medium transition-colors">Gut</button>
                <button onClick={() => rate(5)} className="py-2.5 rounded-xl bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 text-sm font-medium transition-colors">Leicht</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Topic Create/Edit Modal ──────────────────────────────────────────────── */
function TopicModal({ initial, parentId, modules, exams, tasks, presetExam, presetTask, presetModule, onClose, onSaved }: {
  initial: Topic | null;
  parentId: string | null;
  modules: ReturnType<typeof useModules>["modules"];
  exams: Exam[];
  tasks: { id: string; title: string; module_id: string | null }[];
  presetExam?: string;
  presetTask?: string;
  presetModule?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    module_id: initial?.module_id ?? presetModule ?? "",
    exam_id: initial?.exam_id ?? presetExam ?? "",
    task_id: initial?.task_id ?? presetTask ?? "",
    status: initial?.status ?? "not_started",
    knowledge_level: initial?.knowledge_level ?? 0,
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string | number) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const payload = {
      title: form.title,
      description: form.description || null,
      module_id: form.module_id || null,
      exam_id: form.exam_id || null,
      task_id: form.task_id || null,
      status: form.status,
      knowledge_level: form.knowledge_level,
      parent_id: initial?.parent_id ?? parentId ?? null,
    };
    if (initial) {
      await supabase.from("topics").update(payload).eq("id", initial.id);
    } else {
      await supabase.from("topics").insert({ ...payload, user_id: user.id });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface-50 dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-surface-100 dark:border-surface-700">
          <h2 className="font-semibold text-surface-900 dark:text-white">{initial ? t("knowledge.editTopic") : parentId ? t("knowledge.addSubtopic") : t("knowledge.newTopic")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">{t("knowledge.labelTitle")} *</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder={t("knowledge.topicPlaceholder")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">{t("knowledge.labelDescription")}</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder={t("knowledge.detailsPlaceholder")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">{t("knowledge.labelModule")}</label>
              <select className="input" value={form.module_id} onChange={e => set("module_id", e.target.value)}>
                <option value="">—</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">{t("knowledge.labelStatus")}</label>
              <select className="input" value={form.status} onChange={e => set("status", e.target.value)}>
                {Object.entries(getStatusLabels(t)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-500 mb-1 flex items-center gap-1">
                <GraduationCap size={12} /> {t("knowledge.labelExam")}
              </label>
              <select className="input" value={form.exam_id} onChange={e => set("exam_id", e.target.value)}>
                <option value="">{t("knowledge.optionNone")}</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">{t("knowledge.labelTask")}</label>
              <select className="input" value={form.task_id} onChange={e => set("task_id", e.target.value)}>
                <option value="">{t("knowledge.optionNone")}</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.title.length > 30 ? t.title.slice(0, 30) + "…" : t.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-500 mb-2">{t("knowledge.labelKnowledgeLevel")}</label>
            <div className="flex gap-2 flex-wrap">
              {getKnowledgeLevels(t).map(kl => (
                <button key={kl.level} type="button"
                  onClick={() => set("knowledge_level", kl.level)}
                  className={`flex-1 min-w-12 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    form.knowledge_level >= kl.level ? `${kl.color} text-white` : "bg-surface-100 dark:bg-surface-900 text-surface-500 dark:text-surface-400"
                  }`}>
                  {kl.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t("knowledge.cancel")}</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? t("knowledge.saving") : t("knowledge.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
