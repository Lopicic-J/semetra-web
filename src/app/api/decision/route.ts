/**
 * Decision Engine API Route
 *
 * Berechnet den CommandCenterState serverseitig.
 * Liefert Prioritäten, Risiken, Prognosen und Aktionsempfehlungen.
 *
 * GET  /api/decision           → Full CommandCenterState
 * GET  /api/decision?module=ID → Single module AI context
 */

import { NextRequest } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  errorResponse,
  successResponse,
  withErrorHandler,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import {
  buildCommandCenterState,
  assessModuleRisk,
  generateActions,
  buildAIContext,
  predictOutcome,
  calculateModulePriority,
} from "@/lib/decision/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/lib/decision/types";
import type {
  ModuleIntelligence,
  ComponentSnapshot,
  ExamSnapshot,
  TrendDirection,
} from "@/lib/decision/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const log = logger("api:decision");

export async function GET(req: NextRequest) {
  return withErrorHandler("api:decision", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const moduleId = req.nextUrl.searchParams.get("module");

    log.info("Decision engine request", { userId: user.id, moduleId });

    // Fetch all raw data
    const intelligence = await buildModuleIntelligenceServer(supabase, user.id);

    if (moduleId) {
      // Single module context (for AI chat)
      const module = intelligence.find((m) => m.moduleId === moduleId);
      if (!module) return errorResponse("Modul nicht gefunden", 404);

      const risk = assessModuleRisk(module);
      const actions = generateActions(module, risk);
      const prediction = predictOutcome(module);
      const priority = calculateModulePriority(module, risk);
      const aiContext = buildAIContext(module, risk, actions);

      return successResponse({
        module: {
          intelligence: module,
          risk,
          actions,
          prediction,
          priority,
        },
        aiContext,
      });
    }

    // Full Command Center state
    const state = buildCommandCenterState(intelligence);

    // Serialize Maps to plain objects for JSON
    const serializable = {
      ...state,
      risks: {
        critical: state.risks.critical,
        high: state.risks.high,
        medium: state.risks.medium,
        modules: Object.fromEntries(state.risks.modules),
      },
      predictions: Object.fromEntries(state.predictions),
    };

    log.info("Decision engine computed", {
      modules: intelligence.length,
      activeModules: state.overview.activeModules,
      atRisk: state.overview.atRiskModules,
      actions: state.today.actions.length,
    });

    return successResponse(serializable);
  });
}

// ─── Server-side Module Intelligence Builder ─────────────────
// Mirror of useModuleIntelligence logic but using server-side Supabase

