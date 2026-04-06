/**
 * Semetra Decision Engine — Core
 *
 * Das Gehirn von Semetra. Reine Berechnungsfunktionen ohne
 * Side Effects. Transformiert ModuleIntelligence-Daten in
 * priorisierte Entscheidungen und konkrete Handlungsempfehlungen.
 *
 * Architektur:
 *   Input  → ModuleIntelligence[] (aggregierte Rohdaten pro Modul)
 *   Output → CommandCenterState (Prioritäten, Risiken, Prognosen, Aktionen)
 *
 * Alle Funktionen sind pure: gleicher Input → gleicher Output.
 */

import type {
  ModuleIntelligence,
  ModuleRisk,
  RiskFactor,
  RiskFactorType,
  RiskLevel,
  ModulePriority,
  PriorityReason,
  OutcomePrediction,
  RequiredPerformance,
  Scenario,
  Action,
  ActionType,
  ActionUrgency,
  DailyPlan,
  Alert,
  CommandCenterState,
  AIDecisionContext,
  DecisionEngineConfig,
  ExamSnapshot,
  TrendDirection,
} from "./types";
import { DEFAULT_ENGINE_CONFIG } from "./types";

// ═══════════════════════════════════════════════════════════════
// 1. RISK ASSESSMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Bewertet das Risiko für ein einzelnes Modul.
 * Analysiert alle Risikofaktoren und berechnet einen Gesamtscore.
 */
export function assessModuleRisk(
  module: ModuleIntelligence,
  config: DecisionEngineConfig = DEFAULT_ENGINE_CONFIG
): ModuleRisk {
  const factors: RiskFactor[] = [];

  // ── Prüfung bald, kaum vorbereitet ──
  if (module.exams.next && module.exams.daysUntilNext !== null) {
    const days = module.exams.daysUntilNext;
    const studyMinutes = module.studyTime.last7Days;
    const hasEnoughPrep = studyMinutes >= config.estimates.minutesPerExamPrep * 0.5;

    if (days <= 7 && !hasEnoughPrep) {
      factors.push({
        type: "exam_soon_no_prep",
        severity: days <= 3 ? "critical" : "high",
        score: Math.min(100, Math.round((1 - days / 14) * 100)),
        message:
          days <= 3
            ? `Prüfung in ${days} Tagen — kaum Vorbereitung!`
            : `Prüfung in ${days} Tagen — mehr Vorbereitung nötig`,
        detail: `${studyMinutes} Minuten letzte 7 Tage, empfohlen: ${config.estimates.minutesPerExamPrep}`,
      });
    } else if (days <= config.thresholds.examSoonDays && !hasEnoughPrep) {
      factors.push({
        type: "exam_soon_no_prep",
        severity: "medium",
        score: Math.round((1 - days / config.thresholds.examSoonDays) * 60),
        message: `Prüfung in ${days} Tagen — Vorbereitung starten`,
        detail: `${studyMinutes} Minuten letzte 7 Tage`,
      });
    }
  }

  // ── Note unter Bestehensgrenze ──
  if (module.grades.current !== null && module.grades.passed === false) {
    const buffer = config.thresholds.criticalGradeBuffer;
    // Swiss system: 4.0 = pass, higher is better
    const distanceToPass = 4.0 - module.grades.current;
    const severity: RiskLevel =
      distanceToPass > 1.0 ? "critical" : distanceToPass > buffer ? "high" : "medium";
    factors.push({
      type: "grade_below_pass",
      severity,
      score: Math.min(100, Math.round(distanceToPass * 40 + 30)),
      message: `Aktuelle Note ${module.grades.current.toFixed(1)} — unter Bestehensgrenze`,
      detail: `Benötigt: 4.0, Differenz: ${distanceToPass.toFixed(1)}`,
    });
  }

  // ── Note wird schlechter ──
  if (module.grades.trend === "declining") {
    const currentGrade = module.grades.current;
    const severity: RiskLevel =
      currentGrade !== null && currentGrade < 4.5 ? "high" : "medium";
    factors.push({
      type: "grade_declining",
      severity,
      score: severity === "high" ? 65 : 40,
      message: "Notentrend ist negativ",
      detail: currentGrade !== null ? `Aktuelle Note: ${currentGrade.toFixed(1)}` : undefined,
    });
  }

  // ── Lange nicht gelernt ──
  if (module.studyTime.daysSinceLastStudy !== null) {
    const days = module.studyTime.daysSinceLastStudy;
    if (days > config.thresholds.noActivityDays) {
      const severity: RiskLevel =
        days > config.thresholds.noActivityDays * 3
          ? "high"
          : days > config.thresholds.noActivityDays * 2
            ? "medium"
            : "low";
      factors.push({
        type: "no_recent_activity",
        severity,
        score: Math.min(80, Math.round((days / 30) * 80)),
        message: `${days} Tage seit letzter Lernaktivität`,
        detail: `Schwelle: ${config.thresholds.noActivityDays} Tage`,
      });
    }
  } else if (module.status === "active" && module.studyTime.totalMinutes === 0) {
    // Aktives Modul, nie gelernt
    factors.push({
      type: "no_recent_activity",
      severity: "high",
      score: 70,
      message: "Noch keine Lernzeit erfasst",
      detail: "Modul ist aktiv, aber keine Lernaktivitäten vorhanden",
    });
  }

  // ── Aufgaben überfällig ──
  if (module.tasks.overdue > 0) {
    const severity: RiskLevel =
      module.tasks.overdue >= 5 ? "high" : module.tasks.overdue >= 3 ? "medium" : "low";
    factors.push({
      type: "tasks_overdue",
      severity,
      score: Math.min(70, module.tasks.overdue * 15),
      message: `${module.tasks.overdue} überfällige Aufgabe${module.tasks.overdue > 1 ? "n" : ""}`,
      detail: `${module.tasks.completed}/${module.tasks.total} erledigt (${module.tasks.completionRate}%)`,
    });
  }

  // ── Wissenslücken ──
  if (module.knowledge.weakTopics.length > 0) {
    const weakCount = module.knowledge.weakTopics.length;
    const totalTopics = module.knowledge.topicCount;
    const weakRatio = totalTopics > 0 ? weakCount / totalTopics : 0;
    const severity: RiskLevel =
      weakRatio > 0.5 ? "high" : weakRatio > 0.3 ? "medium" : "low";
    factors.push({
      type: "low_knowledge",
      severity,
      score: Math.min(75, Math.round(weakRatio * 100)),
      message: `${weakCount} Thema${weakCount > 1 ? "en" : ""} mit Wissenslücken`,
      detail: `Durchschnittliches Wissenslevel: ${module.knowledge.averageLevel}%`,
    });
  }

  // ── Zu wenig Lernzeit ──
  const weeklyTarget = config.thresholds.minStudyMinutesPerWeek;
  if (
    module.status === "active" &&
    module.studyTime.averagePerWeek < weeklyTarget * 0.5
  ) {
    const deficit = weeklyTarget - module.studyTime.averagePerWeek;
    const severity: RiskLevel =
      module.studyTime.averagePerWeek < weeklyTarget * 0.2 ? "high" : "medium";
    factors.push({
      type: "time_deficit",
      severity,
      score: Math.min(60, Math.round((deficit / weeklyTarget) * 60)),
      message: `Lernzeit deutlich unter Soll (${Math.round(module.studyTime.averagePerWeek)}/${weeklyTarget} Min/Woche)`,
      detail: `Defizit: ${Math.round(deficit)} Minuten pro Woche`,
    });
  }

  // ── Assessment-Komponenten fehlen ──
  const missingComponents = module.grades.componentResults.filter(
    (c) => c.grade === null
  );
  if (missingComponents.length > 0) {
    const totalWeight = missingComponents.reduce((sum, c) => sum + c.weight, 0);
    const severity: RiskLevel = totalWeight > 50 ? "high" : totalWeight > 25 ? "medium" : "low";
    factors.push({
      type: "missing_components",
      severity,
      score: Math.min(60, Math.round(totalWeight * 0.8)),
      message: `${missingComponents.length} Assessment-Komponente${missingComponents.length > 1 ? "n" : ""} noch offen`,
      detail: `Offenes Gewicht: ${totalWeight}%`,
    });
  }

  // ── Prüfung ohne Lernmaterial ──
  if (
    module.exams.next &&
    module.exams.daysUntilNext !== null &&
    module.exams.daysUntilNext <= config.thresholds.examSoonDays
  ) {
    const totalMaterial =
      module.resources.noteCount +
      module.resources.documentCount +
      module.resources.mindmapCount +
      module.resources.flashcardDecks;
    if (totalMaterial === 0) {
      factors.push({
        type: "exam_no_material",
        severity: "medium",
        score: 45,
        message: "Prüfung bald, aber kein Lernmaterial vorhanden",
        detail: `Prüfung in ${module.exams.daysUntilNext} Tagen`,
      });
    }
  }

  // ── Gesamtscore berechnen ──
  const overallScore =
    factors.length === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            factors.reduce((sum, f) => sum + f.score, 0) /
              Math.max(1, factors.length) *
              // Bonus für mehrere Risikofaktoren (kumulative Gefahr)
              (1 + Math.min(0.5, (factors.length - 1) * 0.1))
          )
        );

  const overallLevel = scoreToRiskLevel(overallScore);

  return {
    moduleId: module.moduleId,
    overall: overallLevel,
    score: overallScore,
    factors: factors.sort((a, b) => b.score - a.score),
  };
}

