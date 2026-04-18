"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import {
  GraduationCap, Calendar, CheckCircle2, Circle, Clock, Play,
  Brain, Target, BookOpen, AlertTriangle, Coffee, FileText,
  RefreshCw, ArrowRight, Zap,
} from "lucide-react";
import Link from "next/link";

interface Activity {
  type: string;
  title: string;
  description: string;
  duration_min: number;
  topicId?: string;
  topicTitle?: string;
  completed: boolean;
}

interface DayPlan {
  date: string;
  dayNumber: number;
  daysUntilExam: number;
  focus: string;
  activities: Activity[];
}

interface PrepPlan {
  id: string;
  exam_id: string;
  module_id: string;
  exam_date: string;
  plan_start_date: string;
  total_days: number;
  status: string;
  daily_plan: DayPlan[];
  days_completed: number;
  activities_completed: number;
  activities_total: number;
  modules?: { name: string; color: string };
  events?: { title: string; start_dt: string };
}

const ACTIVITY_ICONS: Record<string, typeof Brain> = {
  flashcards: Zap,
  review: BookOpen,
  exercises: Target,
  mock_exam: GraduationCap,
  summary: FileText,
  weak_topics: AlertTriangle,
  formula_sheet: FileText,
  rest: Coffee,
};

export default function ExamPrepPage() {
  const supabase = createClient();
  const { modules } = useModules();
  const searchParams = useSearchParams();
  const paramExamId = searchParams.get("examId");

  const [plans, setPlans] = useState<PrepPlan[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedExam, setSelectedExam] = useState(paramExamId ?? "");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [plansRes, examsRes] = await Promise.all([
      fetch("/api/exam-prep-plan").then(r => r.ok ? r.json() : { plans: [] }),
      supabase.from("events").select("id, title, start_dt, module_id, modules(name, color)")
        .eq("event_type", "exam")
        .gte("start_dt", new Date().toISOString())
        .order("start_dt"),
    ]);
    setPlans(plansRes.plans ?? []);
    setExams(examsRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const generatePlan = async () => {
    if (!selectedExam) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/exam-prep-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: selectedExam, prepDays: 5 }),
      });
      if (res.ok) {
        const plan = await res.json();
        await loadData();

        // Sync plan activities into Smart Schedule as exam_prep blocks
        // Uses free-slot detection to avoid conflicts with existing schedule
        if (plan?.daily_plan?.length > 0) {
          const exam = exams.find(e => e.id === selectedExam);
          for (const day of plan.daily_plan) {
            if (!day.date || !day.activities?.length) continue;
            const totalMin = day.activities.reduce((s: number, a: Activity) => s + (a.duration_min || 30), 0);

            // Find a free slot for this day
            let startTime = `${day.date}T09:00:00`;
            try {
              const slotRes = await fetch(`/api/schedule?view=free-slots&date=${day.date}`);
              if (slotRes.ok) {
                const slots = await slotRes.json();
                const freeSlots = Array.isArray(slots) ? slots : slots?.slots ?? [];
                const fit = freeSlots.find((s: any) => s.duration_minutes >= totalMin);
                if (fit) startTime = fit.slot_start;
              }
            } catch { /* fallback to 09:00 */ }

            const endTime = new Date(new Date(startTime).getTime() + totalMin * 60000).toISOString();

            fetch("/api/schedule", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                block_type: "exam_prep",
                start_time: startTime,
                end_time: endTime,
                title: `Prüfungsvorbereitung · ${exam?.title || "Prüfung"}`,
                module_id: exam?.module_id || null,
                exam_id: selectedExam,
                priority: "high",
                estimated_minutes: totalMin,
                source: "decision_engine",
                description: day.activities.map((a: Activity) => `${a.title} (${a.duration_min}min)`).join("\n"),
              }),
            }).catch(() => {});
          }
        }
      }
    } finally {
      setGenerating(false);
    }
  };

  const toggleActivity = async (planId: string, dayIndex: number, actIndex: number, completed: boolean) => {
    await fetch("/api/exam-prep-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, dayIndex, activityIndex: actIndex, completed }),
    });
    // Optimistic update
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p;
      const dp = [...p.daily_plan];
      dp[dayIndex] = { ...dp[dayIndex], activities: dp[dayIndex].activities.map((a, i) => i === actIndex ? { ...a, completed } : a) };
      const ac = dp.reduce((s, d) => s + d.activities.filter(a => a.completed).length, 0);
      return { ...p, daily_plan: dp, activities_completed: ac };
    }));
  };

  const today = new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-56" />
        <div className="h-40 bg-surface-200 dark:bg-surface-700 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
        <Calendar size={28} className="text-brand-500" />
        Prüfungsvorbereitung
      </h1>

      {/* Generate new plan */}
      {exams.length > 0 && (
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-surface-500 block mb-1">Prüfung wählen</label>
              <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm">
                <option value="">Prüfung auswählen...</option>
                {exams.filter(e => !plans.some(p => p.exam_id === e.id && p.status === "active")).map(e => {
                  const days = Math.ceil((new Date(e.start_dt).getTime() - Date.now()) / 86400000);
                  return <option key={e.id} value={e.id}>{e.title} — in {days} Tagen</option>;
                })}
              </select>
            </div>
            <button onClick={generatePlan} disabled={!selectedExam || generating}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
              {generating ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              Plan erstellen
            </button>
          </div>
        </div>
      )}

      {/* Active Plans */}
      {plans.filter(p => p.status === "active").map(plan => {
        const progress = plan.activities_total > 0 ? Math.round((plan.activities_completed / plan.activities_total) * 100) : 0;
        const examTitle = plan.events?.title ?? "Prüfung";
        const moduleColor = plan.modules?.color ?? "#6d28d9";

        return (
          <div key={plan.id} className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] overflow-hidden">
            {/* Plan Header */}
            <div className="p-5 border-b border-surface-100 dark:border-surface-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: moduleColor }}>
                  <GraduationCap size={20} />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-surface-900 dark:text-surface-50">{examTitle}</h2>
                  <p className="text-xs text-surface-500">{plan.modules?.name} · Prüfung am {new Date(plan.exam_date).toLocaleDateString("de-CH")}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-brand-600">{progress}%</p>
                  <p className="text-[10px] text-surface-400">{plan.activities_completed}/{plan.activities_total}</p>
                </div>
              </div>
              <div className="h-2 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden mt-3">
                <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* Day-by-day plan */}
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {plan.daily_plan.map((day, dayIndex) => {
                const isToday = day.date === today;
                const isPast = day.date < today;
                const dayComplete = day.activities.every(a => a.completed || a.type === "rest");

                return (
                  <div key={day.date} className={`p-4 ${isToday ? "bg-brand-50/30 dark:bg-brand-950/10" : ""}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        dayComplete ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" :
                        isToday ? "bg-brand-100 dark:bg-brand-900/30 text-brand-600" :
                        "bg-surface-100 dark:bg-surface-800 text-surface-500"
                      }`}>
                        {dayComplete ? <CheckCircle2 size={14} /> : `T${day.dayNumber}`}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                          {day.focus}
                          {isToday && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">Heute</span>}
                        </p>
                        <p className="text-[10px] text-surface-400">
                          {new Date(day.date).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}
                          {" · "}{day.daysUntilExam} Tag{day.daysUntilExam !== 1 ? "e" : ""} bis Prüfung
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 ml-10">
                      {day.activities.map((act, actIndex) => {
                        const Icon = ACTIVITY_ICONS[act.type] ?? BookOpen;
                        return (
                          <div key={actIndex} className="flex items-start gap-2.5">
                            <button
                              onClick={() => toggleActivity(plan.id, dayIndex, actIndex, !act.completed)}
                              className="mt-0.5 shrink-0"
                            >
                              {act.completed
                                ? <CheckCircle2 size={16} className="text-emerald-500" />
                                : <Circle size={16} className="text-surface-300 hover:text-brand-500 transition-colors" />
                              }
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${act.completed ? "line-through text-surface-400" : "text-surface-800 dark:text-surface-200"}`}>
                                {act.title}
                              </p>
                              <p className="text-[10px] text-surface-400">{act.description}</p>
                            </div>
                            {act.duration_min > 0 && (
                              <span className="text-[10px] text-surface-400 shrink-0 flex items-center gap-0.5">
                                <Clock size={9} /> {act.duration_min}m
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {plans.length === 0 && exams.length === 0 && (
        <div className="text-center py-12 text-surface-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p>Keine anstehenden Prüfungen. Trage eine Prüfung im Kalender ein.</p>
          <Link href="/calendar" className="text-sm text-brand-600 hover:underline mt-2 inline-block">Zum Kalender →</Link>
        </div>
      )}
    </div>
  );
}
