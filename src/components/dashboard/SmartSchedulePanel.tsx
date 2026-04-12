"use client";
/**
 * SmartSchedulePanel — Kompakte Sidebar-Version des Smart Schedule.
 * Wird rechts neben dem Stundenplan eingebettet.
 * Zeigt: Tagesansicht, Stats, Timeline, Timer, Auto-Plan.
 */
import { useState, useMemo, useCallback } from "react";
import {
  Clock, Brain, Play, Pause, Square, SkipForward,
  ChevronLeft, ChevronRight, Zap, Target, Coffee,
  BookOpen, RefreshCw, Layers, GraduationCap, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Plus,
  Timer as TimerIcon, BarChart3,
} from "lucide-react";
import { useScheduleDay, useScheduleActions } from "@/lib/hooks/useSchedule";
import { useTimerSession } from "@/lib/hooks/useTimerSession";
import type { ScheduleBlock, TimerSession, FreeSlot, BlockType } from "@/lib/schedule";
import { BLOCK_TYPE_META, getBlockDurationMinutes } from "@/lib/schedule";
import Link from "next/link";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}
function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "short" });
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDays(d: string, n: number) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10);
}

// ── Icons ───────────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ElementType> = {
  GraduationCap, BookOpen, RefreshCw, Target, Layers, Brain, Coffee, AlertTriangle, Clock,
};
function BIcon({ type, size = 12 }: { type: BlockType; size?: number }) {
  const I = ICONS[BLOCK_TYPE_META[type]?.defaultIcon] || Clock;
  return <I size={size} />;
}

// ── Mini Progress Bar ───────────────────────────────────────────────────────

function Bar({ pct, className = "" }: { pct: number; className?: string }) {
  const c = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : pct > 0 ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600";
  return (
    <div className={"h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden " + className}>
      <div className={"h-full rounded-full " + c} style={{ width: Math.min(100, pct) + "%" }} />
    </div>
  );
}

// ── Timeline Block ──────────────────────────────────────────────────────────