/**
 * Konvertiert einen numerischen Score (0-100) in ein RiskLevel.
 */
function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  if (score > 0) return "low";
  return "none";
}

// ═══════════════════════════════════════════════════════════════
// 2. PRIORITY SCORING
// ═══════════════════════════════════════════════════════════════

/**
 * Berechnet die Priorität eines Moduls anhand gewichteter Faktoren.
 * Höherer Score = dringender = zuerst bearbeiten.
 */
export function calculateModulePriority(
  module: ModuleIntelligence,
  risk: ModuleRisk,
  config: DecisionEngineConfig = DEFAULT_ENGINE_CONFIG
): ModulePriority {
  const reasons: PriorityReason[] = [];
  const w = config.weights;

  // ── Prüfungsnähe (35%) ──
  let examScore = 0;
  if (module.exams.daysUntilNext !== null) {
    const days = module.exams.daysUntilNext;
    // Exponential decay: je näher desto dringender
    examScore = Math.round(Math.max(0, 100 * Math.exp(-days / 10)));
    reasons.push({
      factor: "exam_proximity",
      weight: w.examProximity,
      contribution: Math.round((examScore * w.examProximity) / 100),
      description:
        days <= 3
          ? `Prüfung in ${days} Tagen — höchste Dringlichkeit!`
          : days <= 7
            ? `Prüfung in ${days} Tagen — intensive Phase`
            : days <= 14
              ? `Prüfung in ${days} Tagen — Vorbereitung nötig`
              : `Prüfung in ${days} Tagen`,
    });
  }

  // ── Notenrisiko (25%) ──
  let gradeScore = 0;
  if (module.grades.current !== null) {
    if (module.grades.passed === false) {
      gradeScore = 90; // Nicht bestanden = hohe Priorität
    } else if (module.grades.target !== null) {
      const gap = Math.abs(module.grades.target - module.grades.current);
      gradeScore = Math.min(80, Math.round(gap * 20));
    }
    if (module.grades.trend === "declining") {
      gradeScore = Math.min(100, gradeScore + 20);
    }
  } else if (module.status === "active") {
    gradeScore = 30; // Keine Note = unbekanntes Risiko
  }
  if (gradeScore > 0) {
    reasons.push({
      factor: "grade_risk",
      weight: w.gradeRisk,
      contribution: Math.round((gradeScore * w.gradeRisk) / 100),
      description: module.grades.passed === false
        ? `Note ${module.grades.current?.toFixed(1)} — unter Bestehensgrenze`
        : module.grades.trend === "declining"
          ? "Notentrend sinkt — Gegensteuern nötig"
          : `Abstand zum Ziel: ${module.grades.target ? (module.grades.target - (module.grades.current ?? 0)).toFixed(1) : "unbekannt"}`,
    });
  }

  // ── Aufgabendringlichkeit (15%) ──
  let taskScore = 0;
  if (module.tasks.overdue > 0) {
    taskScore = Math.min(100, module.tasks.overdue * 25);
  } else if (module.tasks.dueSoon > 0) {
    taskScore = Math.min(70, module.tasks.dueSoon * 20);
  }
  if (taskScore > 0) {
    reasons.push({
      factor: "task_urgency",
      weight: w.taskUrgency,
      contribution: Math.round((taskScore * w.taskUrgency) / 100),
      description:
        module.tasks.overdue > 0
          ? `${module.tasks.overdue} überfällige Aufgaben`
          : `${module.tasks.dueSoon} Aufgaben bald fällig`,
    });
  }

  // ── Aktivitätslücke (15%) ──
  let activityScore = 0;
  if (module.studyTime.daysSinceLastStudy !== null) {
    const days = module.studyTime.daysSinceLastStudy;
    activityScore = Math.min(
      100,
      Math.round((days / config.thresholds.noActivityDays) * 50)
    );
  } else if (module.status === "active") {
    activityScore = 80; // Nie gelernt
  }
  if (activityScore > 0) {
    reasons.push({
      factor: "activity_gap",
      weight: w.activityGap,
      contribution: Math.round((activityScore * w.activityGap) / 100),
      description:
        module.studyTime.daysSinceLastStudy !== null
          ? `${module.studyTime.daysSinceLastStudy} Tage seit letzter Aktivität`
          : "Noch keine Lernzeit erfasst",
    });
  }

  // ── Wissenslücken (10%) ──
  let knowledgeScore = 0;
  if (module.knowledge.topicCount > 0) {
    const weakRatio = module.knowledge.weakTopics.length / module.knowledge.topicCount;
    knowledgeScore = Math.round(weakRatio * 100);
    if (module.knowledge.reviewDue > 0) {
      knowledgeScore = Math.min(100, knowledgeScore + module.knowledge.reviewDue * 5);
    }
  }
  if (knowledgeScore > 0) {
    reasons.push({
      factor: "knowledge_gap",
      weight: w.knowledgeGap,
      contribution: Math.round((knowledgeScore * w.knowledgeGap) / 100),
      description:
        module.knowledge.weakTopics.length > 0
          ? `${module.knowledge.weakTopics.length} schwache Themen`
          : `${module.knowledge.reviewDue} Themen brauchen Review`,
    });
  }

  // ── Gewichteter Gesamtscore ──
  const totalWeight = w.examProximity + w.gradeRisk + w.taskUrgency + w.activityGap + w.knowledgeGap;
  const weightedScore = Math.round(
    (examScore * w.examProximity +
      gradeScore * w.gradeRisk +
      taskScore * w.taskUrgency +
      activityScore * w.activityGap +
      knowledgeScore * w.knowledgeGap) /
      totalWeight
  );

  // ── Lernzeit-Empfehlung ──
  const suggestedMinutes = calculateSuggestedMinutes(module, risk, config);

  return {
    moduleId: module.moduleId,
    score: weightedScore,
    rank: 0, // Wird in rankModules() gesetzt
    reasons: reasons.sort((a, b) => b.contribution - a.contribution),
    suggestedMinutesToday: suggestedMinutes,
  };
}

