/**
 * Cortex Engine — Proactive Action Generator (C2.2)
 *
 * Verwandelt CrossEngineInsights in konkrete, ausführbare Aktionen.
 * Jede Aktion hat Priorität, optionalen API-Endpoint und Ablaufzeit.
 */

import type {
  CrossEngineInsight,
  ProactiveAction,
  ProactiveActionType,
  InsightType,
} from "./types";
import { randomUUID } from "crypto";

// ─── Mapping: Insight → Action(s) ─────────────────────────────────

interface ActionTemplate {
  type: ProactiveActionType;
  priorityBoost: number;        // Added to base priority
  title: (insight: CrossEngineInsight) => string;
  description: (insight: CrossEngineInsight) => string;
  autoExecutable: boolean;
  executeFn?: string;
  ttlHours: number;
}

const INSIGHT_ACTION_MAP: Partial<Record<InsightType, ActionTemplate[]>> = {
  planning_execution_gap: [
    {
      type: "adjust_study_target",
      priorityBoost: 10,
      title: () => "Lernblöcke verkürzen",
      description: () =>
        "Verkürze deine geplanten Lernblöcke auf 25-45 Min um die Umsetzungsrate zu erhöhen.",
      autoExecutable: false,
      ttlHours: 48,
    },
  ],

  burnout_risk: [
    {
      type: "suggest_break",
      priorityBoost: 30,
      title: () => "Pause einlegen",
      description: (i) =>
        `Dein Körper und Geist brauchen Erholung. ${i.severity === "critical" ? "Nimm dir morgen frei." : "Plane eine leichtere Woche."}`,
      autoExecutable: false,
      ttlHours: 24,
    },
    {
      type: "reschedule_block",
      priorityBoost: 20,
      title: () => "Intensive Blöcke verschieben",
      description: () =>
        "Verschiebe anspruchsvolle Lernblöcke auf nächste Woche.",
      autoExecutable: false,
      executeFn: "/api/schedule/reschedule",
      ttlHours: 24,
    },
  ],

  exam_underprep: [
    {
      type: "generate_exam_plan",
      priorityBoost: 40,
      title: (i) => `Lernplan für ${extractModuleName(i)}`,
      description: (i) =>
        `Erstelle einen strukturierten Lernplan für die verbleibende Zeit bis zur Prüfung.`,
      autoExecutable: false,
      executeFn: "/api/schedule",
      ttlHours: 168, // 7 days
    },
    {
      type: "create_study_block",
      priorityBoost: 35,
      title: (i) => `Lernblock für ${extractModuleName(i)} einplanen`,
      description: () =>
        "Plane heute noch einen Lernblock für dieses Modul ein.",
      autoExecutable: true,
      executeFn: "/api/schedule",
      ttlHours: 12,
    },
  ],

  module_neglect: [
    {
      type: "create_study_block",
      priorityBoost: 20,
      title: (i) => `${extractModuleName(i)}: Kurze Session starten`,
      description: () =>
        "Selbst 20 Minuten helfen — starte eine kurze Einstiegssession.",
      autoExecutable: true,
      executeFn: "/api/schedule",
      ttlHours: 24,
    },
    {
      type: "prioritize_module",
      priorityBoost: 15,
      title: (i) => `Priorität für ${extractModuleName(i)} erhöhen`,
      description: () =>
        "Erhöhe die Priorität dieses Moduls im Decision Engine.",
      autoExecutable: true,
      executeFn: "/api/decision",
      ttlHours: 48,
    },
  ],

  grade_trajectory_alert: [
    {
      type: "prioritize_module",
      priorityBoost: 35,
      title: () => "Modul-Priorität erhöhen",
      description: () =>
        "Der Decision Engine soll diesem Modul mehr Gewicht geben.",
      autoExecutable: true,
      executeFn: "/api/decision",
      ttlHours: 72,
    },
    {
      type: "generate_exam_plan",
      priorityBoost: 30,
      title: () => "Aufhol-Plan erstellen",
      description: () =>
        "Erstelle einen gezielten Plan um die Note zu verbessern.",
      autoExecutable: false,
      ttlHours: 168,
    },
  ],

  optimal_time_unused: [
    {
      type: "create_study_block",
      priorityBoost: 15,
      title: () => "Produktivste Zeit nutzen",
      description: (i) =>
        `Plane einen Lernblock in deinen besten Stunden ein.`,
      autoExecutable: true,
      executeFn: "/api/schedule",
      ttlHours: 8,
    },
  ],

  streak_momentum: [
    {
      type: "send_nudge",
      priorityBoost: 5,
      title: () => "Streak-Erfolg teilen",
      description: () =>
        "Positive Verstärkung: Dein Streak und Fokus wachsen!",
      autoExecutable: true,
      ttlHours: 24,
    },
  ],

  knowledge_decay: [
    {
      type: "trigger_flashcard_review",
      priorityBoost: 25,
      title: () => "Flashcard-Review starten",
      description: (i) =>
        `Starte jetzt ein Review deiner überfälligen Karteikarten.`,
      autoExecutable: false,
      executeFn: "/api/flashcards",
      ttlHours: 12,
    },
    {
      type: "create_study_block",
      priorityBoost: 20,
      title: () => "Review-Block einplanen",
      description: () =>
        "Plane einen festen Review-Block in deinen Zeitplan ein.",
      autoExecutable: true,
      executeFn: "/api/schedule",
      ttlHours: 24,
    },
  ],

  schedule_overload: [
    {
      type: "reschedule_block",
      priorityBoost: 25,
      title: () => "Blöcke verschieben",
      description: () =>
        "Verschiebe nicht-dringende Blöcke auf einen weniger vollen Tag.",
      autoExecutable: false,
      executeFn: "/api/schedule/reschedule",
      ttlHours: 12,
    },
    {
      type: "suggest_break",
      priorityBoost: 15,
      title: () => "Pausen einbauen",
      description: () =>
        "Baue bewusst Pausen zwischen den Blöcken ein.",
      autoExecutable: false,
      ttlHours: 12,
    },
  ],

  quick_win_available: [
    {
      type: "send_nudge",
      priorityBoost: 10,
      title: (i) => "Quick Win: Starte jetzt",
      description: (i) =>
        `Erledige eine hochpriorisierte Aufgabe für schnellen Fortschritt.`,
      autoExecutable: false,
      ttlHours: 8,
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────

function extractModuleName(insight: CrossEngineInsight): string {
  // Try to extract module name from title (often in quotes)
  const match = insight.title.match(/"([^"]+)"/);
  return match ? match[1] : "Modul";
}

function basePriority(severity: string): number {
  switch (severity) {
    case "critical": return 80;
    case "warning": return 60;
    case "attention": return 40;
    case "info": return 20;
    default: return 10;
  }
}

// ─── Main: Generate Actions from Insights ─────────────────────────

export function generateActions(
  insights: CrossEngineInsight[]
): ProactiveAction[] {
  const actions: ProactiveAction[] = [];

  for (const ins of insights) {
    const templates = INSIGHT_ACTION_MAP[ins.type];
    if (!templates) continue;

    for (const tmpl of templates) {
      const now = new Date();
      const priority = Math.min(100, basePriority(ins.severity) + tmpl.priorityBoost);

      actions.push({
        id: randomUUID(),
        type: tmpl.type,
        priority,
        title: tmpl.title(ins),
        description: tmpl.description(ins),
        autoExecutable: tmpl.autoExecutable,
        executeFn: tmpl.executeFn,
        payload: {
          insightType: ins.type,
          insightId: ins.id,
          engines: ins.engines,
        },
        expiresAt: new Date(now.getTime() + tmpl.ttlHours * 3600 * 1000).toISOString(),
        sourceInsight: ins.id,
      });
    }
  }

  // Sort by priority descending
  actions.sort((a, b) => b.priority - a.priority);

  // Cap at 15 actions max
  return actions.slice(0, 15);
}
