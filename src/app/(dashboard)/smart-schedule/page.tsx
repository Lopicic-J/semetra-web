"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar, Clock, Brain, Play, Pause, Square, SkipForward,
  ChevronLeft, ChevronRight, Plus, Zap, Target, Coffee,
  BookOpen, RefreshCw, Layers, GraduationCap, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Settings, X, Sparkles,
  Timer as TimerIcon, BarChart3,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useScheduleDay, useScheduleWeek, useModuleSchedule, useScheduleActions, useSchedulePreferences } from "@/lib/hooks/useSchedule";
import { useTimerSession } from "@/lib/hooks/useTimerSession";
import type { ScheduleBlock, TimerSession, FreeSlot, BlockType, ScheduleViewMode } from "@/lib/schedule";
import { BLOCK_TYPE_META, isLearningBlock, getBlockDurationMinutes } from "@/lib/schedule";
import { PreferencesModal } from "@/components/schedule/PreferencesModal";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" });
}

function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });
}

function today(): string { return new Date().toISOString().slice(0, 10); }

function monday(date: string): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Block Icon ──────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  GraduationCap, BookOpen, RefreshCw, Target, Layers, Brain, Coffee, AlertTriangle, Clock,
};

function BlockIcon({ type, size = 14 }: { type: BlockType; size?: number }) {
  const meta = BLOCK_TYPE_META[type];
  const Icon = ICON_MAP[meta?.defaultIcon] || Clock;
  return <Icon size={size} />;
}

// ── Adherence Pill ──────────────────────────────────────────────────────────

function Adherence({ percent }: { percent: number }) {
  const cls = percent >= 80 ? "text-green-600 bg-green-100 dark:bg-green-900/30"
    : percent >= 50 ? "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30"
    : percent > 0 ? "text-orange-600 bg-orange-100 dark:bg-orange-900/30"
    : "text-gray-400 bg-gray-100 dark:bg-gray-800";
  return <span className={"text-[11px] font-semibold px-1.5 py-0.5 rounded-md " + cls}>{percent}%</span>;
}

// ── Mini Progress Bar ───────────────────────────────────────────────────────

function MiniBar({ percent, className = "" }: { percent: number; className?: string }) {
  const color = percent >= 80 ? "bg-green-500" : percent >= 50 ? "bg-yellow-500" : percent > 0 ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600";
  return (
    <div className={"h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden " + className}>
      <div className={"h-full rounded-full transition-all " + color} style={{ width: Math.min(100, percent) + "%" }} />
    </div>
  );
}

// ── Time Block ──────────────────────────────────────────────────────────────