/**
 * Berechnet empfohlene Lernminuten für heute.
 */
function calculateSuggestedMinutes(
  module: ModuleIntelligence,
  risk: ModuleRisk,
  config: DecisionEngineConfig
): number {
  let base = 30; // Minimum

  // Prüfungsnähe erhöht die Zeit
  if (module.exams.daysUntilNext !== null) {
    const days = module.exams.daysUntilNext;
    if (days <= 3) base = 120;
    else if (days <= 7) base = 90;
    else if (days <= 14) base = 60;
  }

  // Risiko erhöht die Zeit
  if (risk.overall === "critical") base = Math.max(base, 90);
  else if (risk.overall === "high") base = Math.max(base, 60);

  // Überfällige Aufgaben addieren Zeit
  base += module.tasks.overdue * 15;

  // Wissenslücken addieren Zeit
  base += Math.min(30, module.knowledge.weakTopics.length * 10);

  // Maximum pro Tag und Modul
  return Math.min(180, base);
}

/**
 * Rankt alle Module nach Priorität.
 */
export function rankModules(
  priorities: ModulePriority[]
): ModulePriority[] {
  const sorted = [...priorities].sort((a, b) => b.score - a.score);
  return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
}

// ═══════════════════════════════════════════════════════════════
// 3. OUTCOME PREDICTION
// ═══════════════════════════════════════════════════════════════

/**
 * Prognostiziert das wahrscheinliche Ergebnis eines Moduls.
 * Swiss grade system: 1-6, 4.0 = pass, higher = better.
 */