async function buildModuleIntelligenceServer(
  supabase: SupabaseClient,
  userId: string
): Promise<ModuleIntelligence[]> {
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
    supabase.from("tasks").select("*").eq("user_id", userId),
    supabase.from("time_logs").select("*").eq("user_id", userId),
    supabase.from("grades").select("*").eq("user_id", userId),
    supabase.from("topics").select("*").eq("user_id", userId),
    supabase.from("flashcards").select("*").eq("user_id", userId),
    supabase.from("notes").select("id, module_id").eq("user_id", userId),
    supabase.from("documents").select("id, module_id").eq("user_id", userId),
    supabase.from("mindmaps").select("id, module_id").eq("user_id", userId),
    supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .eq("event_type", "exam"),
  ]);

  if (!modules || modules.length === 0) return [];

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Index by module_id
  const tasksByModule = groupBy(tasks ?? [], "module_id");
  const gradesByModule = groupBy(grades ?? [], "module_id");
  const topicsByModule = groupBy(topics ?? [], "module_id");
  const flashcardsByModule = groupBy(flashcards ?? [], "module_id");
  const notesByModule = groupBy(notes ?? [], "module_id");
  const docsByModule = groupBy(documents ?? [], "module_id");
  const mindmapsByModule = groupBy(mindmaps ?? [], "module_id");
  const timeLogsByModule = groupBy(timeLogs ?? [], "module_id");

  // Exam-module mapping
  const examsByModule = buildExamModuleMap(
    events ?? [],
    topics ?? [],
    grades ?? [],
    modules
  );

  return modules.map((mod: Record<string, unknown>) => {
    const moduleId = mod.id as string;

    // Grades
    const moduleGrades = (gradesByModule.get(moduleId) ?? []) as Array<Record<string, unknown>>;
    const gradeValues = moduleGrades
      .filter((g) => g.grade !== null && g.grade !== undefined)
      .map((g) => g.grade as number);

    const currentGrade =
      gradeValues.length > 0
        ? Math.round((gradeValues.reduce((s, g) => s + g, 0) / gradeValues.length) * 100) / 100
        : null;

    const gradeTrend: TrendDirection = gradeValues.length >= 2
      ? (gradeValues[0] > gradeValues[gradeValues.length - 1] ? "improving" :
         gradeValues[0] < gradeValues[gradeValues.length - 1] ? "declining" : "stable")
      : "unknown";

    const isPassed = currentGrade !== null ? currentGrade >= 4.0 : null;

    const targetGrade = (mod.target_grade as number | null) ?? null;
    let neededGrade: number | null = null;
    if (targetGrade && currentGrade !== null && gradeValues.length > 0) {
      const needed = targetGrade * (gradeValues.length + 1) - gradeValues.reduce((s, g) => s + g, 0);
      neededGrade = Math.round(Math.max(1, Math.min(6, needed)) * 10) / 10;
    }

    const componentResults: ComponentSnapshot[] = moduleGrades.map((g) => ({
      name: g.title as string,
      type: (g.exam_type as string) ?? "unbekannt",
      weight: (g.weight as number) ?? 1,
      grade: (g.grade as number | null) ?? null,
      passed: g.grade !== null ? (g.grade as number) >= 4.0 : null,
    }));

    // Exams
    const moduleExams = (examsByModule.get(moduleId) ?? []) as Array<Record<string, unknown>>;
    const allExamSnapshots: ExamSnapshot[] = moduleExams.map((e) => ({
      id: e.id as string,
      title: e.title as string,
      date: e.start_dt as string,
      daysUntil: daysUntil(e.start_dt as string),
      moduleId,
      hasGrade: moduleGrades.some((g) => g.exam_id === e.id && g.grade !== null),
    }));
    const futureExams = allExamSnapshots.filter((e) => e.daysUntil >= 0);
    const nextExam = futureExams[0] ?? null;

    // Tasks
    const moduleTasks = (tasksByModule.get(moduleId) ?? []) as Array<Record<string, unknown>>;
    const completedTasks = moduleTasks.filter((t) => t.status === "done").length;
    const overdueTasks = moduleTasks.filter(
      (t) => t.status !== "done" && t.due_date && new Date(t.due_date as string) < now
    ).length;
    const dueSoonTasks = moduleTasks.filter((t) => {
      if (t.status === "done" || !t.due_date) return false;
      const d = new Date(t.due_date as string);
      const limit = new Date(now);
      limit.setDate(now.getDate() + 3);
      return d >= now && d <= limit;
    }).length;
    const taskRate = moduleTasks.length > 0 ? Math.round((completedTasks / moduleTasks.length) * 100) : 0;
    const nextDeadline = moduleTasks
      .filter((t) => t.status !== "done" && t.due_date && new Date(t.due_date as string) >= now)
      .map((t) => t.due_date as string)[0] ?? null;

    // Time Logs
    const moduleTimeLogs = (timeLogsByModule.get(moduleId) ?? []) as Array<Record<string, unknown>>;
    const totalMinutes = Math.round(
      moduleTimeLogs.reduce((s, l) => s + ((l.duration_seconds as number) ?? 0), 0) / 60
    );
    const last7DaysMinutes = Math.round(
      moduleTimeLogs
        .filter((l) => new Date(l.started_at as string) >= sevenDaysAgo)
        .reduce((s, l) => s + ((l.duration_seconds as number) ?? 0), 0) / 60
    );
    const last30DaysMinutes = Math.round(
      moduleTimeLogs
        .filter((l) => new Date(l.started_at as string) >= thirtyDaysAgo)
        .reduce((s, l) => s + ((l.duration_seconds as number) ?? 0), 0) / 60
    );
    const averagePerWeek = Math.round(last30DaysMinutes / 4);
    const lastStudied = moduleTimeLogs.length > 0 ? (moduleTimeLogs[0].started_at as string) : null;
    const daysSinceLastStudy = lastStudied ? Math.round((now.getTime() - new Date(lastStudied).getTime()) / (1000 * 60 * 60 * 24)) : null;

    // Topics
    const moduleTopics = (topicsByModule.get(moduleId) ?? []) as Array<Record<string, unknown>>;
    const topicLevels = moduleTopics.map((t) => (t.knowledge_level as number) ?? 0);
    const averageLevel = topicLevels.length > 0
      ? Math.round(topicLevels.reduce((s, l) => s + l, 0) / topicLevels.length)
      : 0;
    const weakTopics = moduleTopics
      .filter((t) => ((t.knowledge_level as number) ?? 0) < 40)
      .map((t) => t.title as string);
    const reviewDue = moduleTopics.filter((t) => {
      if (!t.sr_next_review) return false;
      return new Date(t.sr_next_review as string) <= now;
    }).length;

    // Flashcards
    const moduleFlashcards = (flashcardsByModule.get(moduleId) ?? []) as Array<Record<string, unknown>>;
    const flashcardsDue = moduleFlashcards.filter((f) => {
      if (!f.next_review) return true;
      return new Date(f.next_review as string) <= now;
    }).length;
    const flashcardDecks = new Set(moduleFlashcards.map((f) => f.deck_name as string)).size;

    // Resources
    const moduleNotes = notesByModule.get(moduleId) ?? [];
    const moduleDocs = docsByModule.get(moduleId) ?? [];
    const moduleMindmaps = mindmapsByModule.get(moduleId) ?? [];

    const status = (mod.status as string) ?? "active";

    return {
      moduleId,
      moduleName: mod.name as string,
      moduleCode: (mod.code as string) ?? (mod.module_code as string) ?? undefined,
      ects: (mod.ects as number) ?? (mod.ects_equivalent as number) ?? 0,
      semester: mod.semester ? parseInt(mod.semester as string, 10) || undefined : undefined,
      status: (["planned", "active", "completed", "paused"].includes(status) ? status : "active") as ModuleIntelligence["status"],
      color: (mod.color as string) ?? undefined,

      grades: {
        current: currentGrade,
        target: targetGrade,
        needed: neededGrade,
        passed: isPassed,
        trend: gradeTrend,
        componentResults,
      },
      exams: {
        next: nextExam,
        daysUntilNext: nextExam?.daysUntil ?? null,
        all: allExamSnapshots,
        totalCount: allExamSnapshots.length,
        completedCount: allExamSnapshots.filter((e) => e.hasGrade).length,
      },
      tasks: {
        total: moduleTasks.length,
        completed: completedTasks,
        overdue: overdueTasks,
        dueSoon: dueSoonTasks,
        completionRate: taskRate,
        nextDeadline,
      },
      studyTime: {
        totalMinutes,
        last7Days: last7DaysMinutes,
        last30Days: last30DaysMinutes,
        averagePerWeek,
        trend: last7DaysMinutes > last30DaysMinutes / 4 * 1.1 ? "improving" as TrendDirection :
               last7DaysMinutes < last30DaysMinutes / 4 * 0.9 ? "declining" as TrendDirection :
               moduleTimeLogs.length > 0 ? "stable" as TrendDirection : "unknown" as TrendDirection,
        lastStudied: lastStudied ? new Date(lastStudied).toISOString() : null,
        daysSinceLastStudy,
      },
      knowledge: {
        topicCount: moduleTopics.length,
        averageLevel,
        weakTopics,
        reviewDue,
        flashcardsDue,
        totalFlashcards: moduleFlashcards.length,
      },
      resources: {
        noteCount: moduleNotes.length,
        documentCount: moduleDocs.length,
        mindmapCount: moduleMindmaps.length,
        flashcardDecks,
      },
    } as ModuleIntelligence;
  });
}

