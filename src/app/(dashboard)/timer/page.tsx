"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useTimeLogs } from "@/lib/hooks/useTimeLogs";
import { formatDuration } from "@/lib/utils";
import { Play, Pause, Square, Timer, Trash2 } from "lucide-react";

export default function TimerPage() {
  const { modules } = useModules();
  const { logs, refetch: refetchLogs } = useTimeLogs();
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pausedAtRef = useRef(0);
  const supabase = createClient();

  const tick = useCallback(() => {
    if (startRef.current) {
      setElapsed(Math.floor((Date.now() - startRef.current.getTime()) / 1000) + pausedAtRef.current);
    }
  }, []);

  function start() {
    startRef.current = new Date();
    setRunning(true);
    setPaused(false);
    intervalRef.current = setInterval(tick, 1000);
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

    if (finalElapsed > 5) {
      await supabase.from("time_logs").insert({
        module_id: selectedModule || null,
        duration_seconds: finalElapsed,
        started_at: new Date(Date.now() - finalElapsed * 1000).toISOString(),
        note: note || null,
      });
      refetchLogs();
    }
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  async function deleteLog(id: string) {
    await supabase.from("time_logs").delete().eq("id", id);
    refetchLogs();
  }

  // Today stats
  const today = new Date().toDateString();
  const todayLogs = logs.filter(l => new Date(l.started_at).toDateString() === today);
  const todaySecs = todayLogs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0);
  const weekSecs = logs.filter(l => {
    const d = new Date(l.started_at);
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo;
  }).reduce((s, l) => s + (l.duration_seconds ?? 0), 0);

  // Format as HH:MM:SS for display
  function formatTimer(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lern-Timer</h1>
        <p className="text-gray-500 text-sm mt-0.5">Tracke deine Lernzeit</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-violet-600">{formatDuration(todaySecs)}</p>
          <p className="text-sm text-gray-500 mt-1">Heute gelernt</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-indigo-600">{formatDuration(weekSecs)}</p>
          <p className="text-sm text-gray-500 mt-1">Diese Woche</p>
        </div>
      </div>

      {/* Timer */}
      <div className="card text-center mb-6">
        {/* Clock face */}
        <div className="flex items-center justify-center mb-6 mt-2">
          <div className="relative w-48 h-48">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f0ff" strokeWidth="8" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="#6d28d9" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - (elapsed % 3600) / 3600)}`}
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-mono font-bold text-gray-900">{formatTimer(elapsed)}</span>
              <span className="text-xs text-gray-400 mt-1">{running && !paused ? "läuft" : paused ? "pausiert" : "bereit"}</span>
            </div>
          </div>
        </div>

        {/* Module & note selector */}
        {!running && (
          <div className="flex gap-3 mb-5 max-w-sm mx-auto">
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
              <button onClick={stop} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">
                <Square size={16} /> Stopp
              </button>
            </>
          )}
        </div>
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
                <div className={`w-2.5 h-2.5 rounded-full shrink-0`}
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
