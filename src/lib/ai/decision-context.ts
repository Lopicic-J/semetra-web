/**
 * Decision Engine Context for AI
 *
 * Generates a rich context block from the Decision Engine's analysis
 * to inject into AI conversations. This gives the AI awareness of:
 * - Module priorities and risk levels
 * - Specific recommendations and action items
 * - Grade predictions and required performance
 * - Study patterns and knowledge gaps
 *
 * This context makes the AI a true study advisor rather than
 * just a chat assistant.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCommandCenterState,
  assessModuleRisk,
  generateActions,
  buildAIContext,
  predictOutcome,
} from "@/lib/decision/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/lib/decision/types";
import type {
  ModuleIntelligence,
  CommandCenterState,
  AIDecisionContext,
} from "@/lib/decision/types";

/**
 * Build full decision context for AI injection (server-side).
 * Returns a formatted text block.
 */
export async function buildDecisionContextBlock(
  supabase: SupabaseClient,
  userId: string,
  focusModuleId?: string | null
): Promise<string> {
  // Fetch intelligence data server-side
  const intelligence = await fetchModuleIntelligenceServer(supabase, userId);
  if (intelligence.length === 0) return "";

  const state = buildCommandCenterState(intelligence, DEFAULT_ENGINE_CONFIG);
  const lines: string[] = ["\n\n--- Semetra Decision Engine Analysis ---"];

  // Global Overview
  lines.push(`\nOverall Status:`);
  lines.push(`  Active Modules: ${state.overview.activeModules}`);
  lines.push(`  Modules at Risk: ${state.overview.atRiskModules}`);
  if (state.overview.overallGPA !== null) {
    lines.push(`  GPA: ${state.overview.overallGPA.toFixed(2)}`);
  }
  lines.push(`  Study Time This Week: ${state.overview.totalStudyMinutesThisWeek} minutes`);
  lines.push(`  Overdue Tasks: ${state.overview.tasksOverdue}`);
  lines.push(`  Study Streak: ${state.overview.studyStreak} days`);

  // Upcoming Exams
  if (state.overview.examsThisWeek.length > 0) {
    lines.push(`\nExams This Week:`);
    for (const e of state.overview.examsThisWeek) {
      lines.push(`  - ${e.title} in ${e.daysUntil} days`);
    }
  }

  // Alerts (Critical + High)
  const importantAlerts = state.today.alerts.filter(
    (a) => a.level === "critical" || a.level === "high"
  );
  if (importantAlerts.length > 0) {
    lines.push(`\nCritical Alerts:`);
    for (const a of importantAlerts) {
      lines.push(`  ⚠️ [${a.level.toUpperCase()}] ${a.title}: ${a.message}`);
    }
  }

  // Top 5 Module Priorities
  lines.push(`\nModule Priority Ranking:`);
  for (const mp of state.moduleRankings.slice(0, 5)) {
    const mod = intelligence.find((m) => m.moduleId === mp.moduleId);
    if (!mod) continue;
    const topReason = mp.reasons[0]?.description ?? "";
    lines.push(`  ${mp.rank}. ${mod.moduleName} (Score: ${mp.score}) — ${topReason}`);
    lines.push(`     Suggested study time today: ${mp.suggestedMinutesToday} min`);
  }

  // Today's Top Actions
  const topActions = state.today.actions.slice(0, 5);
  if (topActions.length > 0) {
    lines.push(`\nRecommended Actions Today:`);
    for (const a of topActions) {
      lines.push(`  - [${a.urgency.toUpperCase()}] ${a.title} (~${a.estimatedMinutes} min)`);
      lines.push(`    Reason: ${a.reason}`);
    }
  }

  // Focus Module Detail (if specified)
  if (focusModuleId) {
    const mod = intelligence.find((m) => m.moduleId === focusModuleId);
    if (mod) {
      const risk = assessModuleRisk(mod);
      const actions = generateActions(mod, risk);
      const prediction = predictOutcome(mod);
      const ctx = buildAIContext(mod, risk, actions);

      lines.push(`\n--- Focus Module: ${mod.moduleName} ---`);
      lines.push(`  Risk Level: ${risk.overall} (Score: ${risk.score}/100)`);
      if (risk.factors.length > 0) {
        lines.push(`  Risk Factors:`);
        for (const f of risk.factors.slice(0, 5)) {
          lines.push(`    - [${f.severity}] ${f.message}`);
        }
      }
      if (mod.grades.current !== null) {
        lines.push(`  Current Grade: ${mod.grades.current.toFixed(1)}`);
      }
      if (mod.grades.target !== null) {
        lines.push(`  Target Grade: ${mod.grades.target.toFixed(1)}`);
      }
      if (prediction.requiredPerformance) {
        lines.push(`  Required: ${prediction.requiredPerformance.description}`);
      }
      lines.push(`  Pass Probability: ${prediction.passProbability}%`);
      if (mod.knowledge.weakTopics.length > 0) {
        lines.push(`  Weak Topics: ${mod.knowledge.weakTopics.slice(0, 5).join(", ")}`);
      }
      lines.push(`  Study Time (7 days): ${mod.studyTime.last7Days} min`);
      lines.push(`  Overdue Tasks: ${mod.tasks.overdue}`);
      if (mod.exams.daysUntilNext !== null) {
        lines.push(`  Days Until Exam: ${mod.exams.daysUntilNext}`);
      }
    }
  }

  // Risks Overview
  const criticalModules = [...state.risks.critical, ...state.risks.high];
  if (criticalModules.length > 0) {
    lines.push(`\nHigh-Risk Modules:`);
    for (const risk of criticalModules.slice(0, 3)) {
      const mod = intelligence.find((m) => m.moduleId === risk.moduleId);
      if (!mod) continue;
      const prediction = predictOutcome(mod);
      lines.push(`  ${mod.moduleName}:`);
      lines.push(`    Risk: ${risk.overall} (${risk.score}/100)`);
      lines.push(`    Pass Probability: ${prediction.passProbability}%`);
      lines.push(`    Top Issue: ${risk.factors[0]?.message ?? "unknown"}`);
    }
  }

  lines.push(`\n--- End of Decision Engine Analysis ---`);
  lines.push(`(Use this data to provide personalized, actionable study advice.)`);

  return lines.join("\n");
}