// ─── Utilities (server-side) ─────────────────────────────────

function groupBy(items: Array<Record<string, unknown>>, key: string): Map<string, Array<Record<string, unknown>>> {
  const map = new Map<string, Array<Record<string, unknown>>>();
  for (const item of items) {
    const k = item[key] as string | null;
    if (!k) continue;
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function daysUntil(target: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(target);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function buildExamModuleMap(
  events: Array<Record<string, unknown>>,
  topics: Array<Record<string, unknown>>,
  grades: Array<Record<string, unknown>>,
  modules: Array<Record<string, unknown>>
): Map<string, Array<Record<string, unknown>>> {
  const map = new Map<string, Array<Record<string, unknown>>>();

  const examToModuleViaGrades = new Map<string, string>();
  for (const g of grades) {
    if (g.exam_id && g.module_id) {
      examToModuleViaGrades.set(g.exam_id as string, g.module_id as string);
    }
  }

  const examToModuleViaTopics = new Map<string, string>();
  for (const t of topics) {
    if (t.exam_id && t.module_id) {
      examToModuleViaTopics.set(t.exam_id as string, t.module_id as string);
    }
  }

  const modulePatterns = modules.map((m) => ({
    id: m.id as string,
    patterns: [
      (m.name as string).toLowerCase(),
      ...((m.code as string) ? [(m.code as string).toLowerCase()] : []),
      ...((m.module_code as string) ? [(m.module_code as string).toLowerCase()] : []),
    ],
  }));

  for (const event of events) {
    const eventId = event.id as string;
    let moduleId: string | null = null;

    moduleId = examToModuleViaGrades.get(eventId) ?? null;
    if (!moduleId) moduleId = examToModuleViaTopics.get(eventId) ?? null;

    if (!moduleId) {
      const title = (event.title as string).toLowerCase();
      for (const mp of modulePatterns) {
        if (mp.patterns.some((p) => title.includes(p) || p.includes(title))) {
          moduleId = mp.id;
          break;
        }
      }
    }

    if (!moduleId) {
      const eventDate = (event.start_dt as string).split("T")[0];
      for (const m of modules) {
        if (m.exam_date) {
          const modDate = (m.exam_date as string).split("T")[0];
          if (modDate === eventDate) {
            moduleId = m.id as string;
            break;
          }
        }
      }
    }

    if (moduleId) {
      const arr = map.get(moduleId);
      if (arr) arr.push(event);
      else map.set(moduleId, [event]);
    }
  }

  return map;
}
