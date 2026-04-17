"use client";
/**
 * useModuleIntelligence — Data Aggregation Layer
 *
 * Aggregiert alle Datenquellen pro Modul zu ModuleIntelligence-Objekten
 * die der Decision Engine als Input dienen.
 *
 * Anti-Loop-Architektur:
 *   - Supabase-Client via useRef (stabile Referenz)
 *   - initialLoading vs. Hintergrund-Refresh (kein useMemo-Reset)
 *   - Debounced fetchAll für Realtime-Events
 *   - Fetch-Guard gegen parallele Fetches
 *   - computedAt als Ref (kein Re-render-Trigger)
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Module,
  Task,
  TimeLog,
  Grade,
  Topic,
  Flashcard,
  CalendarEvent,
} from "@/types/database";
import type {
  ModuleIntelligence,
  ComponentSnapshot,
  ExamSnapshot,
  TrendDirection,
} from "@/lib/decision/types";
import { calculateTrend } from "@/lib/decision/engine";

// ─── Partial types for lightweight queries ───────────────────
interface IdAndModule {
  id: string;
  module_id: string | null;
}

// ─── Hook Return Type ────────────────────────────────────────
interface UseModuleIntelligenceResult {
  modules: ModuleIntelligence[];
  loading: boolean;
  refetch: () => void;
  computedAt: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────
function daysUntil(target: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(target);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function groupByModule<T extends { module_id: string | null }>(
  items: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!item.module_id) continue;
    const arr = map.get(item.module_id);
    if (arr) arr.push(item);
    else map.set(item.module_id, [item]);
  }
  return map;
}

// ─── Raw Data Store (avoids 10 separate useState) ───────────
interface RawData {
  modules: Module[];
  tasks: Task[];
  timeLogs: TimeLog[];
  grades: Grade[];
  topics: Topic[];
  flashcards: Flashcard[];
  notes: IdAndModule[];
  documents: IdAndModule[];
  mindmaps: IdAndModule[];
  events: CalendarEvent[];
}

const EMPTY_RAW: RawData = {
  modules: [],
  tasks: [],
  timeLogs: [],
  grades: [],
  topics: [],
  flashcards: [],
  notes: [],
  documents: [],
  mindmaps: [],
  events: [],
};

// ─── Main Hook ───────────────────────────────────────────────
/**
 * @param standalone — When true, opens own realtime channels (for pages
 *   that don't use useModules/useTasks/useGrades). When false (default),
 *   listens to custom events dispatched by useSupabaseQuery.
 */
