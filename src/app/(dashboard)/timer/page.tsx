"use client";
import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useTimerSession } from "@/lib/hooks/useTimerSession";
import { useScheduleDay } from "@/lib/hooks/useSchedule";
import { useStreaks } from "@/lib/hooks/useStreaks";
import { formatDuration } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { ScheduleBlock, BlockType } from "@/lib/schedule";
import { BLOCK_TYPE_META, isLearningBlock } from "@/lib/schedule";
import type { CalendarEvent, Topic, Task } from "@/types/database";
import {
  Play, Pause, Square, RotateCcw, Coffee, BookOpen, Brain, Target,
  GraduationCap, ClipboardList, ChevronDown, ChevronUp, Flame,
  Clock, Zap, Calendar, CheckCircle2, Timer as TimerIcon,
  StickyNote, Save, X, Trash2, Layers, TrendingUp, SlidersHorizontal,
} from "lucide-react";
import { events } from "@/lib/analytics/tracker";
import PostSessionCard from "@/components/timer/PostSessionCard";
import AmbientSounds from "@/components/timer/AmbientSounds";
import SessionContextPanel from "@/components/timer/SessionContextPanel";

// ── Mode Presets ────────────────────────────────────────────────────────────

type FocusMode = "pomodoro" | "deep_work" | "free";

