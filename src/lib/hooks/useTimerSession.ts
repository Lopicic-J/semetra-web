"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  timerReducer, INITIAL_TIMER_STATE,
  formatTimerDisplay, formatCountdown, getTimerProgress,
} from "@/lib/schedule";
import type {
  TimerState, TimerAction, TimerSideEffect,
  SessionType, ScheduleBlock, SchedulePreferences,
} from "@/lib/schedule";
import { DEFAULT_PREFERENCES } from "@/lib/schedule";

/**
 * Enhanced Timer Hook — connects to the Schedule Engine.
 *
 * Features:
 * - Pure state machine (timerReducer) with side-effect handling
 * - Links sessions to schedule blocks (Plan vs. Reality)
 * - Persists sessions to server via /api/timer-sessions
 * - Backward-compatible time_log insertion (via DB trigger)
 * - Pomodoro cycle management
 * - Real-time tick with requestAnimationFrame
 *
 * Usage:
 *   const timer = useTimerSession();
 *
 *   // Start from a schedule block
 *   timer.startFromBlock(block);
 *
 *   // Start a free session
 *   timer.start("focus", { moduleId: "...", targetMinutes: 45 });
 *
 *   // Pomodoro
 *   timer.startPomodoro(moduleId);
 */
export function useTimerSession(preferences?: SchedulePreferences) {
  const prefs = preferences || DEFAULT_PREFERENCES;
  const [state, setState] = useState<TimerState>(INITIAL_TIMER_STATE);
  const tickRef = useRef<number | null>(null);
  const serverSessionId = useRef<string | null>(null);

  // ── Dispatch ──────────────────────────────────────────────────────────
  const dispatch = useCallback((action: TimerAction) => {
    setState(prev => {
      const [newState, sideEffect] = timerReducer(prev, action, prefs);

      // Handle side effects asynchronously
      if (sideEffect) {
        handleSideEffect(sideEffect).catch(console.error);
      }

      return newState;
    });
  }, [prefs]);

  // ── Tick Loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.isRunning && !state.isPaused) {
      const tick = () => {
        dispatch({ type: "TICK" });
        tickRef.current = requestAnimationFrame(tick);
      };
      tickRef.current = requestAnimationFrame(tick);

      return () => {
        if (tickRef.current) cancelAnimationFrame(tickRef.current);
      };
    }
    return () => {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
    };
  }, [state.isRunning, state.isPaused, dispatch]);

  // ── Side Effect Handler ───────────────────────────────────────────────
  async function handleSideEffect(effect: TimerSideEffect) {
    switch (effect.type) {
      case "SESSION_CREATED": {
        // Create session on server
        try {
          const res = await fetch("/api/timer-sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_type: effect.session.session_type,
              module_id: effect.session.module_id,
              task_id: effect.session.task_id,
              topic_id: effect.session.topic_id,
              exam_id: effect.session.exam_id,
              schedule_block_id: effect.session.schedule_block_id,
              planned_duration_minutes: effect.session.planned_duration_minutes,
              energy_level: effect.session.energy_level,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            serverSessionId.current = data.id;
          }
        } catch (err) {
          console.error("Failed to create server session:", err);
        }
        break;
      }

      case "SESSION_COMPLETED": {
        // Complete on server
        if (serverSessionId.current) {
          try {
            await fetch("/api/timer-sessions", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: serverSessionId.current,
                status: "completed",
                total_pause_seconds: effect.session.total_pause_seconds,
                focus_rating: effect.session.focus_rating,
                note: effect.session.note,
              }),
            });
          } catch (err) {
            console.error("Failed to complete server session:", err);
          }
        }

        // Notify other components
        window.dispatchEvent(new Event("time-log-updated"));
        window.dispatchEvent(new CustomEvent("timer-session-completed", {
          detail: effect.session,
        }));

        serverSessionId.current = null;

        // Play completion sound
        playCompletionSound();

        break;
      }

      case "SESSION_ABANDONED": {
        if (serverSessionId.current) {
          try {
            await fetch("/api/timer-sessions", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: serverSessionId.current,
                status: "abandoned",
              }),
            });
          } catch (err) {
            console.error("Failed to abandon server session:", err);
          }
        }
        serverSessionId.current = null;
        break;
      }

      case "SESSION_PAUSED":
      case "SESSION_RESUMED":
        // Optional: sync pause state to server
        break;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

  const start = useCallback((
    sessionType: SessionType,
    options?: {
      targetMinutes?: number;
      moduleId?: string;
      taskId?: string;
      topicId?: string;
      examId?: string;
      energyLevel?: number;
    },
  ) => {
    dispatch({
      type: "START",
      sessionType,
      targetMinutes: options?.targetMinutes,
      moduleId: options?.moduleId,
      taskId: options?.taskId,
      topicId: options?.topicId,
      examId: options?.examId,
      energyLevel: options?.energyLevel,
    });
  }, [dispatch]);

  const startFromBlock = useCallback((block: ScheduleBlock) => {
    const durationMinutes = Math.round(
      (new Date(block.end_time).getTime() - new Date(block.start_time).getTime()) / 60000
    );

    dispatch({
      type: "START",
      sessionType: blockTypeToSessionType(block.block_type),
      targetMinutes: durationMinutes,
      block,
    });
  }, [dispatch]);

  const startPomodoro = useCallback((moduleId?: string, taskId?: string) => {
    dispatch({
      type: "START",
      sessionType: "pomodoro",
      targetMinutes: prefs.pomodoro_focus_minutes,
      moduleId,
      taskId,
    });
  }, [dispatch, prefs]);

  const pause = useCallback(() => dispatch({ type: "PAUSE" }), [dispatch]);
  const resume = useCallback(() => dispatch({ type: "RESUME" }), [dispatch]);

  const stop = useCallback((focusRating?: number, note?: string) => {
    dispatch({ type: "STOP", focusRating, note });
  }, [dispatch]);

  const abandon = useCallback(() => dispatch({ type: "ABANDON" }), [dispatch]);

  // ── Computed Values ───────────────────────────────────────────────────

  const display = state.mode === "countdown" && state.targetSeconds
    ? formatCountdown(state.targetSeconds, state.effectiveSeconds)
    : formatTimerDisplay(state.effectiveSeconds);

  const progress = getTimerProgress(state.targetSeconds, state.effectiveSeconds);

  return {
    // State
    ...state,
    display,
    progress,
    serverSessionId: serverSessionId.current,

    // Actions
    start,
    startFromBlock,
    startPomodoro,
    pause,
    resume,
    stop,
    abandon,
    dispatch,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function blockTypeToSessionType(blockType: string): SessionType {
  switch (blockType) {
    case "flashcards": return "flashcards";
    case "review": return "review";
    case "deep_work": return "deep_work";
    default: return "focus";
  }
}

function playCompletionSound() {
  try {
    const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGUcBj+a2teleR0OVqzk5aViDACG0Oz/nUwAHYDY8f+oWgAWc9P0/7BjAA5p0Pb/t2wACGLP+P+8dAADb87+/8B7AABhzf//w4EAAFzN///EhgAAV83//8eLAABRzf//yJAAAEzN///IlQAAR83//8iaAABCzf//yJ8AAD3N///JpAAAOMz//8mpAAAzzP//yq4AAC7M///KswAAKcz//8u4AAAkzP//y70AAB/M///MwgAAGsz//8zHAAAVzP//zMwAABDM///NzwAAC8z//83SAAAL");
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch { /* Ignore audio errors */ }
}