export function predictOutcome(
  module: ModuleIntelligence
): OutcomePrediction {
  const { grades } = module;

  // Aktuelle Trajektorie basierend auf bisherigen Noten
  let currentTrajectory: number | null = null;
  if (grades.current !== null) {
    currentTrajectory = grades.current;
    // Trend-Anpassung
    if (grades.trend === "declining") {
      currentTrajectory = Math.max(1, currentTrajectory - 0.3);
    } else if (grades.trend === "improving") {
      currentTrajectory = Math.min(6, currentTrajectory + 0.2);
    }
    currentTrajectory = Math.round(currentTrajectory * 10) / 10;
  }

  // Gap zum Ziel
  const gapToTarget =
    grades.target !== null && currentTrajectory !== null
      ? Math.round((grades.target - currentTrajectory) * 10) / 10
      : null;

  // Required Performance berechnen
  const requiredPerformance = calculateRequiredPerformance(module);

  // Pass-Wahrscheinlichkeit
  const passProbability = estimatePassProbability(module);

  // Szenarien
  const scenarioAnalysis = generateScenarios(module, currentTrajectory);

  return {
    moduleId: module.moduleId,
    currentTrajectory,
    targetGrade: grades.target,
    gapToTarget,
    requiredPerformance,
    passProbability,
    scenarioAnalysis,
  };
}

/**
 * Berechnet was in verbleibenden Prüfungen nötig ist.
 */
function calculateRequiredPerformance(
  module: ModuleIntelligence
): RequiredPerformance | null {
  const { grades } = module;
  if (grades.current === null || grades.target === null) return null;

  const completedComponents = grades.componentResults.filter((c) => c.grade !== null);
  const remainingComponents = grades.componentResults.filter((c) => c.grade === null);

  if (remainingComponents.length === 0) return null;

  // Gewichteter Durchschnitt der bisherigen Ergebnisse
  const completedWeight = completedComponents.reduce((s, c) => s + c.weight, 0);
  const completedWeightedSum = completedComponents.reduce(
    (s, c) => s + (c.grade ?? 0) * c.weight,
    0
  );
  const remainingWeight = remainingComponents.reduce((s, c) => s + c.weight, 0);

  if (remainingWeight === 0) return null;

  // Welche Note braucht man im Durchschnitt der verbleibenden Komponenten?
  // target = (completedWeightedSum + needed * remainingWeight) / (completedWeight + remainingWeight)
  const needed =
    (grades.target * (completedWeight + remainingWeight) - completedWeightedSum) /
    remainingWeight;

  const clampedNeeded = Math.round(Math.max(1, Math.min(6, needed)) * 10) / 10;

  let description: string;
  if (clampedNeeded > 6) {
    description = `Zielnote ${grades.target.toFixed(1)} ist rechnerisch nicht mehr erreichbar`;
  } else if (clampedNeeded > 5.5) {
    description = `Du brauchst mindestens ${clampedNeeded.toFixed(1)} — sehr anspruchsvoll`;
  } else if (clampedNeeded > 4.5) {
    description = `Du brauchst mindestens ${clampedNeeded.toFixed(1)} — machbar mit guter Vorbereitung`;
  } else {
    description = `Du brauchst mindestens ${clampedNeeded.toFixed(1)} — gut erreichbar`;
  }

  return {
    nextExamGrade: clampedNeeded,
    remainingComponentAverage: clampedNeeded,
    description,
  };
}

/**
 * Schätzt die Bestehens-Wahrscheinlichkeit (0-100%).
 */
function estimatePassProbability(module: ModuleIntelligence): number {
  const { grades, studyTime, tasks, knowledge, exams } = module;

  // Basiswahrscheinlichkeit
  let probability = 50;

  // Aktuelle Note beeinflusst stark
  if (grades.current !== null) {
    if (grades.current >= 5.0) probability += 30;
    else if (grades.current >= 4.5) probability += 20;
    else if (grades.current >= 4.0) probability += 10;
    else if (grades.current >= 3.5) probability -= 10;
    else probability -= 25;
  }

  // Trend
  if (grades.trend === "improving") probability += 10;
  else if (grades.trend === "declining") probability -= 15;

  // Lernaktivität
  if (studyTime.averagePerWeek >= 120) probability += 10;
  else if (studyTime.averagePerWeek < 30) probability -= 15;

  // Aufgaben-Completion
  if (tasks.completionRate >= 80) probability += 5;
  else if (tasks.completionRate < 40) probability -= 10;

  // Wissenslevel
  if (knowledge.averageLevel >= 70) probability += 10;
  else if (knowledge.averageLevel < 40) probability -= 10;

  // Prüfung bald + wenig vorbereitet = Malus
  if (exams.daysUntilNext !== null && exams.daysUntilNext <= 7) {
    if (studyTime.last7Days < 60) probability -= 15;
  }

  return Math.max(5, Math.min(95, probability));
}

/**
 * Generiert Best/Realistic/Worst-Case Szenarien.
 */
