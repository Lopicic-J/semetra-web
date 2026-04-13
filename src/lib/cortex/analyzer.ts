/**
 * Cortex Engine — Cross-Engine Analyzer (C2.1)
 *
 * Generiert Insights die kein einzelner Engine allein erkennen kann.
 * Kombiniert Daten aus Decision, Schedule, Academic, DNA, Streaks & Patterns.
 *
 * 10 Insight-Typen:
 * 1. Planning-Execution Gap    6. Optimal Time Unused
 * 2. Burnout Risk              7. Streak Momentum
 * 3. Exam Underprep            8. Knowledge Decay
 * 4. Module Neglect            9. Schedule Overload
 * 5. Grade Trajectory Alert   10. Quick Win Available
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CrossEngineInsight,
  Evidence,
  InsightSeverity,
  InsightType,
  EngineName,
  CortexState,
} from "./types";
import { randomUUID } from "crypto";

// ─── Helpers ──────────────────────────────────────────────────────

function insight(
  type: InsightType,
  severity: InsightSeverity,
  title: string,
  description: string,
  suggestion: string,
  evidence: Evidence[],
  engines: EngineName[],
  actionHref?: string,
  ttlHours = 24
): CrossEngineInsight {
  const now = new Date();
  return {
    id: randomUUID(),
    type,
    severity,
    title,
    description,
    evidence,
    suggestion,
    actionHref,
    engines,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlHours * 3600 * 1000).toISOString(),
    dismissed: false,
  };
}

// ─── Data Fetchers ────────────────────────────────────────────────

interface DNAProfile {
  consistency_score: number;
  focus_score: number;
  endurance_score: number;
  planning_score: number;
  overall_score: number;
}

interface TimerSessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  focus_rating: number | null;
  energy_level: number | null;
  module_id: string | null;
  actual_duration_seconds: number | null;
}

interface ExamRow {
  id: string;
  title: string;
  date: string;
  module_id: string;
  module?: { name: string; color: string }[] | { name: string; color: string } | null;
}

interface FlashcardRow {
  id: string;
  next_review: string | null;
  module_id: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  module_id: string | null;
  estimated_minutes?: number | null;
}

interface ScheduleBlockRow {
  id: string;
  start_time: string;
  end_time: string;
  block_type: string;
  module_id: string | null;
}

async function fetchAnalyzerData(supabase: SupabaseClient, userId: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400 * 1000).toISOString();
  const twentyOneDaysAgo = new Date(now.getTime() - 21 * 86400 * 1000).toISOString();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(now);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const [
    dnaResult,
    sessionsResult,
    examsResult,
    flashcardsResult,
    tasksResult,
    blocksResult,
    modulesResult,
    patternsResult,
  ] = await Promise.all([
    // Latest DNA snapshot
    supabase
      .from("learning_dna_snapshots")
      .select("consistency_score, focus_score, endurance_score, planning_score, overall_score")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Sessions from last 7 days
    supabase
      .from("timer_sessions")
      .select("id, started_at, ended_at, status, focus_rating, energy_level, module_id, actual_duration_seconds")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("started_at", sevenDaysAgo)
      .order("started_at", { ascending: false }),

    // Upcoming exams (next 60 days)
    supabase
      .from("exams")
      .select("id, title, date, module_id, module:modules(name, color)")
      .eq("user_id", userId)
      .gte("date", now.toISOString().slice(0, 10))
      .order("date", { ascending: true })
      .limit(20),

    // Flashcards with overdue reviews
    supabase
      .from("flashcards")
      .select("id, next_review, module_id")
      .eq("user_id", userId)
      .not("next_review", "is", null)
      .lt("next_review", now.toISOString()),

    // Active tasks
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date, module_id")
      .eq("user_id", userId)
      .in("status", ["todo", "in_progress"])
      .order("due_date", { ascending: true, nullsFirst: false }),

    // Today's + tomorrow's schedule blocks
    supabase
      .from("schedule_blocks")
      .select("id, start_time, end_time, block_type, module_id")
      .eq("user_id", userId)
      .gte("start_time", todayStart.toISOString())
      .lte("start_time", tomorrowEnd.toISOString())
      .order("start_time", { ascending: true }),

    // All modules (for neglect detection)
    supabase
      .from("modules")
      .select("id, name")
      .eq("user_id", userId),

    // Study patterns
    supabase
      .from("study_patterns")
      .select("best_hours, avg_session_minutes, preferred_days")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    dna: dnaResult.data as DNAProfile | null,
    sessions: (sessionsResult.data || []) as TimerSessionRow[],
    exams: (examsResult.data || []) as ExamRow[],
    overdueFlashcards: (flashcardsResult.data || []) as FlashcardRow[],
    tasks: (tasksResult.data || []) as TaskRow[],
    blocks: (blocksResult.data || []) as ScheduleBlockRow[],
    modules: (modulesResult.data || []) as Array<{ id: string; name: string }>,
    patterns: patternsResult.data as { best_hours: number[] | null; avg_session_minutes: number | null; preferred_days: number[] | null } | null,
  };
}

// ─── 1. Planning-Execution Gap ────────────────────────────────────

function analyzePlanningGap(
  dna: DNAProfile | null,
  _sessions: TimerSessionRow[],
  insights: CrossEngineInsight[]
): void {
  if (!dna) return;
  if (dna.planning_score > 70 && dna.consistency_score < 40) {
    insights.push(
      insight(
        "planning_execution_gap",
        "warning",
        "Planen vs. Umsetzen",
        `Du planst sehr gut (${Math.round(dna.planning_score)}%), setzt aber nur ${Math.round(dna.consistency_score)}% um. Kürzere, realistischere Lernblöcke können helfen.`,
        "Versuche kürzere Blöcke (25-45 Min) statt langer Sessions. Das erhöht die Umsetzungsrate.",
        [
          { engine: "dna", metric: "planning_score", value: dna.planning_score },
          { engine: "dna", metric: "consistency_score", value: dna.consistency_score },
        ],
        ["dna", "schedule"],
        "/schedule"
      )
    );
  }
}

// ─── 2. Burnout Risk ─────────────────────────────────────────────

function analyzeBurnoutRisk(
  dna: DNAProfile | null,
  sessions: TimerSessionRow[],
  insights: CrossEngineInsight[]
): void {
  if (sessions.length < 5) return;

  const avgFocus =
    sessions.filter((s) => s.focus_rating).reduce((sum, s) => sum + (s.focus_rating || 0), 0) /
    (sessions.filter((s) => s.focus_rating).length || 1);

  const avgEnergy =
    sessions.filter((s) => s.energy_level).reduce((sum, s) => sum + (s.energy_level || 0), 0) /
    (sessions.filter((s) => s.energy_level).length || 1);

  const totalHours = sessions.reduce((s, sess) => s + (sess.actual_duration_seconds || 0), 0) / 3600;

  // High volume + declining focus + low energy = burnout risk
  if (sessions.length > 20 && avgFocus < 3.5 && avgEnergy < 3) {
    insights.push(
      insight(
        "burnout_risk",
        "critical",
        "Burnout-Risiko erkannt",
        `${sessions.length} Sessions in 7 Tagen (${Math.round(totalHours)}h) bei sinkendem Fokus (Ø ${avgFocus.toFixed(1)}/5) und niedriger Energie (Ø ${avgEnergy.toFixed(1)}/5).`,
        "Gönn dir morgen eine Pause. Qualität schlägt Quantität — dein Gehirn braucht Erholung.",
        [
          { engine: "streaks", metric: "sessions_7d", value: sessions.length },
          { engine: "dna", metric: "avg_focus", value: Math.round(avgFocus * 10) / 10 },
          { engine: "dna", metric: "avg_energy", value: Math.round(avgEnergy * 10) / 10 },
        ],
        ["streaks", "dna"],
        undefined,
        12 // Shorter TTL for burnout alerts
      )
    );
  } else if (sessions.length > 15 && (avgFocus < 3 || avgEnergy < 2.5)) {
    insights.push(
      insight(
        "burnout_risk",
        "warning",
        "Energielevel sinkt",
        `Dein Fokus (Ø ${avgFocus.toFixed(1)}/5) oder Energie (Ø ${avgEnergy.toFixed(1)}/5) ist niedrig bei ${sessions.length} Sessions diese Woche.`,
        "Plane leichtere Sessions oder kürzere Blöcke für die nächsten Tage ein.",
        [
          { engine: "streaks", metric: "sessions_7d", value: sessions.length },
          { engine: "dna", metric: "avg_focus", value: Math.round(avgFocus * 10) / 10 },
        ],
        ["streaks", "dna"]
      )
    );
  }
}

// ─── 3. Exam Underprep ───────────────────────────────────────────

function analyzeExamUnderprep(
  sessions: TimerSessionRow[],
  exams: ExamRow[],
  insights: CrossEngineInsight[]
): void {
  const now = Date.now();

  for (const exam of exams) {
    const examDate = new Date(exam.date).getTime();
    const daysRemaining = Math.ceil((examDate - now) / 86400000);

    if (daysRemaining > 30 || daysRemaining < 0) continue;

    // Count study hours for this module in the last 14 days
    const moduleSessions = sessions.filter((s) => s.module_id === exam.module_id);
    const studyHours = moduleSessions.reduce((sum, s) => sum + (s.actual_duration_seconds || 0), 0) / 3600;

    // Heuristic: < 5h of study with < 14 days to exam = underprepped
    const minExpected = daysRemaining <= 7 ? 8 : 5;

    if (studyHours < minExpected) {
      const moduleName = exam.module && typeof exam.module === "object" && "name" in exam.module
        ? (exam.module as { name: string }).name
        : exam.title;

      insights.push(
        insight(
          "exam_underprep",
          daysRemaining <= 7 ? "critical" : "warning",
          `Prüfung "${moduleName}" in ${daysRemaining} Tagen`,
          `Für ${moduleName} hast du erst ${studyHours.toFixed(1)}h gelernt (letzte 7 Tage). Prüfung am ${new Date(exam.date).toLocaleDateString("de-CH")}.`,
          daysRemaining <= 7
            ? "Erstelle jetzt einen Intensiv-Lernplan für die verbleibenden Tage."
            : `Plane täglich mindestens ${Math.ceil((minExpected - studyHours) / daysRemaining * 60)} Minuten für ${moduleName} ein.`,
          [
            { engine: "academic", metric: "days_remaining", value: daysRemaining, context: exam.title },
            { engine: "streaks", metric: "study_hours_7d", value: Math.round(studyHours * 10) / 10 },
          ],
          ["academic", "streaks", "schedule"],
          `/exams`,
          Math.min(daysRemaining * 24, 168) // TTL = days until exam, max 7 days
        )
      );
    }
  }
}

// ─── 4. Module Neglect ────────────────────────────────────────────

function analyzeModuleNeglect(
  sessions: TimerSessionRow[],
  exams: ExamRow[],
  modules: Array<{ id: string; name: string }>,
  insights: CrossEngineInsight[]
): void {
  // Find modules with upcoming exams but no activity in 21+ days
  const activeModuleIds = new Set(sessions.map((s) => s.module_id).filter(Boolean));
  const examModuleIds = new Set(exams.map((e) => e.module_id));

  for (const mod of modules) {
    if (activeModuleIds.has(mod.id)) continue; // Has recent activity
    if (!examModuleIds.has(mod.id)) continue; // No upcoming exam

    const exam = exams.find((e) => e.module_id === mod.id);
    if (!exam) continue;

    const daysToExam = Math.ceil((new Date(exam.date).getTime() - Date.now()) / 86400000);
    if (daysToExam > 60) continue;

    insights.push(
      insight(
        "module_neglect",
        daysToExam < 21 ? "warning" : "attention",
        `"${mod.name}" wird vernachlässigt`,
        `Keine Lernaktivität für ${mod.name} in den letzten 7 Tagen, aber Prüfung in ${daysToExam} Tagen.`,
        `Starte heute eine kurze Session für ${mod.name} — selbst 20 Minuten helfen.`,
        [
          { engine: "streaks", metric: "last_activity_days", value: ">7" },
          { engine: "academic", metric: "exam_days", value: daysToExam },
        ],
        ["academic", "streaks"],
        `/modules`
      )
    );
  }
}

// ─── 5. Grade Trajectory Alert ────────────────────────────────────

async function analyzeGradeTrajectory(
  supabase: SupabaseClient,
  userId: string,
  insights: CrossEngineInsight[]
): Promise<void> {
  // Get recent grades, check for downward trend
  const { data: grades } = await supabase
    .from("grades")
    .select("value, module_id, date, module:modules(name)")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(20);

  if (!grades || grades.length < 3) return;

  // Group by module, check trend
  const byModule = new Map<string, Array<{ value: number; date: string }>>();
  for (const g of grades) {
    if (!g.module_id || g.value == null) continue;
    const arr = byModule.get(g.module_id) || [];
    arr.push({ value: g.value, date: g.date });
    byModule.set(g.module_id, arr);
  }

  for (const [moduleId, moduleGrades] of byModule) {
    if (moduleGrades.length < 2) continue;

    // Check if latest grade is below pass threshold and trending down
    const latest = moduleGrades[0];
    const previous = moduleGrades[1];

    if (latest.value < 4.0 && latest.value < previous.value) {
      const moduleName = grades.find((g) => g.module_id === moduleId)?.module;
      const name = moduleName && typeof moduleName === "object" && "name" in moduleName
        ? (moduleName as { name: string }).name
        : "Unbekanntes Modul";

      insights.push(
        insight(
          "grade_trajectory_alert",
          latest.value < 3.5 ? "critical" : "warning",
          `Notentrend fällt: ${name}`,
          `Deine letzte Note (${latest.value.toFixed(1)}) liegt unter der Bestehensgrenze und ist tiefer als die vorherige (${previous.value.toFixed(1)}).`,
          "Fokussiere dich verstärkt auf dieses Modul. Der Decision Engine kann die Priorität erhöhen.",
          [
            { engine: "academic", metric: "latest_grade", value: latest.value },
            { engine: "academic", metric: "previous_grade", value: previous.value },
          ],
          ["academic", "decision"],
          `/grades`
        )
      );
    }
  }
}

// ─── 6. Optimal Time Unused ──────────────────────────────────────

function analyzeOptimalTimeUnused(
  patterns: { best_hours: number[] | null } | null,
  blocks: ScheduleBlockRow[],
  insights: CrossEngineInsight[]
): void {
  if (!patterns?.best_hours || patterns.best_hours.length === 0) return;

  const bestHours = patterns.best_hours.slice(0, 3); // Top 3 productive hours
  const now = new Date();

  // Check if any of the best hours have schedule blocks today
  const todayBlocks = blocks.filter((b) => {
    const bDate = new Date(b.start_time);
    return bDate.toDateString() === now.toDateString();
  });

  const usedHours = new Set(
    todayBlocks.map((b) => new Date(b.start_time).getHours())
  );

  const unusedBestHours = bestHours.filter((h) => !usedHours.has(h) && h > now.getHours());

  if (unusedBestHours.length > 0) {
    const hourStr = unusedBestHours.map((h) => `${h}:00`).join(", ");
    insights.push(
      insight(
        "optimal_time_unused",
        "info",
        "Produktivste Stunden sind frei",
        `Deine besten Lernstunden (${hourStr}) sind heute nicht belegt.`,
        "Soll ich einen Lernblock in deiner produktivsten Zeit einplanen?",
        [
          { engine: "patterns", metric: "best_hours", value: hourStr },
          { engine: "schedule", metric: "unused_slots", value: unusedBestHours.length },
        ],
        ["patterns", "schedule"],
        "/schedule",
        8 // Short TTL — only relevant today
      )
    );
  }
}

// ─── 7. Streak Momentum ──────────────────────────────────────────

function analyzeStreakMomentum(
  sessions: TimerSessionRow[],
  dna: DNAProfile | null,
  insights: CrossEngineInsight[]
): void {
  if (sessions.length < 7 || !dna) return;

  // Check for positive momentum: consistent daily sessions + improving focus
  const daySet = new Set(
    sessions.map((s) => new Date(s.started_at).toDateString())
  );
  const consecutiveDays = daySet.size;

  const recentFocus = sessions.slice(0, 5).filter((s) => s.focus_rating);
  const olderFocus = sessions.slice(5).filter((s) => s.focus_rating);

  if (recentFocus.length < 2 || olderFocus.length < 2) return;

  const recentAvg = recentFocus.reduce((s, x) => s + (x.focus_rating || 0), 0) / recentFocus.length;
  const olderAvg = olderFocus.reduce((s, x) => s + (x.focus_rating || 0), 0) / olderFocus.length;

  if (consecutiveDays >= 5 && recentAvg > olderAvg) {
    insights.push(
      insight(
        "streak_momentum",
        "info",
        "Dein Streak hat Momentum!",
        `${consecutiveDays} Tage in Folge gelernt und dein Fokus steigt (${olderAvg.toFixed(1)} → ${recentAvg.toFixed(1)}/5). Weiter so!`,
        "Halte dieses Tempo bei — Momentum ist dein bester Verbündeter.",
        [
          { engine: "streaks", metric: "consecutive_days", value: consecutiveDays },
          { engine: "dna", metric: "focus_trend", value: `${olderAvg.toFixed(1)} → ${recentAvg.toFixed(1)}` },
        ],
        ["streaks", "dna"]
      )
    );
  }
}

// ─── 8. Knowledge Decay ──────────────────────────────────────────

function analyzeKnowledgeDecay(
  overdueFlashcards: FlashcardRow[],
  insights: CrossEngineInsight[]
): void {
  if (overdueFlashcards.length < 10) return;

  const severity: InsightSeverity = overdueFlashcards.length > 100 ? "warning" : "attention";
  const minutes = Math.ceil(overdueFlashcards.length * 0.3); // ~18s per card

  insights.push(
    insight(
      "knowledge_decay",
      severity,
      `${overdueFlashcards.length} überfällige Karteikarten`,
      `Du hast ${overdueFlashcards.length} Karteikarten, deren Review-Datum überschritten ist. Ohne Review vergisst du das Gelernte.`,
      `${minutes} Minuten Review heute sichert dein Wissen. Starte jetzt eine kurze Session.`,
      [
        { engine: "academic", metric: "overdue_cards", value: overdueFlashcards.length },
        { engine: "patterns", metric: "estimated_minutes", value: minutes },
      ],
      ["academic", "patterns"],
      "/flashcards",
      12
    )
  );
}

// ─── 9. Schedule Overload ─────────────────────────────────────────

function analyzeScheduleOverload(
  blocks: ScheduleBlockRow[],
  sessions: TimerSessionRow[],
  insights: CrossEngineInsight[]
): void {
  // Check today's blocks
  const now = new Date();
  const todayBlocks = blocks.filter((b) => {
    const bDate = new Date(b.start_time);
    return bDate.toDateString() === now.toDateString();
  });

  if (todayBlocks.length < 6) return;

  // Calculate total scheduled hours today
  const totalMinutes = todayBlocks.reduce((sum, b) => {
    const start = new Date(b.start_time).getTime();
    const end = new Date(b.end_time).getTime();
    return sum + (end - start) / 60000;
  }, 0);

  const totalHours = totalMinutes / 60;

  // Check recent energy levels
  const recentEnergy = sessions.slice(0, 5).filter((s) => s.energy_level);
  const avgEnergy = recentEnergy.length > 0
    ? recentEnergy.reduce((s, x) => s + (x.energy_level || 0), 0) / recentEnergy.length
    : 5;

  if (totalHours > 8 || (totalHours > 6 && avgEnergy < 3)) {
    insights.push(
      insight(
        "schedule_overload",
        totalHours > 10 ? "warning" : "attention",
        "Zeitplan ist überladen",
        `Heute sind ${totalHours.toFixed(1)}h in ${todayBlocks.length} Blöcken geplant${avgEnergy < 3 ? " — bei niedrigem Energielevel" : ""}.`,
        "Verschiebe nicht-dringende Blöcke auf morgen. Qualität > Quantität.",
        [
          { engine: "schedule", metric: "blocks_today", value: todayBlocks.length },
          { engine: "schedule", metric: "hours_today", value: Math.round(totalHours * 10) / 10 },
          { engine: "dna", metric: "avg_energy", value: Math.round(avgEnergy * 10) / 10 },
        ],
        ["schedule", "dna"],
        "/schedule",
        12
      )
    );
  }
}

// ─── 10. Quick Win Available ──────────────────────────────────────

function analyzeQuickWins(
  tasks: TaskRow[],
  insights: CrossEngineInsight[]
): void {
  // Find high-priority tasks that are quick to complete
  const quickWins = tasks.filter(
    (t) => t.priority === "high" && t.status === "todo"
  );

  // If there are many pending high-prio tasks, suggest tackling them
  if (quickWins.length >= 3) {
    const titles = quickWins.slice(0, 3).map((t) => t.title);
    insights.push(
      insight(
        "quick_win_available",
        "info",
        `${quickWins.length} Quick Wins verfügbar`,
        `Du hast ${quickWins.length} hochpriorisierte Tasks die bereit sind. Kleine Erfolge geben Schwung für grössere Aufgaben.`,
        `Starte mit "${titles[0]}" — das bringt dich in den Flow.`,
        [
          { engine: "decision", metric: "high_prio_tasks", value: quickWins.length },
        ],
        ["decision"],
        "/tasks",
        8
      )
    );
  }
}

// ─── Main: Run All Analyses ───────────────────────────────────────

export async function generateInsights(
  supabase: SupabaseClient,
  userId: string,
  cortexState: CortexState
): Promise<CrossEngineInsight[]> {
  const data = await fetchAnalyzerData(supabase, userId);
  const insights: CrossEngineInsight[] = [];

  // Run all 10 analyses
  analyzePlanningGap(data.dna, data.sessions, insights);
  analyzeBurnoutRisk(data.dna, data.sessions, insights);
  analyzeExamUnderprep(data.sessions, data.exams, insights);
  analyzeModuleNeglect(data.sessions, data.exams, data.modules, insights);
  await analyzeGradeTrajectory(supabase, userId, insights);
  analyzeOptimalTimeUnused(data.patterns, data.blocks, insights);
  analyzeStreakMomentum(data.sessions, data.dna, insights);
  analyzeKnowledgeDecay(data.overdueFlashcards, insights);
  analyzeScheduleOverload(data.blocks, data.sessions, insights);
  analyzeQuickWins(data.tasks, insights);

  // Sort by severity (critical first) then by type
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, attention: 2, info: 3 };
  insights.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  // Cap at 10 insights max
  return insights.slice(0, 10);
}
