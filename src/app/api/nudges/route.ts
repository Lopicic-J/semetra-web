/**
 * /api/nudges — Personalized Daily Nudges
 *
 * GET: Generate contextual nudges for the current user based on:
 *      - DNA profile (consistency, focus, planning scores)
 *      - Today's schedule adherence
 *      - Upcoming exams
 *      - Streak status
 *      - Overdue tasks
 *      - Study time today vs target
 *
 * Returns 1-3 prioritized nudges. Fire once per session.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── Types ────────────────────────────────────────────────────────────────────

interface Nudge {
  id: string;
  type: NudgeType;
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
  action?: {
    label: string;
    href: string;
  };
  icon: string; // Lucide icon name
}

type NudgeType =
  | "streak_at_risk"
  | "streak_milestone"
  | "exam_countdown"
  | "overdue_tasks"
  | "study_target"
  | "consistency_boost"
  | "focus_tip"
  | "planning_reminder"
  | "great_progress"
  | "come_back"
  | "weekly_review";

interface DnaRow {
  consistency_score: number;
  focus_score: number;
  planning_score: number;
  overall_score: number;
  learner_type: string;
}

interface ExamRow {
  id: string;
  title: string;
  date: string;
  module_id: string;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // Fetch everything in parallel
  const [dnaRes, examsRes, tasksRes, todaySessionsRes, streakRes, weeklyReviewRes] =
    await Promise.all([
      // Latest DNA
      supabase
        .from("learning_dna_snapshots")
        .select("consistency_score, focus_score, planning_score, overall_score, learner_type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Upcoming exams (next 14 days)
      supabase
        .from("exams")
        .select("id, title, date, module_id")
        .eq("user_id", user.id)
        .gte("date", todayStr)
        .lte("date", new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10))
        .order("date", { ascending: true })
        .limit(5),
      // Overdue tasks
      supabase
        .from("tasks")
        .select("id, title, due_date")
        .eq("user_id", user.id)
        .neq("status", "done")
        .lt("due_date", todayStr)
        .limit(10),
      // Today's study sessions
      supabase
        .from("time_logs")
        .select("duration_seconds")
        .eq("user_id", user.id)
        .gte("started_at", `${todayStr}T00:00:00`)
        .eq("status", "completed"),
      // Study streak (sessions in last 3 days)
      supabase
        .from("time_logs")
        .select("started_at")
        .eq("user_id", user.id)
        .gte("started_at", threeDaysAgo.toISOString())
        .eq("status", "completed"),
      // Latest weekly review
      supabase
        .from("weekly_reviews")
        .select("id, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const dna = dnaRes.data as DnaRow | null;
  const exams = (examsRes.data ?? []) as ExamRow[];
  const overdueTasks = tasksRes.data ?? [];
  const todaySessions = todaySessionsRes.data ?? [];
  const recentSessions = streakRes.data ?? [];
  const latestReview = weeklyReviewRes.data as { id: string; is_read: boolean; created_at: string } | null;

  // Calculate today's study minutes
  const todayMinutes = todaySessions.reduce(
    (sum: number, s: { duration_seconds: number }) => sum + s.duration_seconds / 60,
    0
  );

  // Check streak: unique study days in last 3 days
  const recentDays = new Set(
    (recentSessions as { started_at: string }[]).map((s) => s.started_at.slice(0, 10))
  );
  const hasStudiedToday = recentDays.has(todayStr);
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const studiedYesterday = recentDays.has(yesterdayStr);

  // ── Generate Nudges ──────────────────────────────────────────────────────

  const nudges: Nudge[] = [];

  // 1. Streak at risk
  if (!hasStudiedToday && studiedYesterday && now.getHours() >= 16) {
    nudges.push({
      id: "streak-risk",
      type: "streak_at_risk",
      priority: "high",
      title: "Deine Serie ist in Gefahr!",
      message: "Du hast heute noch nicht gelernt. Eine kurze 15-Minuten-Session reicht, um deine Serie zu halten.",
      action: { label: "Timer starten", href: "/timer" },
      icon: "Flame",
    });
  }

  // 2. Exam countdown
  if (exams.length > 0) {
    const nextExam = exams[0];
    const daysUntil = Math.ceil(
      (new Date(nextExam.date).getTime() - now.getTime()) / 86400000
    );

    if (daysUntil <= 3) {
      nudges.push({
        id: `exam-${nextExam.id}`,
        type: "exam_countdown",
        priority: "high",
        title: `Prüfung in ${daysUntil} Tag${daysUntil !== 1 ? "en" : ""}!`,
        message: `"${nextExam.title}" steht bevor. Fokussiere dich auf die wichtigsten Themen.`,
        action: { label: "Prüfung anzeigen", href: "/exam-intelligence" },
        icon: "AlertTriangle",
      });
    } else if (daysUntil <= 7) {
      nudges.push({
        id: `exam-week-${nextExam.id}`,
        type: "exam_countdown",
        priority: "medium",
        title: `Prüfung nächste Woche`,
        message: `"${nextExam.title}" in ${daysUntil} Tagen. Erstelle einen Lernplan, falls noch nicht geschehen.`,
        action: { label: "Lernplan öffnen", href: "/lernplan" },
        icon: "Clock",
      });
    }
  }

  // 3. Overdue tasks
  if (overdueTasks.length > 0) {
    nudges.push({
      id: "overdue-tasks",
      type: "overdue_tasks",
      priority: "high",
      title: `${overdueTasks.length} überfällige Aufgabe${overdueTasks.length > 1 ? "n" : ""}`,
      message: "Erledige deine ausstehenden Aufgaben, bevor sie sich weiter anstauen.",
      action: { label: "Aufgaben anzeigen", href: "/tasks" },
      icon: "CheckCircle",
    });
  }

  // 4. Study target nudge
  if (hasStudiedToday && todayMinutes < 30) {
    nudges.push({
      id: "study-more",
      type: "study_target",
      priority: "low",
      title: "Noch ein bisschen mehr?",
      message: `Du hast heute ${Math.round(todayMinutes)} Minuten gelernt. Noch eine Session würde deinen Tag abrunden.`,
      action: { label: "Weiterlernen", href: "/timer" },
      icon: "Target",
    });
  }

  // 5. DNA-based nudges
  if (dna) {
    if (dna.consistency_score < 40 && !hasStudiedToday) {
      nudges.push({
        id: "consistency-boost",
        type: "consistency_boost",
        priority: "medium",
        title: "Konsistenz aufbauen",
        message: "Regelmässigkeit ist der Schlüssel. Auch 20 Minuten heute machen einen Unterschied für deine Lern-DNA.",
        action: { label: "Quick-Session", href: "/timer" },
        icon: "CalendarCheck",
      });
    }

    if (dna.focus_score >= 70 && todayMinutes > 0) {
      nudges.push({
        id: "focus-tip",
        type: "great_progress",
        priority: "low",
        title: "Starker Fokus!",
        message: `Dein Fokus-Score ist ${Math.round(dna.focus_score)}% — nutze das für eine Deep-Work-Session.`,
        icon: "Zap",
      });
    }

    if (dna.planning_score < 35) {
      nudges.push({
        id: "planning-reminder",
        type: "planning_reminder",
        priority: "medium",
        title: "Plane deinen Tag",
        message: "Dein Planungs-Score ist niedrig. Nutze den Smart Schedule, um deinen Tag zu strukturieren.",
        action: { label: "Schedule öffnen", href: "/schedule" },
        icon: "Calendar",
      });
    }
  }

  // 6. Come back nudge (no study in 3 days)
  if (recentDays.size === 0) {
    nudges.push({
      id: "come-back",
      type: "come_back",
      priority: "high",
      title: "Willkommen zurück!",
      message: "Du hast eine Pause gemacht — das ist okay. Starte heute mit einer kurzen Session.",
      action: { label: "Jetzt starten", href: "/timer" },
      icon: "Heart",
    });
  }

  // 7. Weekly review reminder (if unread)
  if (latestReview && !latestReview.is_read) {
    const reviewAge = Date.now() - new Date(latestReview.created_at).getTime();
    if (reviewAge < 7 * 86400000) {
      nudges.push({
        id: "weekly-review",
        type: "weekly_review",
        priority: "low",
        title: "Wochenrückblick verfügbar",
        message: "Dein Wochenrückblick wartet. Reflektiere über deine letzte Woche.",
        action: { label: "Rückblick lesen", href: "/weekly-review" },
        icon: "BarChart3",
      });
    }
  }

  // Sort by priority and limit to 3
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  nudges.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const topNudges = nudges.slice(0, 3);

  return NextResponse.json({
    nudges: topNudges,
    meta: {
      todayMinutes: Math.round(todayMinutes),
      hasStudiedToday,
      streakDays: recentDays.size,
      upcomingExams: exams.length,
      overdueTasks: overdueTasks.length,
    },
  });
}