function generateScenarios(
  module: ModuleIntelligence,
  currentTrajectory: number | null
): Scenario[] {
  const base = currentTrajectory ?? 4.0;

  return [
    {
      name: "Best Case",
      finalGrade: Math.min(6.0, Math.round((base + 0.8) * 10) / 10),
      passed: Math.min(6.0, base + 0.8) >= 4.0,
      assumptions:
        "Intensive Vorbereitung, alle verbleibenden Aufgaben erledigt, Wissenlücken geschlossen",
    },
    {
      name: "Realistisch",
      finalGrade: Math.round(base * 10) / 10,
      passed: base >= 4.0,
      assumptions:
        "Aktueller Lernaufwand beibehalten, moderate Verbesserung in schwachen Themen",
    },
    {
      name: "Worst Case",
      finalGrade: Math.max(1.0, Math.round((base - 1.0) * 10) / 10),
      passed: Math.max(1.0, base - 1.0) >= 4.0,
      assumptions:
        "Weniger Lernzeit, keine zusätzliche Vorbereitung, bestehende Lücken bleiben",
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
// 4. ACTION GENERATION
// ═══════════════════════════════════════════════════════════════

/**
 * Generiert konkrete Handlungsempfehlungen basierend auf
 * ModuleIntelligence und Risikobewertung.
 */
export function generateActions(
  module: ModuleIntelligence,
  risk: ModuleRisk,
  config: DecisionEngineConfig = DEFAULT_ENGINE_CONFIG
): Action[] {
  const actions: Action[] = [];
  let actionId = 0;

  const makeAction = (
    type: ActionType,
    urgency: ActionUrgency,
    title: string,
    description: string,
    estimatedMinutes: number,
    reason: string,
    impact: string,
    relatedEntityId?: string,
    relatedEntityType?: "task" | "exam" | "topic" | "flashcard"
  ): Action => ({
    id: `${module.moduleId}-action-${actionId++}`,
    moduleId: module.moduleId,
    moduleName: module.moduleName,
    moduleColor: module.color,
    type,
    urgency,
    title,
    description,
    estimatedMinutes,
    reason,
    impact,
    relatedEntityId,
    relatedEntityType,
  });

  // ── Prüfungsvorbereitung ──
  if (module.exams.next) {
    const days = module.exams.daysUntilNext ?? 999;
    if (days <= 3) {
      actions.push(
        makeAction(
          "prepare_exam",
          "now",
          `Prüfung vorbereiten: ${module.exams.next.title}`,
          `Prüfung in ${days} Tagen — fokussierte Vorbereitung nötig. Schwerpunkt auf schwache Themen legen.`,
          config.estimates.minutesPerExamPrep,
          `Prüfung am ${formatDate(module.exams.next.date)}`,
          "Direkte Auswirkung auf die Note in diesem Modul",
          module.exams.next.id,
          "exam"
        )
      );
    } else if (days <= 14) {
      actions.push(
        makeAction(
          "prepare_exam",
          days <= 7 ? "today" : "this_week",
          `Prüfungsvorbereitung: ${module.exams.next.title}`,
          `Strukturierte Vorbereitung starten: Lernplan erstellen, Material sammeln, Übungen durchgehen.`,
          Math.round(config.estimates.minutesPerExamPrep * 0.5),
          `Prüfung in ${days} Tagen`,
          "Bessere Vorbereitung = bessere Note",
          module.exams.next.id,
          "exam"
        )
      );
    }
  }

  // ── Überfällige Aufgaben ──
  if (module.tasks.overdue > 0) {
    actions.push(
      makeAction(
        "complete_task",
        "now",
        `${module.tasks.overdue} überfällige Aufgabe${module.tasks.overdue > 1 ? "n" : ""} erledigen`,
        `Diese Aufgaben sind bereits überfällig und sollten sofort bearbeitet werden.`,
        module.tasks.overdue * 30,
        `${module.tasks.overdue} Aufgaben sind überfällig`,
        "Überfällige Aufgaben können die Modulnote beeinflussen und erzeugen Stress"
      )
    );
  }

  // ── Bald fällige Aufgaben ──
  if (module.tasks.dueSoon > 0 && module.tasks.overdue === 0) {
    actions.push(
      makeAction(
        "complete_task",
        "today",
        `${module.tasks.dueSoon} Aufgabe${module.tasks.dueSoon > 1 ? "n" : ""} bald fällig`,
        `Aufgaben in den nächsten ${config.thresholds.taskDueSoonDays} Tagen fällig — rechtzeitig erledigen.`,
        module.tasks.dueSoon * 25,
        `Fällig innerhalb von ${config.thresholds.taskDueSoonDays} Tagen`,
        "Rechtzeitiges Erledigen verhindert Zeitdruck"
      )
    );
  }

  // ── Karteikarten-Review ──
  if (module.knowledge.flashcardsDue > 0) {
    actions.push(
      makeAction(
        "review_flashcards",
        module.knowledge.flashcardsDue > 20 ? "today" : "this_week",
        `${module.knowledge.flashcardsDue} Karteikarten wiederholen`,
        `Spaced-Repetition-Review fällig. Regelmässiges Wiederholen verbessert Langzeitgedächtnis.`,
        Math.round(
          (module.knowledge.flashcardsDue / 10) *
            config.estimates.minutesPerFlashcardDeck
        ),
        `${module.knowledge.flashcardsDue} Karten warten auf Review`,
        "Spaced Repetition ist die effektivste Lernmethode",
        undefined,
        "flashcard"
      )
    );
  }

  // ── Schwache Themen nacharbeiten ──
  if (module.knowledge.weakTopics.length > 0) {
    const topicList = module.knowledge.weakTopics.slice(0, 3);
    actions.push(
      makeAction(
        "review_weak_topics",
        risk.overall === "critical" || risk.overall === "high" ? "today" : "this_week",
        `Schwache Themen vertiefen (${module.knowledge.weakTopics.length})`,
        `Fokus auf: ${topicList.join(", ")}${module.knowledge.weakTopics.length > 3 ? ` und ${module.knowledge.weakTopics.length - 3} weitere` : ""}`,
        module.knowledge.weakTopics.length * config.estimates.minutesPerTopic,
        `Wissenslevel unter ${config.thresholds.lowKnowledgeLevel}% in ${module.knowledge.weakTopics.length} Themen`,
        "Diese Lücken könnten in der Prüfung entscheidend sein",
        undefined,
        "topic"
      )
    );
  }

  // ── Lernen starten (keine Aktivität) ──
  if (
    module.status === "active" &&
    module.studyTime.totalMinutes === 0
  ) {
    actions.push(
      makeAction(
        "start_studying",
        "today",
        `Mit ${module.moduleName} anfangen`,
        `Du hast noch keine Lernzeit in diesem Modul erfasst. Starte mit einer ersten Lerneinheit.`,
        45,
        "Noch keine Lernaktivität vorhanden",
        "Der erste Schritt ist der wichtigste — jede Minute zählt"
      )
    );
  }

  // ── Mehr Zeit investieren ──
  if (
    module.status === "active" &&
    module.studyTime.totalMinutes > 0 &&
    module.studyTime.averagePerWeek < config.thresholds.minStudyMinutesPerWeek * 0.5 &&
    risk.overall !== "none" && risk.overall !== "low"
  ) {
    actions.push(
      makeAction(
        "increase_time",
        "this_week",
        `Lernzeit erhöhen für ${module.moduleName}`,
        `Aktuell ${Math.round(module.studyTime.averagePerWeek)} Min/Woche — Empfehlung: mindestens ${config.thresholds.minStudyMinutesPerWeek} Min/Woche.`,
        60,
        `Lernzeit deutlich unter Empfehlung`,
        "Mehr Lernzeit korreliert direkt mit besseren Noten"
      )
    );
  }

  // ── Hilfe suchen (kritisch) ──
  if (
    risk.overall === "critical" &&
    module.grades.current !== null &&
    module.grades.current < 3.5
  ) {
    actions.push(
      makeAction(
        "seek_help",
        "today",
        `Hilfe suchen für ${module.moduleName}`,
        `Die Note ist kritisch niedrig. Kontaktiere Dozent*in, Tutor*in oder Lerngruppe.`,
        30,
        `Note ${module.grades.current.toFixed(1)} ist kritisch`,
        "Frühzeitige Hilfe kann den Unterschied zwischen Bestehen und Nicht-Bestehen machen"
      )
    );
  }

  // ── Lernmaterial erstellen ──
  if (
    module.exams.daysUntilNext !== null &&
    module.exams.daysUntilNext <= config.thresholds.examSoonDays
  ) {
    const totalMaterial =
      module.resources.noteCount +
      module.resources.documentCount +
      module.resources.mindmapCount;
    if (totalMaterial === 0) {
      actions.push(
        makeAction(
          "create_material",
          "today",
          `Lernmaterial für ${module.moduleName} erstellen`,
          `Erstelle Zusammenfassungen, Mindmaps oder Karteikarten als Prüfungsvorbereitung.`,
          60,
          "Kein Lernmaterial vorhanden, Prüfung naht",
          "Gutes Lernmaterial ist die Basis für effektive Prüfungsvorbereitung"
        )
      );
    }
  }

  // Sortieren: dringendste zuerst
  return actions.sort((a, b) => urgencyToNumber(a.urgency) - urgencyToNumber(b.urgency));
}

/**
 * Konvertiert ActionUrgency in eine numerische Sortierung.
 */
function urgencyToNumber(urgency: ActionUrgency): number {
  const map: Record<ActionUrgency, number> = {
    now: 0,
    today: 1,
    this_week: 2,
    soon: 3,
    later: 4,
  };
  return map[urgency];
}

/**
 * Formatiert ein ISO-Datum für deutsche Anzeige.
 */
function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (_e) {
    return isoDate;
  }
}

// ═══════════════════════════════════════════════════════════════
// 5. DAILY PLAN
// ═══════════════════════════════════════════════════════════════

/**
 * Erstellt den Tagesplan aus allen Modulen.
 * Konsolidiert Aktionen, wählt Fokus-Modul, generiert Alerts.
 */
export function buildDailyPlan(
  modules: ModuleIntelligence[],
  config: DecisionEngineConfig = DEFAULT_ENGINE_CONFIG
): DailyPlan {
  const today = new Date().toISOString().split("T")[0];

  // Nur aktive Module
  const activeModules = modules.filter((m) => m.status === "active");

  // Risiko & Priorität für alle Module
  const risks = activeModules.map((m) => assessModuleRisk(m, config));
  const riskMap = new Map(risks.map((r) => [r.moduleId, r]));

  const priorities = activeModules.map((m) =>
    calculateModulePriority(m, riskMap.get(m.moduleId)!, config)
  );
  const ranked = rankModules(priorities);

  // Aktionen generieren und budgetieren
  const allActions: Action[] = [];
  for (const module of activeModules) {
    const risk = riskMap.get(module.moduleId)!;
    const moduleActions = generateActions(module, risk, config);
    allActions.push(...moduleActions);
  }

  // Aktionen nach Dringlichkeit sortieren und auf realistische Tageszeit beschränken
  const sortedActions = allActions.sort(
    (a, b) =>
      urgencyToNumber(a.urgency) - urgencyToNumber(b.urgency) ||
      b.estimatedMinutes - a.estimatedMinutes
  );

  // Budget: max 6 Stunden Lernzeit pro Tag
  const MAX_DAILY_MINUTES = 360;
  const todayActions: Action[] = [];
  let totalMinutes = 0;

  for (const action of sortedActions) {
    if (action.urgency === "now" || action.urgency === "today") {
      todayActions.push(action);
      totalMinutes += action.estimatedMinutes;
    } else if (totalMinutes < MAX_DAILY_MINUTES && action.urgency === "this_week") {
      todayActions.push(action);
      totalMinutes += action.estimatedMinutes;
    }
    if (totalMinutes >= MAX_DAILY_MINUTES) break;
  }

  // Fokus-Modul = höchste Priorität
  const topModule = ranked[0];
  const focusModuleData = topModule
    ? activeModules.find((m) => m.moduleId === topModule.moduleId)
    : null;

  const focusModule = focusModuleData
    ? {
        id: focusModuleData.moduleId,
        name: focusModuleData.moduleName,
        color: focusModuleData.color,
        reason: topModule.reasons[0]?.description ?? "Höchste Priorität",
      }
    : null;

  // Alerts generieren
  const alerts = generateAlerts(activeModules, risks, config);

  return {
    date: today,
    totalMinutes: Math.min(totalMinutes, MAX_DAILY_MINUTES),
    actions: todayActions,
    focusModule,
    alerts,
  };
}

/**
 * Generiert Warnungen/Alerts basierend auf kritischen Zuständen.
 */
function generateAlerts(
  modules: ModuleIntelligence[],
  risks: ModuleRisk[],
  config: DecisionEngineConfig
): Alert[] {
  const alerts: Alert[] = [];

  for (let i = 0; i < modules.length; i++) {
    const module = modules[i];
    const risk = risks[i];

    // Kritische Prüfung
    if (
      module.exams.daysUntilNext !== null &&
      module.exams.daysUntilNext <= 3 &&
      module.studyTime.last7Days < config.estimates.minutesPerExamPrep * 0.3
    ) {
      alerts.push({
        level: "critical",
        title: "Prüfung in wenigen Tagen!",
        message: `${module.exams.next?.title} in ${module.exams.daysUntilNext} Tagen — Vorbereitung reicht möglicherweise nicht.`,
        moduleId: module.moduleId,
        moduleName: module.moduleName,
        actionRequired: true,
      });
    }

    // Nicht-Bestehens-Gefahr
    if (risk.overall === "critical" && module.grades.passed === false) {
      alerts.push({
        level: "critical",
        title: "Nicht-Bestehen droht",
        message: `${module.moduleName}: Note ${module.grades.current?.toFixed(1)} unter Bestehensgrenze. Sofortiges Handeln erforderlich.`,
        moduleId: module.moduleId,
        moduleName: module.moduleName,
        actionRequired: true,
      });
    }

    // Viele überfällige Aufgaben
    if (module.tasks.overdue >= 5) {
      alerts.push({
        level: "high",
        title: "Aufgabenstau",
        message: `${module.moduleName}: ${module.tasks.overdue} überfällige Aufgaben. Rückstand aufholen!`,
        moduleId: module.moduleId,
        moduleName: module.moduleName,
        actionRequired: true,
      });
    }

    // Lange keine Aktivität bei aktivem Modul mit Prüfung
    if (
      module.status === "active" &&
      module.studyTime.daysSinceLastStudy !== null &&
      module.studyTime.daysSinceLastStudy > config.thresholds.noActivityDays * 3 &&
      module.exams.next !== null
    ) {
      alerts.push({
        level: "high",
        title: "Modul vernachlässigt",
        message: `${module.moduleName}: ${module.studyTime.daysSinceLastStudy} Tage ohne Lernaktivität, Prüfung geplant.`,
        moduleId: module.moduleId,
        moduleName: module.moduleName,
        actionRequired: true,
      });
    }
  }

  // Globale Alerts
  const totalOverdue = modules.reduce((s, m) => s + m.tasks.overdue, 0);
  if (totalOverdue >= 10) {
    alerts.push({
      level: "high",
      title: "Allgemeiner Aufgabenrückstand",
      message: `Insgesamt ${totalOverdue} überfällige Aufgaben über alle Module. Priorisierung empfohlen.`,
      actionRequired: true,
    });
  }

  // Sortieren: critical zuerst
  return alerts.sort((a, b) => riskLevelToNumber(a.level) - riskLevelToNumber(b.level));
}

function riskLevelToNumber(level: RiskLevel): number {
  const map: Record<RiskLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    none: 4,
  };
  return map[level];
}

// ═══════════════════════════════════════════════════════════════
// 6. COMMAND CENTER STATE
// ═══════════════════════════════════════════════════════════════

/**
 * Baut den kompletten Command Center State auf.
 * Dies ist die Haupt-Funktion die alles orchestriert.
 */
export function buildCommandCenterState(
  modules: ModuleIntelligence[],
  config: DecisionEngineConfig = DEFAULT_ENGINE_CONFIG
): CommandCenterState {
  const activeModules = modules.filter((m) => m.status === "active");

  // 1. Risiko für jedes Modul
  const allRisks = activeModules.map((m) => assessModuleRisk(m, config));
  const riskMap = new Map<string, ModuleRisk>();
  const criticalRisks: ModuleRisk[] = [];
  const highRisks: ModuleRisk[] = [];
  const mediumRisks: ModuleRisk[] = [];

  for (const risk of allRisks) {
    riskMap.set(risk.moduleId, risk);
    if (risk.overall === "critical") criticalRisks.push(risk);
    else if (risk.overall === "high") highRisks.push(risk);
    else if (risk.overall === "medium") mediumRisks.push(risk);
  }

  // 2. Priorität für jedes Modul
  const priorities = activeModules.map((m) =>
    calculateModulePriority(m, riskMap.get(m.moduleId)!, config)
  );
  const moduleRankings = rankModules(priorities);

  // 3. Prognosen für jedes Modul
  const predictions = new Map<string, OutcomePrediction>();
  for (const module of activeModules) {
    predictions.set(module.moduleId, predictOutcome(module));
  }

  // 4. Tagesplan
  const today = buildDailyPlan(modules, config);

  // 5. Globale Metriken
  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const allExams = modules.flatMap((m) => m.exams.all);
  const examsThisWeek = allExams.filter((e) => {
    const d = new Date(e.date);
    return d >= now && d <= endOfWeek;
  });
  const examsThisMonth = allExams.filter((e) => {
    const d = new Date(e.date);
    return d >= now && d <= endOfMonth;
  });

  const completedModules = modules.filter((m) => m.status === "completed");
  const ectsEarned = completedModules.reduce((s, m) => s + m.ects, 0);
  const ectsTarget = modules.reduce((s, m) => s + m.ects, 0);

  // GPA: Durchschnitt aller Module mit Note
  const modulesWithGrade = modules.filter((m) => m.grades.current !== null);
  const overallGPA =
    modulesWithGrade.length > 0
      ? Math.round(
          (modulesWithGrade.reduce((s, m) => s + (m.grades.current ?? 0) * m.ects, 0) /
            modulesWithGrade.reduce((s, m) => s + m.ects, 0)) *
            100
        ) / 100
      : null;

  const totalStudyMinutesThisWeek = activeModules.reduce(
    (s, m) => s + m.studyTime.last7Days,
    0
  );
  const totalOverdue = activeModules.reduce((s, m) => s + m.tasks.overdue, 0);

  // Streak: Anzahl aufeinanderfolgender Tage mit Lernaktivität
  const studyStreak = calculateStudyStreak(modules);

  const atRiskModules = criticalRisks.length + highRisks.length;

  return {
    today,
    moduleRankings,
    risks: {
      critical: criticalRisks,
      high: highRisks,
      medium: mediumRisks,
      modules: riskMap,
    },
    predictions,
    overview: {
      totalModules: modules.length,
      activeModules: activeModules.length,
      atRiskModules,
      ectsEarned,
      ectsTarget,
      overallGPA,
      studyStreak,
      totalStudyMinutesThisWeek,
      tasksOverdue: totalOverdue,
      examsThisWeek,
      examsThisMonth,
    },
    computedAt: new Date().toISOString(),
  };
}

/**
 * Berechnet die aktuelle Lern-Streak über alle Module.
 * Vereinfachte Version — volle Streak-Berechnung kommt vom Hook.
 */
function calculateStudyStreak(modules: ModuleIntelligence[]): number {
  // Finde das früheste "daysSinceLastStudy" über alle aktiven Module
  const activeWithStudy = modules.filter(
    (m) => m.status === "active" && m.studyTime.daysSinceLastStudy !== null
  );
  if (activeWithStudy.length === 0) return 0;

  const minDaysSince = Math.min(
    ...activeWithStudy.map((m) => m.studyTime.daysSinceLastStudy!)
  );

  // Wenn heute oder gestern gelernt wurde, gibt es mindestens Streak = 1
  // Genauere Berechnung braucht tagesgenaue Daten (aus Hook)
  if (minDaysSince === 0) return 1; // Mindestens heute
  if (minDaysSince === 1) return 1; // Gestern
  return 0; // Streak unterbrochen
}

// ═══════════════════════════════════════════════════════════════
// 7. AI CONTEXT
// ═══════════════════════════════════════════════════════════════

/**
 * Erstellt den Kontext der an die KI übergeben wird.
 * Komprimiert ModuleIntelligence zu den wesentlichen Fakten.
 */
export function buildAIContext(
  module: ModuleIntelligence,
  risk: ModuleRisk,
  actions: Action[]
): AIDecisionContext {
  return {
    moduleId: module.moduleId,
    moduleName: module.moduleName,
    currentGrade: module.grades.current,
    targetGrade: module.grades.target,
    riskLevel: risk.overall,
    riskFactors: risk.factors.map((f) => f.message),
    weakTopics: module.knowledge.weakTopics,
    daysUntilExam: module.exams.daysUntilNext,
    studyMinutesLast7Days: module.studyTime.last7Days,
    tasksOverdue: module.tasks.overdue,
    requiredExamGrade: module.grades.needed,
    recentActions: actions.slice(0, 5).map((a) => a.title),
  };
}

// ═══════════════════════════════════════════════════════════════
// 8. TREND ANALYSIS
// ═══════════════════════════════════════════════════════════════

/**
 * Bestimmt den Trend einer Zahlenreihe.
 * Verwendet lineare Regression.
 */
export function calculateTrend(values: number[]): TrendDirection {
  if (values.length < 2) return "unknown";

  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Schwellwert für "stabil"
  const avgValue = sumY / n;
  const threshold = avgValue * 0.02; // 2% Veränderung = merkbar

  if (slope > threshold) return "improving";
  if (slope < -threshold) return "declining";
  return "stable";
}

/**
 * Berechnet den gewichteten Notendurchschnitt aus Komponenten.
 */
export function calculateWeightedAverage(
  components: Array<{ grade: number | null; weight: number }>
): number | null {
  const graded = components.filter((c) => c.grade !== null);
  if (graded.length === 0) return null;

  const totalWeight = graded.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) return null;

  return (
    Math.round(
      (graded.reduce((s, c) => s + (c.grade ?? 0) * c.weight, 0) / totalWeight) * 100
    ) / 100
  );
}