interface ModePreset {
  labelKey: string;
  focusMin: number;
  breakMin: number;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const MODE_PRESETS: Record<FocusMode, ModePreset> = {
  pomodoro:  { labelKey: "Pomodoro",    focusMin: 25, breakMin: 5,  icon: <TimerIcon size={16} />, color: "#6d28d9", description: "25 Min. Fokus · 5 Min. Pause" },
  deep_work: { labelKey: "Deep Work",   focusMin: 50, breakMin: 10, icon: <Brain size={16} />,     color: "#2563eb", description: "50 Min. Fokus · 10 Min. Pause" },
  free:      { labelKey: "Freie Sitzung", focusMin: 0, breakMin: 0, icon: <Clock size={16} />,     color: "#059669", description: "Ohne Zeitlimit" },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

function blockIcon(type: BlockType): React.ReactNode {
  const meta = BLOCK_TYPE_META[type];
  if (!meta) return <BookOpen size={14} />;
  const icons: Record<string, React.ReactNode> = {
    GraduationCap: <GraduationCap size={14} />, BookOpen: <BookOpen size={14} />,
    Brain: <Brain size={14} />, Target: <Target size={14} />, Layers: <Layers size={14} />,
    Coffee: <Coffee size={14} />, Clock: <Clock size={14} />, ClipboardList: <ClipboardList size={14} />,
  };
  return icons[meta.defaultIcon] || <BookOpen size={14} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// Timer Page — Central Learning Hub
// ═══════════════════════════════════════════════════════════════════════════

function TimerPageInner() {
  const { t } = useTranslation();
  const { modules } = useModules();
  const supabase = createClient();
  const timer = useTimerSession();
  const streaks = useStreaks();
  const today = todayISO();
  const scheduleDay = useScheduleDay(today);

  // ── Context Selection ──────────────────────────────────────────────────
  const [focusMode, setFocusMode] = useState<FocusMode>("pomodoro");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [note, setNote] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [postSession, setPostSession] = useState<{ visible: boolean; duration: number; moduleName?: string }>({ visible: false, duration: 0 });

  // Learning Goal — what the student wants to achieve in this session
  type LearningGoal = "weak_topic" | "flashcards" | "exam_prep" | "task" | "explore" | "free";
  const [learningGoal, setLearningGoal] = useState<LearningGoal | "">("");
  const [coachSuggestion, setCoachSuggestion] = useState<{ title: string; reason: string; goal: LearningGoal; topicId?: string; examId?: string; taskId?: string } | null>(null);

  // Context data
  const [exams, setExams] = useState<CalendarEvent[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // URL params for deep-linking
  const searchParams = useSearchParams();
  const paramExam = searchParams.get("exam");
  const paramTopic = searchParams.get("topic");
  const paramModule = searchParams.get("module");
  const paramGoal = searchParams.get("goal") as LearningGoal | null;
  const prefilledRef = useRef(false);

  // ── Session History (recent timer_sessions) ────────────────────────────
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  useEffect(() => {
    async function loadSessions() {
      const { data } = await supabase
        .from("timer_sessions")
        .select("*, module:modules(name, color)")
        .order("started_at", { ascending: false })
        .limit(15);
      setRecentSessions(data ?? []);
    }
    loadSessions();

    // Refresh on timer completion
    const handler = () => loadSessions();
    window.addEventListener("timer-session-completed", handler);
    window.addEventListener("time-log-updated", handler);
    return () => {
      window.removeEventListener("timer-session-completed", handler);
      window.removeEventListener("time-log-updated", handler);
    };
  }, [supabase]);

  // ── Fetch context data ─────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [examRes, topicRes, taskRes] = await Promise.all([
        supabase.from("events").select("*").eq("event_type", "exam")
          .gte("start_dt", new Date().toISOString()).order("start_dt"),
        supabase.from("topics").select("*").order("title"),
        supabase.from("tasks").select("*").neq("status", "done").order("due_date"),
      ]);
      const loadedExams = examRes.data ?? [];
      const loadedTopics = topicRes.data ?? [];
      setExams(loadedExams);
      setTopics(loadedTopics);
      setTasks(taskRes.data ?? []);

      // Deep-link prefill (from Smart Start, DailyActions, etc.)
      if (!prefilledRef.current && (paramExam || paramTopic || paramModule)) {
        prefilledRef.current = true;
        const topic = paramTopic ? loadedTopics.find(tp => tp.id === paramTopic) : null;
        const moduleId = paramModule || topic?.module_id || "";
        if (moduleId) setSelectedModule(moduleId);
        if (paramExam) { setSelectedExam(paramExam); setLearningGoal("exam_prep"); }
        if (paramTopic) { setSelectedTopic(paramTopic); setLearningGoal("weak_topic"); }
        if (paramGoal) setLearningGoal(paramGoal);
        setShowContext(true);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Load coach suggestion when module is selected
  useEffect(() => {
    if (!selectedModule) { setCoachSuggestion(null); return; }

    // Find the best action from Decision Engine for this module
    fetch("/api/decision")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.today?.actions) return;
        const moduleAction = data.today.actions.find((a: any) => a.moduleId === selectedModule);
        if (moduleAction) {
          let goal: LearningGoal = "free";
          if (moduleAction.type === "review_weak_topics") goal = "weak_topic";
          else if (moduleAction.type === "review_flashcards") goal = "flashcards";
          else if (moduleAction.type === "prepare_exam") goal = "exam_prep";
          else if (moduleAction.type === "complete_task") goal = "task";
          else if (moduleAction.type === "create_material") goal = "explore";

          setCoachSuggestion({
            title: moduleAction.title,
            reason: moduleAction.reason,
            goal,
            topicId: moduleAction.relatedEntityType === "topic" ? moduleAction.relatedEntityId : undefined,
            examId: moduleAction.relatedEntityType === "exam" ? moduleAction.relatedEntityId : undefined,
          });
        }
      })
      .catch(() => {});
  }, [selectedModule]);

  // Reset sub-selections when module changes
  const moduleChangeCount = useRef(0);
  useEffect(() => {
    moduleChangeCount.current++;
    if (moduleChangeCount.current <= 1 && prefilledRef.current) return;
    setSelectedExam("");
    setSelectedTopic("");
    setSelectedTask("");
    setLearningGoal("");
  }, [selectedModule]);