function TimeBlock({
  block, sessions, onStartTimer, onSkip,
}: {
  block: ScheduleBlock; sessions: TimerSession[];
  onStartTimer: (b: ScheduleBlock) => void; onSkip: (id: string) => void;
}) {
  const meta = BLOCK_TYPE_META[block.block_type] || BLOCK_TYPE_META.study;
  const duration = getBlockDurationMinutes(block);
  const matchMin = sessions
    .filter(s => s.schedule_block_id === block.id || (s.module_id === block.module_id && block.module_id))
    .reduce((sum, s) => sum + ((s.effective_seconds || s.actual_duration_seconds || 0) / 60), 0);
  const adherence = duration > 0 ? Math.round((matchMin / duration) * 100) : 0;

  const done = block.status === "completed";
  const skipped = block.status === "skipped";
  const isL2 = block.layer === 2;

  return (
    <div className={
      "group relative flex items-stretch rounded-lg border transition-all hover:shadow-sm "
      + (skipped ? "opacity-35 " : "")
      + (done ? "border-green-200 dark:border-green-800 " : "border-gray-100 dark:border-gray-700/60 ")
      + (isL2 ? "border-dashed " : "")
    } style={{ borderLeftWidth: 3, borderLeftColor: block.color || meta.defaultColor }}>

      {/* Time */}
      <div className="flex flex-col justify-center items-center px-2 sm:px-2.5 py-2 min-h-14 sm:min-h-auto min-w-[52px] sm:min-w-[56px] border-r border-gray-50 dark:border-gray-800 text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 leading-tight flex-shrink-0">
        <span className="font-medium">{fmt(block.start_time)}</span>
        <span className="text-gray-300 dark:text-gray-600 text-[8px] sm:text-[9px]">│</span>
        <span className="font-medium">{fmt(block.end_time)}</span>
      </div>

      {/* Content */}
      <div className="flex-1 py-2 px-3 min-w-0 flex flex-col justify-center">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="opacity-60 flex-shrink-0"><BlockIcon type={block.block_type} size={13} /></span>
          <span className={"text-xs sm:text-sm font-medium truncate " + (done ? "text-green-700 dark:text-green-400 line-through" : skipped ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100")}>
            {block.title}
          </span>
          {block.module?.name && (
            <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
              {block.module.name}
            </span>
          )}
        </div>

        {/* Layer 2: adherence row + progress */}
        {isL2 && !skipped && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-gray-400">{duration}min</span>
            {matchMin > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">→</span>
                <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{Math.round(matchMin)}min</span>
                <Adherence percent={adherence} />
              </>
            )}
          </div>
        )}
        {isL2 && !skipped && <MiniBar percent={adherence} className="mt-1.5" />}
      </div>

      {/* Quick Actions */}
      {isL2 && !skipped && !done && (
        <div className="flex items-center gap-0.5 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onStartTimer(block)} className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600" title="Timer starten">
            <Play size={14} />
          </button>
          <button onClick={() => onSkip(block.id)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400" title="Überspringen">
            <SkipForward size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Free Slot ───────────────────────────────────────────────────────────────

function FreeSlotRow({ slot, onCreate }: { slot: FreeSlot; onCreate: (s: string, e: string) => void }) {
  return (
    <button
      onClick={() => onCreate(slot.slot_start, slot.slot_end)}
      className="group flex items-center w-full min-h-14 sm:min-h-auto rounded-lg border border-dashed border-gray-100 dark:border-gray-800 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/30 dark:hover:bg-brand-900/5 transition-all"
    >
      <div className="flex flex-col justify-center items-center px-2 sm:px-2.5 py-2 min-w-[52px] sm:min-w-[56px] text-[10px] sm:text-[11px] text-gray-300 dark:text-gray-600 flex-shrink-0">
        <span>{fmt(slot.slot_start)}</span>
        <span className="text-[8px] sm:text-[9px]">│</span>
        <span>{fmt(slot.slot_end)}</span>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 text-gray-300 dark:text-gray-600 group-hover:text-brand-500 dark:group-hover:text-brand-400">
        <Plus size={12} className="flex-shrink-0" />
        <span className="text-[10px] sm:text-[11px]">{slot.duration_minutes} min frei</span>
      </div>
    </button>
  );
}

// ── Active Timer Banner ─────────────────────────────────────────────────────

function TimerBanner({ timer }: { timer: ReturnType<typeof useTimerSession> }) {
  if (!timer.isRunning) return null;
  return (
    <div className="mb-3 px-3 sm:px-4 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-9 h-9 rounded-full bg-white/20 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
            {timer.isPaused ? <Pause size={18} /> : <TimerIcon size={18} className="animate-pulse" />}
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-xl font-mono font-bold leading-tight">{timer.display}</div>
            <div className="text-[11px] text-white/60 truncate">
              {timer.linkedBlock?.title || "Session"}{timer.isPaused && " — Pausiert"}
            </div>
          </div>
        </div>
        {timer.targetSeconds && (
          <div className="relative w-10 h-10 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
              <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
              <circle cx="18" cy="18" r="16" fill="none" stroke="white" strokeWidth="2.5"
                strokeDasharray={`${timer.progress * 1.005} 100`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">{timer.progress}%</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
          {timer.isPaused
            ? <button onClick={timer.resume} className="p-2 min-h-9 min-w-9 rounded-lg bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 transition-colors flex items-center justify-center"><Play size={16} /></button>
            : <button onClick={timer.pause} className="p-2 min-h-9 min-w-9 rounded-lg bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 transition-colors flex items-center justify-center"><Pause size={16} /></button>}
          <button onClick={() => timer.stop()} className="p-2 min-h-9 min-w-9 rounded-lg bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 transition-colors flex items-center justify-center"><Square size={16} /></button>
        </div>
      </div>
    </div>
  );
}

// ── Compact Stats Row ───────────────────────────────────────────────────────

function StatsRow({ stats, budget }: {
  stats: { planned_minutes: number; actual_minutes: number; effective_minutes: number; adherence_percent: number; blocks_completed: number; planned_blocks: number } | null;
  budget: { maxMinutes: number; remainingMinutes: number; overBudget: boolean } | null;
}) {
  if (!stats) return null;
  const items = [
    { icon: <Target size={13} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />, label: "Geplant", val: stats.planned_minutes + "min", sub: stats.planned_blocks + " Blöcke" },
    { icon: <Zap size={13} className="text-green-500 dark:text-green-400 flex-shrink-0" />, label: "Effektiv", val: stats.effective_minutes + "min", sub: stats.actual_minutes > 0 ? Math.round((stats.effective_minutes / stats.actual_minutes) * 100) + "% Fokus" : "–" },
    { icon: stats.adherence_percent >= 80 ? <TrendingUp size={13} className="text-green-500 dark:text-green-400 flex-shrink-0" /> : stats.adherence_percent > 0 ? <Minus size={13} className="text-yellow-500 dark:text-yellow-400 flex-shrink-0" /> : <TrendingDown size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />, label: "Einhaltung", val: stats.adherence_percent + "%", sub: stats.blocks_completed + "/" + stats.planned_blocks },
    { icon: <BarChart3 size={13} className={budget?.overBudget ? "text-red-500 dark:text-red-400" : "text-brand-500 dark:text-brand-400"} />, label: "Budget", val: (budget?.remainingMinutes || 0) + "min", sub: budget?.overBudget ? "Über Budget!" : "übrig" },
  ];
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-3 p-2 rounded-lg bg-[rgb(var(--card-bg))] dark:bg-gray-800/50 border border-gray-50 dark:border-gray-800 overflow-x-auto">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 min-w-0 flex-1 sm:flex-none">
          {it.icon}
          <div className="min-w-0">
            <div className="text-xs font-bold text-gray-900 dark:text-white leading-tight">{it.val}</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{it.sub}</div>
          </div>
          {i < items.length - 1 && <div className="hidden sm:block w-px h-6 bg-gray-100 dark:bg-gray-700 ml-2" />}
        </div>
      ))}
    </div>
  );
}

// ── Layer Dots (compact filter) ─────────────────────────────────────────────

function LayerDots({
  layers, onToggle,
}: {
  layers: { layer1: boolean; layer2: boolean; layer3: boolean; freeSlots: boolean };
  onToggle: (k: keyof typeof layers) => void;
}) {
  const items: Array<{ key: keyof typeof layers; color: string; label: string }> = [
    { key: "layer1", color: "bg-blue-500", label: "Fix" },
    { key: "layer2", color: "bg-purple-500", label: "Geplant" },
    { key: "layer3", color: "bg-green-500", label: "Sessions" },
    { key: "freeSlots", color: "bg-gray-300 dark:bg-gray-600", label: "Frei" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map(it => (
        <button
          key={it.key}
          onClick={() => onToggle(it.key)}
          className={"flex items-center gap-1 px-2 py-1 min-h-7 rounded-full text-[10px] font-medium transition-all "
            + (layers[it.key] ? "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300" : "text-gray-300 dark:text-gray-600 line-through")}
        >
          <div className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + it.color + (layers[it.key] ? "" : " opacity-20")} />
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ── Module Card ─────────────────────────────────────────────────────────────

function ModuleCard({ stat }: { stat: { moduleId: string; moduleName: string; moduleColor: string; plannedThisWeek: number; actualThisWeek: number; lastStudied: string | null; nextExam: string | null; daysUntilExam: number | null; deficit: number; trend: string } }) {
  const pct = stat.plannedThisWeek > 0 ? Math.round((stat.actualThisWeek / stat.plannedThisWeek) * 100) : 0;
  return (
    <div className="p-3 sm:p-4 rounded-xl bg-[rgb(var(--card-bg))] dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-shadow"
      style={{ borderLeftWidth: 3, borderLeftColor: stat.moduleColor }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
        <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{stat.moduleName}</span>
        <span className={"text-[10px] px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap "
          + (stat.trend === "improving" ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
            : stat.trend === "declining" ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
            : "text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800")}>
          {stat.trend === "improving" ? "↑ Aufwärts" : stat.trend === "declining" ? "↓ Abwärts" : "→ Stabil"}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row justify-between text-[11px] text-gray-400 dark:text-gray-500 mb-2 gap-1">
        <span>{stat.plannedThisWeek}min geplant</span>
        <span>{stat.actualThisWeek}min effektiv</span>
      </div>
      <MiniBar percent={pct} className="mb-2" />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-gray-400 dark:text-gray-500 gap-1">
        <span>{stat.lastStudied ? "Zuletzt " + fmtDate(stat.lastStudied) : "Noch nicht gelernt"}</span>
        {stat.daysUntilExam !== null && stat.daysUntilExam >= 0 && (
          <span className={stat.daysUntilExam <= 7 ? "text-red-500 dark:text-red-400 font-semibold" : ""}>
            Prüfung in {stat.daysUntilExam}d
          </span>
        )}
      </div>
      {stat.deficit > 30 && (
        <div className="mt-2 sm:mt-1.5 flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400">
          <AlertTriangle size={11} className="flex-shrink-0" />
          <span>{stat.deficit}min Rückstand</span>
        </div>
      )}
    </div>
  );
}

// ScheduleSettingsModal replaced by PreferencesModal component
// See: src/components/schedule/PreferencesModal.tsx

// ── Main Page ───────────────────────────────────────────────────────────────

function SmartScheduleInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const moduleParam = searchParams.get("module");
  const [viewMode, setViewMode] = useState<ScheduleViewMode>(moduleParam ? "module" : "day");
  const [currentDate, setCurrentDate] = useState(today());
  const weekStart = useMemo(() => monday(currentDate), [currentDate]);

  const [visibleLayers, setVisibleLayers] = useState({ layer1: true, layer2: true, layer3: true, freeSlots: true });
  const toggleLayer = useCallback((key: keyof typeof visibleLayers) => {
    setVisibleLayers(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const [showSettings, setShowSettings] = useState(false);
  const [planResult, setPlanResult] = useState<{ scheduled: number; context?: any; warnings?: string[] } | null>(null);
  const [bestHours, setBestHours] = useState<{ hour: number; avgMinutes: number }[]>([]);
  const [showSuggestPlan, setShowSuggestPlan] = useState(false);
  const day = useScheduleDay(currentDate);
  const week = useScheduleWeek(weekStart);
  const moduleView = useModuleSchedule(weekStart);
  const actions = useScheduleActions();
  const timer = useTimerSession();
  const { preferences, updatePreferences } = useSchedulePreferences();

  const goToday = () => setCurrentDate(today());
  const goPrev = () => setCurrentDate(prev => addDays(prev, viewMode === "week" ? -7 : -1));
  const goNext = () => setCurrentDate(prev => addDays(prev, viewMode === "week" ? 7 : 1));

  const handleStartTimer = useCallback((block: ScheduleBlock) => { timer.startFromBlock(block); }, [timer]);
  const handleSkipBlock = useCallback(async (id: string) => { await actions.skipBlock(id); day.refetch(); }, [actions, day]);
  const handleCreateBlock = useCallback(async (s: string, e: string) => {
    await actions.createBlock({ block_type: "study", start_time: s, end_time: e, title: "Lernsession", priority: "medium" } as Partial<ScheduleBlock>);
    day.refetch();
  }, [actions, day]);
  const handleAutoPlan = useCallback(async () => {
    const result = await actions.autoPlan(currentDate);
    if (result) setPlanResult(result);
    day.refetch();
    // Auto-dismiss after 5s
    setTimeout(() => setPlanResult(null), 5000);
  }, [actions, currentDate, day]);
  const handleResync = useCallback(async () => { await actions.syncStundenplan(); day.refetch(); }, [actions, day]);
  const handleAutoFill = useCallback(async () => { await actions.autoFillGaps(currentDate); day.refetch(); }, [actions, currentDate, day]);
  const handleAutoRescue = useCallback(async () => { await actions.autoRescue(); day.refetch(); }, [actions, day]);
  const handleExamPlan = useCallback(async () => { await actions.generateExamPlan(); day.refetch(); }, [actions, day]);

  // Load best study hours (pattern insights)
  useEffect(() => {
    fetch("/api/schedule/patterns?view=hours")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.bestHours?.length > 0) {
          setBestHours(data.bestHours.slice(0, 3));
        }
      })
      .catch(() => {});
  }, []);

  // Suggest auto-plan if today has no Layer 2 blocks
  useEffect(() => {
    if (currentDate !== today() || day.loading) return;
    const hasAutoBlocks = (day.blocks || []).some(b => b.layer === 2 && b.source === "decision_engine");
    const hasAnyL2 = (day.blocks || []).some(b => b.layer === 2);
    if (!hasAutoBlocks && !hasAnyL2 && (day.blocks || []).length > 0) {
      setShowSuggestPlan(true);
    }
  }, [currentDate, day.blocks, day.loading]);

  // Filtered data
  const filteredBlocks = useMemo(() => {
    if (!day.blocks) return [];
    return day.blocks.filter(b => {
      if (b.layer === 1 && !visibleLayers.layer1) return false;
      if (b.layer === 2 && !visibleLayers.layer2) return false;
      return true;
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [day.blocks, visibleLayers]);

  const unplannedSessions = useMemo(() => {
    if (!day.sessions || !visibleLayers.layer3) return [];
    return day.sessions.filter(s => s.status === "completed" && s.alignment === "unplanned");
  }, [day.sessions, visibleLayers]);

  // Build interleaved timeline
  const timelineItems = useMemo(() => {
    const items: Array<{ type: "block" | "slot" | "session"; time: string; data: any }> = [];
    for (const block of filteredBlocks) items.push({ type: "block", time: block.start_time, data: block });
    if (visibleLayers.freeSlots) for (const slot of day.freeSlots) items.push({ type: "slot", time: slot.slot_start, data: slot });
    if (visibleLayers.layer3) for (const s of unplannedSessions) items.push({ type: "session", time: s.started_at, data: s });
    items.sort((a, b) => a.time.localeCompare(b.time));
    return items;
  }, [filteredBlocks, day.freeSlots, unplannedSessions, visibleLayers]);

  const isToday = currentDate === today();

  return (
    <div className="max-w-4xl mx-auto w-full px-3 sm:px-4 py-4">

      {/* ━━ HEADER: title + nav + actions in ONE row ━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-3">
        {/* Left: nav */}
        <div className="flex items-center gap-1.5">
          <button onClick={goPrev} className="p-1.5 min-h-9 min-w-9 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors flex items-center justify-center">
            <ChevronLeft size={18} />
          </button>
          <button onClick={goToday} className={"px-2 py-1.5 min-h-9 text-[11px] font-semibold rounded-md transition-colors "
            + (isToday ? "bg-brand-600 text-white" : "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/30")}>
            Heute
          </button>
          <button onClick={goNext} className="p-1.5 min-h-9 min-w-9 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors flex items-center justify-center">
            <ChevronRight size={18} />
          </button>
          <span className="ml-1 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
            {viewMode === "week"
              ? fmtDate(weekStart) + " – " + fmtDate(addDays(weekStart, 6))
              : fmtDateLong(currentDate)}
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 w-full sm:w-auto">
          {/* View toggle */}
          <div className="flex items-center p-0.5 bg-gray-100 dark:bg-gray-800 rounded-md">
            {(["day", "week", "module"] as ScheduleViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={"px-2 py-1 text-[10px] sm:text-[11px] font-medium rounded transition-all min-h-7 "
                  + (viewMode === mode ? "bg-[rgb(var(--card-bg))] dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400")}
              >
                {mode === "day" ? "Tag" : mode === "week" ? "Woche" : "Module"}
              </button>
            ))}
          </div>
          <button onClick={handleAutoPlan} disabled={actions.loading}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 min-h-7 text-[10px] sm:text-[11px] font-semibold rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            <Zap size={12} className="hidden sm:inline" /> Auto-Plan
          </button>
          <button onClick={handleAutoFill} disabled={actions.loading} title="Freie Slots mit Lernzeit füllen"
            className="flex items-center gap-1 px-2 py-1 min-h-7 text-[10px] sm:text-[11px] font-medium rounded-md border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/40 disabled:opacity-50 transition-colors">
            <Plus size={11} className="flex-shrink-0" /> Füllen
          </button>
          <button onClick={handleExamPlan} disabled={actions.loading} title="Prüfungs-Lernplan generieren"
            className="flex items-center gap-1 px-2 py-1 min-h-7 text-[10px] sm:text-[11px] font-medium rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors">
            <Target size={11} className="flex-shrink-0" /> Prüfung
          </button>
          <button onClick={handleResync} disabled={actions.loading} title="Stundenplan synchronisieren"
            className="p-1.5 min-h-7 min-w-7 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors flex items-center justify-center">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setShowSettings(true)} title="Einstellungen"
            className="p-1.5 min-h-7 min-w-7 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors flex items-center justify-center">
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* Active Timer */}
      <TimerBanner timer={timer} />

      {/* Suggest Auto-Plan Banner (no L2 blocks today) */}
      {showSuggestPlan && !planResult && (
        <div className="flex items-center gap-2 px-3 py-2.5 mb-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
          <Sparkles size={14} className="text-amber-500 shrink-0" />
          <span>Dein Tag ist noch nicht geplant.</span>
          <button
            onClick={() => { setShowSuggestPlan(false); handleAutoPlan(); }}
            className="ml-1 px-2 py-0.5 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors"
          >
            Jetzt planen
          </button>
          <button onClick={() => setShowSuggestPlan(false)} className="ml-auto p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Plan Result Banner */}
      {planResult && planResult.scheduled > 0 && (
        <div className="flex flex-col gap-1 px-3 py-2.5 mb-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-xs">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-brand-500 shrink-0" />
            <span className="font-medium">{planResult.scheduled} Blöcke geplant</span>
            {planResult.context && (
              <span className="text-brand-500 dark:text-brand-400">
                {planResult.context.flashcardsDue > 0 && ` · ${planResult.context.flashcardsDue} Karten fällig`}
                {planResult.context.tasksWithDeadline > 0 && ` · ${planResult.context.tasksWithDeadline} Deadlines`}
                {planResult.context.upcomingExams > 0 && ` · ${planResult.context.upcomingExams} Prüfungen`}
              </span>
            )}
            <button onClick={() => setPlanResult(null)} className="ml-auto p-0.5 hover:bg-brand-100 dark:hover:bg-brand-900/40 rounded">
              <X size={12} />
            </button>
          </div>
          {planResult.warnings && planResult.warnings.length > 0 && (
            <div className="text-[10px] text-brand-500 dark:text-brand-400 pl-5">
              {planResult.warnings.map((w, i) => <span key={i} className="block">{w}</span>)}
            </div>
          )}
        </div>
      )}

      {/* Pattern Insight Tip */}
      {bestHours.length > 0 && viewMode === "day" && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 text-[11px] text-surface-500 dark:text-surface-400">
          <Brain size={13} className="text-violet-500 shrink-0" />
          <span>
            Deine produktivsten Stunden:{" "}
            {bestHours.map((h, i) => (
              <span key={h.hour} className="font-semibold text-surface-700 dark:text-surface-200">
                {i > 0 && ", "}{String(h.hour).padStart(2, "0")}:00
              </span>
            ))}
            <span className="text-surface-400"> · Ø {Math.round(bestHours[0].avgMinutes)} Min</span>
          </span>
        </div>
      )}

      {/* ━━ DAY VIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {viewMode === "day" && (
        <>
          {/* Stats row + layer filter */}
          <div className="flex items-center justify-between mb-2">
            <LayerDots layers={visibleLayers} onToggle={toggleLayer} />
          </div>
          <StatsRow stats={day.scheduleDay?.stats || null} budget={day.budget} />

          {/* Conflicts */}
          {day.conflicts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 min-h-9 mb-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-medium w-full">
              <AlertTriangle size={14} className="flex-shrink-0" />
              {day.conflicts.length} Überschneidung{day.conflicts.length > 1 ? "en" : ""}
            </div>
          )}

          {/* Loading */}
          {day.loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-[3px] border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            </div>
          ) : timelineItems.length === 0 ? (
            /* Empty state */
            <div className="text-center py-14 text-gray-400">
              <Calendar size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm mb-3">{t("smartSchedule.empty") || "Keine Einträge für diesen Tag"}</p>
              <button onClick={handleAutoPlan}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700">
                <Zap size={13} /> Auto-Plan generieren
              </button>
            </div>
          ) : (
            /* Timeline */
            <div className="space-y-1.5">
              {timelineItems.map((item, i) => {
                if (item.type === "block") {
                  return <TimeBlock key={item.data.id} block={item.data} sessions={day.sessions} onStartTimer={handleStartTimer} onSkip={handleSkipBlock} />;
                }
                if (item.type === "slot") {
                  return <FreeSlotRow key={"s" + i} slot={item.data} onCreate={handleCreateBlock} />;
                }
                // Unplanned session
                const s = item.data;
                return (
                  <div key={s.id} className="flex flex-col sm:flex-row items-start sm:items-center min-h-14 sm:min-h-auto rounded-lg border border-green-100 dark:border-green-900/40 bg-green-50/30 dark:bg-green-900/5">
                    <div className="flex flex-col justify-center items-center px-2 sm:px-2.5 py-2 min-w-[52px] sm:min-w-[56px] text-[10px] sm:text-[11px] text-green-500 dark:text-green-400 flex-shrink-0">
                      <span>{fmt(s.started_at)}</span>
                      {s.ended_at && <><span className="text-[8px] sm:text-[9px]">│</span><span>{fmt(s.ended_at)}</span></>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 w-full sm:w-auto">
                      <TimerIcon size={12} className="text-green-500 dark:text-green-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Ungeplant</span>
                      {s.module?.name && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{s.module.name}</span>}
                      <span className="text-[11px] text-green-600 dark:text-green-400 ml-auto sm:ml-4 font-medium">{Math.round((s.effective_seconds || s.actual_duration_seconds || 0) / 60)}min</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ━━ WEEK VIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {viewMode === "week" && week.scheduleWeek && (
        <>
          {/* Compact week stats */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-3 p-2 rounded-lg bg-[rgb(var(--card-bg))] dark:bg-gray-800/50 border border-gray-50 dark:border-gray-800 overflow-x-auto">
            {[
              { icon: <Target size={13} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />, val: Math.round(week.scheduleWeek.weekStats.totalPlannedMinutes / 60) + "h", sub: "Geplant" },
              { icon: <Zap size={13} className="text-green-500 dark:text-green-400 flex-shrink-0" />, val: Math.round(week.scheduleWeek.weekStats.totalEffectiveMinutes / 60) + "h", sub: "Effektiv" },
              { icon: <BarChart3 size={13} className="text-brand-500 dark:text-brand-400 flex-shrink-0" />, val: week.scheduleWeek.weekStats.overallAdherence + "%", sub: "Einhaltung" },
              { icon: <TrendingUp size={13} className="text-orange-500 dark:text-orange-400 flex-shrink-0" />, val: week.scheduleWeek.weekStats.studyStreak + "d", sub: "Streak" },
            ].map((it, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 min-h-8 flex-1 sm:flex-none">
                {it.icon}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-900 dark:text-white leading-tight">{it.val}</div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{it.sub}</div>
                </div>
                {i < 3 && <div className="hidden sm:block w-px h-6 bg-gray-100 dark:bg-gray-700 ml-2" />}
              </div>
            ))}
          </div>

          {/* Day rows */}
          <div className="space-y-1.5">
            {week.scheduleWeek.days.map(d => {
              const isTdy = d.date === today();
              const isPast = d.date < today();
              const l1 = d.blocks.filter(b => b.layer === 1).length;
              const l2 = d.blocks.filter(b => b.layer === 2).length;
              const done = d.blocks.filter(b => b.layer === 2 && b.status === "completed").length;

              return (
                <button key={d.date} onClick={() => { setCurrentDate(d.date); setViewMode("day"); }}
                  className={"w-full flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-2.5 min-h-16 sm:min-h-auto rounded-lg border text-left transition-all hover:shadow-sm "
                    + (isTdy ? "border-brand-200 dark:border-brand-700 bg-brand-50/40 dark:bg-brand-900/10" : "border-gray-50 dark:border-gray-800 bg-[rgb(var(--card-bg))] dark:bg-gray-800/50")}>
                  {/* Date badge + info row */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={"w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 "
                      + (isTdy ? "bg-brand-600 text-white" : isPast ? "bg-gray-100 dark:bg-gray-700 text-gray-400" : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300")}>
                      {new Date(d.date).getDate()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{fmtDate(d.date)}</span>
                        {isTdy && <span className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold">Heute</span>}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500">{l1} Termine · {l2} Lernblöcke · {done} erledigt</div>
                    </div>
                  </div>

                  {/* Adherence mini */}
                  {d.stats && d.stats.planned_minutes > 0 && (
                    <div className="text-right shrink-0 w-full sm:w-auto px-2 sm:px-0">
                      <div className="text-xs font-bold text-gray-900 dark:text-white">{d.stats.effective_minutes}/{d.stats.planned_minutes}min</div>
                      <MiniBar percent={d.stats.adherence_percent} className="w-16 mt-0.5" />
                    </div>
                  )}
                  <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 shrink-0 hidden sm:block" />
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ━━ MODULE VIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {viewMode === "module" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {moduleView.moduleStats.length === 0 ? (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 text-center py-14 px-4 text-gray-400 dark:text-gray-500">
              <BookOpen size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Keine aktiven Module</p>
            </div>
          ) : moduleView.moduleStats.map(stat => (
            <ModuleCard key={stat.moduleId} stat={stat} />
          ))}
        </div>
      )}

      {/* ━━ SETTINGS MODAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <PreferencesModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        preferences={preferences}
        onSave={async (updates) => { await updatePreferences(updates); day.refetch(); }}
      />
    </div>
  );
}

export default function SmartSchedulePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-[3px] border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>}>
      <SmartScheduleInner />
    </Suspense>
  );
}
