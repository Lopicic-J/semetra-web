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
  DnaProfile,
  OnboardingProfile,
  ExamSnapshot,
  TrendDirection,
  SemesterPhase,
  AdaptiveBudgetContext,
} from "./types";
import { DEFAULT_ENGINE_CONFIG } from "./types";

/**
 * Determines if a module should be considered "active" by the Decision Engine.
 * Includes both "active" and "planned" modules — institution-imported modules
 * start as "planned" but students are actively studying them.
 */
function isEngineActive(module: ModuleIntelligence): boolean {
  return module.status === "active" || module.status === "planned";
}

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
  } else if (isEngineActive(module) && module.studyTime.totalMinutes === 0) {
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
    isEngineActive(module) &&
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
  } else if (isEngineActive(module)) {
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
  } else if (isEngineActive(module)) {
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
 *
 * Verwendet Bayesian Update:
 * - Prior: Durchschnitt 4.5 (typische Schweizer FH-Note) gewichtet mit (1-confidence)
 * - Likelihood: Bisherige Noten des Users gewichtet mit confidence
 * - Confidence steigt mit Anzahl Datenpunkte (0.3 bei 1 Note → 0.9 bei 5+)
 * - Trend, Lernzeit und Wissensstand als Modifikatoren
 */
export function predictOutcome(
  module: ModuleIntelligence
): OutcomePrediction {
  const { grades } = module;
  const PRIOR_GRADE = 4.5; // Typische Schweizer FH-Durchschnittsnote

  // Aktuelle Trajektorie mit Bayesian Update
  let currentTrajectory: number | null = null;
  if (grades.current !== null) {
    // Konfidenz steigt mit Anzahl Noten: 1→0.3, 2→0.5, 3→0.65, 4→0.75, 5+→0.85-0.95
    const gradeCount = grades.componentResults.filter((c) => c.grade !== null).length;
    const confidence = Math.min(0.95, 0.3 + gradeCount * 0.15);

    // Bayesian Update: Prior × (1-conf) + Likelihood × conf
    let bayesianEstimate = PRIOR_GRADE * (1 - confidence) + grades.current * confidence;

    // Trend-Modifikator (subtiler als vorher)
    if (grades.trend === "declining") {
      bayesianEstimate -= 0.15 * confidence; // Stärker gewichtet wenn mehr Daten
    } else if (grades.trend === "improving") {
      bayesianEstimate += 0.12 * confidence;
    }

    // Lernzeit-Modifikator: Viel Lernen = leicht positiv, wenig = leicht negativ
    if (module.studyTime.averagePerWeek >= 150) {
      bayesianEstimate += 0.1;
    } else if (module.studyTime.averagePerWeek < 30 && module.studyTime.totalMinutes > 0) {
      bayesianEstimate -= 0.1;
    }

    // Wissens-Modifikator: Hoher Knowledge-Level = positiv
    if (module.knowledge.topicCount > 0) {
      if (module.knowledge.averageLevel >= 75) bayesianEstimate += 0.1;
      else if (module.knowledge.averageLevel < 30) bayesianEstimate -= 0.1;
    }

    currentTrajectory = Math.round(Math.max(1, Math.min(6, bayesianEstimate)) * 10) / 10;
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
 *
 * Verwendet gewichtete Faktoren mit Konfidenz-Skalierung:
 * Je mehr Datenpunkte vorhanden, desto stärker beeinflussen sie das Ergebnis.
 */
function estimatePassProbability(module: ModuleIntelligence): number {
  const { grades, studyTime, tasks, knowledge, exams } = module;

  // Basiswahrscheinlichkeit
  let probability = 50;

  // Konfidenz basierend auf Datenlage
  const gradeCount = grades.componentResults.filter((c) => c.grade !== null).length;
  const dataConfidence = Math.min(1, 0.3 + gradeCount * 0.15);

  // Aktuelle Note beeinflusst stark — skaliert mit Konfidenz
  if (grades.current !== null) {
    // Distanz zum Bestehen (4.0) als kontinuierlicher Score statt Stufen
    const distanceToPass = grades.current - 4.0;
    const gradeImpact = Math.round(distanceToPass * 20 * dataConfidence);
    probability += Math.max(-30, Math.min(35, gradeImpact));
  }

  // Trend (skaliert mit Konfidenz)
  if (grades.trend === "improving") probability += Math.round(10 * dataConfidence);
  else if (grades.trend === "declining") probability -= Math.round(15 * dataConfidence);

  // Lernaktivität
  if (studyTime.averagePerWeek >= 120) probability += 10;
  else if (studyTime.averagePerWeek < 30) probability -= 15;

  // Aufgaben-Completion
  if (tasks.completionRate >= 80) probability += 5;
  else if (tasks.completionRate < 40) probability -= 10;

  // Wissenslevel
  if (knowledge.topicCount > 0) {
    if (knowledge.averageLevel >= 70) probability += 10;
    else if (knowledge.averageLevel < 40) probability -= 10;
  }

  // Prüfung bald + wenig vorbereitet = Malus (stärker bei näherem Termin)
  if (exams.daysUntilNext !== null && exams.daysUntilNext <= 7) {
    if (studyTime.last7Days < 60) {
      const urgencyPenalty = Math.round(15 * (1 - exams.daysUntilNext / 7));
      probability -= Math.max(5, urgencyPenalty);
    }
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

  // ── Modul ohne Inhalte → Topics zuerst generieren (vor Prüfungsvorbereitung) ──
  if (
    isEngineActive(module) &&
    module.knowledge.topicCount === 0 &&
    module.knowledge.totalFlashcards === 0 &&
    module.exams.next &&
    (module.exams.daysUntilNext ?? 999) <= 21
  ) {
    actions.push(
      makeAction(
        "create_material",
        "now",
        `Lerninhalte für ${module.moduleName} generieren`,
        `Dieses Modul hat noch keine Topics oder Flashcards. Generiere jetzt Inhalte, damit Semetra dich gezielt auf die Prüfung vorbereiten kann.`,
        5, // Only takes a few seconds with AI
        `Prüfung in ${module.exams.daysUntilNext} Tagen, aber keine Lerninhalte vorhanden`,
        "Ohne Topics kann Semetra keine Wissenslücken erkennen und keine gezielte Vorbereitung empfehlen"
      )
    );
  }

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
    isEngineActive(module) &&
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
    isEngineActive(module) &&
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

  // ── Modultyp-spezifische Lernempfehlung ──
  if (isEngineActive(module) && module.learningType && module.learningType !== "mixed") {
    const typeRecommendations: Record<string, { title: string; description: string; type: ActionType }> = {
      math: {
        title: `Übungsaufgaben lösen — ${module.moduleName}`,
        description: "Mathe-Module brauchen Praxis: Löse Aufgaben Schritt für Schritt. Formeln verstehen kommt durch Anwenden.",
        type: "review_weak_topics",
      },
      programming: {
        title: `Code schreiben — ${module.moduleName}`,
        description: "Programmieren lernt man durch Programmieren. Starte ein kleines Übungsprojekt oder löse Coding-Aufgaben.",
        type: "review_weak_topics",
      },
      language: {
        title: `Vokabeln & Sprechen — ${module.moduleName}`,
        description: "Sprachen brauchen tägliche Wiederholung. Flashcards für Vokabeln + laut Sprechen üben.",
        type: "review_flashcards",
      },
      theory: {
        title: `Zusammenfassung schreiben — ${module.moduleName}`,
        description: "Theorie-Module: Schreibe die Kernkonzepte in eigenen Worten auf. Das vertieft das Verständnis.",
        type: "create_material",
      },
      project: {
        title: `Projektfortschritt — ${module.moduleName}`,
        description: "Projekt-Module: Setze dir ein Tagesziel und dokumentiere deinen Fortschritt.",
        type: "complete_task",
      },
    };

    const rec = typeRecommendations[module.learningType];
    if (rec && !actions.some(a => a.type === rec.type && a.moduleId === module.moduleId)) {
      actions.push(
        makeAction(
          rec.type,
          "this_week",
          rec.title,
          rec.description,
          30,
          `Empfehlung basierend auf Modultyp: ${module.learningType}`,
          "Die Lernmethode ist auf den Modultyp abgestimmt"
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
// 5. ADAPTIVE WEIGHTS
// ═══════════════════════════════════════════════════════════════

export interface AdaptiveWeightProfile {
  examProximity: number;
  gradeRisk: number;
  taskUrgency: number;
  activityGap: number;
  knowledgeGap: number;
  confidence: number;
  modulesAnalyzed: number;
}

/**
 * Berechnet adaptive Gewichte basierend auf historischen Korrelationen.
 *
 * Für jedes abgeschlossene Modul: Welcher Faktor-Score war am stärksten
 * korreliert mit einem guten/schlechten Noten-Outcome?
 *
 * @param completedModules - Module mit finaler Note (status = completed)
 * @param config - Basis-Config für Default-Gewichte
 * @returns Adaptive Gewichte oder null wenn zu wenig Daten
 */
export function computeAdaptiveWeights(
  completedModules: ModuleIntelligence[],
  config: DecisionEngineConfig = DEFAULT_ENGINE_CONFIG
): AdaptiveWeightProfile | null {
  // Brauchen mindestens 3 abgeschlossene Module für sinnvolle Analyse
  if (completedModules.length < 3) return null;

  const factorNames = ["examProximity", "gradeRisk", "taskUrgency", "activityGap", "knowledgeGap"] as const;
  const defaultWeights = config.weights;

  // Für jedes Modul: Score pro Faktor berechnen + Note als Outcome
  const dataPoints = completedModules
    .filter((m) => m.grades.current !== null)
    .map((m) => {
      const grade = m.grades.current!;
      // Positives Outcome = Note ≥ 4.0 (bestanden) + Bonus für gute Noten
      const outcome = Math.max(0, (grade - 3.0) / 3.0); // 0-1 Skala, 3.0→0, 6.0→1

      return {
        outcome,
        factors: {
          examProximity: m.exams.daysUntilNext !== null ? Math.max(0, 100 * Math.exp(-m.exams.daysUntilNext / 10)) : 0,
          gradeRisk: m.grades.passed === false ? 90 : (m.grades.target ? Math.min(80, Math.abs(m.grades.target - grade) * 20) : 30),
          taskUrgency: Math.min(100, m.tasks.overdue * 25 + m.tasks.dueSoon * 20),
          activityGap: m.studyTime.daysSinceLastStudy !== null ? Math.min(100, (m.studyTime.daysSinceLastStudy / 5) * 50) : 80,
          knowledgeGap: m.knowledge.topicCount > 0 ? Math.round((m.knowledge.weakTopics.length / m.knowledge.topicCount) * 100) : 0,
        },
      };
    });

  if (dataPoints.length < 3) return null;

  // Pearson-Korrelation zwischen jedem Faktor und dem Outcome
  const correlations: Record<string, number> = {};

  for (const factor of factorNames) {
    const xs = dataPoints.map((d) => d.factors[factor]);
    const ys = dataPoints.map((d) => d.outcome);
    correlations[factor] = pearsonCorrelation(xs, ys);
  }

  // Korrelation in Gewichte umrechnen:
  // Negative Korrelation (hoher Risiko-Score → schlechte Note) = dieser Faktor ist prädiktiv
  // → höheres Gewicht (weil wir vor diesem Risiko warnen wollen)
  const rawWeights: Record<string, number> = {};
  for (const factor of factorNames) {
    // Absolute Korrelation nutzen — sowohl stark negative als auch positive Korrelation sind informativ
    const absCorr = Math.abs(correlations[factor]);
    // Blend: 70% Default + 30% Korrelations-basiert
    const defaultW = defaultWeights[factor];
    rawWeights[factor] = defaultW * 0.7 + defaultW * absCorr * 3 * 0.3;
    // Minimum 5% pro Faktor
    rawWeights[factor] = Math.max(5, rawWeights[factor]);
  }

  // Normalisieren auf Summe = 100
  const totalRaw = Object.values(rawWeights).reduce((s, w) => s + w, 0);
  const scale = 100 / totalRaw;

  const result: AdaptiveWeightProfile = {
    examProximity: Math.round(rawWeights.examProximity * scale),
    gradeRisk: Math.round(rawWeights.gradeRisk * scale),
    taskUrgency: Math.round(rawWeights.taskUrgency * scale),
    activityGap: Math.round(rawWeights.activityGap * scale),
    knowledgeGap: Math.round(rawWeights.knowledgeGap * scale),
    confidence: Math.min(1, 0.3 + dataPoints.length * 0.1),
    modulesAnalyzed: dataPoints.length,
  };

  return result;
}

/**
 * Pearson-Korrelationskoeffizient zwischen zwei Zahlenreihen.
 * Gibt -1 bis 1 zurück. 0 = keine Korrelation.
 */
function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const sumY2 = ys.reduce((s, y) => s + y * y, 0);

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (den === 0) return 0;
  return num / den;
}

// ═══════════════════════════════════════════════════════════════
// 6. SEMESTER PHASE & ADAPTIVE BUDGET
// ═══════════════════════════════════════════════════════════════

/**
 * Erkennt die aktuelle Semester-Phase basierend auf Prüfungsdichte.
 * - exam_period: >3 Prüfungen in den nächsten 21 Tagen
 * - ramp_up: Wenige/keine Prüfungen, frühes Semester
 * - normal: Alles andere
 */
export function detectSemesterPhase(modules: ModuleIntelligence[]): SemesterPhase {
  const allExams = modules.flatMap((m) => m.exams.all);
  const upcomingExams = allExams.filter((e) => e.daysUntil >= 0 && e.daysUntil <= 21);

  if (upcomingExams.length > 3) return "exam_period";

  // Anlaufphase: Keine Prüfungen in 30 Tagen + wenig Lernaktivität
  const examsIn30Days = allExams.filter((e) => e.daysUntil >= 0 && e.daysUntil <= 30);
  const activeModules = modules.filter(isEngineActive);
  const avgStudyMinutes = activeModules.length > 0
    ? activeModules.reduce((s, m) => s + m.studyTime.last30Days, 0) / activeModules.length
    : 0;

  if (examsIn30Days.length === 0 && avgStudyMinutes < 300) return "ramp_up";

  return "normal";
}

/**
 * Berechnet das adaptive Tagesbudget basierend auf:
 * - User-Präferenz (max_daily_study_minutes)
 * - Wochentag-Pattern (wann lernt der User typisch wie viel)
 * - Historische Adherence (wie viel vom Plan schafft der User)
 * - Semester-Phase (Prüfungsphase = mehr, Anlaufphase = weniger)
 */
function computeAdaptiveBudget(
  context?: AdaptiveBudgetContext
): number {
  const DEFAULT_BUDGET = 360;
  if (!context) return DEFAULT_BUDGET;

  let budget = context.maxDailyMinutes ?? DEFAULT_BUDGET;

  // Wochentag-Anpassung: Wenn der User samstags typisch 60 Min lernt, nicht 360 vorschlagen
  if (context.dayPatterns && context.dayPatterns.length > 0) {
    const todayDow = (new Date().getDay() + 6) % 7; // Mon=0..Sun=6
    const todayPattern = context.dayPatterns.find((d) => d.day === todayDow);
    if (todayPattern && todayPattern.avgMinutes > 0) {
      // Blend: 60% historisch, 40% Basis-Budget (erlaubt Wachstum)
      budget = Math.round(todayPattern.avgMinutes * 0.6 + budget * 0.4);
    }
  }

  // Adherence-Anpassung: Wenn User nur 50% schafft, Budget realistischer setzen
  if (context.adherenceRatio !== undefined && context.adherenceRatio > 0 && context.adherenceRatio < 1) {
    // Formel: Budget × (adherence + (1 - adherence) × 0.3)
    // Bei 50% Adherence → Budget × 0.65 (nicht zu aggressiv kürzen)
    const adherenceFactor = context.adherenceRatio + (1 - context.adherenceRatio) * 0.3;
    budget = Math.round(budget * adherenceFactor);
  }

  // Semester-Phase-Anpassung
  if (context.semesterPhase === "exam_period") {
    budget = Math.round(budget * 1.3); // +30% in der Prüfungsphase
  } else if (context.semesterPhase === "ramp_up") {
    budget = Math.round(budget * 0.7); // -30% in der Anlaufphase
  }

  // Clamp: Minimum 60 Min, Maximum 480 Min (8h)
  return Math.max(60, Math.min(480, budget));
}

// ═══════════════════════════════════════════════════════════════
// 6. DAILY PLAN
// ═══════════════════════════════════════════════════════════════

/**
 * Erstellt den Tagesplan aus allen Modulen.
 * Konsolidiert Aktionen, wählt Fokus-Modul, generiert Alerts.
 */
export function buildDailyPlan(
  modules: ModuleIntelligence[],
  config: DecisionEngineConfig = DEFAULT_ENGINE_CONFIG,
  budgetContext?: AdaptiveBudgetContext
): DailyPlan {
  const today = new Date().toISOString().split("T")[0];

  // Nur aktive Module
  const activeModules = modules.filter(isEngineActive);

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

  // Adaptives Budget statt hartem 360-Min-Limit
  const dailyBudget = computeAdaptiveBudget(budgetContext);
  const todayActions: Action[] = [];
  let totalMinutes = 0;

  for (const action of sortedActions) {
    if (action.urgency === "now" || action.urgency === "today") {
      todayActions.push(action);
      totalMinutes += action.estimatedMinutes;
    } else if (totalMinutes < dailyBudget && action.urgency === "this_week") {
      todayActions.push(action);
      totalMinutes += action.estimatedMinutes;
    }
    if (totalMinutes >= dailyBudget) break;
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
    totalMinutes: Math.min(totalMinutes, dailyBudget),
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
      isEngineActive(module) &&
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
// ═══════════════════════════════════════════════════════════════
// 6. DNA FEEDBACK LOOP
// ═══════════════════════════════════════════════════════════════

/**
 * Passt die Engine-Konfiguration basierend auf Lern-DNA-Scores an.
 *
 * Logik:
 * - Niedrige Konsistenz → Aktivitätslücke-Gewicht steigt (früherer Alarm)
 * - Niedriger Fokus → kürzere empfohlene Sessions (via estimates)
 * - Niedrige Planung → Aufgabendringlichkeit-Gewicht steigt
 * - Niedrige Ausdauer → niedrigere Session-Dauer-Schätzungen
 * - Hohe Adaptabilität → tolerantere Schwellwerte bei Inaktivität
 *
 * Die Anpassung ist subtil (±5-15%) um Stabilität zu gewährleisten.
 */
export function applyDnaModifiers(
  baseConfig: DecisionEngineConfig,
  dna: DnaProfile,
  onboarding?: OnboardingProfile | null
): DecisionEngineConfig {
  // Kopie um Mutation zu vermeiden
  const config: DecisionEngineConfig = {
    weights: { ...baseConfig.weights },
    thresholds: { ...baseConfig.thresholds },
    estimates: { ...baseConfig.estimates },
  };

  // ── Konsistenz beeinflusst Aktivitätslücke-Gewicht ──
  // Niedrige Konsistenz → Inaktivität wiegt schwerer
  if (dna.consistencyScore < 40) {
    config.weights.activityGap = Math.round(baseConfig.weights.activityGap * 1.15);
    // Früherer Alarm bei Inaktivität
    config.thresholds.noActivityDays = Math.max(2, baseConfig.thresholds.noActivityDays - 1);
  } else if (dna.consistencyScore >= 80) {
    // Sehr konsistente Lerner brauchen weniger Aktivitäts-Nudging
    config.weights.activityGap = Math.round(baseConfig.weights.activityGap * 0.9);
  }

  // ── Fokus beeinflusst Session-Dauer-Empfehlungen ──
  if (dna.focusScore < 40) {
    // Kürzere Sessions empfehlen (eher Pomodoro-Stil)
    config.estimates.minutesPerTopic = Math.round(baseConfig.estimates.minutesPerTopic * 0.8);
    config.estimates.minutesPerExamPrep = Math.round(baseConfig.estimates.minutesPerExamPrep * 0.85);
  } else if (dna.focusScore >= 80) {
    // Starker Fokus → längere Deep-Work-Sessions sinnvoll
    config.estimates.minutesPerTopic = Math.round(baseConfig.estimates.minutesPerTopic * 1.1);
  }

  // ── Planung beeinflusst Aufgabendringlichkeit ──
  if (dna.planningScore < 40) {
    // Schlechte Planer brauchen mehr Aufgaben-Nudging
    config.weights.taskUrgency = Math.round(baseConfig.weights.taskUrgency * 1.15);
    config.thresholds.taskDueSoonDays = Math.min(5, baseConfig.thresholds.taskDueSoonDays + 1);
  }

  // ── Ausdauer beeinflusst Prüfungsvorbereitungs-Schätzung ──
  if (dna.enduranceScore < 40) {
    // Niedrige Ausdauer → mehr kurze Sessions statt Marathon-Lernen
    config.estimates.minutesPerExamPrep = Math.round(baseConfig.estimates.minutesPerExamPrep * 0.8);
  } else if (dna.enduranceScore >= 80) {
    // Hohe Ausdauer → kann längere Prep-Blöcke nutzen
    config.estimates.minutesPerExamPrep = Math.round(baseConfig.estimates.minutesPerExamPrep * 1.1);
  }

  // ── Adaptabilität beeinflusst Inaktivitätsschwelle ──
  if (dna.adaptabilityScore >= 70) {
    // Adaptive Lerner können Pausen besser kompensieren
    config.thresholds.noActivityDays = Math.min(7, baseConfig.thresholds.noActivityDays + 1);
  }

  // ══ Onboarding-basierte Modifikationen ══
  if (onboarding) {
    // ── Primary Goal beeinflusst Gewichte ──
    switch (onboarding.primaryGoal) {
      case "pass_exams":
      case "exam_prep":
        // Prüfungsfokus → Exam-Gewicht steigt, Wissenslücken wichtiger
        config.weights.examProximity = Math.round(config.weights.examProximity * 1.12);
        config.weights.knowledgeGap = Math.round(config.weights.knowledgeGap * 1.15);
        break;
      case "improve_grades":
        // Notenverbesserung → Noten-Risiko-Gewicht steigt
        config.weights.gradeRisk = Math.round(config.weights.gradeRisk * 1.15);
        break;
      case "time_management":
      case "save_time":
        // Zeitmanagement → Aufgabendringlichkeit und Aktivitätslücke wichtiger
        config.weights.taskUrgency = Math.round(config.weights.taskUrgency * 1.10);
        config.weights.activityGap = Math.round(config.weights.activityGap * 1.10);
        break;
      case "reduce_stress":
        // Stressreduktion → konservativere Schwellwerte, weniger aggressive Warnungen
        config.thresholds.examSoonDays = Math.max(baseConfig.thresholds.examSoonDays, 18);
        config.thresholds.noActivityDays = Math.min(7, baseConfig.thresholds.noActivityDays + 1);
        break;
    }

    // ── Exam Anxiety beeinflusst Prüfungsfrühwarnung ──
    if (onboarding.examAnxietyLevel >= 4) {
      // Hohe Prüfungsangst → frühere Warnung, Prüfungsgewicht etwas höher
      config.thresholds.examSoonDays = Math.max(config.thresholds.examSoonDays, 21);
      config.weights.examProximity = Math.round(config.weights.examProximity * 1.08);
    } else if (onboarding.examAnxietyLevel <= 2) {
      // Niedrige Angst → Standard-Schwelle reicht
      config.thresholds.examSoonDays = Math.min(config.thresholds.examSoonDays, 14);
    }

    // ── Focus Challenge beeinflusst Session-Schätzungen ──
    if (onboarding.focusChallenge === "easily_distracted") {
      config.estimates.minutesPerTopic = Math.min(config.estimates.minutesPerTopic, 35);
      config.estimates.minutesPerExamPrep = Math.min(config.estimates.minutesPerExamPrep, 90);
    } else if (onboarding.focusChallenge === "very_focused") {
      config.estimates.minutesPerTopic = Math.max(config.estimates.minutesPerTopic, 50);
    }
  }

  // Gewichte normalisieren (sollen sich zu ~100 addieren)
  const totalW = config.weights.examProximity + config.weights.gradeRisk +
    config.weights.taskUrgency + config.weights.activityGap + config.weights.knowledgeGap;
  const baseTotalW = baseConfig.weights.examProximity + baseConfig.weights.gradeRisk +
    baseConfig.weights.taskUrgency + baseConfig.weights.activityGap + baseConfig.weights.knowledgeGap;
  if (totalW !== baseTotalW) {
    const scale = baseTotalW / totalW;
    config.weights.examProximity = Math.round(config.weights.examProximity * scale);
    config.weights.gradeRisk = Math.round(config.weights.gradeRisk * scale);
    config.weights.taskUrgency = Math.round(config.weights.taskUrgency * scale);
    config.weights.activityGap = Math.round(config.weights.activityGap * scale);
    config.weights.knowledgeGap = Math.round(config.weights.knowledgeGap * scale);
  }

  return config;
}

// ═══════════════════════════════════════════════════════════════
// 7. COMMAND CENTER STATE
// ═══════════════════════════════════════════════════════════════

export function buildCommandCenterState(
  modules: ModuleIntelligence[],
  config: DecisionEngineConfig = DEFAULT_ENGINE_CONFIG,
  dnaProfile?: DnaProfile | null,
  onboardingProfile?: OnboardingProfile | null,
  budgetContext?: AdaptiveBudgetContext
): CommandCenterState {
  // Apply DNA + Onboarding modifiers if available → personalized engine behavior
  let effectiveConfig = dnaProfile
    ? applyDnaModifiers(config, dnaProfile, onboardingProfile)
    : { ...config, weights: { ...config.weights }, thresholds: { ...config.thresholds }, estimates: { ...config.estimates } };

  // Semester-Phase erkennen und Thresholds anpassen
  const semesterPhase = detectSemesterPhase(modules);
  if (semesterPhase === "exam_period") {
    // Prüfungsphase: Prüfungsgewicht +20%, minStudyMinutes +30%
    effectiveConfig = {
      ...effectiveConfig,
      weights: {
        ...effectiveConfig.weights,
        examProximity: Math.round(effectiveConfig.weights.examProximity * 1.2),
      },
      thresholds: {
        ...effectiveConfig.thresholds,
        minStudyMinutesPerWeek: Math.round(effectiveConfig.thresholds.minStudyMinutesPerWeek * 1.3),
      },
    };
    // Re-normalize weights
    const totalW = effectiveConfig.weights.examProximity + effectiveConfig.weights.gradeRisk +
      effectiveConfig.weights.taskUrgency + effectiveConfig.weights.activityGap + effectiveConfig.weights.knowledgeGap;
    const baseTotal = config.weights.examProximity + config.weights.gradeRisk +
      config.weights.taskUrgency + config.weights.activityGap + config.weights.knowledgeGap;
    if (totalW !== baseTotal) {
      const scale = baseTotal / totalW;
      effectiveConfig.weights = {
        examProximity: Math.round(effectiveConfig.weights.examProximity * scale),
        gradeRisk: Math.round(effectiveConfig.weights.gradeRisk * scale),
        taskUrgency: Math.round(effectiveConfig.weights.taskUrgency * scale),
        activityGap: Math.round(effectiveConfig.weights.activityGap * scale),
        knowledgeGap: Math.round(effectiveConfig.weights.knowledgeGap * scale),
      };
    }
  } else if (semesterPhase === "ramp_up") {
    // Anlaufphase: Aktivitätslücke lockerer (+3 Tage)
    effectiveConfig = {
      ...effectiveConfig,
      thresholds: {
        ...effectiveConfig.thresholds,
        noActivityDays: effectiveConfig.thresholds.noActivityDays + 3,
      },
    };
  }

  // Enrich budget context with semester phase
  const enrichedBudgetContext: AdaptiveBudgetContext = {
    ...budgetContext,
    semesterPhase,
  };

  const activeModules = modules.filter(isEngineActive);

  // 1. Risiko für jedes Modul (uses DNA-adjusted config)
  const allRisks = activeModules.map((m) => assessModuleRisk(m, effectiveConfig));
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

  // 2. Priorität für jedes Modul (uses DNA-adjusted config)
  const priorities = activeModules
    .filter((m) => riskMap.has(m.moduleId))
    .map((m) =>
      calculateModulePriority(m, riskMap.get(m.moduleId)!, effectiveConfig)
    );
  const moduleRankings = rankModules(priorities);

  // 3. Prognosen für jedes Modul
  const predictions = new Map<string, OutcomePrediction>();
  for (const module of activeModules) {
    predictions.set(module.moduleId, predictOutcome(module));
  }

  // 4. Tagesplan (uses DNA-adjusted config + adaptive budget)
  const today = buildDailyPlan(modules, effectiveConfig, enrichedBudgetContext);

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
    (m) => isEngineActive(m) && m.studyTime.daysSinceLastStudy !== null
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
