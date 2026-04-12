/**
 * Semetra Daily Nudge Engine
 *
 * Generates personalized daily nudges with REAL numbers from the user's data:
 * - "Dein Fokusmodul heute: Statistik (Prüfung in 12 Tagen, du brauchst eine 4.8)"
 * - "Du hast heute 120min verfügbar. Empfohlen: 45min Statistik, 30min Mathe"
 * - "Deine beste Lernzeit ist 14-16 Uhr (Fokus: 4.2/5)"
 *
 * Uses: CommandCenterState, ModuleIntelligence[], StudyPatterns, StreakData
 */

import type {
  CommandCenterState,
  ModuleIntelligence,
  OutcomePrediction,
} from "./types";

// ─── Types ──────────────────────────────────────────────────────

export interface DailyNudge {
  id: string;
  sections: NudgeSection[];
  greeting: string;
  generatedAt: string;
}

export interface NudgeSection {
  type: "focus_module" | "time_budget" | "best_time" | "streak" | "exam_countdown" | "quick_win" | "encouragement";
  title: string;
  message: string;
  icon: string;
  data: Record<string, unknown>;
}

export interface NudgeContext {
  state: CommandCenterState;
  modules: ModuleIntelligence[];
  patterns?: {
    bestHours?: Array<{ hour: number; score: number; avgFocus: number }>;
    currentStreakDays?: number;
    longestStreakDays?: number;
    avgSessionMinutes?: number;
    consistencyScore?: number;
    energyCurve?: { morning: number; afternoon: number; evening: number };
  };
  streakData?: {
    currentStreak: number;
    longestStreak: number;
    todayDone: boolean;
  };
  now?: Date;
}

// ─── Greeting Generator ────────────────────────────────────────

function generateGreeting(hour: number, streakDays: number, todayDone: boolean): string {
  const timeGreeting =
    hour < 10 ? "Guten Morgen" :
    hour < 14 ? "Hallo" :
    hour < 18 ? "Guten Nachmittag" : "Guten Abend";

  if (todayDone) {
    return `${timeGreeting}! Du hast heute schon gelernt — hier dein Update.`;
  }
  if (streakDays >= 14) {
    return `${timeGreeting}! ${streakDays}-Tage-Streak — beeindruckend. Hier ist dein Tagesplan.`;
  }
  if (streakDays >= 3) {
    return `${timeGreeting}! ${streakDays} Tage in Folge — weiter so. Dein Tagesplan:`;
  }
  return `${timeGreeting}! Hier ist dein personalisierter Tagesplan.`;
}

// ─── Core Builder ──────────────────────────────────────────────

