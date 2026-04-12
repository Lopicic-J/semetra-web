/**
 * /api/nudge — Daily Nudge API
 *
 * GET  → Generate today's personalized nudge (from Decision Engine + Patterns)
 * POST → Persist nudge as notification + log
 */

import { NextRequest } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  errorResponse,
  successResponse,
  parseBody,
  withErrorHandler,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { buildCommandCenterState } from "@/lib/decision/engine";
import { buildDailyNudge, nudgeToNotification } from "@/lib/decision/daily-nudge";
import type { ModuleIntelligence, TrendDirection, ExamSnapshot } from "@/lib/decision/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const log = logger("api:nudge");

export async function GET(_req: NextRequest) {
  return withErrorHandler("api:nudge", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    // Check if nudge already generated today
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("daily_nudge_log")
      .select("nudge_data")
      .eq("user_id", user.id)
      .eq("nudge_date", today)
      .single();

    if (existing) {
      return successResponse({ nudge: existing.nudge_data, cached: true });
    }

    // Build intelligence (server-side)
    const intelligence = await buildModuleIntelligenceServer(supabase, user.id);
    const state = buildCommandCenterState(intelligence);

    // Get patterns (if available)
    const { data: patternData } = await supabase
      .from("study_patterns")
      .select("patterns")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Get streak data
    const { data: timeLogs } = await supabase
      .from("time_logs")
      .select("started_at, duration_seconds")
      .eq("user_id", user.id)
      .gte("started_at", new Date(Date.now() - 90 * 86400000).toISOString())
      .order("started_at", { ascending: false });

    const streakData = computeStreakFromLogs(timeLogs || []);

    // Build nudge
    const nudge = buildDailyNudge({
      state,
      modules: intelligence,
      patterns: patternData?.patterns || undefined,
      streakData,
    });

    return successResponse({ nudge, cached: false });
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandler("api:nudge", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<{ nudge: Record<string, unknown> }>(req);
    if (isErrorResponse(body)) return body;

    if (!body.nudge) return errorResponse("nudge required", 400);

    const today = new Date().toISOString().split("T")[0];

    // Log nudge
    await supabase.from("daily_nudge_log").upsert({
      user_id: user.id,
      nudge_date: today,
      nudge_data: body.nudge,
    }, { onConflict: "user_id,nudge_date" });

    // Persist as notification
    const notification = nudgeToNotification(body.nudge as unknown as ReturnType<typeof buildDailyNudge>);
    await supabase.from("notifications").upsert({
      user_id: user.id,
      ...notification,
    }, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });

    return successResponse({ ok: true });
  });
}

// ─── Server-side Module Intelligence (simplified) ──────────────

interface RawRow { [key: string]: unknown }

