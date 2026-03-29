"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useTimeLogs } from "@/lib/hooks/useTimeLogs";
import { formatDuration } from "@/lib/utils";
import { Play, Pause, Square, Timer, Trash2, RotateCcw, Coffee, BookOpen, Zap } from "lucide-react";

type TimerMode = "focus" | "short_break" | "long_break";

const PRESETS: Record<TimerMode, { label: string; seconds: number; color: string; icon: React.ReactNode }> = {
  focus:       { label: "Fokus",        seconds: 25 * 60, color: "#6d28d9", icon: <BookOpen size={14} /> },
  short_break: { label: "Kurze Pause",  seconds: 5 * 60,  color: "#059669", icon: <Coffee size={14} /> },
  long_break:  { label: "Lange Pause",  seconds: 15 * 60, color: "#2563eb", icon: <Coffee size={14} /> },
};

const FOCUS_DURATIONS = [
  { label: "25 Min", seconds: 25 * 60 },
  { label: "50 Min", seconds: 50 * 60 },
  { label: "90 Min", seconds: 90 * 60 },
];

export default function TimerPage() {
  const { modules } = useModules();
  const { logs, refetch: refetchLogs } = useTimeLogs();
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<TimerMode>("focus");
  const [targetSeconds, setTargetSeconds] = useState(25 * 60);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [autoBreak, setAutoBreak] = useState(true);
  const [useCountdown, setUseCountdown] = useState(true);
  const startRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pausedAtRef = useRef(0);
  const supabase = createClient();

  const tick = useCallback(() => {
    if (startRef.current) {
      const now = Math.floor((Date.now() - startRef.current.getTime()) / 1000) + pausedAtRef.current;
      setElapsed(now);
    }
  }, []);

  // Check if countdown is done
  useEffect(() => {
    if (useCountdown && running && !paused && elapsed >= targetSeconds) {
      // Timer finished
      handleTimerComplete();
    }
  }, [elapsed, targetSeconds, running, paused, useCountdown]);

  async function handleTimerComplete() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const finalElapsed = Math.min(elapsed, targetSeconds);

    // Play notification sound
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGUcBj+a2teleR0OVqzk5aViDACG0Oz/nUwAHYDY8f+oWgAWc9P0/7BjAA5p0Pb/t2wACGLP+P+8dAADb87+/8B7AABhzf//w4EAAFzN///EhgAAV83//8eLAABRzf//yJAAAEzN///IlQAAR83//8iaAABCzf//yJ8AAD3N///JpAAAOMz//8mpAAAzzP//yq4AAC7M///KswAAKcz//8u4AAAkzP//y70AAB/M///MwgAAGsz//8zHAAAVzP//zMwAABDM///NzwAAC8z//83SAAAL");
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}

    // Save focus session
    if (mode === "focus" && finalElapsed > 5) {
      await supabase.from("time_logs").insert({
        module_id: selectedModule || null,
        duration_seconds: finalElapsed,
        started_at: new Date(Date.now() - finalElapsed * 1000).toISOString(),
        note: note || null,
      });
      refetchLogs();
      setPomodoroCount(c => c + 1);
    }

    setRunning(false);
    setPaused(false);
    setElapsed(0);
    pausedAtRef.current = 0;
    startRef.current = null;

    // Auto-switch to break
    if (autoBreak && mode === "focus") {
      const nextMode = (pomodoroCount + 1) % 4 === 0 ? "long_break" : "short_break";
      setMode(nextMode);
      setTargetSeconds(PRESETS[nextMode].seconds);
      // Auto-start break
      setTimeout(() => startTimer(PRESETS[nextMode].seconds), 500);
    } else if (autoBreak && (mode === "short_break" || mode === "long_break")) {
      setMode("focus");
      setTargetSeconds(25 * 60);
    }
  }

  function startTimer(overrideTarget?: number) {
    const target = overrideTarget ?? targetSeconds;
    startRef.current = new Date();
    setElapsed(0);
    pausedAtRef.current = 0;
    setRunning(true);
    setPaused(false);
    intervalRef.current = setInterval(tick, 1000);
  }

  function start() {
    startTimer();
  }

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

    if (mode === "focus" && finalElapsed > 5) {
      await supabase.from("time_logs").insert({
        module_id: selectedModule || null,
        duration_seconds: finalElapsed,
        started_at: new Date(Date.now() - finalElapsed * 1000).toISOString(),
        note: note || null,
      });
      refetchLogs();
    }
  }

  function reset() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setPaused(false);
    setElapsed(0);
    pausedAtRef.current = 0;
    startRef.current = null;
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
  const h = Math.floor(displaySeconds / 3600);
  const m = Math.floor((displaySeconds % 3600) / 60);
  const sec = displaySeconds % 60;
  const timeStr = h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

  const progress = useCountdown
    ? Math.min(1, elapsed / targetSeconds)
    : (elapsed % 3600) / 3600;

  const currentPreset = PRESETS[mode];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lern-Timer</h1>
        <p className="text-gray-500 text-sm mt-0.5">Pomodoro-Technik & Lernzeit-Tracking</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-violet-600">{formatDuration(todaySecs)}</p>
          <p className="text-sm text-gray-500 mt-1">Heute gelernt</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-indigo-600">{formatDuration(weekSecs)}</p>
          <p className="text-sm text-gray-500 mt-1">Diese Woche</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center gap-1">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className={`text-2xl ${i < pomodoroCount % 4 ? "" : "opacity-20"}`}>🍅</span>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-1">{pomodoroCount} Pomodoro{pomodoroCount !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex justify-center gap-2 mb-6">
        {(Object.entries(PRESETS) as [TimerMode, typeof PRESETS["focus"]][]).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => { if (!running) { setMode(key); setTargetSeconds(preset.seconds); } }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === key
                ? "text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            style={mode === key ? { background: preset.color } : {}}
            disabled={running}
          >
            {preset.icon} {preset.label}
          </button>
        ))}
      </div>

      {/* Focus duration presets (only in focus mode) */}
      {mode === "focus" && !running && (
        <div className="flex justify-center gap-2 mb-4">
          {FOCUS_DURATIONS.map(d => (
            <button
              key={d.seconds}
              onClick={() => setTargetSeconds(d.seconds)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                targetSeconds === d.seconds
                  ? "bg-violet-100 text-violet-700 ring-1 ring-violet-300"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {d.label}
            </button>
          ))}
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
              <span className="text-4xl font-mono font-bold text-gray-900">{timeStr}</span>
              <span className="text-xs mt-1 font-medium" style={{ color: currentPreset.color }}>
                {running && !paused ? currentPreset.label : paused ? "Pausiert" : "Bereit"}
              </span>
            </div>
          </div>
        </div>

        {/* Module & note selector */}
        {!running && mode === "focus" && (
          <div className="flex gap-3 mb-5 max-w-md mx-auto">
            <select className="input flex-1" value={selectedModule} onChange={e => setSelectedModule(e.target.value)}>
              <option value="">— Modul —</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input className="input flex-1" value={note} onChange={e => setNote(e.target.value)} placeholder="Notiz…" />
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {!running ? (
            <button onClick={start} className="btn-primary gap-2 px-8 py-3 text-base">
              <Play size={18} /> Starten
            </button>
          ) : (
            <>
              <button onClick={paused ? resume : pause} className="btn-secondary gap-2 px-6 py-2.5">
                {paused ? <><Play size={16} /> Weiter</> : <><Pause size={16} /> Pause</>}
              </button>
              <button onClick={reset} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium transition-colors">
                <RotateCcw size={16} /> Reset
              </button>
              <button onClick={stop} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">
                <Square size={16} /> Stopp
              </button>
            </>
          )}
        </div>

        {/* Settings */}
        {!running && (
          <div className="flex justify-center gap-6 mt-5 pt-4 border-t border-gray-100">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={autoBreak} onChange={e => setAutoBreak(e.target.checked)}
                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
              Auto-Pause
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={useCountdown} onChange={e => setUseCountdown(e.target.checked)}
                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
              Countdown
            </label>
          </div>
        )}
      </div>

      {/* Logs */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Letzte Sitzungen</h2>
        {logs.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Timer size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Noch keine Sitzungen aufgezeichnet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.slice(0, 20).map(log => (
              <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-violet-200 group">
                <div className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: (log as any).modules?.color ?? "#6d28d9" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {(log as any).modules?.name ?? "Ohne Modul"}
                    {log.note && <span className="text-gray-400 font-normal ml-2">· {log.note}</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(log.started_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })} ·{" "}
                    {new Date(log.started_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className="text-sm font-semibold text-violet-600">{formatDuration(log.duration_seconds ?? 0)}</span>
                <button onClick={() => deleteLog(log.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
