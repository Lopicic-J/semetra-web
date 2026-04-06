/**
 * Semetra Smart Automations
 *
 * Event-driven triggers that fire when certain conditions are met.
 * These automations don't run on a schedule — they evaluate when
 * the Decision Engine state changes.
 *
 * Automation Types:
 *   - Notifications (toast messages)
 *   - Study Nudges (remind to study)
 *   - Smart Suggestions (create material, seek help)
 *   - Exam Warnings (countdown alerts)
 *   - Streak Motivation (celebrate consistency)
 */

import type {
  ModuleIntelligence,
  ModuleRisk,
  ModulePriority,
  CommandCenterState,
  DecisionEngineConfig,
} from "./types";
import { DEFAULT_ENGINE_CONFIG } from "./types";

// ─── Automation Types ────────────────────────────────────────

export type AutomationType =
  | "exam_warning"
  | "grade_alert"
  | "study_nudge"
  | "streak_celebration"
  | "task_reminder"
  | "knowledge_review"
  | "milestone_reached"
  | "risk_escalation";

export type AutomationPriority = "critical" | "high" | "normal" | "low";

export interface Automation {
  id: string;
  type: AutomationType;
  priority: AutomationPriority;
  title: string;
  message: string;
  moduleId?: string;
  moduleName?: string;
  moduleColor?: string;
  actionLabel?: string;
  actionHref?: string;
  dismissable: boolean;
  /** Unique key to prevent duplicate notifications */
  dedupeKey: string;
}

// ─── Automation Engine ───────────────────────────────────────

/**
 * Evaluates all automation triggers based on the current state.
 * Returns a list of automations that should fire.
 *
 * The caller is responsible for deduplication (comparing dedupeKeys
 * with previously shown automations).
 */