async function buildModuleIntelligenceServer(
  supabase: SupabaseClient,
  userId: string
): Promise<ModuleIntelligence[]> {
  const [modulesRes, gradesRes, tasksRes, timeLogsRes, eventsRes] = await Promise.all([
    supabase.from("modules").select("*").eq("user_id", userId),
    supabase.from("grades").select("*").eq("user_id", userId),
    supabase.from("tasks").select("*").eq("user_id", userId),
    supabase.from("time_logs").select("*").eq("user_id", userId)
      .gte("started_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("events").select("*").eq("user_id", userId)
      .gte("date", new Date().toISOString().split("T")[0]),
  ]);

  const modules = (modulesRes.data || []) as RawRow[];
  const grades = (gradesRes.data || []) as RawRow[];
  const tasks = (tasksRes.data || []) as RawRow[];
  const timeLogs = (timeLogsRes.data || []) as RawRow[];
  const events = (eventsRes.data || []) as RawRow[];

  const gradesByMod = groupBy(grades, "module_id");
  const tasksByMod = groupBy(tasks, "module_id");
  const timeByMod = groupBy(timeLogs, "module_id");
  const eventsByMod = groupBy(events, "module_id");

  return modules
    .filter((m) => m.status === "active" || m.status === "planned")
    .map((m): ModuleIntelligence => {
      const mid = m.id as string;
      const modGrades = gradesByMod[mid] || [];
      const modTasks = tasksByMod[mid] || [];
      const modTime = timeByMod[mid] || [];
      const modEvents = eventsByMod[mid] || [];

      const avgGrade = modGrades.length > 0
        ? modGrades.reduce((s, g) => s + ((g.value as number) || 0), 0) / modGrades.length
        : null;

      const now = Date.now();
      const dayMs = 86400000;
      const last7 = modTime
        .filter((t) => new Date(t.started_at as string).getTime() > now - 7 * dayMs)
        .reduce((s, t) => s + (((t.duration_seconds as number) || 0) / 60), 0);
      const last30 = modTime.reduce((s, t) => s + (((t.duration_seconds as number) || 0) / 60), 0);
      const totalMin = last30; // simplified

      const lastStudy = modTime[0]?.started_at
        ? Math.floor((now - new Date(modTime[0].started_at as string).getTime()) / dayMs)
        : null;

      const nextExam = modEvents
        .filter((e) => (e.type as string) === "exam" || (e.event_type as string) === "exam")
        .sort((a, b) => new Date(a.date as string || a.start_dt as string).getTime() - new Date(b.date as string || b.start_dt as string).getTime())[0] || null;

      const examDate = nextExam ? (nextExam.date as string || nextExam.start_dt as string) : null;
      const daysUntilExam = examDate
        ? Math.ceil((new Date(examDate).getTime() - now) / dayMs)
        : null;

      const examSnapshot: ExamSnapshot | null = nextExam ? {
        id: nextExam.id as string,
        title: (nextExam.title as string) || (m.name as string) || "",
        date: examDate || "",
        daysUntil: daysUntilExam || 0,
        moduleId: mid,
        hasGrade: false,
      } : null;

      const overdueTasks = modTasks.filter((t) =>
        t.status !== "done" && t.due_date && new Date(t.due_date as string).getTime() < now
      ).length;

      return {
        moduleId: mid,
        moduleName: (m.name as string) || "",
        moduleCode: m.code as string | undefined,
        ects: (m.ects as number) || 0,
        semester: m.semester as number | undefined,
        status: m.status as "active" | "planned" | "completed" | "paused",
        color: m.color as string | undefined,
        grades: {
          current: avgGrade,
          target: (m.target_grade as number) || null,
          needed: null,
          passed: avgGrade ? avgGrade >= 4.0 : null,
          trend: "unknown" as TrendDirection,
          componentResults: [],
        },
        exams: {
          next: examSnapshot,
          daysUntilNext: daysUntilExam,
          all: [],
          totalCount: modEvents.filter((e) =>
            (e.type as string) === "exam" || (e.event_type as string) === "exam"
          ).length,
          completedCount: 0,
        },
        tasks: {
          total: modTasks.length,
          completed: modTasks.filter((t) => t.status === "done").length,
          overdue: overdueTasks,
          dueSoon: modTasks.filter((t) => {
            if (t.status === "done" || !t.due_date) return false;
            const d = new Date(t.due_date as string).getTime();
            return d > now && d < now + 3 * dayMs;
          }).length,
          completionRate: modTasks.length > 0
            ? Math.round((modTasks.filter((t) => t.status === "done").length / modTasks.length) * 100)
            : 0,
          nextDeadline: null,
        },
        studyTime: {
          totalMinutes: Math.round(totalMin),
          last7Days: Math.round(last7),
          last30Days: Math.round(last30),
          averagePerWeek: Math.round(last30 / 4),
          trend: "unknown" as TrendDirection,
          lastStudied: modTime[0]?.started_at as string | null ?? null,
          daysSinceLastStudy: lastStudy,
        },
        knowledge: {
          topicCount: 0,
          averageLevel: 0,
          weakTopics: [],
          reviewDue: 0,
          flashcardsDue: 0,
          totalFlashcards: 0,
        },
        resources: { noteCount: 0, documentCount: 0, mindmapCount: 0, flashcardDecks: 0 },
      };
    });
}

function groupBy(arr: RawRow[], key: string): Record<string, RawRow[]> {
  const map: Record<string, RawRow[]> = {};
  for (const item of arr) {
    const k = item[key] as string;
    if (!k) continue;
    (map[k] ??= []).push(item);
  }
  return map;
}

function computeStreakFromLogs(
  logs: Array<{ started_at: string; duration_seconds: number }>
): { currentStreak: number; longestStreak: number; todayDone: boolean } {
  const MIN_SECONDS = 900;
  const daySet = new Set<string>();

  for (const l of logs) {
    if (l.duration_seconds >= MIN_SECONDS) {
      daySet.add(new Date(l.started_at).toISOString().split("T")[0]);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const todayDone = daySet.has(today);

  let current = 0;
  let longest = 0;
  let streak = 0;
  const d = new Date();
  if (!todayDone) d.setDate(d.getDate() - 1);

  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().split("T")[0];
    if (daySet.has(key)) {
      streak++;
      if (i < 100) current = streak;
      longest = Math.max(longest, streak);
    } else {
      if (current === 0 && streak > 0) current = streak;
      streak = 0;
    }
    d.setDate(d.getDate() - 1);
  }

  return { currentStreak: current, longestStreak: longest, todayDone };
}
