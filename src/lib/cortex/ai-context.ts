/**
 * Cortex Engine — AI Context Enrichment (C2.3)
 *
 * Erweitert den AI-Chat-Kontext mit Cortex-Intelligence:
 * - Gesamtgesundheit aller Engines
 * - Top-Insights mit Evidenz
 * - Aktive Empfehlungen
 * - Personalisierte Ratschläge basierend auf DNA + Patterns
 *
 * Wird in jeden AI-Chat injiziert für kontextbewusste Antworten.
 */

import type {
  CortexState,
  CrossEngineInsight,
  ProactiveAction,
  EngineName,
} from "./types";

// ─── Build Cortex Context Block ───────────────────────────────────

export function buildCortexContextBlock(
  state: CortexState,
  insights: CrossEngineInsight[],
  actions: ProactiveAction[],
  moduleId?: string
): string {
  const parts: string[] = [];

  // 1. Health Summary
  parts.push("=== CORTEX GESUNDHEIT ===");
  parts.push(`Gesamtstatus: ${translateHealth(state.overallHealth)}`);

  const engineLines: string[] = [];
  for (const [name, health] of Object.entries(state.engines)) {
    if (health.status !== "healthy") {
      engineLines.push(
        `  ${name}: ${health.status} (${formatAge(health.dataAgeSeconds)} alt)`
      );
    }
  }
  if (engineLines.length > 0) {
    parts.push("Engines mit Problemen:");
    parts.push(...engineLines);
  } else {
    parts.push("Alle Engines gesund.");
  }

  // 2. Integrity Issues
  if (state.integrity.issuesFound > 0) {
    parts.push("");
    parts.push(`=== INTEGRITÄT: ${state.integrity.issuesFound} Problem(e) ===`);
    for (const issue of state.integrity.issues.slice(0, 3)) {
      parts.push(
        `  [${issue.severity.toUpperCase()}] ${issue.message}${issue.repaired ? " (auto-repariert)" : ""}`
      );
    }
  }

  // 3. Top Insights
  const relevantInsights = moduleId
    ? insights.filter(
        (i) =>
          i.evidence.some((e) => e.context?.includes(moduleId)) ||
          i.severity === "critical"
      )
    : insights;

  const topInsights = relevantInsights.slice(0, 3);
  if (topInsights.length > 0) {
    parts.push("");
    parts.push("=== CORTEX INSIGHTS ===");
    for (const ins of topInsights) {
      parts.push(`[${ins.severity.toUpperCase()}] ${ins.title}`);
      parts.push(`  ${ins.description}`);
      parts.push(`  Empfehlung: ${ins.suggestion}`);
    }
  }

  // 4. Active Actions
  const topActions = actions.slice(0, 3);
  if (topActions.length > 0) {
    parts.push("");
    parts.push("=== EMPFOHLENE AKTIONEN ===");
    for (const act of topActions) {
      parts.push(`  [P${act.priority}] ${act.title}: ${act.description}`);
    }
  }

  // 5. Coaching Instructions
  parts.push("");
  parts.push("=== AI COACHING ANWEISUNG ===");
  parts.push(buildCoachingPrompt(state, insights));

  return parts.join("\n");
}

// ─── Coaching Prompt Builder ──────────────────────────────────────

function buildCoachingPrompt(
  state: CortexState,
  insights: CrossEngineInsight[]
): string {
  const prompts: string[] = [];

  // Overall health coaching
  if (state.overallHealth === "critical") {
    prompts.push(
      "WICHTIG: Der Student hat kritische Probleme. Sei proaktiv und weise auf die Probleme hin."
    );
  }

  // Insight-specific coaching
  const insightTypes = new Set(insights.map((i) => i.type));

  if (insightTypes.has("burnout_risk")) {
    prompts.push(
      "Der Student zeigt Burnout-Anzeichen. Empfehle Pausen und reduzierte Intensität. Sei einfühlsam."
    );
  }

  if (insightTypes.has("exam_underprep")) {
    prompts.push(
      "Prüfungen stehen an mit wenig Vorbereitung. Hilf beim Priorisieren und Erstellen eines realistischen Plans."
    );
  }

  if (insightTypes.has("streak_momentum")) {
    prompts.push(
      "Der Student hat positives Momentum. Ermutige und verstärke das positive Verhalten."
    );
  }

  if (insightTypes.has("knowledge_decay")) {
    prompts.push(
      "Viele Karteikarten sind überfällig. Integriere SR-Reviews in Empfehlungen."
    );
  }

  if (insightTypes.has("planning_execution_gap")) {
    prompts.push(
      "Es gibt eine Lücke zwischen Planung und Umsetzung. Empfehle kürzere, konkretere Aufgaben."
    );
  }

  if (prompts.length === 0) {
    prompts.push(
      "Der Student ist auf gutem Weg. Unterstütze bei konkreten Fragen und ermutige weiterhin."
    );
  }

  return prompts.join(" ");
}

// ─── Compact Summary (for Widget / Quick Checks) ─────────────────

export function buildCortexSummary(
  state: CortexState,
  insights: CrossEngineInsight[]
): string {
  const healthEmoji =
    state.overallHealth === "healthy"
      ? "Gesund"
      : state.overallHealth === "degraded"
        ? "Teilweise beeinträchtigt"
        : "Kritisch";

  const topInsight = insights[0];
  const insightLine = topInsight
    ? `Wichtigster Hinweis: ${topInsight.title}`
    : "Keine besonderen Hinweise.";

  return `Cortex: ${healthEmoji} | ${state.integrity.issuesFound} Issues | ${insightLine}`;
}

// ─── Utilities ────────────────────────────────────────────────────

function translateHealth(health: string): string {
  switch (health) {
    case "healthy": return "Gesund — alle Systeme laufen";
    case "degraded": return "Teilweise beeinträchtigt — einige Engines brauchen Aufmerksamkeit";
    case "critical": return "Kritisch — sofortige Aufmerksamkeit erforderlich";
    default: return health;
  }
}

function formatAge(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} Min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)} Tage`;
}