function Block({ block, sessions, onStart, onSkip }: {
  block: ScheduleBlock; sessions: TimerSession[];
  onStart: (b: ScheduleBlock) => void; onSkip: (id: string) => void;
}) {
  const meta = BLOCK_TYPE_META[block.block_type] || BLOCK_TYPE_META.study;
  const dur = getBlockDurationMinutes(block);
  const actMin = sessions
    .filter(s => s.schedule_block_id === block.id || (s.module_id === block.module_id && block.module_id))
    .reduce((a, s) => a + ((s.effective_seconds || s.actual_duration_seconds || 0) / 60), 0);
  const pct = dur > 0 ? Math.round((actMin / dur) * 100) : 0;
  const done = block.status === "completed";
  const skip = block.status === "skipped";
  const l2 = block.layer === 2;

  return (
    <div className={
      "group flex items-stretch rounded-md border transition-all hover:shadow-sm "
      + (skip ? "opacity-30 " : "") + (done ? "border-green-200 dark:border-green-800 " : "border-gray-100 dark:border-gray-700/50 ")
      + (l2 ? "border-dashed " : "")
    } style={{ borderLeftWidth: 3, borderLeftColor: block.color || meta.defaultColor }}>
      {/* Time */}
      <div className="flex flex-col justify-center items-center px-1.5 py-1 min-w-[44px] text-[10px] text-gray-400 leading-tight">
        <span>{fmt(block.start_time)}</span>
        <span className="text-gray-200 dark:text-gray-700 text-[8px]">│</span>
        <span>{fmt(block.end_time)}</span>
      </div>
      {/* Content */}
      <div className="flex-1 py-1.5 px-2 min-w-0">
        <div className="flex items-center gap-1">
          <span className="opacity-50"><BIcon type={block.block_type} /></span>
          <span className={"text-xs font-medium truncate " + (done ? "line-through text-green-600 dark:text-green-400" : skip ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100")}>
            {block.title}
          </span>
        </div>
        {l2 && !skip && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-gray-400">{dur}min</span>
            {actMin > 0 && <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">→ {Math.round(actMin)}min</span>}
          </div>
        )}
        {l2 && !skip && <Bar pct={pct} className="mt-1" />}
      </div>
      {/* Actions */}
      {l2 && !skip && !done && (
        <div className="flex items-center gap-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onStart(block)} className="p-0.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600"><Play size={12} /></button>
          <button onClick={() => onSkip(block.id)} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><SkipForward size={11} /></button>
        </div>
      )}
    </div>
  );
}

// ── Free Slot ───────────────────────────────────────────────────────────────

function Slot({ slot, onCreate }: { slot: FreeSlot; onCreate: (s: string, e: string) => void }) {
  return (
    <button onClick={() => onCreate(slot.slot_start, slot.slot_end)}
      className="group flex items-center w-full rounded-md border border-dashed border-gray-100 dark:border-gray-800 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/20 dark:hover:bg-brand-900/5 transition-all">
      <div className="flex flex-col items-center px-1.5 py-1 min-w-[44px] text-[10px] text-gray-300 dark:text-gray-600">
        <span>{fmt(slot.slot_start)}</span>
        <span className="text-[8px]">│</span>
        <span>{fmt(slot.slot_end)}</span>
      </div>
      <div className="flex items-center gap-1 px-2 py-1 text-gray-300 dark:text-gray-600 group-hover:text-brand-500">
        <Plus size={10} />
        <span className="text-[10px]">{slot.duration_minutes}min frei</span>
      </div>
    </button>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────────────

export default function SmartSchedulePanel() {
  const [currentDate, setCurrentDate] = useState(todayStr());
  const day = useScheduleDay(currentDate);
  const actions = useScheduleActions();
  const timer = useTimerSession();

  const isToday = currentDate === todayStr();
  const goPrev = () => setCurrentDate(p => addDays(p, -1));
  const goNext = () => setCurrentDate(p => addDays(p, 1));
  const goToday = () => setCurrentDate(todayStr());

  const handleStart = useCallback((b: ScheduleBlock) => { timer.startFromBlock(b); }, [timer]);
  const handleSkip = useCallback(async (id: string) => { await actions.skipBlock(id); day.refetch(); }, [actions, day]);
  const handleCreate = useCallback(async (s: string, e: string) => {
    await actions.createBlock({ block_type: "study", start_time: s, end_time: e, title: "Lernsession", priority: "medium" } as Partial<ScheduleBlock>);
    day.refetch();
  }, [actions, day]);
  const handleAutoPlan = useCallback(async () => { await actions.autoPlan(currentDate); day.refetch(); }, [actions, currentDate, day]);

  const blocks = useMemo(() =>
    (day.blocks || []).sort((a, b) => a.start_time.localeCompare(b.start_time)),
  [day.blocks]);

  const unplanned = useMemo(() =>
    (day.sessions || []).filter(s => s.status === "completed" && s.alignment === "unplanned"),
  [day.sessions]);

  // Interleave
  const items = useMemo(() => {
    const arr: Array<{ type: "block" | "slot" | "session"; time: string; data: any }> = [];
    for (const b of blocks) arr.push({ type: "block", time: b.start_time, data: b });
    for (const s of day.freeSlots) arr.push({ type: "slot", time: s.slot_start, data: s });
    for (const s of unplanned) arr.push({ type: "session", time: s.started_at, data: s });
    arr.sort((a, b) => a.time.localeCompare(b.time));
    return arr;
  }, [blocks, day.freeSlots, unplanned]);

  const stats = day.scheduleDay?.stats;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1">
          <Brain size={14} className="text-brand-600" />
          <span className="text-xs font-semibold text-gray-900 dark:text-white">Smart Schedule</span>
        </div>
        <Link href="/smart" className="text-[10px] text-brand-600 hover:underline">
          Vollansicht →
        </Link>
      </div>

      {/* ── Date Nav ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-50 dark:border-gray-800">
        <div className="flex items-center gap-0.5">
          <button onClick={goPrev} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><ChevronLeft size={14} /></button>
          <button onClick={goToday} className={"px-1.5 py-0.5 text-[10px] font-semibold rounded " + (isToday ? "bg-brand-600 text-white" : "text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20")}>
            Heute
          </button>
          <button onClick={goNext} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><ChevronRight size={14} /></button>
          <span className="ml-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate">{fmtDay(currentDate)}</span>
        </div>
        <button onClick={handleAutoPlan} disabled={actions.loading}
          className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
          <Zap size={10} /> Plan
        </button>
      </div>

      {/* ── Timer Banner ───────────────────────────────────────── */}
      {timer.isRunning && (
        <div className="px-3 py-2 bg-gradient-to-r from-brand-600 to-brand-700 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 dark:bg-surface-800 flex items-center justify-center">
                {timer.isPaused ? <Pause size={13} /> : <TimerIcon size={13} className="animate-pulse" />}
              </div>
              <div>
                <div className="text-base font-mono font-bold leading-tight">{timer.display}</div>
                <div className="text-[9px] text-white/60">{timer.linkedBlock?.title || "Session"}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {timer.isPaused
                ? <button onClick={timer.resume} className="p-1 rounded bg-white/20 dark:bg-surface-800 hover:bg-white/30 dark:bg-surface-800"><Play size={12} /></button>
                : <button onClick={timer.pause} className="p-1 rounded bg-white/20 dark:bg-surface-800 hover:bg-white/30 dark:bg-surface-800"><Pause size={12} /></button>}
              <button onClick={() => timer.stop()} className="p-1 rounded bg-white/20 dark:bg-surface-800 hover:bg-white/30 dark:bg-surface-800"><Square size={12} /></button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats Strip ────────────────────────────────────────── */}
      {stats && stats.planned_minutes > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-50 dark:border-gray-800 text-[10px]">
          <div className="flex items-center gap-1">
            <Target size={10} className="text-blue-500" />
            <span className="font-bold text-gray-900 dark:text-white">{stats.planned_minutes}min</span>
          </div>
          <span className="text-gray-300">→</span>
          <div className="flex items-center gap-1">
            <Zap size={10} className="text-green-500" />
            <span className="font-bold text-gray-900 dark:text-white">{stats.effective_minutes}min</span>
          </div>
          <div className="flex-1" />
          <span className={
            "font-bold px-1 py-0.5 rounded "
            + (stats.adherence_percent >= 80 ? "text-green-600 bg-green-50 dark:bg-green-900/20" : stats.adherence_percent > 0 ? "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20" : "text-gray-400")
          }>
            {stats.adherence_percent}%
          </span>
        </div>
      )}

      {/* ── Timeline ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {day.loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Brain size={24} className="mx-auto mb-1.5 opacity-30" />
            <p className="text-[11px]">Keine Einträge</p>
            <button onClick={handleAutoPlan}
              className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-brand-600 text-white hover:bg-brand-700">
              <Zap size={10} /> Auto-Plan
            </button>
          </div>
        ) : (
          items.map((item, i) => {
            if (item.type === "block") return <Block key={item.data.id} block={item.data} sessions={day.sessions} onStart={handleStart} onSkip={handleSkip} />;
            if (item.type === "slot") return <Slot key={"s" + i} slot={item.data} onCreate={handleCreate} />;
            const s = item.data;
            return (
              <div key={s.id} className="flex items-center rounded-md border border-green-100 dark:border-green-900/40 bg-green-50/20 dark:bg-green-900/5">
                <div className="flex flex-col items-center px-1.5 py-1 min-w-[44px] text-[10px] text-green-500">
                  <span>{fmt(s.started_at)}</span>
                  {s.ended_at && <><span className="text-[8px]">│</span><span>{fmt(s.ended_at)}</span></>}
                </div>
                <div className="flex items-center gap-1 px-2 py-1">
                  <TimerIcon size={10} className="text-green-500" />
                  <span className="text-[10px] text-gray-600 dark:text-gray-300">Ungeplant</span>
                  <span className="text-[10px] text-green-600 ml-auto">{Math.round((s.effective_seconds || s.actual_duration_seconds || 0) / 60)}min</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Conflicts ──────────────────────────────────────────── */}
      {day.conflicts.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-red-100 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10 text-red-600 text-[10px] font-medium">
          <AlertTriangle size={11} />
          {day.conflicts.length} Überschneidung{day.conflicts.length > 1 ? "en" : ""}
        </div>
      )}
    </div>
  );
}