export function useModuleIntelligence(standalone = false): UseModuleIntelligenceResult {
  // Stable supabase client — never changes across renders
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // Single state object for all raw data — one setState per fetch cycle
  const [rawData, setRawData] = useState<RawData>(EMPTY_RAW);
  const [initialLoading, setInitialLoading] = useState(true);

  // Refs for anti-loop protection
  const isFetchingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const computedAtRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // ─── Core fetch function (no debounce, no guards — raw) ────
  const doFetch = useCallback(async () => {
    if (isFetchingRef.current || !mountedRef.current) return;
    isFetchingRef.current = true;

    try {
      const [
        modulesRes, tasksRes, timeLogsRes, gradesRes, topicsRes,
        flashcardsRes, notesRes, documentsRes, mindmapsRes, eventsRes,
      ] = await Promise.all([
        supabase.from("modules").select("id, name, code, module_code, ects, ects_equivalent, semester, status, color, target_grade, exam_date, created_at, learning_type").order("created_at", { ascending: false }),
        supabase.from("tasks").select("id, module_id, status, due_date").order("due_date", { ascending: true, nullsFirst: false }),
        supabase.from("time_logs").select("id, module_id, duration_seconds, started_at").order("started_at", { ascending: false }).limit(2000),
        supabase.from("grades").select("id, module_id, grade, title, exam_type, weight, exam_id, date").order("date", { ascending: false }),
        supabase.from("topics").select("id, module_id, title, knowledge_level, sr_next_review, exam_id, is_exam_relevant").order("created_at", { ascending: false }),
        supabase.from("flashcards").select("id, module_id, next_review, deck_name").order("next_review", { ascending: true, nullsFirst: false }),
        supabase.from("notes").select("id, module_id") as unknown as Promise<{ data: IdAndModule[] | null }>,
        supabase.from("documents").select("id, module_id") as unknown as Promise<{ data: IdAndModule[] | null }>,
        supabase.from("mindmaps").select("id, module_id") as unknown as Promise<{ data: IdAndModule[] | null }>,
        supabase.from("events").select("id, title, start_dt, module_id").eq("event_type", "exam").order("start_dt", { ascending: true }),
      ]);

      if (!mountedRef.current) return;

      // Single state update — minimizes re-renders
      setRawData({
        modules: (modulesRes.data as Module[] | null) ?? [],
        tasks: (tasksRes.data as Task[] | null) ?? [],
        timeLogs: (timeLogsRes.data as TimeLog[] | null) ?? [],
        grades: (gradesRes.data as Grade[] | null) ?? [],
        topics: (topicsRes.data as Topic[] | null) ?? [],
        flashcards: (flashcardsRes.data as Flashcard[] | null) ?? [],
        notes: notesRes.data ?? [],
        documents: documentsRes.data ?? [],
        mindmaps: mindmapsRes.data ?? [],
        events: (eventsRes.data as CalendarEvent[] | null) ?? [],
      });
    } catch (_e) {
      // Supabase queries failed — still stop loading
      console.error("[Decision Engine] Fetch failed:", _e);
    } finally {
      isFetchingRef.current = false;
      if (mountedRef.current) setInitialLoading(false);
    }
  }, [supabase]);

  // ─── Debounced fetch for realtime events ───────────────────
  const debouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      doFetch();
    }, 1000);
  }, [doFetch]);

  // ─── Initial fetch — once on mount ────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    doFetch();
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [doFetch]);

  // ─── Realtime: event-based (shared pages) or own channels (standalone) ──
  useEffect(() => {
    const timeLogHandler = () => debouncedFetch();
    window.addEventListener("time-log-updated", timeLogHandler);

    if (standalone) {
      // Standalone mode: open own channels (for pages without useModules/useTasks/useGrades)
      const channels = [
        supabase.channel("mi-modules")
          .on("postgres_changes", { event: "*", schema: "public", table: "modules" }, debouncedFetch)
          .subscribe(),
        supabase.channel("mi-tasks")
          .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, debouncedFetch)
          .subscribe(),
        supabase.channel("mi-grades")
          .on("postgres_changes", { event: "*", schema: "public", table: "grades" }, debouncedFetch)
          .subscribe(),
      ];
      return () => {
        channels.forEach((ch) => supabase.removeChannel(ch));
        window.removeEventListener("time-log-updated", timeLogHandler);
      };
    }

    // Shared mode: listen to events from useSupabaseQuery channels
    const WATCHED_TABLES = new Set(["modules", "tasks", "grades"]);
    const realtimeHandler = (e: Event) => {
      const table = (e as CustomEvent).detail?.table;
      if (WATCHED_TABLES.has(table)) debouncedFetch();
    };
    window.addEventListener("supabase-realtime-update", realtimeHandler);

    return () => {
      window.removeEventListener("supabase-realtime-update", realtimeHandler);
      window.removeEventListener("time-log-updated", timeLogHandler);
    };
  }, [supabase, debouncedFetch, standalone]);

  // ─── Aggregate into ModuleIntelligence ─────────────────────
  const modules = useMemo<ModuleIntelligence[]>(() => {
    if (rawData.modules.length === 0) return [];

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const tasksByModule = groupByModule(rawData.tasks);
    const gradesByModule = groupByModule(rawData.grades);
    const topicsByModule = groupByModule(rawData.topics);
    const flashcardsByModule = groupByModule(rawData.flashcards);
    const notesByModule = groupByModule(rawData.notes);
    const docsByModule = groupByModule(rawData.documents);
    const mindmapsByModule = groupByModule(rawData.mindmaps);
    const timeLogsByModule = groupByModule(rawData.timeLogs);
    const examsByModule = buildExamModuleMap(rawData.events, rawData.topics, rawData.grades, rawData.modules);

    const result: ModuleIntelligence[] = rawData.modules.map((mod) => {
      const moduleId = mod.id;

      // ── Grades ──
      const moduleGrades = gradesByModule.get(moduleId) ?? [];
      const gradeValues = moduleGrades
        .filter((g): g is Grade & { grade: number } => g.grade !== null)
        .map((g) => g.grade);

      const currentGrade =
        gradeValues.length > 0
          ? Math.round((gradeValues.reduce((s, g) => s + g, 0) / gradeValues.length) * 100) / 100
          : null;

      const gradeTrend: TrendDirection =
        gradeValues.length >= 2 ? calculateTrend(gradeValues) : "unknown";

      const isPassed = currentGrade !== null ? currentGrade >= 4.0 : null;

      let neededGrade: number | null = null;
      if (mod.target_grade && currentGrade !== null && gradeValues.length > 0) {
        const needed = mod.target_grade * (gradeValues.length + 1) - gradeValues.reduce((s, g) => s + g, 0);
        neededGrade = Math.round(Math.max(1, Math.min(6, needed)) * 10) / 10;
      }

      const componentResults: ComponentSnapshot[] = moduleGrades.map((g) => ({
        name: g.title,
        type: g.exam_type ?? "unbekannt",
        weight: g.weight ?? 1,
        grade: g.grade,
        passed: g.grade !== null ? g.grade >= 4.0 : null,
      }));

      // ── Exams ──
      const moduleExams = examsByModule.get(moduleId) ?? [];
      const allExamSnapshots: ExamSnapshot[] = moduleExams.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.start_dt,
        daysUntil: daysUntil(e.start_dt),
        moduleId,
        hasGrade: moduleGrades.some((g) => g.exam_id === e.id && g.grade !== null),
      }));
      const futureExams = allExamSnapshots
        .filter((e) => e.daysUntil >= 0)
        .sort((a, b) => a.daysUntil - b.daysUntil);
      const nextExam = futureExams[0] ?? null;

      // ── Tasks ──
      const moduleTasks = tasksByModule.get(moduleId) ?? [];
      const completedTasks = moduleTasks.filter((t) => t.status === "done").length;
      const overdueTasks = moduleTasks.filter(
        (t) => t.status !== "done" && t.due_date !== null && new Date(t.due_date) < now
      ).length;
      const dueSoonTasks = moduleTasks.filter((t) => {
        if (t.status === "done" || !t.due_date) return false;
        const d = new Date(t.due_date);
        const limit = new Date(now);
        limit.setDate(now.getDate() + 3);
        return d >= now && d <= limit;
      }).length;
      const taskRate = moduleTasks.length > 0 ? Math.round((completedTasks / moduleTasks.length) * 100) : 0;
      const nextDeadline: string | null =
        moduleTasks
          .filter((t) => t.status !== "done" && t.due_date !== null && new Date(t.due_date) >= now)
          .map((t) => t.due_date)[0] ?? null;

      // ── Time Logs ──
      const moduleTimeLogs = timeLogsByModule.get(moduleId) ?? [];
      const totalMinutes = Math.round(
        moduleTimeLogs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / 60
      );
      const last7DaysMinutes = Math.round(
        moduleTimeLogs
          .filter((l) => new Date(l.started_at) >= sevenDaysAgo)
          .reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / 60
      );
      const last30DaysMinutes = Math.round(
        moduleTimeLogs
          .filter((l) => new Date(l.started_at) >= thirtyDaysAgo)
          .reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / 60
      );
      const averagePerWeek = Math.round(last30DaysMinutes / 4);

      const prev7Start = new Date(sevenDaysAgo);
      prev7Start.setDate(prev7Start.getDate() - 7);
      const prev7DaysMinutes = Math.round(
        moduleTimeLogs
          .filter((l) => {
            const d = new Date(l.started_at);
            return d >= prev7Start && d < sevenDaysAgo;
          })
          .reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / 60
      );
      const studyTimeTrend: TrendDirection =
        last7DaysMinutes > prev7DaysMinutes * 1.1
          ? "improving"
          : last7DaysMinutes < prev7DaysMinutes * 0.9
            ? "declining"
            : moduleTimeLogs.length > 0
              ? "stable"
              : "unknown";

      const lastStudied = moduleTimeLogs.length > 0 ? moduleTimeLogs[0].started_at : null;
      const daysSinceLastStudy = lastStudied
        ? Math.round((now.getTime() - new Date(lastStudied).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // ── Topics ──
      const moduleTopics = topicsByModule.get(moduleId) ?? [];
      const topicLevels = moduleTopics.map((t) => t.knowledge_level ?? 0);
      const averageLevel =
        topicLevels.length > 0
          ? Math.round(topicLevels.reduce((s, l) => s + l, 0) / topicLevels.length)
          : 0;
      const weakTopics = moduleTopics
        .filter((t) => (t.knowledge_level ?? 0) < 40)
        .map((t) => t.title);
      const reviewDue = moduleTopics.filter((t) => {
        if (!t.sr_next_review) return false;
        return new Date(t.sr_next_review) <= now;
      }).length;

      // ── Flashcards ──
      const moduleFlashcards = flashcardsByModule.get(moduleId) ?? [];
      const flashcardsDue = moduleFlashcards.filter((f) => {
        if (!f.next_review) return true;
        return new Date(f.next_review) <= now;
      }).length;
      const flashcardDecks = new Set(moduleFlashcards.map((f) => f.deck_name)).size;

      // ── Resources ──
      const moduleNotes = notesByModule.get(moduleId) ?? [];
      const moduleDocs = docsByModule.get(moduleId) ?? [];
      const moduleMindmaps = mindmapsByModule.get(moduleId) ?? [];

      return {
        moduleId,
        moduleName: mod.name,
        moduleCode: mod.code ?? mod.module_code ?? undefined,
        ects: mod.ects ?? mod.ects_equivalent ?? 0,
        semester: mod.semester ? parseInt(mod.semester, 10) || undefined : undefined,
        status: mapModuleStatus(mod.status),
        color: mod.color ?? undefined,
        learningType: (mod as any).learning_type ?? undefined,

        grades: {
          current: currentGrade,
          target: mod.target_grade,
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
          trend: studyTimeTrend,
          lastStudied: lastStudied ? new Date(lastStudied).toISOString() : null,
          daysSinceLastStudy,
        },
        knowledge: {
          topicCount: moduleTopics.length,
          averageLevel,
          weakTopics,
          examRelevantCount: moduleTopics.filter((t) => (t as any).is_exam_relevant).length,
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

    // Update computedAt as ref (no re-render trigger)
    computedAtRef.current = new Date().toISOString();
    return result;
  }, [rawData]);

  return {
    modules,
    loading: initialLoading,
    refetch: doFetch,
    computedAt: computedAtRef.current,
  };
}

// ─── Utilities ───────────────────────────────────────────────

function mapModuleStatus(status: string): "planned" | "active" | "completed" | "paused" {
  if (status === "planned" || status === "active" || status === "completed" || status === "paused") {
    return status;
  }
  return "active";
}

/**
 * Maps exams (CalendarEvents) to modules via multiple heuristics.
 */
function buildExamModuleMap(
  events: CalendarEvent[],
  topics: Topic[],
  grades: Grade[],
  modules: Module[]
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();

  // Direct module_id (from migration 050)
  const eventsWithModuleId = events.filter((e) => e.module_id !== null);
  for (const e of eventsWithModuleId) {
    const arr = map.get(e.module_id!);
    if (arr) arr.push(e);
    else map.set(e.module_id!, [e]);
  }

  // For events without module_id, use fallback strategies
  const eventsWithoutModuleId = events.filter((e) => e.module_id === null);
  if (eventsWithoutModuleId.length === 0) return map;

  // Index: exam_id → module_id via grades
  const examToModuleViaGrades = new Map<string, string>();
  for (const g of grades) {
    if (g.exam_id && g.module_id) {
      examToModuleViaGrades.set(g.exam_id, g.module_id);
    }
  }

  // Index: exam_id → module_id via topics
  const examToModuleViaTopics = new Map<string, string>();
  for (const t of topics) {
    if (t.exam_id && t.module_id) {
      examToModuleViaTopics.set(t.exam_id, t.module_id);
    }
  }

  // Module name patterns for title matching
  const modulePatterns = modules.map((m) => ({
    id: m.id,
    patterns: [
      m.name.toLowerCase(),
      ...(m.code ? [m.code.toLowerCase()] : []),
      ...(m.module_code ? [m.module_code.toLowerCase()] : []),
    ],
  }));

  for (const event of eventsWithoutModuleId) {
    let moduleId: string | null = null;

    // Strategy 1: Grade links
    moduleId = examToModuleViaGrades.get(event.id) ?? null;

    // Strategy 2: Topic links
    if (!moduleId) {
      moduleId = examToModuleViaTopics.get(event.id) ?? null;
    }

    // Strategy 3: Title matching
    if (!moduleId) {
      const title = event.title.toLowerCase();
      for (const mp of modulePatterns) {
        if (mp.patterns.some((p) => title.includes(p) || p.includes(title))) {
          moduleId = mp.id;
          break;
        }
      }
    }

    // Strategy 4: Date matching
    if (!moduleId) {
      const eventDate = event.start_dt.split("T")[0];
      for (const m of modules) {
        if (m.exam_date) {
          const modDate = m.exam_date.split("T")[0];
          if (modDate === eventDate) {
            moduleId = m.id;
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