export function evaluateAutomations(
  state: CommandCenterState,
  modules: ModuleIntelligence[],
  config: DecisionEngineConfig = DEFAULT_ENGINE_CONFIG
): Automation[] {
  const automations: Automation[] = [];

  // ── Exam Warnings ──
  for (const mod of modules) {
    if (mod.status !== "active") continue;

    if (mod.exams.next && mod.exams.daysUntilNext !== null) {
      const days = mod.exams.daysUntilNext;

      if (days === 1) {
        automations.push({
          id: `exam-tomorrow-${mod.moduleId}`,
          type: "exam_warning",
          priority: "critical",
          title: "Prüfung morgen!",
          message: `${mod.exams.next.title} ist morgen. Letzte Chance zur Vorbereitung.`,
          moduleId: mod.moduleId,
          moduleName: mod.moduleName,
          moduleColor: mod.color,
          actionLabel: "Vorbereiten",
          actionHref: `/modules/${mod.moduleId}`,
          dismissable: false,
          dedupeKey: `exam-tomorrow-${mod.moduleId}-${mod.exams.next.date}`,
        });
      } else if (days === 3) {
        automations.push({
          id: `exam-3days-${mod.moduleId}`,
          type: "exam_warning",
          priority: "high",
          title: "Prüfung in 3 Tagen",
          message: `${mod.exams.next.title} — fokussierte Vorbereitung empfohlen.`,
          moduleId: mod.moduleId,
          moduleName: mod.moduleName,
          moduleColor: mod.color,
          actionLabel: "Lernplan",
          actionHref: `/lernplan`,
          dismissable: true,
          dedupeKey: `exam-3days-${mod.moduleId}-${mod.exams.next.date}`,
        });
      } else if (days === 7) {
        automations.push({
          id: `exam-1week-${mod.moduleId}`,
          type: "exam_warning",
          priority: "normal",
          title: "Prüfung in einer Woche",
          message: `${mod.exams.next.title} — guter Zeitpunkt zum Starten.`,
          moduleId: mod.moduleId,
          moduleName: mod.moduleName,
          moduleColor: mod.color,
          actionLabel: "Vorbereitung starten",
          actionHref: `/modules/${mod.moduleId}`,
          dismissable: true,
          dedupeKey: `exam-1week-${mod.moduleId}-${mod.exams.next.date}`,
        });
      }
    }
  }

  // ── Grade Alerts ──
  for (const risk of [...state.risks.critical, ...state.risks.high]) {
    const mod = modules.find((m) => m.moduleId === risk.moduleId);
    if (!mod) continue;

    const gradeFactors = risk.factors.filter(
      (f) => f.type === "grade_below_pass" || f.type === "grade_declining"
    );
    if (gradeFactors.length > 0) {
      automations.push({
        id: `grade-alert-${mod.moduleId}`,
        type: "grade_alert",
        priority: risk.overall === "critical" ? "critical" : "high",
        title: `Notenwarnung: ${mod.moduleName}`,
        message: gradeFactors[0].message,
        moduleId: mod.moduleId,
        moduleName: mod.moduleName,
        moduleColor: mod.color,
        actionLabel: "Details anzeigen",
        actionHref: `/modules/${mod.moduleId}`,
        dismissable: true,
        dedupeKey: `grade-alert-${mod.moduleId}-${mod.grades.current}`,
      });
    }
  }

  // ── Study Nudges (inactivity) ──
  for (const mod of modules) {
    if (mod.status !== "active") continue;
    if (
      mod.studyTime.daysSinceLastStudy !== null &&
      mod.studyTime.daysSinceLastStudy >= config.thresholds.noActivityDays * 2 &&
      mod.exams.next !== null
    ) {
      automations.push({
        id: `nudge-${mod.moduleId}`,
        type: "study_nudge",
        priority: "normal",
        title: `${mod.moduleName} wartet auf dich`,
        message: `${mod.studyTime.daysSinceLastStudy} Tage ohne Lernaktivität — kleine Einheit kann helfen.`,
        moduleId: mod.moduleId,
        moduleName: mod.moduleName,
        moduleColor: mod.color,
        actionLabel: "Lernen starten",
        actionHref: `/timer`,
        dismissable: true,
        dedupeKey: `nudge-${mod.moduleId}-${mod.studyTime.daysSinceLastStudy}`,
      });
    }
  }

  // ── Task Reminders ──
  const totalOverdue = state.overview.tasksOverdue;
  if (totalOverdue >= 5) {
    automations.push({
      id: "tasks-overdue-bulk",
      type: "task_reminder",
      priority: "high",
      title: `${totalOverdue} überfällige Aufgaben`,
      message: "Aufgabenstau aufbauen? Priorisiere die wichtigsten und arbeite sie ab.",
      actionLabel: "Aufgaben anzeigen",
      actionHref: "/tasks",
      dismissable: true,
      dedupeKey: `tasks-overdue-${totalOverdue}`,
    });
  }

  // ── Knowledge Review ──
  for (const mod of modules) {
    if (mod.status !== "active") continue;
    if (mod.knowledge.flashcardsDue >= 20) {
      automations.push({
        id: `review-fc-${mod.moduleId}`,
        type: "knowledge_review",
        priority: "normal",
        title: `${mod.knowledge.flashcardsDue} Karteikarten fällig`,
        message: `${mod.moduleName}: Spaced Repetition hält Wissen frisch.`,
        moduleId: mod.moduleId,
        moduleName: mod.moduleName,
        moduleColor: mod.color,
        actionLabel: "Wiederholen",
        actionHref: "/flashcards",
        dismissable: true,
        dedupeKey: `review-fc-${mod.moduleId}-${mod.knowledge.flashcardsDue}`,
      });
    }
  }

  // ── Streak Celebration ──
  if (state.overview.studyStreak > 0 && state.overview.studyStreak % 7 === 0) {
    automations.push({
      id: `streak-${state.overview.studyStreak}`,
      type: "streak_celebration",
      priority: "low",
      title: `${state.overview.studyStreak}-Tage-Streak!`,
      message: "Beeindruckende Konstanz — weiter so!",
      dismissable: true,
      dedupeKey: `streak-${state.overview.studyStreak}`,
    });
  }

  // ── Milestone Reached ──
  if (state.overview.ectsTarget > 0) {
    const percent = Math.round((state.overview.ectsEarned / state.overview.ectsTarget) * 100);
    if (percent === 25 || percent === 50 || percent === 75) {
      automations.push({
        id: `milestone-${percent}`,
        type: "milestone_reached",
        priority: "low",
        title: `${percent}% geschafft!`,
        message: `${state.overview.ectsEarned}/${state.overview.ectsTarget} ECTS — du bist auf gutem Weg.`,
        dismissable: true,
        dedupeKey: `milestone-${percent}-${state.overview.ectsEarned}`,
      });
    }
  }

  // Sort by priority
  const priorityOrder: Record<AutomationPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  return automations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * Filters automations that haven't been shown yet.
 * Pass in a Set of previously shown dedupeKeys.
 */
export function filterNewAutomations(
  automations: Automation[],
  shownKeys: Set<string>
): Automation[] {
  return automations.filter((a) => !shownKeys.has(a.dedupeKey));
}