/**
 * Simplified server-side intelligence fetch.
 * Mirrors the client hook but without React state.
 */
async function fetchModuleIntelligenceServer(
  supabase: SupabaseClient,
  userId: string
): Promise<ModuleIntelligence[]> {
  // Import the server-side builder from the API route
  // For now, inline a minimal version that fetches the essentials
  const [
    { data: modules },
    { data: tasks },
    { data: timeLogs },
    { data: grades },
    { data: topics },
    { data: flashcards },
    { data: notes },
    { data: documents },
    { data: mindmaps },
    { data: events },
  ] = await Promise.all([
    supabase.from("modules").select("*").eq("user_id", userId),
    supabase.from("tasks").select("*").eq("user_id", userId).limit(200),
    supabase.from("time_logs").select("*").eq("user_id", userId).order("started_at", { ascending: false }),
    supabase.from("grades").select("*").eq("user_id", userId),
    supabase.from("topics").select("*").eq("user_id", userId).limit(500),
    supabase.from("flashcards").select("*").eq("user_id", userId).limit(1000),
    supabase.from("notes").select("id, module_id").eq("user_id", userId),
    supabase.from("documents").select("id, module_id").eq("user_id", userId),
    supabase.from("mindmaps").select("id, module_id").eq("user_id", userId),
    supabase.from("events").select("*").eq("user_id", userId).eq("event_type", "exam"),
  ]);

  if (!modules || modules.length === 0) return [];

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  return modules.map((mod) => {
    const id = mod.id as string;

    // Grades
    const mGrades = (grades ?? []).filter((g) => g.module_id === id);
    const gVals = mGrades.filter((g) => g.grade != null).map((g) => g.grade as number);
    const currentGrade = gVals.length > 0 ? Math.round((gVals.reduce((s, g) => s + g, 0) / gVals.length) * 100) / 100 : null;

    // Tasks
    const mTasks = (tasks ?? []).filter((t) => t.module_id === id);
    const overdue = mTasks.filter((t) => t.status !== "done" && t.due_date && new Date(t.due_date) < now).length;
    const dueSoon = mTasks.filter((t) => {
      if (t.status === "done" || !t.due_date) return false;
      const d = new Date(t.due_date);
      const limit = new Date(now);
      limit.setDate(now.getDate() + 3);
      return d >= now && d <= limit;
    }).length;

    // Time
    const mLogs = (timeLogs ?? []).filter((l) => l.module_id === id);
    const totalMin = Math.round(mLogs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / 60);
    const last7 = Math.round(mLogs.filter((l) => new Date(l.started_at) >= sevenDaysAgo).reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / 60);
    const last30 = Math.round(mLogs.filter((l) => new Date(l.started_at) >= thirtyDaysAgo).reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / 60);
    const lastStudied = mLogs.length > 0 ? mLogs[0].started_at : null;
    const daysSince = lastStudied ? Math.round((now.getTime() - new Date(lastStudied).getTime()) / 86400000) : null;

    // Topics
    const mTopics = (topics ?? []).filter((t) => t.module_id === id);
    const levels = mTopics.map((t) => t.knowledge_level ?? 0);
    const avgLevel = levels.length > 0 ? Math.round(levels.reduce((s, l) => s + l, 0) / levels.length) : 0;
    const weakTopics = mTopics.filter((t) => (t.knowledge_level ?? 0) < 40).map((t) => t.title);
    const reviewDue = mTopics.filter((t) => t.sr_next_review && new Date(t.sr_next_review) <= now).length;

    // Flashcards
    const mFC = (flashcards ?? []).filter((f) => f.module_id === id);
    const fcDue = mFC.filter((f) => !f.next_review || new Date(f.next_review) <= now).length;

    // Exams
    const mExams = (events ?? []).filter((e) => e.module_id === id);

    // Resources
    const mNotes = (notes ?? []).filter((n) => n.module_id === id);
    const mDocs = (documents ?? []).filter((d) => d.module_id === id);
    const mMM = (mindmaps ?? []).filter((m) => m.module_id === id);

    const status = (mod.status as string) ?? "active";

    return {
      moduleId: id,
      moduleName: mod.name as string,
      moduleCode: (mod.code ?? mod.module_code ?? undefined) as string | undefined,
      ects: (mod.ects ?? mod.ects_equivalent ?? 0) as number,
      semester: mod.semester ? parseInt(mod.semester as string, 10) || undefined : undefined,
      status: (["planned", "active", "completed", "paused"].includes(status) ? status : "active") as ModuleIntelligence["status"],
      color: (mod.color as string) ?? undefined,
      grades: {
        current: currentGrade,
        target: (mod.target_grade as number | null) ?? null,
        needed: null,
        passed: currentGrade !== null ? currentGrade >= 4.0 : null,
        trend: "unknown" as const,
        componentResults: mGrades.map((g) => ({
          name: g.title as string,
          type: (g.exam_type as string) ?? "unbekannt",
          weight: (g.weight as number) ?? 1,
          grade: (g.grade as number | null) ?? null,
          passed: g.grade != null ? (g.grade as number) >= 4.0 : null,
        })),
      },
      exams: {
        next: mExams.length > 0 ? {
          id: mExams[0].id as string,
          title: mExams[0].title as string,
          date: mExams[0].start_dt as string,
          daysUntil: Math.round((new Date(mExams[0].start_dt as string).getTime() - now.getTime()) / 86400000),
          moduleId: id,
          hasGrade: false,
        } : null,
        daysUntilNext: mExams.length > 0 ? Math.round((new Date(mExams[0].start_dt as string).getTime() - now.getTime()) / 86400000) : null,
        all: mExams.map((e) => ({
          id: e.id as string,
          title: e.title as string,
          date: e.start_dt as string,
          daysUntil: Math.round((new Date(e.start_dt as string).getTime() - now.getTime()) / 86400000),
          moduleId: id,
          hasGrade: false,
        })),
        totalCount: mExams.length,
        completedCount: 0,
      },
      tasks: {
        total: mTasks.length,
        completed: mTasks.filter((t) => t.status === "done").length,
        overdue,
        dueSoon,
        completionRate: mTasks.length > 0 ? Math.round((mTasks.filter((t) => t.status === "done").length / mTasks.length) * 100) : 0,
        nextDeadline: mTasks.filter((t) => t.status !== "done" && t.due_date && new Date(t.due_date) >= now).map((t) => t.due_date as string)[0] ?? null,
      },
      studyTime: {
        totalMinutes: totalMin,
        last7Days: last7,
        last30Days: last30,
        averagePerWeek: Math.round(last30 / 4),
        trend: "unknown" as const,
        lastStudied: lastStudied ? new Date(lastStudied).toISOString() : null,
        daysSinceLastStudy: daysSince,
      },
      knowledge: {
        topicCount: mTopics.length,
        averageLevel: avgLevel,
        weakTopics,
        reviewDue,
        flashcardsDue: fcDue,
        totalFlashcards: mFC.length,
      },
      resources: {
        noteCount: mNotes.length,
        documentCount: mDocs.length,
        mindmapCount: mMM.length,
        flashcardDecks: new Set(mFC.map((f) => f.deck_name as string)).size,
      },
    } as ModuleIntelligence;
  });
}