export function buildDailyNudge(ctx: NudgeContext): DailyNudge {
  const now = ctx.now || new Date();
  const hour = now.getHours();
  const sections: NudgeSection[] = [];

  const streak = ctx.streakData?.currentStreak ?? ctx.state.overview.studyStreak ?? 0;
  const todayDone = ctx.streakData?.todayDone ?? false;

  // ── 1. Focus Module ──
  const focusModule = ctx.state.today.focusModule;
  if (focusModule) {
    const mod = ctx.modules.find((m) => m.moduleId === focusModule.id);
    const prediction = ctx.state.predictions.get?.(focusModule.id) ??
      (ctx.state.predictions as unknown as Record<string, OutcomePrediction>)[focusModule.id];

    let detail = focusModule.reason;
    if (mod?.exams.daysUntilNext != null && mod.exams.daysUntilNext <= 30) {
      detail = `Prüfung in ${mod.exams.daysUntilNext} Tagen`;
      if (mod.grades.needed != null) {
        detail += `, du brauchst eine ${mod.grades.needed.toFixed(1)}`;
      }
    }
    if (prediction && prediction.gapToTarget != null && prediction.gapToTarget !== 0) {
      const gap = Math.abs(prediction.gapToTarget).toFixed(1);
      detail += prediction.gapToTarget > 0
        ? ` (${gap} über Ziel)`
        : ` (${gap} unter Ziel — mehr investieren)`;
    }

    sections.push({
      type: "focus_module",
      title: `Fokusmodul: ${focusModule.name}`,
      message: detail,
      icon: "🎯",
      data: {
        moduleId: focusModule.id,
        moduleName: focusModule.name,
        moduleColor: focusModule.color,
        daysUntilExam: mod?.exams.daysUntilNext,
        neededGrade: mod?.grades.needed,
      },
    });
  }

  // ── 2. Time Budget ──
  const totalMinutes = ctx.state.today.totalMinutes;
  if (totalMinutes > 0) {
    const topActions = ctx.state.today.actions
      .filter((a) => a.estimatedMinutes > 0)
      .slice(0, 3);

    const breakdown = topActions
      .map((a) => `${a.estimatedMinutes}min ${a.moduleName || a.type}`)
      .join(", ");

    sections.push({
      type: "time_budget",
      title: `Heute: ${totalMinutes}min geplant`,
      message: breakdown
        ? `Empfohlen: ${breakdown}`
        : `${totalMinutes} Minuten aufgeteilt auf deine aktiven Module.`,
      icon: "⏱️",
      data: {
        totalMinutes,
        actions: topActions.map((a) => ({
          module: a.moduleName,
          minutes: a.estimatedMinutes,
          type: a.type,
        })),
      },
    });
  }

  // ── 3. Best Study Time ──
  if (ctx.patterns?.bestHours && ctx.patterns.bestHours.length > 0 && !todayDone) {
    const best = ctx.patterns.bestHours[0];
    const bestEnd = (best.hour + 2) % 24;
    const focusStr = best.avgFocus?.toFixed(1) || "?";

    // Only show if best time is still upcoming
    if (best.hour >= hour) {
      sections.push({
        type: "best_time",
        title: `Beste Lernzeit: ${best.hour}:00–${bestEnd}:00 Uhr`,
        message: `Dein Durchschnittsfokus um diese Zeit: ${focusStr}/5. Nutze dieses Fenster!`,
        icon: "⚡",
        data: {
          bestHour: best.hour,
          avgFocus: best.avgFocus,
          score: best.score,
        },
      });
    }
  }

  // ── 4. Exam Countdown ──
  const upcomingExams = ctx.modules
    .filter((m) => m.exams.daysUntilNext != null && m.exams.daysUntilNext <= 14 && m.exams.daysUntilNext > 0)
    .sort((a, b) => (a.exams.daysUntilNext ?? 99) - (b.exams.daysUntilNext ?? 99))
    .slice(0, 2);

  if (upcomingExams.length > 0) {
    const examList = upcomingExams
      .map((m) => `${m.moduleName} in ${m.exams.daysUntilNext} Tagen`)
      .join(", ");

    sections.push({
      type: "exam_countdown",
      title: `Prüfungen bald`,
      message: examList,
      icon: "📝",
      data: {
        exams: upcomingExams.map((m) => ({
          moduleId: m.moduleId,
          moduleName: m.moduleName,
          daysUntil: m.exams.daysUntilNext,
          examTitle: m.exams.next?.title,
        })),
      },
    });
  }

  // ── 5. Quick Win ──
  const quickWin = ctx.state.today.actions.find(
    (a) => a.estimatedMinutes <= 15 && a.estimatedMinutes > 0
  );
  if (quickWin && !todayDone) {
    sections.push({
      type: "quick_win",
      title: `Quick Win (${quickWin.estimatedMinutes}min)`,
      message: quickWin.title + (quickWin.moduleName ? ` — ${quickWin.moduleName}` : ""),
      icon: "🚀",
      data: {
        actionType: quickWin.type,
        minutes: quickWin.estimatedMinutes,
        moduleName: quickWin.moduleName,
      },
    });
  }

  // ── 6. Streak ──
  if (streak > 0 && !todayDone) {
    const longestStreak = ctx.streakData?.longestStreak ?? streak;
    const isNearRecord = streak >= longestStreak - 1 && streak < longestStreak;

    sections.push({
      type: "streak",
      title: `${streak}-Tage-Streak`,
      message: isNearRecord
        ? `Noch ${longestStreak - streak} Tag(e) bis zu deinem Rekord (${longestStreak} Tage)!`
        : `Halte deinen Streak aufrecht — 15 Minuten reichen.`,
      icon: "🔥",
      data: { currentStreak: streak, longestStreak, isNearRecord },
    });
  }

  // ── 7. Encouragement (if struggling) ──
  const atRisk = ctx.state.overview.atRiskModules;
  const consistency = ctx.patterns?.consistencyScore ?? 1;
  if (atRisk >= 2 || consistency < 0.3) {
    sections.push({
      type: "encouragement",
      title: "Schritt für Schritt",
      message: atRisk >= 2
        ? `${atRisk} Module brauchen Aufmerksamkeit. Starte mit dem wichtigsten — kleine Fortschritte zählen.`
        : "Regelmässigkeit schlägt Intensität. Starte heute mit einer kurzen Einheit.",
      icon: "💪",
      data: { atRiskModules: atRisk, consistency },
    });
  }

  return {
    id: `nudge-${now.toISOString().split("T")[0]}`,
    sections,
    greeting: generateGreeting(hour, streak, todayDone),
    generatedAt: now.toISOString(),
  };
}

// ─── Flatten to Notification ───────────────────────────────────

export function nudgeToNotification(nudge: DailyNudge): {
  type: "daily_nudge";
  priority: "normal";
  title: string;
  message: string;
  dedupe_key: string;
  action_href: string;
  metadata: Record<string, unknown>;
} {
  const topSections = nudge.sections.slice(0, 3);
  const message = topSections
    .map((s) => `${s.icon} ${s.title}: ${s.message}`)
    .join("\n");

  return {
    type: "daily_nudge",
    priority: "normal",
    title: nudge.greeting,
    message: message || "Schau in dein Dashboard für heute.",
    dedupe_key: nudge.id,
    action_href: "/dashboard",
    metadata: {
      sections: nudge.sections.length,
      types: nudge.sections.map((s) => s.type),
    },
  };
}
