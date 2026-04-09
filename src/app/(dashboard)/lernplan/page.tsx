"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import toast from "react-hot-toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { WeeklyProgress } from "@/components/lernplan/WeeklyProgress";
import { StudyStreak } from "@/components/lernplan/StudyStreak";
import {
  CalendarClock, CheckCircle2, Circle, Clock, Brain,
  ChevronLeft, ChevronRight, Sparkles, Trash2, Archive,
  RotateCcw, Zap, Scale, Timer, Trophy, BookOpen, Dumbbell,
  Layers, FileText, Coffee, GraduationCap, Play, BarChart3,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Types                                                                 */
/* ═══════════════════════════════════════════════════════════════════════ */

interface StudyPlanItem {
  id: string;
  plan_id: string;
  scheduled_date: string;
  topic_id: string | null;
  title: string;
  description: string | null;
  duration_minutes: number;
  item_type: string;
  priority: string;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
}

interface StudyPlan {
  id: string;
  title: string;
  exam_id: string | null;
  module_id: string | null;
  start_date: string;
  end_date: string;
  total_items: number;
  completed_items: number;
  status: string;
  strategy: string;
  created_at: string;
  study_plan_items: StudyPlanItem[];
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Helpers                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */

function formatDateLabel(dateStr: string, t: (k: string) => string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return t("lernplan.today");
  if (diff === 1) return t("lernplan.tomorrow");
  if (diff === -1) return t("lernplan.yesterday");
  return d.toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" });
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ITEM_ICONS: Record<string, typeof BookOpen> = {
  review: BookOpen,
  practice: Dumbbell,
  flashcards: Layers,
  summary: FileText,
  mock_exam: GraduationCap,
  break: Coffee,
};

const PRIORITY_COLORS: Record<string, { dot: string; ring: string }> = {
  high:   { dot: "bg-red-500",    ring: "ring-red-200" },
  medium: { dot: "bg-amber-500",  ring: "ring-amber-200" },
  low:    { dot: "bg-green-500",  ring: "ring-green-200" },
};

const STRATEGY_ICONS: Record<string, typeof Scale> = {
  balanced: Scale,
  intensive: Zap,
  spaced: Timer,
};

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Component                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

export default function LernplanPage() {
  const { t } = useTranslation();
  const supabase = createClient();

  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()));
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [strategy, setStrategy] = useState<"balanced" | "intensive" | "spaced">("balanced");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* ── Delete confirmation ────────────────────────────────────────── */
  const [DeleteConfirm, confirmDelete] = useConfirm({
    title: t("lernplan.deletePlanConfirm") || "Lernplan löschen?",
    description: t("lernplan.deletePlanDesc") || "Der Lernplan und alle Einträge werden unwiderruflich gelöscht.",
    confirmLabel: t("lernplan.deleteBtn") || "Löschen",
    variant: "danger",
  });

  /* ── Fetch plans ─────────────────────────────────────────────────── */
  const loadPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/study-plans?status=active");
      const json = await res.json();
      if (json.plans) {
        setPlans(json.plans);
        if (json.plans.length > 0 && !activePlan) {
          setActivePlan(json.plans[0]);
        }
      }
    } catch (err) {
      console.error("[lernplan] load failed:", err);
      toast.error(t("lernplan.loadError") || "Fehler beim Laden der Lernpläne");
    }
    setLoading(false);
  }, [activePlan, t]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  /* ── Generate plan ───────────────────────────────────────────────── */
  async function generatePlan() {
    setGenerating(true);
    try {
      const res = await fetch("/api/study-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy }),
      });
      const json = await res.json();
      if (json.plan) {
        setPlans(prev => [json.plan, ...prev]);
        setActivePlan(json.plan);
        toast.success(t("lernplan.planCreated") || "Lernplan erstellt!");
      }
    } catch (err) {
      console.error("[lernplan] generate failed:", err);
      toast.error(t("lernplan.generateError") || "Fehler beim Erstellen des Lernplans");
    }
    setGenerating(false);
  }

  /* ── Toggle item ─────────────────────────────────────────────────── */
  async function toggleItem(item: StudyPlanItem) {
    if (!activePlan || togglingId) return;
    setTogglingId(item.id);

    const newCompleted = !item.completed;

    // Optimistic update
    setActivePlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        completed_items: prev.completed_items + (newCompleted ? 1 : -1),
        study_plan_items: prev.study_plan_items.map(i =>
          i.id === item.id ? { ...i, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null } : i
        ),
      };
    });

    try {
      await fetch(`/api/study-plans/${activePlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, completed: newCompleted }),
      });
    } catch (err) {
      console.error("[lernplan] toggle failed:", err);
      toast.error(t("lernplan.toggleError") || "Fehler beim Aktualisieren");
      // Revert on error
      setActivePlan(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          completed_items: prev.completed_items + (newCompleted ? -1 : 1),
          study_plan_items: prev.study_plan_items.map(i =>
            i.id === item.id ? { ...i, completed: !newCompleted, completed_at: item.completed_at } : i
          ),
        };
      });
    }
    setTogglingId(null);
  }

  /* ── Delete plan ─────────────────────────────────────────────────── */
  async function deletePlan(planId: string) {
    const ok = await confirmDelete();
    if (!ok) return;
    try {
      await fetch(`/api/study-plans/${planId}`, { method: "DELETE" });
      setPlans(prev => prev.filter(p => p.id !== planId));
      if (activePlan?.id === planId) {
        setActivePlan(plans.find(p => p.id !== planId) ?? null);
      }
      toast.success(t("lernplan.planDeleted") || "Lernplan gelöscht");
    } catch (err) {
      console.error("[lernplan] delete failed:", err);
      toast.error(t("lernplan.deleteError") || "Fehler beim Löschen");
    }
  }

  /* ── Date navigation ─────────────────────────────────────────────── */
  function shiftDate(days: number) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(toDateStr(d));
  }

  /* ── Filter items for selected date ──────────────────────────────── */
  const dayItems = (activePlan?.study_plan_items ?? [])
    .filter(i => i.scheduled_date === selectedDate)
    .sort((a, b) => a.sort_order - b.sort_order);

  const dayCompleted = dayItems.filter(i => i.completed).length;
  const dayTotal = dayItems.filter(i => i.item_type !== "break").length;
  const dayMinutes = dayItems.filter(i => !i.completed && i.item_type !== "break")
    .reduce((s, i) => s + i.duration_minutes, 0);

  /* ── Week statistics ─────────────────────────────────────────── */
  const getWeekStats = () => {
    if (!activePlan) return { plannedMinutes: 0, completedMinutes: 0, rate: 0, plannedHours: "0", completedHours: "0" };

    const weekStart = new Date(selectedDate + "T00:00:00");
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekItems = activePlan.study_plan_items.filter(i => {
      const itemDate = new Date(i.scheduled_date + "T00:00:00");
      return itemDate >= weekStart && itemDate <= weekEnd && i.item_type !== "break";
    });

    const plannedMinutes = weekItems.reduce((sum, i) => sum + i.duration_minutes, 0);
    const completedMinutes = weekItems
      .filter(i => i.completed)
      .reduce((sum, i) => sum + i.duration_minutes, 0);
    const rate = plannedMinutes > 0 ? Math.round((completedMinutes / plannedMinutes) * 100) : 0;

    return {
      plannedMinutes,
      completedMinutes,
      rate,
      plannedHours: (plannedMinutes / 60).toFixed(1),
      completedHours: (completedMinutes / 60).toFixed(1),
    };
  };

  const weekStats = getWeekStats();

  /* ── Plan progress ───────────────────────────────────────────────── */
  const totalItems = activePlan?.total_items ?? 0;
  const completedItems = activePlan?.completed_items ?? 0;
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  /* ── Dates with items (for dots) ─────────────────────────────────── */
  const datesWithItems = new Set(
    (activePlan?.study_plan_items ?? []).map(i => i.scheduled_date)
  );

  // Week view dates
  const weekDates: string[] = [];
  const weekStart = new Date(selectedDate + "T00:00:00");
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    weekDates.push(toDateStr(d));
  }

  /* ═════════════════════════════════════════════════════════════════ */
  /*  Render                                                          */
  /* ═════════════════════════════════════════════════════════════════ */

  return (
    <ErrorBoundary feature="Lernplan">
      {DeleteConfirm}
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-surface-100 rounded-xl w-48 mb-6" />
            <div className="h-32 bg-surface-100 rounded-2xl mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface-100 rounded-xl" />)}
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
              <CalendarClock className="text-brand-600" size={26} />
              {t("lernplan.title")}
            </h1>
            {activePlan && <StudyStreak items={activePlan.study_plan_items} />}
          </div>
          <p className="text-surface-500 text-sm">{t("lernplan.subtitle")}</p>
        </div>
      </div>

      {/* ── No plans: Generate CTA ───────────────────────────────── */}
      {plans.length === 0 && !activePlan ? (
        <div className="card text-center py-16">
          <Brain size={48} className="mx-auto mb-4 text-brand-300" />
          <h2 className="text-lg font-semibold text-surface-800 mb-2">
            {t("lernplan.noPlanTitle")}
          </h2>
          <p className="text-surface-500 text-sm mb-6 max-w-md mx-auto">
            {t("lernplan.noPlanDesc")}
          </p>

          {/* Strategy picker */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {(["balanced", "intensive", "spaced"] as const).map(s => {
              const Icon = STRATEGY_ICONS[s];
              const isActive = strategy === s;
              return (
                <button
                  key={s}
                  onClick={() => setStrategy(s)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    isActive
                      ? "border-brand-300 bg-brand-50 text-brand-700"
                      : "border-surface-200 text-surface-600 hover:border-brand-200"
                  }`}
                >
                  <Icon size={16} />
                  {t(`lernplan.strategy.${s}`)}
                </button>
              );
            })}
          </div>

          <button
            onClick={generatePlan}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <RotateCcw size={18} className="animate-spin" />
            ) : (
              <Sparkles size={18} />
            )}
            {generating ? t("lernplan.generating") : t("lernplan.generate")}
          </button>
        </div>
      ) : (
        <>
          {/* ── Plan selector + progress ───────────────────────── */}
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {plans.length > 1 && (
                  <select
                    value={activePlan?.id ?? ""}
                    onChange={(e) => {
                      const p = plans.find(p => p.id === e.target.value);
                      if (p) setActivePlan(p);
                    }}
                    className="text-sm font-medium bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 text-surface-800"
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                )}
                {plans.length <= 1 && activePlan && (
                  <h2 className="text-lg font-semibold text-surface-800">{activePlan.title}</h2>
                )}
                {activePlan && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    activePlan.strategy === "intensive"
                      ? "bg-red-50 text-red-600"
                      : activePlan.strategy === "spaced"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-brand-50 text-brand-600"
                  }`}>
                    {t(`lernplan.strategy.${activePlan.strategy}`)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={generatePlan}
                  disabled={generating}
                  className="text-xs px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors font-medium flex items-center gap-1.5"
                >
                  <Sparkles size={14} />
                  {t("lernplan.newPlan")}
                </button>
                {activePlan && (
                  <button
                    onClick={() => deletePlan(activePlan.id)}
                    className="text-xs p-1.5 text-surface-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    title={t("lernplan.deletePlan")}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2.5 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-sm font-bold text-brand-600 whitespace-nowrap">
                {completedItems}/{totalItems}
              </span>
            </div>
          </div>

          {/* ── Week strip ─────────────────────────────────────── */}
          <div className="card mb-4 p-3">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => shiftDate(-7)} className="p-1 rounded-lg hover:bg-surface-100 text-surface-500">
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-medium text-surface-700">
                {formatDateLabel(selectedDate, t)}
              </span>
              <button onClick={() => shiftDate(7)} className="p-1 rounded-lg hover:bg-surface-100 text-surface-500">
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekDates.map(d => {
                const isSelected = d === selectedDate;
                const hasItems = datesWithItems.has(d);
                const isToday = d === toDateStr(new Date());
                const dayNum = new Date(d + "T00:00:00").getDate();
                const dayName = new Date(d + "T00:00:00").toLocaleDateString("de-CH", { weekday: "short" });

                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    className={`flex flex-col items-center py-2 rounded-xl transition-all ${
                      isSelected
                        ? "bg-brand-600 text-white shadow-sm"
                        : isToday
                          ? "bg-brand-50 text-brand-700"
                          : "hover:bg-surface-50 text-surface-600"
                    }`}
                  >
                    <span className="text-[10px] uppercase">{dayName}</span>
                    <span className="text-sm font-bold">{dayNum}</span>
                    {hasItems && !isSelected && (
                      <span className="w-1 h-1 rounded-full bg-brand-400 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Day summary ────────────────────────────────────── */}
          {dayItems.length > 0 && (
            <div className="flex items-center gap-4 mb-4 text-sm text-surface-600">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-green-500" />
                {dayCompleted}/{dayTotal} {t("lernplan.done")}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-surface-400" />
                {dayMinutes} min {t("lernplan.remaining")}
              </span>
              {dayCompleted === dayTotal && dayTotal > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                  <Trophy size={14} />
                  {t("lernplan.dayComplete")}
                </span>
              )}
            </div>
          )}

          {/* ── Weekly Progress Chart ──────────────────────────── */}
          {activePlan && (
            <div className="card mb-4">
              <h3 className="text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
                <BarChart3 size={16} className="text-brand-600" />
                {t("lernplan.weeklyProgress")}
              </h3>
              <WeeklyProgress items={activePlan.study_plan_items} />
            </div>
          )}

          {/* ── Day items ──────────────────────────────────────── */}
          <div className="space-y-2">
            {dayItems.length === 0 ? (
              <div className="card text-center py-12 text-surface-400">
                <CalendarClock size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t("lernplan.noItemsForDay")}</p>
              </div>
            ) : (
              <>
                {dayItems.map(item => {
                const Icon = ITEM_ICONS[item.item_type] ?? BookOpen;
                const prio = PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.medium;
                const isToggling = togglingId === item.id;
                const isBreak = item.item_type === "break";

                // Format completion time
                const completionTime = item.completed_at
                  ? new Date(item.completed_at).toLocaleTimeString("de-CH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : null;

                return (
                  <div
                    key={item.id}
                    className={`card p-4 flex items-start gap-4 transition-all ${
                      item.completed ? "opacity-60" : ""
                    } ${isBreak ? "bg-surface-50 border-dashed" : ""}`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleItem(item)}
                      disabled={isToggling}
                      className={`mt-0.5 flex-shrink-0 transition-transform ${isToggling ? "scale-90" : "hover:scale-110"}`}
                    >
                      {item.completed ? (
                        <CheckCircle2 size={22} className="text-green-500" />
                      ) : (
                        <Circle size={22} className="text-surface-300 hover:text-brand-400" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} className={item.completed ? "text-surface-400" : "text-brand-500"} />
                        <span className={`font-medium text-sm ${
                          item.completed ? "line-through text-surface-400" : "text-surface-800"
                        }`}>
                          {item.title}
                        </span>
                        {!isBreak && (
                          <span className={`w-2 h-2 rounded-full ${prio.dot}`} />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.description && (
                          <p className="text-xs text-surface-500 truncate">{item.description}</p>
                        )}
                        {completionTime && (
                          <span className="text-xs text-surface-400">
                            {t("lernplan.completedAt")} {completionTime}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!item.completed && !isBreak && (
                        <Link
                          href={`/timer?module=${item.topic_id || ""}&label=${encodeURIComponent(item.title)}&minutes=${item.duration_minutes}`}
                          className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title={t("lernplan.startTimer")}
                        >
                          <Play size={14} />
                        </Link>
                      )}
                      <span className="text-xs text-surface-400 whitespace-nowrap flex items-center gap-1">
                        <Clock size={12} />
                        {item.duration_minutes} min
                      </span>
                    </div>
                  </div>
                );
              })
                }
              </>
            )}
          </div>

          {/* ── Week Statistics ────────────────────────────────── */}
          {activePlan && (
            <div className="card mt-6">
              <h3 className="text-sm font-semibold text-surface-800 mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-brand-600" />
                {t("lernplan.weekStats")}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-surface-500 mb-1">{t("lernplan.plannedHours")}</p>
                  <p className="text-lg font-bold text-brand-600">
                    {weekStats.plannedHours} <span className="text-xs text-surface-400">{t("lernplan.hours")}</span>
                  </p>
                </div>
                <div className="text-center border-l border-r border-surface-200">
                  <p className="text-xs text-surface-500 mb-1">{t("lernplan.completedHours")}</p>
                  <p className="text-lg font-bold text-green-600">
                    {weekStats.completedHours} <span className="text-xs text-surface-400">{t("lernplan.hours")}</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-surface-500 mb-1">{t("lernplan.completionRate")}</p>
                  <p className="text-lg font-bold text-indigo-600">
                    {weekStats.rate}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
        )}
      </>
      )}
      </div>
    </ErrorBoundary>
  );
}
