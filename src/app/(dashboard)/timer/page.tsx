"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useTimeLogs } from "@/lib/hooks/useTimeLogs";
import { formatDuration } from "@/lib/utils";
import {
  Play, Pause, Square, Timer, Trash2, RotateCcw, Coffee, BookOpen,
  GraduationCap, Brain, ClipboardList, SlidersHorizontal, ChevronDown, ChevronUp,
  Pencil, Save, X, StickyNote
} from "lucide-react";
import type { CalendarEvent, Topic, Task } from "@/types/database";
import { useTranslation } from "@/lib/i18n";

type TimerMode = "focus" | "short_break" | "long_break";

export default function TimerPage() {
  const { t } = useTranslation();
  const { modules } = useModules();
  const { logs, refetch: refetchLogs } = useTimeLogs();
  const supabase = createClient();

  // Build runtime constants with translations
  const PRESETS: Record<TimerMode, { label: string; seconds: number; color: string; icon: React.ReactNode }> = {
    focus:       { label: t("timer.focus"),        seconds: 25 * 60, color: "#6d28d9", icon: <BookOpen size={14} /> },
    short_break: { label: t("timer.shortBreak"),  seconds: 5 * 60,  color: "#059669", icon: <Coffee size={14} /> },
    long_break:  { label: t("timer.longBreak"),   seconds: 15 * 60, color: "#2563eb", icon: <Coffee size={14} /> },
  };

  const FOCUS_DURATIONS = [
    { label: `15 ${t("timer.minutes")}`, seconds: 15 * 60 },
    { label: `25 ${t("timer.minutes")}`, seconds: 25 * 60 },
    { label: `50 ${t("timer.minutes")}`, seconds: 50 * 60 },
    { label: `90 ${t("timer.minutes")}`, seconds: 90 * 60 },
  ];

  // Context selection
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<string>("");
  const [note, setNote] = useState("");
  const [showContext, setShowContext] = useState(false);

  // Context data (fetched from Supabase)
  const [exams, setExams] = useState<CalendarEvent[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Timer state
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<TimerMode>("focus");
  const [targetSeconds, setTargetSeconds] = useState(25 * 60);
  const [customMinutes, setCustomMinutes] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [autoBreak, setAutoBreak] = useState(true);
  const [useCountdown, setUseCountdown] = useState(true);
  const startRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pausedAtRef = useRef(0);

  // URL params for deep-linking from study plan
  const searchParams = useSearchParams();
  const paramExam = searchParams.get("exam");
  const paramTopic = searchParams.get("topic");
  const paramModule = searchParams.get("module");
  const prefilledRef = useRef(false);

  // Fetch exams, topics, tasks
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

      // Pre-select from URL params (study plan deep link)
      if (!prefilledRef.current && (paramExam || paramTopic || paramModule)) {
        prefilledRef.current = true;

        // Find topic first to resolve module
        const topic = paramTopic ? loadedTopics.find(tp => tp.id === paramTopic) : null;
        const moduleId = paramModule || topic?.module_id || "";

        if (moduleId) setSelectedModule(moduleId);
        if (paramExam) setSelectedExam(paramExam);
        if (paramTopic) setSelectedTopic(paramTopic);

        // Auto-open context panel so user sees what's selected
        setShowContext(true);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Filter context by module
  const filteredExams = selectedModule
    ? exams.filter(e => {
        const mod = modules.find(m => m.id === selectedModule);
        return mod && e.title.toLowerCase().includes(mod.name.toLowerCase().split(" ")[0]);
      })
    : exams;

  const filteredTopics = selectedModule
    ? topics.filter(t => t.module_id === selectedModule)
    : topics;

  const filteredTasks = selectedModule
    ? tasks.filter(t => t.module_id === selectedModule)
    : tasks;

  // Reset sub-selections when module changes (skip on initial prefill from URL)
  const moduleChangeCount = useRef(0);
  useEffect(() => {
    moduleChangeCount.current++;
    // Skip the first change if it came from URL prefill
    if (moduleChangeCount.current <= 1 && prefilledRef.current) return;
    setSelectedExam("");
    setSelectedTopic("");
    setSelectedTask("");
  }, [selectedModule]);

  const tick = useCallback(() => {
    if (startRef.current) {
      const now = Math.floor((Date.now() - startRef.current.getTime()) / 1000) + pausedAtRef.current;
      setElapsed(now);
    }
  }, []);

  // Check if countdown is done
  useEffect(() => {
    if (useCountdown && running && !paused && elapsed >= targetSeconds) {
      handleTimerComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, targetSeconds, running, paused, useCountdown]);

  async function saveLog(duration: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || duration <= 5) return;
    await supabase.from("time_logs").insert({
      user_id: user.id,
      module_id: selectedModule || null,
      exam_id: selectedExam || null,
      topic_id: selectedTopic || null,
      task_id: selectedTask || null,
      duration_seconds: duration,
      started_at: new Date(Date.now() - duration * 1000).toISOString(),
      note: note || null,
    });
    refetchLogs();
  }

  async function handleTimerComplete() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const finalElapsed = Math.min(elapsed, targetSeconds);

    try {
      const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGUcBj+a2teleR0OVqzk5aViDACG0Oz/nUwAHYDY8f+oWgAWc9P0/7BjAA5p0Pb/t2wACGLP+P+8dAADb87+/8B7AABhzf//w4EAAFzN///EhgAAV83//8eLAABRzf//yJAAAEzN///IlQAAR83//8iaAABCzf//yJ8AAD3N///JpAAAOMz//8mpAAAzzP//yq4AAC7M///KswAAKcz//8u4AAAkzP//y70AAB/M///MwgAAGsz//8zHAAAVzP//zMwAABDM///NzwAAC8z//83SAAAL");
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}

    if (mode === "focus") {
      await saveLog(finalElapsed);
      setPomodoroCount(c => c + 1);
    }

    setRunning(false);
    setPaused(false);
    setElapsed(0);
    pausedAtRef.current = 0;
    startRef.current = null;

    if (autoBreak && mode === "focus") {
      const nextMode = (pomodoroCount + 1) % 4 === 0 ? "long_break" : "short_break";
      setMode(nextMode);
      setTargetSeconds(PRESETS[nextMode].seconds);
      setTimeout(() => startTimer(PRESETS[nextMode].seconds), 500);
    } else if (autoBreak && (mode === "short_break" || mode === "long_break")) {
      setMode("focus");
      setTargetSeconds(25 * 60);
    }
  }

  function startTimer(overrideTarget?: number) {
    startRef.current = new Date();
    setElapsed(0);
    pausedAtRef.current = 0;
    setRunning(true);
    setPaused(false);
    intervalRef.current = setInterval(tick, 1000);
  }

  function start() { startTimer(); }

  function pause() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    pausedAtRef.current = elapsed;
    startRef.current = null;
    setPaused(true);
  }

  function resume() {
    startRef.current = new Date();
    setPaused(false);
    intervalRef.current = setInterval(tick, 1000);
  }

  async function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const finalElapsed = elapsed;
    setRunning(false);
    setPaused(false);
    setElapsed(0);
    pausedAtRef.current = 0;
    startRef.current = null;
    if (mode === "focus") await saveLog(finalElapsed);
  }

  function reset() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setPaused(false);
    setElapsed(0);
    pausedAtRef.current = 0;
    startRef.current = null;
  }

  function applyCustomDuration() {
    const mins = parseInt(customMinutes);
    if (mins > 0 && mins <= 600) {
      setTargetSeconds(mins * 60);
      setShowCustom(false);
    }
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  async function deleteLog(id: string) {
    await supabase.from("time_logs").delete().eq("id", id);
    refetchLogs();
  }

  // Stats
  const today = new Date().toDateString();
  const todayLogs = logs.filter(l => new Date(l.started_at).toDateString() === today);
  const todaySecs = todayLogs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0);
  const weekSecs = logs.filter(l => {
    const d = new Date(l.started_at);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }).reduce((s, l) => s + (l.duration_seconds ?? 0), 0);

  // Display time
  const displaySeconds = useCountdown ? Math.max(0, targetSeconds - elapsed) : elapsed;
  const hh = Math.floor(displaySeconds / 3600);
  const mm = Math.floor((displaySeconds % 3600) / 60);
  const ss = displaySeconds % 60;
  const timeStr = hh > 0
    ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  const progress = useCountdown
    ? Math.min(1, elapsed / targetSeconds)
    : (elapsed % 3600) / 3600;

  const currentPreset = PRESETS[mode];

  // Build context label for running state
  const contextParts: string[] = [];
  if (selectedModule) {
    const mod = modules.find(m => m.id === selectedModule);
    if (mod) contextParts.push(mod.name);
  }
  if (selectedExam) {
    const ex = exams.find(e => e.id === selectedExam);
    if (ex) contextParts.push(`🎓 ${ex.title}`);
  }
  if (selectedTopic) {
    const tp = topics.find(t => t.id === selectedTopic);
    if (tp) contextParts.push(`🧠 ${tp.title}`);
  }
  if (selectedTask) {
    const tk = tasks.find(t => t.id === selectedTask);
    if (tk) contextParts.push(`📋 ${tk.title}`);
  }
  const contextLabel = contextParts.join(" · ");

  // Helper to resolve context names for log entries
  function logContextLabel(log: any): string {
    const parts: string[] = [];
    if (log.modules?.name) parts.push(log.modules.name);
    if (log.exam_id) {
      const ex = exams.find(e => e.id === log.exam_id);
      if (ex) parts.push(`🎓 ${ex.title}`);
    }
    if (log.topic_id) {
      const tp = topics.find(t => t.id === log.topic_id);
      if (tp) parts.push(`🧠 ${tp.title}`);
    }
    if (log.task_id) {
      const tk = tasks.find(t => t.id === log.task_id);
      if (tk) parts.push(`📋 ${tk.title}`);
    }
    return parts.length > 0 ? parts.join(" · ") : t("timer.freeSession");
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-surface-900">{t("nav.timer")}</h1>
        <p className="text-surface-500 text-sm mt-0.5">{t("navigator.timerDesc")}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-brand-600">{formatDuration(todaySecs)}</p>
          <p className="text-sm text-surface-500 mt-1">{t("timer.todayLearned")}</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-brand-700">{formatDuration(weekSecs)}</p>
          <p className="text-sm text-surface-500 mt-1">{t("timer.thisWeek")}</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center gap-1">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className={`text-2xl ${i < pomodoroCount % 4 ? "" : "opacity-20"}`}>🍅</span>
            ))}
          </div>
          <p className="text-sm text-surface-500 mt-1">{pomodoroCount} Pomodoro{pomodoroCount !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex justify-center gap-2 mb-6">
        {(Object.entries(PRESETS) as [TimerMode, typeof PRESETS["focus"]][]).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => { if (!running) { setMode(key); setTargetSeconds(preset.seconds); setShowCustom(false); } }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === key
                ? "text-white shadow-sm"
                : "bg-surface-100 text-surface-600 hover:bg-surface-200"
            }`}
            style={mode === key ? { background: preset.color } : {}}
            disabled={running}
          >
            {preset.icon} {preset.label}
          </button>
        ))}
      </div>

      {/* Focus duration presets + custom */}
      {mode === "focus" && !running && (
        <div className="flex justify-center items-center gap-2 mb-4 flex-wrap">
          {FOCUS_DURATIONS.map(d => (
            <button
              key={d.seconds}
              onClick={() => { setTargetSeconds(d.seconds); setShowCustom(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                targetSeconds === d.seconds && !showCustom
                  ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300"
                  : "bg-surface-50 text-surface-500 hover:bg-surface-100"
              }`}
            >
              {d.label}
            </button>
          ))}
          {/* Custom duration button */}
          {!showCustom ? (
            <button
              onClick={() => setShowCustom(true)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !FOCUS_DURATIONS.some(d => d.seconds === targetSeconds)
                  ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300"
                  : "bg-surface-50 text-surface-500 hover:bg-surface-100"
              }`}
            >
              <SlidersHorizontal size={12} /> {t("timer.custom")}
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                max="600"
                value={customMinutes}
                onChange={e => setCustomMinutes(e.target.value)}
                onKeyDown={e => e.key === "Enter" && applyCustomDuration()}
                placeholder="Min."
                className="w-20 px-2 py-1.5 rounded-lg border border-brand-300 text-xs text-center focus:outline-none focus:ring-2 focus:ring-brand-400"
                autoFocus
              />
              <button
                onClick={applyCustomDuration}
                className="px-2.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
              >
                OK
              </button>
              <button
                onClick={() => setShowCustom(false)}
                className="px-2 py-1.5 rounded-lg text-surface-400 hover:bg-surface-100 text-xs"
              >
                ✕
              </button>
            </div>
          )}
          {/* Show current custom if not a preset */}
          {!showCustom && !FOCUS_DURATIONS.some(d => d.seconds === targetSeconds) && (
            <span className="text-xs text-brand-600 font-medium">
              ({Math.round(targetSeconds / 60)} Min.)
            </span>
          )}
        </div>
      )}

      {/* Timer */}
      <div className="card text-center mb-6">
        <div className="flex items-center justify-center mb-6 mt-2">
          <div className="relative w-56 h-56">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f0ff" strokeWidth="6" />
              <circle cx="50" cy="50" r="45" fill="none"
                stroke={currentPreset.color}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress)}`}
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-mono font-bold text-surface-900">{timeStr}</span>
              <span className="text-xs mt-1 font-medium" style={{ color: currentPreset.color }}>
                {running && !paused ? currentPreset.label : paused ? t("timer.paused") : t("timer.ready")}
              </span>
            </div>
          </div>
        </div>

        {/* Context label while running */}
        {running && contextLabel && (
          <p className="text-sm text-surface-500 mb-4 -mt-2 truncate max-w-md mx-auto">{contextLabel}</p>
        )}

        {/* Module + Context selectors */}
        {!running && mode === "focus" && (
          <div className="max-w-lg mx-auto mb-5 space-y-3">
            {/* Module + Note (always visible) */}
            <div className="flex gap-3">
              <select className="input flex-1" value={selectedModule} onChange={e => setSelectedModule(e.target.value)}>
                <option value="">— {t("studiengaenge.modal.module")} —</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input className="input flex-1" value={note} onChange={e => setNote(e.target.value)} placeholder={t("timer.noteLabel")} />
            </div>

            {/* Toggle for extended context */}
            <button
              onClick={() => setShowContext(!showContext)}
              className="flex items-center gap-1.5 mx-auto text-xs text-surface-400 hover:text-brand-600 transition-colors"
            >
              {showContext ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showContext ? t("timer.lessOptions") : t("timer.selectTopic")}
            </button>

            {/* Extended selectors */}
            {showContext && (
              <div className="grid grid-cols-1 gap-2 p-3 bg-surface-50 rounded-xl border border-surface-100">
                {/* Exam selector */}
                <div className="flex items-center gap-2">
                  <GraduationCap size={14} className="text-red-400 shrink-0" />
                  <select className="input flex-1 text-sm" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
                    <option value="">— {t("timer.exam")} —</option>
                    {filteredExams.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.title} ({new Date(e.start_dt).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Topic selector */}
                <div className="flex items-center gap-2">
                  <Brain size={14} className="text-purple-400 shrink-0" />
                  <select className="input flex-1 text-sm" value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}>
                    <option value="">— {t("timer.topic")} —</option>
                    {filteredTopics.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>

                {/* Task selector */}
                <div className="flex items-center gap-2">
                  <ClipboardList size={14} className="text-green-400 shrink-0" />
                  <select className="input flex-1 text-sm" value={selectedTask} onChange={e => setSelectedTask(e.target.value)}>
                    <option value="">— {t("nav.tasks")} —</option>
                    {filteredTasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>

                {/* Context summary */}
                {contextLabel && (
                  <p className="text-[10px] text-surface-400 mt-1 text-center truncate">
                    {t("timer.learningContext")} {contextLabel}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {!running ? (
            <button onClick={start} className="btn-primary gap-2 px-8 py-3 text-base">
              <Play size={18} /> {t("timer.start")}
            </button>
          ) : (
            <>
              <button onClick={paused ? resume : pause} className="btn-secondary gap-2 px-6 py-2.5">
                {paused ? <><Play size={16} /> {t("timer.resume")}</> : <><Pause size={16} /> {t("timer.pauseLabel")}</>}
              </button>
              <button onClick={reset} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-100 hover:bg-surface-200 text-surface-600 font-medium transition-colors">
                <RotateCcw size={16} /> {t("timer.reset")}
              </button>
              <button onClick={stop} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">
                <Square size={16} /> {t("timer.stop")}
              </button>
            </>
          )}
        </div>

        {/* Settings */}
        {!running && (
          <div className="flex justify-center gap-6 mt-5 pt-4 border-t border-surface-100">
            <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
              <input type="checkbox" checked={autoBreak} onChange={e => setAutoBreak(e.target.checked)}
                className="rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
              {t("timer.autoPause")}
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
              <input type="checkbox" checked={useCountdown} onChange={e => setUseCountdown(e.target.checked)}
                className="rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
              {t("timer.countdownLabel")}
            </label>
          </div>
        )}
      </div>

      {/* Logs */}
      <div>
        <h2 className="font-semibold text-surface-900 mb-3">{t("timer.lastSessions")}</h2>
        {logs.length === 0 ? (
          <div className="text-center py-10 text-surface-400">
            <Timer size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t("timer.noSessions")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.slice(0, 20).map(log => (
              <SessionLogRow
                key={log.id}
                log={log}
                contextLabel={logContextLabel(log)}
                onDelete={deleteLog}
                onNoteUpdated={refetchLogs}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Individual session log row with inline note editing */
function SessionLogRow({ log, contextLabel, onDelete, onNoteUpdated }: {
  log: any;
  contextLabel: string;
  onDelete: (id: string) => void;
  onNoteUpdated: () => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(log.note ?? "");
  const [saving, setSaving] = useState(false);

  async function saveNote() {
    setSaving(true);
    await supabase.from("time_logs").update({ note: noteText.trim() || null }).eq("id", log.id);
    setSaving(false);
    setEditingNote(false);
    onNoteUpdated();
  }

  function cancelEdit() {
    setNoteText(log.note ?? "");
    setEditingNote(false);
  }

  return (
    <div className="rounded-xl bg-white border border-surface-100 hover:border-brand-200 group transition-colors">
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: log.modules?.color ?? "#6d28d9" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-800 truncate">{contextLabel}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-surface-400">
              {new Date(log.started_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })} ·{" "}
              {new Date(log.started_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
            </p>
            {!editingNote && log.note && (
              <span className="text-xs text-surface-400 truncate">· {log.note}</span>
            )}
          </div>
        </div>
        <span className="text-sm font-semibold text-brand-600 shrink-0">{formatDuration(log.duration_seconds ?? 0)}</span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => { setEditingNote(!editingNote); setNoteText(log.note ?? ""); }}
            className={`p-1.5 rounded-lg transition-colors ${editingNote ? "bg-brand-100 text-brand-600" : "hover:bg-surface-100 text-surface-400"}`}
            title={t("timer.editNote")}
          >
            <StickyNote size={13} />
          </button>
          <button onClick={() => onDelete(log.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Inline note editor */}
      {editingNote && (
        <div className="px-3 pb-3 pt-0">
          <div className="flex gap-2 items-start">
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder={t("timer.notePlaceholder")}
              className="input flex-1 text-sm resize-none"
              rows={2}
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote();
                if (e.key === "Escape") cancelEdit();
              }}
            />
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={saveNote}
                disabled={saving}
                className="p-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                title={t("timer.saveNote")}
              >
                {saving ? <span className="w-3 h-3 block border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={13} />}
              </button>
              <button
                onClick={cancelEdit}
                className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400"
                title={t("timer.cancelEdit")}
              >
                <X size={13} />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-surface-400 mt-1">{t("timer.ctrlSaveEscCancel")}</p>
        </div>
      )}
    </div>
  );
}
