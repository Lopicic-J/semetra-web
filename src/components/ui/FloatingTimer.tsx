"use client";

import { useState, useEffect, useCallback } from "react";
import { Pause } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface TimerInfo {
  startedAt: string;
  plannedMinutes: number | null;
  status: "active" | "paused";
  moduleName: string | null;
  moduleColor: string | null;
}

/**
 * Floating timer bubble that appears when a timer is running.
 *
 * Reads timer state from TWO sources:
 * 1. localStorage (instant — written by useTimerSession hook)
 * 2. Server API (backup — polls /api/timer-sessions?active=true)
 *
 * This ensures the bubble appears immediately when navigating away
 * from the timer page, even before the server session is created.
 */
export default function FloatingTimer() {
  const router = useRouter();
  const pathname = usePathname();
  const [timer, setTimer] = useState<TimerInfo | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Read from localStorage first (instant), then server (backup)
  const syncState = useCallback(() => {
    // Source 1: localStorage (written by useTimerSession)
    try {
      const stored = localStorage.getItem("semetra_active_timer");
      if (stored) {
        const parsed = JSON.parse(stored) as TimerInfo;
        if (parsed.startedAt && (parsed.status === "active" || parsed.status === "paused")) {
          setTimer(parsed);
          return; // localStorage has data, skip server
        }
      }
    } catch { /* ignore */ }

    // Source 2: Server (fallback when localStorage is empty)
    fetch("/api/timer-sessions?active=true")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const s = data?.session ?? data;
        if (s?.id && (s.status === "active" || s.status === "paused")) {
          setTimer({
            startedAt: s.started_at,
            plannedMinutes: s.planned_duration_minutes,
            status: s.status,
            moduleName: s.module?.name ?? null,
            moduleColor: s.module?.color ?? null,
          });
        } else {
          setTimer(null);
        }
      })
      .catch(() => {});
  }, []);

  // Sync on mount + poll every 3s + listen for events
  useEffect(() => {
    syncState();
    const interval = setInterval(syncState, 3000);

    // Listen for localStorage changes from timer page (same-tab and cross-tab)
    const onStorage = (e: StorageEvent) => {
      if (e.key === "semetra_active_timer") syncState();
    };
    window.addEventListener("storage", onStorage);

    // Listen for timer events
    const onCompleted = () => { setTimer(null); };
    const onUpdate = () => { setTimeout(syncState, 200); };
    window.addEventListener("timer-session-completed", onCompleted);
    window.addEventListener("time-log-updated", onUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("timer-session-completed", onCompleted);
      window.removeEventListener("time-log-updated", onUpdate);
    };
  }, [syncState]);

  // Tick elapsed time client-side
  useEffect(() => {
    if (!timer || timer.status === "paused") return;

    const startedAt = new Date(timer.startedAt).getTime();
    if (isNaN(startedAt)) return;

    const tick = () => {
      const totalSec = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(Math.max(0, totalSec));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Don't show on timer page or when no timer
  if (!timer || pathname === "/timer") return null;

  const planned = (timer.plannedMinutes ?? 0) * 60;
  const remaining = planned > 0 ? Math.max(0, planned - elapsed) : 0;
  const isCountdown = planned > 0;
  const displaySeconds = isCountdown ? remaining : elapsed;

  const mins = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;
  const display = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const progress = isCountdown && planned > 0 ? Math.min(1, elapsed / planned) : 0;
  const isPaused = timer.status === "paused";
  const moduleColor = timer.moduleColor ?? "#6d28d9";

  // SVG circle
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);

  return (
    <button
      onClick={() => router.push("/timer")}
      className="fixed z-50 bottom-[104px] right-6 group"
      title="Zum Timer"
    >
      <div className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
        isPaused
          ? "bg-amber-500 shadow-amber-500/30"
          : "bg-surface-900 dark:bg-surface-100 shadow-surface-900/30 dark:shadow-surface-100/30"
      }`}>
        {/* Progress ring */}
        {isCountdown && !isPaused && (
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="3"
              className="text-white/20 dark:text-black/20" />
            <circle cx="28" cy="28" r={r} fill="none" strokeWidth="3"
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              style={{ color: moduleColor, transition: "stroke-dashoffset 1s linear" }}
              stroke="currentColor" />
          </svg>
        )}

        {/* Time display */}
        <div className="relative z-10 text-center">
          {isPaused && <Pause size={14} className="text-white mx-auto mb-0.5" />}
          <span className={`text-[11px] font-bold tabular-nums leading-none ${
            isPaused ? "text-white" : "text-white dark:text-black"
          }`}>
            {display}
          </span>
        </div>

        {/* Pulse ring when active */}
        {!isPaused && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: moduleColor }} />
        )}
      </div>

      {/* Module name tooltip on hover */}
      {timer.moduleName && (
        <div className="absolute bottom-full right-0 mb-2 px-2 py-1 rounded-lg bg-surface-900 dark:bg-surface-100 text-white dark:text-black text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {timer.moduleName}
        </div>
      )}
    </button>
  );
}
