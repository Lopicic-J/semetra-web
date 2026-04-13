/**
 * /api/briefing/weekly — Personalized Weekly Briefing
 *
 * GET: Generate this week's briefing with:
 *      - Study time summary (vs last week, vs target)
 *      - Module health snapshot
 *      - Upcoming exams & deadlines
 *      - Streak status
 *      - DNA-influenced tips
 *      - Personalized motivational message with real numbers
 *
 * POST: Mark briefing as read
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── Types ────────────────────────────────────────────────────────────────────

interface BriefingSection {
  id: string;
  title: string;
  icon: string;
  content: string;
  detail?: string;
  sentiment: "positive" | "neutral" | "warning" | "critical";
  action?: { label: string; href: string };
}

interface WeeklyBriefing {
  weekLabel: string; // "KW 16 — 14.–20. Apr 2026"
  sections: BriefingSection[];
  headline: string;
  overallSentiment: "great" | "good" | "okay" | "needs_attention";
  generatedAt: string;
}

interface TimeLogRow {
  duration_seconds: number;
  started_at: string;
}

interface ExamRow {
  id: string;
  title: string;
  date: string;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
}

interface ModuleRow {
  id: string;
  name: string;
  status: string;
}

interface DnaRow {
  consistency_score: number;
  focus_score: number;
  planning_score: number;
  overall_score: number;
  learner_type: string;
}

// ── GET: Generate briefing ───────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const weekStart = getMonday(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const weekLabel = `KW ${getWeekNumber(now)} — ${formatDateShort(weekStart)}–${formatDateShort(weekEnd)}`;

  // Fetch all data in parallel
  const [thisWeekRes, lastWeekRes, examsRes, tasksRes, modulesRes, dnaRes, streakRes] =
    await Promise.all([
      // This week's study time
      supabase
        .from("time_logs")
        .select("duration_seconds, started_at")
        .eq("user_id", user.id)
        .gte("started_at", weekStart.toISOString())
        .eq("status", "completed"),
      // Last week's study time
      supabase
        .from("time_logs")
        .select("duration_seconds")
        .eq("user_id", user.id)
        .gte("started_at", prevWeekStart.toISOString())
        .lt("started_at", weekStart.toISOString())
        .eq("status", "completed"),
      // Upcoming exams (next 14 days)
      supabase
        .from("exams")
        .select("id, title, date")
        .eq("user_id", user.id)
        .gte("date", now.toISOString().slice(0, 10))
        .lte("date", new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10))
        .order("date", { ascending: true }),
      // Tasks due this week
      supabase
        .from("tasks")
        .select("id, title, status, due_date")
        .eq("user_id", user.id)
        .gte("due_date", weekStart.toISOString().slice(0, 10))
        .lte("due_date", weekEnd.toISOString().slice(0, 10)),
      // Active modules
      supabase
        .from("modules")
        .select("id, name, status")
        .eq("user_id", user.id)
        .eq("status", "active"),
      // DNA
      supabase
        .from("learning_dna_snapshots")
        .select("consistency_score, focus_score, planning_score, overall_score, learner_type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Streak (sessions in last 30 days to calculate)
      supabase
        .from("time_logs")
        .select("started_at")
        .eq("user_id", user.id)
        .gte("started_at", new Date(now.getTime() - 30 * 86400000).toISOString())
        .eq("status", "completed")
        .gte("duration_seconds", 900), // 15 min minimum
    ]);

  const thisWeekLogs = (thisWeekRes.data ?? []) as TimeLogRow[];
  const lastWeekLogs = (lastWeekRes.data ?? []) as { duration_seconds: number }[];
  const exams = (examsRes.data ?? []) as ExamRow[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const modules = (modulesRes.data ?? []) as ModuleRow[];
  const dna = dnaRes.data as DnaRow | null;
  const streakLogs = (streakRes.data ?? []) as { started_at: string }[];

  // ── Compute Metrics ──────────────────────────────────────────────────────

  const thisWeekMins = Math.round(
    thisWeekLogs.reduce((s, l) => s + l.duration_seconds, 0) / 60
  );
  const lastWeekMins = Math.round(
    lastWeekLogs.reduce((s, l) => s + l.duration_seconds, 0) / 60
  );
  const weekChange = lastWeekMins > 0
    ? Math.round(((thisWeekMins - lastWeekMins) / lastWeekMins) * 100)
    : 0;

  // Study days this week
  const studyDays = new Set(thisWeekLogs.map((l) => l.started_at.slice(0, 10)));

  // Tasks
  const completedTasks = tasks.filter((t) => t.status === "done");
  const overdueTasks = tasks.filter(
    (t) => t.status !== "done" && t.due_date && new Date(t.due_date) < now
  );

  // Streak
  const streakDays = new Set(streakLogs.map((l) => l.started_at.slice(0, 10)));
  const currentStreak = calculateStreak(streakDays, now);

  // ── Build Sections ───────────────────────────────────────────────────────

  const sections: BriefingSection[] = [];

  // 1. Study time
  const timeChangeStr = weekChange > 0 ? `+${weekChange}%` : weekChange < 0 ? `${weekChange}%` : "gleich";
  sections.push({
    id: "study-time",
    title: "Lernzeit",
    icon: "Clock",
    content: `${formatHours(thisWeekMins)} diese Woche (${timeChangeStr} vs. letzte Woche)`,
    detail: `${studyDays.size} von 7 Tagen aktiv. Letzte Woche: ${formatHours(lastWeekMins)}.`,
    sentiment: thisWeekMins >= 120 ? "positive" : thisWeekMins >= 60 ? "neutral" : "warning",
    action: { label: "Timer starten", href: "/timer" },
  });

  // 2. Exams
  if (exams.length > 0) {
    const examList = exams
      .slice(0, 3)
      .map((e) => {
        const days = Math.ceil((new Date(e.date).getTime() - now.getTime()) / 86400000);
        return `${e.title} (${days}d)`;
      })
      .join(", ");

    sections.push({
      id: "exams",
      title: "Prüfungen",
      icon: "AlertTriangle",
      content: `${exams.length} Prüfung${exams.length > 1 ? "en" : ""} in den nächsten 2 Wochen`,
      detail: examList,
      sentiment: exams.some((e) => {
        const d = Math.ceil((new Date(e.date).getTime() - now.getTime()) / 86400000);
        return d <= 3;
      }) ? "critical" : "warning",
      action: { label: "Prüfungs-Dashboard", href: "/exam-intelligence" },
    });
  } else {
    sections.push({
      id: "exams",
      title: "Prüfungen",
      icon: "CheckCircle",
      content: "Keine Prüfungen in den nächsten 2 Wochen",
      sentiment: "positive",
    });
  }

  // 3. Tasks
  const taskTotal = tasks.length;
  const taskDone = completedTasks.length;
  sections.push({
    id: "tasks",
    title: "Aufgaben",
    icon: "ClipboardList",
    content: `${taskDone}/${taskTotal} Aufgaben erledigt${overdueTasks.length > 0 ? `, ${overdueTasks.length} überfällig` : ""}`,
    sentiment: overdueTasks.length > 0 ? "warning" : taskDone === taskTotal && taskTotal > 0 ? "positive" : "neutral",
    action: overdueTasks.length > 0 ? { label: "Aufgaben anzeigen", href: "/tasks" } : undefined,
  });

  // 4. Streak
  sections.push({
    id: "streak",
    title: "Lernserie",
    icon: "Flame",
    content: currentStreak > 0
      ? `${currentStreak} Tage am Stück — weiter so!`
      : "Starte heute eine neue Lernserie",
    sentiment: currentStreak >= 7 ? "positive" : currentStreak >= 3 ? "neutral" : "warning",
    action: currentStreak === 0 ? { label: "Jetzt starten", href: "/timer" } : undefined,
  });

  // 5. Modules
  sections.push({
    id: "modules",
    title: "Module",
    icon: "BookOpen",
    content: `${modules.length} aktive Module`,
    sentiment: "neutral",
    action: { label: "Module verwalten", href: "/modules" },
  });

  // 6. DNA tip
  if (dna) {
    let tip = "";
    let tipSentiment: BriefingSection["sentiment"] = "neutral";

    if (dna.consistency_score < 40) {
      tip = `Dein Konsistenz-Score ist ${Math.round(dna.consistency_score)}%. Versuche diese Woche jeden Tag mindestens 20 Minuten zu lernen.`;
      tipSentiment = "warning";
    } else if (dna.focus_score > 70 && thisWeekMins < 120) {
      tip = `Starker Fokus (${Math.round(dna.focus_score)}%)! Du könntest mehr rausholen, wenn du deine Lernzeit erhöhst.`;
      tipSentiment = "neutral";
    } else if (dna.planning_score < 40) {
      tip = "Nutze den Smart Schedule, um deine Woche besser zu strukturieren.";
      tipSentiment = "warning";
    } else if (dna.overall_score > 70) {
      tip = `Dein DNA-Score liegt bei ${Math.round(dna.overall_score)}% — du bist auf einem sehr guten Weg!`;
      tipSentiment = "positive";
    } else {
      tip = `Dein Lerntyp: ${dna.learner_type}. Dein DNA-Score: ${Math.round(dna.overall_score)}%.`;
    }

    sections.push({
      id: "dna-tip",
      title: "Lern-DNA Tipp",
      icon: "Brain",
      content: tip,
      sentiment: tipSentiment,
      action: { label: "Lern-DNA anzeigen", href: "/lern-dna" },
    });
  }

  // ── Headline & Overall Sentiment ──────────────────────────────────────────

  let overallSentiment: WeeklyBriefing["overallSentiment"] = "okay";
  const positiveCount = sections.filter((s) => s.sentiment === "positive").length;
  const warningCount = sections.filter((s) => s.sentiment === "warning" || s.sentiment === "critical").length;

  if (positiveCount >= 3 && warningCount === 0) overallSentiment = "great";
  else if (positiveCount >= 2) overallSentiment = "good";
  else if (warningCount >= 3) overallSentiment = "needs_attention";

  const headlines: Record<string, string> = {
    great: `Starke Woche! ${formatHours(thisWeekMins)} gelernt und ${currentStreak} Tage Serie.`,
    good: `Gute Woche — ${formatHours(thisWeekMins)} gelernt. Weiter so!`,
    okay: `${formatHours(thisWeekMins)} gelernt diese Woche. Da geht noch mehr!`,
    needs_attention: `Diese Woche braucht Aufmerksamkeit: ${warningCount} Bereiche im gelben Bereich.`,
  };

  const briefing: WeeklyBriefing = {
    weekLabel,
    sections,
    headline: headlines[overallSentiment],
    overallSentiment,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json({ briefing });
}

// ── POST: Mark as read ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weekNumber } = await req.json();

  // Store in notifications as read
  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "weekly_briefing",
    priority: "normal",
    title: `Wochen-Briefing KW ${weekNumber ?? getWeekNumber(new Date())} gelesen`,
    message: "Automatisch markiert",
    read_at: new Date().toISOString(),
    dedupe_key: `weekly-briefing-${weekNumber ?? getWeekNumber(new Date())}`,
  });

  return NextResponse.json({ ok: true });
}

// ── Utility Functions ────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("de-CH", { day: "numeric", month: "short" });
}

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function calculateStreak(studyDays: Set<string>, now: Date): number {
  let streak = 0;
  const check = new Date(now);
  check.setHours(0, 0, 0, 0);

  // Check if today is done, otherwise start from yesterday
  const todayStr = check.toISOString().slice(0, 10);
  if (!studyDays.has(todayStr)) {
    check.setDate(check.getDate() - 1);
  }

  while (studyDays.has(check.toISOString().slice(0, 10))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }

  return streak;
}