  // ── Today's Blocks from Smart Schedule ─────────────────────────────────
  const todayBlocks = useMemo(() => {
    if (!scheduleDay.scheduleDay) return [];
    const now = new Date();
    return scheduleDay.scheduleDay.blocks
      .filter(b =>
        isLearningBlock(b.block_type) &&
        b.status !== "completed" &&
        b.status !== "skipped" &&
        new Date(b.end_time) > now
      )
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [scheduleDay.scheduleDay]);

  // ── Filtered context ───────────────────────────────────────────────────
  const filteredExams = selectedModule
    ? exams.filter(e => e.module_id === selectedModule)
    : exams;
  const filteredTopics = selectedModule ? topics.filter(tp => tp.module_id === selectedModule) : topics;
  const filteredTasks = selectedModule ? tasks.filter(tk => tk.module_id === selectedModule) : tasks;

  // ── Weekly Goal ────────────────────────────────────────────────────────
  const weeklyGoalMinutes = 600; // 10h default — later from preferences
  const weekStudySec = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return Object.entries(streaks.last30Days)
      .filter(([date]) => new Date(date) >= weekAgo)
      .reduce((sum, [, sec]) => sum + sec, 0);
  }, [streaks.last30Days]);
  const weeklyProgress = Math.min(1, weekStudySec / (weeklyGoalMinutes * 60));

  // ── Context label ──────────────────────────────────────────────────────
  const contextLabel = useMemo(() => {
    const parts: string[] = [];
    if (selectedModule) {
      const mod = modules.find(m => m.id === selectedModule);
      if (mod) parts.push(mod.name);
    }
    if (selectedExam) {
      const ex = exams.find(e => e.id === selectedExam);
      if (ex) parts.push(ex.title);
    }
    if (selectedTopic) {
      const tp = topics.find(t => t.id === selectedTopic);
      if (tp) parts.push(tp.title);
    }
    if (selectedTask) {
      const tk = tasks.find(t => t.id === selectedTask);
      if (tk) parts.push(tk.title);
    }
    return parts.join(" · ");
  }, [selectedModule, selectedExam, selectedTopic, selectedTask, modules, exams, topics, tasks]);

  // ── Timer Actions ──────────────────────────────────────────────────────

  function handleStart() {
    const preset = MODE_PRESETS[focusMode];
    const targetMin = focusMode === "free"
      ? (customMinutes ? parseInt(customMinutes) : undefined)
      : preset.focusMin;

    const sessionType = focusMode === "deep_work" ? "deep_work" as const : "focus" as const;

    timer.start(sessionType, {
      targetMinutes: targetMin,
      moduleId: selectedModule || undefined,
      taskId: selectedTask || undefined,
      topicId: selectedTopic || undefined,
      examId: selectedExam || undefined,
    });
    events.timerStarted(selectedModule || null, targetMin ?? 0);
  }

  function handleStartFromBlock(block: ScheduleBlock) {
    timer.startFromBlock(block);
    if (block.module_id) setSelectedModule(block.module_id);
  }

  function handleStop() {
    const actualSec = timer.elapsedSeconds ?? 0;
    const actualMin = Math.round(actualSec / 60);
    const modName = modules.find(m => m.id === selectedModule)?.name;
    // Include learning goal in session note for tracking
    const sessionNote = learningGoal && learningGoal !== "free"
      ? `[goal:${learningGoal}]${note ? ` ${note}` : ""}`
      : note || undefined;
    timer.stop(undefined, sessionNote);
    events.timerCompleted(selectedModule || null, actualMin);
    setNote("");

    // DNA Micro-Update with learning goal context
    if (actualSec >= 60) {
      fetch("/api/learning-dna", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationMinutes: actualMin,
          alignment: learningGoal && learningGoal !== "free" ? "within_plan" : "unplanned",
        }),
      }).catch(() => {});
    }

    // Show post-session card with next action recommendation
    if (actualSec >= 60) {
      setPostSession({ visible: true, duration: actualSec, moduleName: modName });
    }
  }

  // ── Current preset ─────────────────────────────────────────────────────
  const activePreset = MODE_PRESETS[focusMode];
  const accentColor = timer.isRunning
    ? (timer.session?.session_type === "deep_work" ? "#2563eb" : "#6d28d9")
    : activePreset.color;

  // ── SVG Circle Progress ────────────────────────────────────────────────
  const circumference = 2 * Math.PI * 45;
  const progressOffset = circumference * (1 - (timer.progress ?? 0));

  return (
    <div className="lg:flex lg:flex-row lg:h-[calc(100vh-64px)] overflow-y-auto lg:overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════════
          LEFT: Timer Core (Main Area)
          ══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 lg:overflow-y-auto">
        <div className="max-w-2xl mx-auto p-3 sm:p-6">

          {/* Header — compact on mobile */}
          <div className="flex items-center justify-between mb-3 sm:mb-5">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-surface-900 dark:text-white">Lernzeit</h1>
              <p className="text-xs text-surface-500 mt-0.5 hidden sm:block">Fokussiert lernen, Fortschritt tracken</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Ambient Sounds */}
              <AmbientSounds isTimerRunning={timer.isRunning} />
              {/* Streak Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/30">
                <Flame size={16} className="text-orange-500" />
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{streaks.currentStreak}</span>
                <span className="text-[10px] text-orange-400">Tage</span>
              </div>
            </div>
          </div>

          {/* Post-Session: Next Action recommendation */}
          <PostSessionCard
            sessionDuration={postSession.duration}
            moduleName={postSession.moduleName}
            visible={postSession.visible}
            onDismiss={() => setPostSession({ visible: false, duration: 0 })}
          />

          {/* Quick Stats — inline row on mobile */}
          <div className="flex gap-2 sm:grid sm:grid-cols-3 sm:gap-3 mb-4 sm:mb-6 overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="rounded-xl bg-brand-50 dark:bg-brand-950/20 p-2 sm:p-3 text-center shrink-0 min-w-[90px] sm:min-w-0 flex-1">
              <p className="text-sm sm:text-lg font-bold text-brand-600">{formatDuration(weekStudySec)}</p>
              <p className="text-[10px] text-surface-500">Woche</p>
            </div>
 <div className="rounded-xl bg-surface-50 p-2 sm:p-3 text-center shrink-0 min-w-[80px] sm:min-w-0 flex-1">
              <p className="text-sm sm:text-lg font-bold text-surface-800">
                {streaks.last30Days[today] ? formatDuration(streaks.last30Days[today]) : "0m"}
              </p>
              <p className="text-[10px] text-surface-500">Heute</p>
            </div>
 <div className="rounded-xl bg-surface-50 p-2 sm:p-3 text-center shrink-0 min-w-[80px] sm:min-w-0 flex-1">
              <p className="text-sm sm:text-lg font-bold text-surface-800">{timer.pomodoroCount}</p>
              <p className="text-[10px] text-surface-500">Pomodoros</p>
            </div>
          </div>

          {/* Weekly Goal — hidden on mobile when timer running to save space */}
          <div className={`mb-4 sm:mb-6 ${timer.isRunning ? "hidden sm:block" : ""}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] sm:text-xs font-medium text-surface-500">Wochenziel</span>
              <span className="text-[11px] sm:text-xs text-surface-400">
                {Math.round(weekStudySec / 60)} / {weeklyGoalMinutes} Min.
              </span>
            </div>
 <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${weeklyProgress * 100}%`, background: accentColor }}
              />
            </div>
          </div>

          {/* ── Mode Selector (only when not running) ──────────────── */}
          {!timer.isRunning && (
            <div className="flex gap-2 mb-5 justify-center">
              {(Object.entries(MODE_PRESETS) as [FocusMode, ModePreset][]).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setFocusMode(key)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all active:scale-[0.97] ${
                    focusMode === key
                      ? "text-white shadow-md scale-[1.02]"
 :"bg-surface-100 text-surface-600 hover:bg-surface-200 dark:hover:bg-surface-700"
                  }`}
                  style={focusMode === key ? { background: preset.color } : {}}
                >
                  {preset.icon}
                  <span>{preset.labelKey}</span>
                </button>
              ))}
            </div>
          )}

          {/* Mode description */}
          {!timer.isRunning && (
            <p className="text-center text-xs text-surface-400 mb-4">{activePreset.description}</p>
          )}

          {/* Learning Goal Badge — shown during session */}
          {timer.isRunning && learningGoal && learningGoal !== "free" && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                learningGoal === "weak_topic" ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400" :
                learningGoal === "exam_prep" ? "bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400" :
                learningGoal === "task" ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400" :
                "bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400"
              }`}>
                {learningGoal === "weak_topic" ? "🎯 Thema vertiefen" :
                 learningGoal === "exam_prep" ? "🎓 Prüfungsvorbereitung" :
                 learningGoal === "task" ? "✅ Aufgabe" : "📚 Lernen"}
                {selectedTopic && topics.find(t => t.id === selectedTopic) && (
                  <span className="text-[10px] opacity-70">· {topics.find(t => t.id === selectedTopic)?.title}</span>
                )}
              </span>
            </div>
          )}

          {/* ── Timer Ring ─────────────────────────────────────────── */}
          <div className="flex justify-center mb-5 sm:mb-6">
            <div className="relative w-52 h-52 sm:w-72 sm:h-72">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none"
                  className="stroke-surface-100 dark:stroke-surface-800" strokeWidth="5" />
                <circle cx="50" cy="50" r="45" fill="none"
                  stroke={accentColor} strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={timer.isRunning ? progressOffset : circumference}
                  style={{ transition: "stroke-dashoffset 0.8s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl sm:text-6xl font-mono font-bold text-surface-900 dark:text-white tracking-tight">
                  {timer.display}
                </span>
                {timer.isRunning && !timer.isPaused && (
                  <span className="text-xs mt-2 font-medium" style={{ color: accentColor }}>
                    {timer.session?.session_type === "deep_work" ? "Deep Work" : "Fokus"}
                  </span>
                )}
                {timer.isPaused && (
                  <span className="text-xs mt-2 font-medium text-amber-500">Pausiert</span>
                )}
                {!timer.isRunning && (
                  <span className="text-xs mt-2 text-surface-400">Bereit</span>
                )}
              </div>
            </div>
          </div>

          {/* Context label while running */}
          {timer.isRunning && contextLabel && (
            <p className="text-center text-sm text-surface-500 mb-4 -mt-2 truncate max-w-md mx-auto">
              {contextLabel}
            </p>
          )}

          {/* ── Context Selection (before start) ──────────────────── */}
          {!timer.isRunning && (
            <div className="max-w-lg mx-auto mb-5 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  className="input flex-1"
                  value={selectedModule}
                  onChange={e => setSelectedModule(e.target.value)}
                >
                  <option value="">— Modul wählen —</option>
                  {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <input
                  className="input flex-1"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Notiz…"
                />
              </div>

              {/* Coach Suggestion — from Decision Engine */}
              {coachSuggestion && !learningGoal && selectedModule && (
                <button
                  onClick={() => {
                    setLearningGoal(coachSuggestion.goal);
                    if (coachSuggestion.topicId) setSelectedTopic(coachSuggestion.topicId);
                    if (coachSuggestion.examId) setSelectedExam(coachSuggestion.examId);
                    setShowContext(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800/40 hover:bg-brand-100 dark:hover:bg-brand-950/30 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
                    <Zap size={14} className="text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-brand-700 dark:text-brand-300">Coach empfiehlt:</p>
                    <p className="text-sm text-brand-600 dark:text-brand-400 truncate">{coachSuggestion.title}</p>
                  </div>
                  <span className="text-xs text-brand-500 shrink-0">Übernehmen</span>
                </button>
              )}

              {/* Learning Goal Selection */}
              {selectedModule && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-surface-500 text-center">Was möchtest du lernen?</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {([
                      { id: "weak_topic" as const, label: "Schwaches Thema", icon: "🎯", desc: "Topic vertiefen", redirect: null },
                      { id: "flashcards" as const, label: "Flashcards", icon: "⚡", desc: "Karten reviewen", redirect: `/flashcards?module=${selectedModule}` },
                      { id: "exam_prep" as const, label: "Prüfung", icon: "🎓", desc: "Gezielt vorbereiten", redirect: null },
                      { id: "task" as const, label: "Aufgabe", icon: "✅", desc: "Aufgabe erledigen", redirect: null },
                      { id: "explore" as const, label: "Erkunden", icon: "📚", desc: "Lernraum öffnen", redirect: `/modules/${selectedModule}/learn` },
                      { id: "free" as const, label: "Frei lernen", icon: "⏱️", desc: "Ohne Vorgabe", redirect: null },
                    ]).map(g => (
                      <button
                        key={g.id}
                        onClick={() => {
                          if (g.redirect) { window.location.href = g.redirect; return; }
                          setLearningGoal(g.id); if (g.id !== "free") setShowContext(true);
                        }}
                        className={`p-2 rounded-lg text-left transition-colors ${
                          learningGoal === g.id
                            ? "bg-brand-50 dark:bg-brand-950/20 border border-brand-300 dark:border-brand-700"
                            : "border border-surface-200 dark:border-surface-700 hover:border-surface-300"
                        }`}
                      >
                        <span className="text-base">{g.icon}</span>
                        <p className="text-[11px] font-medium text-surface-800 dark:text-surface-200 mt-0.5">{g.label}</p>
                        <p className="text-[9px] text-surface-400">{g.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Toggle extended context */}
              <button
                onClick={() => setShowContext(!showContext)}
                className="flex items-center gap-1.5 mx-auto text-xs text-surface-400 hover:text-brand-600 transition-colors"
              >
                {showContext ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showContext ? "Weniger Optionen" : "Details anpassen"}
              </button>

              {showContext && (
 <div className="grid gap-2 p-3 bg-surface-50 rounded-xl border border-surface-100">
                  <div className="flex items-center gap-2">
                    <GraduationCap size={14} className="text-red-400 shrink-0" />
                    <select className="input flex-1 text-sm" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
                      <option value="">— Prüfung —</option>
                      {filteredExams.map(e => (
                        <option key={e.id} value={e.id}>
                          {e.title} ({new Date(e.start_dt).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Brain size={14} className="text-purple-400 shrink-0" />
                    <select className="input flex-1 text-sm" value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}>
                      <option value="">— Thema —</option>
                      {filteredTopics.map(tp => <option key={tp.id} value={tp.id}>{tp.title}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <ClipboardList size={14} className="text-green-400 shrink-0" />
                    <select className="input flex-1 text-sm" value={selectedTask} onChange={e => setSelectedTask(e.target.value)}>
                      <option value="">— Aufgabe —</option>
                      {filteredTasks.map(tk => <option key={tk.id} value={tk.id}>{tk.title}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Free mode: custom duration */}
              {focusMode === "free" && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                  <span className="text-xs text-surface-400">Dauer:</span>
                  {[15, 30, 45, 60, 90].map(min => (
                    <button key={min}
                      onClick={() => setCustomMinutes(String(min))}
                      className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-[0.95] ${
                        customMinutes === String(min)
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-700"
 :"bg-surface-50 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700"
                      }`}
                    >
                      {min}m
                    </button>
                  ))}
                  <span className="text-xs text-surface-400">oder frei</span>
                </div>
              )}
            </div>
          )}

          {/* ── Controls ──────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-3 mb-6">
            {!timer.isRunning ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-10 py-3.5 rounded-2xl text-white font-semibold text-base shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: accentColor }}
              >
                <Play size={20} /> Starten
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={timer.isPaused ? timer.resume : timer.pause}
                    className="btn-secondary gap-2 px-5 sm:px-6 py-2.5 active:scale-[0.97]"
                  >
                    {timer.isPaused ? <><Play size={16} /> Weiter</> : <><Pause size={16} /> Pause</>}
                  </button>
                  <button
                    onClick={handleStop}
                    className="flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors active:scale-[0.97]"
                  >
                    <Square size={16} /> Stopp
                  </button>
                </div>
                {/* Note input while running */}
                <input
                  className="input w-full max-w-xs text-sm"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Notiz hinzufügen…"
                />
              </>
            )}
          </div>

          {/* Linked Block indicator */}
          {timer.isRunning && timer.linkedBlock && (
            <div className="max-w-md mx-auto mb-6 flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900">
              <Calendar size={14} className="text-brand-500 shrink-0" />
              <span className="text-xs text-brand-600 truncate">
                Geplant: {timer.linkedBlock.title} ({formatTime(timer.linkedBlock.start_time)}–{formatTime(timer.linkedBlock.end_time)})
              </span>
              <CheckCircle2 size={14} className="text-green-500 shrink-0 ml-auto" />
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          RIGHT: Sidebar — Schedule + History
          ══════════════════════════════════════════════════════════════ */}
 <div className="w-full lg:w-80 xl:w-96 lg:border-l border-surface-200 bg-surface-50/50 lg:overflow-y-auto">
        <div className="p-3 sm:p-4">

          {/* ── Session Context Panel (learning goal content) ──────── */}
          {timer.isRunning && selectedModule && (
            <SessionContextPanel
              learningGoal={learningGoal}
              moduleId={selectedModule}
              moduleName={modules.find(m => m.id === selectedModule)?.name ?? ""}
              moduleColor={modules.find(m => m.id === selectedModule)?.color}
              topicTitle={selectedTopic ? topics.find(t => t.id === selectedTopic)?.title : undefined}
              topicKnowledgeLevel={selectedTopic ? (topics.find(t => t.id === selectedTopic)?.knowledge_level ?? undefined) : undefined}
              examTitle={selectedExam ? exams.find(e => e.id === selectedExam)?.title : undefined}
              examDaysLeft={selectedExam ? (() => {
                const exam = exams.find(e => e.id === selectedExam);
                return exam ? Math.ceil((new Date(exam.start_dt).getTime() - Date.now()) / 86400000) : undefined;
              })() : undefined}
              taskTitle={selectedTask ? tasks.find(t => t.id === selectedTask)?.title : undefined}
              weakTopicCount={topics.filter(t => t.module_id === selectedModule && (t.knowledge_level ?? 0) < 50).length}
              flashcardsDue={0}
            />
          )}

          {/* ── Daily Progress (from Decision Engine) ─────────────── */}
          {streaks.last30Days[today] > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-brand-50/50 dark:bg-brand-950/10 border border-brand-100 dark:border-brand-800/30">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-brand-700 dark:text-brand-300">Tagesfortschritt</span>
                <span className="text-xs text-brand-500">
                  {formatDuration(streaks.last30Days[today])} gelernt
                </span>
              </div>
              <div className="h-1.5 bg-brand-100 dark:bg-brand-900/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (streaks.last30Days[today] / (120 * 60)) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-brand-400 mt-1">
                Ziel: 2h · {Math.round(Math.max(0, 120 - streaks.last30Days[today] / 60))} Min verbleibend
              </p>
            </div>
          )}

          {/* ── Today's Planned Blocks ────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={15} className="text-brand-500" />
              <h2 className="text-sm font-semibold text-surface-800">Heutige Blöcke</h2>
              <span className="ml-auto text-[11px] text-surface-400">
                {todayBlocks.length} offen
              </span>
            </div>

            {todayBlocks.length === 0 ? (
              <div className="text-center py-6 text-surface-400">
                <Calendar size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Keine geplanten Lernblöcke heute</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {todayBlocks.slice(0, 6).map(block => (
                  <BlockQuickStart
                    key={block.id}
                    block={block}
                    isTimerRunning={timer.isRunning}
                    onStart={handleStartFromBlock}
                  />
                ))}
                {todayBlocks.length > 6 && (
                  <p className="text-[11px] text-center text-surface-400">
                    +{todayBlocks.length - 6} weitere Blöcke
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Streak Calendar (mini heat-map) ──────────────────── */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Flame size={15} className="text-orange-500" />
              <h2 className="text-sm font-semibold text-surface-800">Lernstreak</h2>
              <span className="ml-auto text-[11px] text-orange-500 font-medium">
                {streaks.currentStreak} Tage
              </span>
            </div>
            <MiniStreakCalendar last30Days={streaks.last30Days} />
            <div className="flex items-center justify-between mt-2 text-[10px] text-surface-400">
              <span>Längster: {streaks.longestStreak} Tage</span>
              <span>Gesamt: {streaks.totalDays} Lerntage</span>
            </div>
          </div>

          {/* ── Recent Sessions ───────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={15} className="text-surface-500" />
              <h2 className="text-sm font-semibold text-surface-800">Letzte Sitzungen</h2>
            </div>

            {recentSessions.length === 0 ? (
              <div className="text-center py-6 text-surface-400">
                <TimerIcon size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Noch keine Sitzungen</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentSessions.slice(0, 10).map(session => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════════

/** Quick-start button for a scheduled block */
function BlockQuickStart({ block, isTimerRunning, onStart }: {
  block: ScheduleBlock;
  isTimerRunning: boolean;
  onStart: (block: ScheduleBlock) => void;
}) {
  const durationMin = Math.round(
    (new Date(block.end_time).getTime() - new Date(block.start_time).getTime()) / 60000
  );
  const color = block.color || block.module?.color || BLOCK_TYPE_META[block.block_type]?.defaultColor || "#6d28d9";

  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 hover:border-brand-200 dark:hover:border-brand-800 transition-colors group">
      <div className="w-1.5 h-8 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-800 truncate">{block.title}</p>
        <p className="text-[11px] text-surface-400">
          {formatTime(block.start_time)}–{formatTime(block.end_time)} · {durationMin} Min.
        </p>
      </div>
      {!isTimerRunning && (
        <button
          onClick={() => onStart(block)}
          className="shrink-0 p-2 rounded-lg bg-brand-50 dark:bg-brand-950/30 text-brand-600 hover:bg-brand-100 dark:hover:bg-brand-900/50 opacity-0 group-hover:opacity-100 transition-all"
          title="Block starten"
        >
          <Play size={14} />
        </button>
      )}
    </div>
  );
}

/** Mini 30-day streak calendar */
function MiniStreakCalendar({ last30Days }: { last30Days: Record<string, number> }) {
  const days = useMemo(() => {
    const result: { date: string; seconds: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      result.push({ date: key, seconds: last30Days[key] || 0 });
    }
    return result;
  }, [last30Days]);

  const threshold = 15 * 60; // 15 min = active day

  return (
    <div className="grid grid-cols-10 gap-1">
      {days.map(day => {
        const intensity = day.seconds === 0 ? 0
          : day.seconds < threshold ? 1
          : day.seconds < 3600 ? 2
          : day.seconds < 7200 ? 3
          : 4;
        const colors = [
"bg-surface-100",
          "bg-orange-100 dark:bg-orange-900/30",
          "bg-orange-200 dark:bg-orange-800/40",
          "bg-orange-400 dark:bg-orange-600/60",
          "bg-orange-500 dark:bg-orange-500/80",
        ];
        return (
          <div
            key={day.date}
            className={`w-full aspect-square rounded-sm ${colors[intensity]}`}
            title={`${day.date}: ${day.seconds > 0 ? formatDuration(day.seconds) : "—"}`}
          />
        );
      })}
    </div>
  );
}

/** Recent session row */
function SessionRow({ session }: { session: any }) {
  const duration = session.effective_seconds || session.actual_duration_seconds || 0;
  const moduleName = session.module?.name || "Freie Sitzung";
  const moduleColor = session.module?.color || "#94a3b8";
  const date = new Date(session.started_at);
  const isToday = date.toDateString() === new Date().toDateString();
  const alignment = session.alignment;

  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white dark:bg-surface-800 dark:hover:bg-surface-800 transition-colors">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: moduleColor }} />
      <div className="flex-1 min-w-0">
 <p className="text-xs font-medium text-surface-700 truncate">{moduleName}</p>
        <p className="text-[10px] text-surface-400">
          {isToday ? "Heute" : date.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })} · {date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
          {alignment === "within_plan" && " · geplant"}
        </p>
      </div>
      <span className="text-xs font-semibold text-surface-600 shrink-0">{formatDuration(duration)}</span>
      {alignment === "within_plan" && (
        <CheckCircle2 size={12} className="text-green-500 shrink-0" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Export with Suspense boundary (for useSearchParams)
// ═══════════════════════════════════════════════════════════════════════════

export default function TimerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh] lg:h-[calc(100vh-64px)]">
        <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TimerPageInner />
    </Suspense>
  );
}