// ═══════════════════════════════════════════════════════════════
// 9. UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Filtert Aktionen nach Dringlichkeit.
 */
export function filterActionsByUrgency(
  actions: Action[],
  maxUrgency: ActionUrgency
): Action[] {
  const maxLevel = urgencyToNumber(maxUrgency);
  return actions.filter((a) => urgencyToNumber(a.urgency) <= maxLevel);
}

/**
 * Gruppiert Aktionen nach Modul.
 */
export function groupActionsByModule(
  actions: Action[]
): Map<string, Action[]> {
  const grouped = new Map<string, Action[]>();
  for (const action of actions) {
    const existing = grouped.get(action.moduleId) ?? [];
    existing.push(action);
    grouped.set(action.moduleId, existing);
  }
  return grouped;
}

/**
 * Berechnet die Gesamtzeit aller Aktionen.
 */
export function totalActionMinutes(actions: Action[]): number {
  return actions.reduce((sum, a) => sum + a.estimatedMinutes, 0);
}

/**
 * Erstellt eine kompakte Zusammenfassung für Notifications.
 */
export function buildDailySummary(state: CommandCenterState): string {
  const parts: string[] = [];

  // Alerts
  const criticalAlerts = state.today.alerts.filter((a) => a.level === "critical");
  if (criticalAlerts.length > 0) {
    parts.push(`${criticalAlerts.length} kritische Warnung${criticalAlerts.length > 1 ? "en" : ""}`);
  }

  // Fokus
  if (state.today.focusModule) {
    parts.push(`Fokus: ${state.today.focusModule.name}`);
  }

  // Aktionen
  const todayActions = state.today.actions.filter(
    (a) => a.urgency === "now" || a.urgency === "today"
  );
  if (todayActions.length > 0) {
    parts.push(`${todayActions.length} Aufgaben für heute`);
  }

  // Prüfungen
  if (state.overview.examsThisWeek.length > 0) {
    parts.push(
      `${state.overview.examsThisWeek.length} Prüfung${state.overview.examsThisWeek.length > 1 ? "en" : ""} diese Woche`
    );
  }

  // Risiken
  if (state.overview.atRiskModules > 0) {
    parts.push(
      `${state.overview.atRiskModules} Modul${state.overview.atRiskModules > 1 ? "e" : ""} mit erhöhtem Risiko`
    );
  }

  return parts.join(" · ");
}
