"use client";

import { useState, useEffect, useCallback } from "react";
import { Timer, Pause, Square } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface ActiveSession {
  id: string;
  status: "active" | "paused";
  session_type: string;
  started_at: string;
  planned_duration_minutes: number | null;
  module_id: string | null;
  total_pause_seconds: number;
  module?: { name: string; color: string } | null;
}

/**
 * Floating timer bubble that appears when a timer is running.
 * Syncs with the server-side session and shows remaining/elapsed time.
 * Clicking navigates to the timer page.
 * Hidden on the timer page itself.
 */
export default function FloatingTimer() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Poll for active session every 5s
  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch("/api/timer-sessions?active=true");
      if (res.ok) {
        const data = await res.json();
        const s = data?.session ?? data;
        if (s && s.id && (s.status === "active" || s.status === "paused")) {
          setSession(s);
        } else {
          setSession(null);
        }
      } else {
        setSession(null);
      }
    } catch {
      // Offline or error — keep current state
    }
  }, []);

  // Initial fetch + poll
  useEffect(() => {
    fetchActive();
    const interval = setInterval(fetchActive, 5000);

    // Listen for timer events to update immediately
    const onCompleted = () => { setSession(null); };
    const onStarted = () => { setTimeout(fetchActive, 500); };
    window.addEventListener("timer-session-completed", onCompleted);
    window.addEventListener("time-log-updated", onStarted);

    return () => {
      clearInterval(interval);
      window.removeEventListener("timer-session-completed", onCompleted);
      window.removeEventListener("time-log-updated", onStarted);
    };
  }, [fetchActive]);

  // Tick elapsed time client-side (between polls)
  useEffect(() => {
    if (!session || session.status === "paused") return;

    const startedAt = new Date(session.started_at).getTime();
    const pauseSec = session.total_pause_seconds || 0;

    const tick = () => {
      const now = Date.now();
      const totalSec = Math.floor((now - startedAt) / 1000) - pauseSec;
      setElapsed(Math.max(0, totalSec));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Don't show on timer page
  if (!session || pathname === "/timer") return null;

  const planned = (session.planned_duration_minutes ?? 0) * 60;
  const remaining = planned > 0 ? Math.max(0, planned - elapsed) : 0;
  const isCountdown = planned > 0;
  const displaySeconds = isCountdown ? remaining : elapsed;

  const mins = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;
  const display = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const progress = isCountdown && planned > 0 ? Math.min(1, elapsed / planned) : 0;
  const isPaused = session.status === "paused";
  const moduleColor = (session.module as any)?.color ?? "#6d28d9";

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
          {isPaused ? (
            <Pause size={14} className="text-white mx-auto mb-0.5" />
          ) : null}
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
      {(session.module as any)?.name && (
        <div className="absolute bottom-full right-0 mb-2 px-2 py-1 rounded-lg bg-surface-900 dark:bg-surface-100 text-white dark:text-black text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {(session.module as any).name}
        </div>
      )}
    </button>
  );
}
