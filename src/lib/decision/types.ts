/**
 * Semetra Decision Engine — Type System
 *
 * Das Nervensystem von Semetra. Diese Typen definieren wie
 * Module, Aufgaben, Prüfungen, Zeit und Noten zu konkreten
 * Entscheidungen und Handlungen zusammenfliessen.
 */

// ─── Risk Levels ─────────────────────────────────────────────
export type RiskLevel = "critical" | "high" | "medium" | "low" | "none";
export type ActionUrgency = "now" | "today" | "this_week" | "soon" | "later";
export type TrendDirection = "improving" | "stable" | "declining" | "unknown";

// ─── Module Intelligence ─────────────────────────────────────
/** Alles was wir über ein Modul wissen, aggregiert */
export interface ModuleIntelligence {
  moduleId: string;
  moduleName: string;
  moduleCode?: string;
  ects: number;
  semester?: number;
  status: "planned" | "active" | "completed" | "paused";
  color?: string;

  // Noten & Leistung
  grades: {
    current: number | null; // aktuelle Durchschnittsnote
    target: number | null; // Zielnote vom User
    needed: number | null; // benötigte Note in nächster Prüfung
    passed: boolean | null;
    trend: TrendDirection;
    componentResults: ComponentSnapshot[];
  };

  // Prüfungen
  exams: {
    next: ExamSnapshot | null;
    daysUntilNext: number | null;
    all: ExamSnapshot[];
    totalCount: number;
    completedCount: number;
  };

  // Aufgaben
  tasks: {
    total: number;
    completed: number;
    overdue: number;
    dueSoon: number; // fällig in 3 Tagen
    completionRate: number; // 0-100
    nextDeadline: string | null; // ISO date
  };

  // Lernzeit
  studyTime: {
    totalMinutes: number;
    last7Days: number;
    last30Days: number;
    averagePerWeek: number;
    trend: TrendDirection;
    lastStudied: string | null; // ISO date
    daysSinceLastStudy: number | null;
  };

  // Wissen
  knowledge: {
    topicCount: number;
    averageLevel: number; // 0-100
    weakTopics: string[]; // Themen mit level < 40
    reviewDue: number; // Themen die Review brauchen
    flashcardsDue: number;
    totalFlashcards: number;
  };

  // Material
  resources: {
    noteCount: number;
    documentCount: number;
    mindmapCount: number;
    flashcardDecks: number;
  };
}

export interface ComponentSnapshot {
  name: string;
  type: string;
  weight: number;
  grade: number | null;
  passed: boolean | null;
}

export interface ExamSnapshot {
  id: string;
  title: string;
  date: string; // ISO date
  daysUntil: number;
  moduleId?: string;
  hasGrade: boolean;
}

// ─── Risk Assessment ─────────────────────────────────────────
export interface ModuleRisk {
  moduleId: string;
  overall: RiskLevel;
  score: number; // 0-100, höher = mehr Risiko
  factors: RiskFactor[];
}

export interface RiskFactor {
  type: RiskFactorType;
  severity: RiskLevel;
  score: number; // 0-100
  message: string;
  detail?: string;
}

export type RiskFactorType =
  | "exam_soon_no_prep" // Prüfung bald, kaum gelernt
  | "grade_below_pass" // Note unter Bestehensgrenze
  | "grade_declining" // Note wird schlechter
  | "no_recent_activity" // Lange nicht gelernt
  | "tasks_overdue" // Aufgaben überfällig
  | "low_knowledge" // Wissenslücken
  | "time_deficit" // Zu wenig Lernzeit vs Plan
  | "missing_components" // Assessment-Komponenten fehlen
  | "prerequisite_not_met" // Voraussetzungen nicht erfüllt
  | "exam_no_material"; // Prüfung ohne Lernmaterial

// ─── Priority Scoring ────────────────────────────────────────
export interface ModulePriority {
  moduleId: string;
  score: number; // 0-100, höher = dringender
  rank: number; // 1 = höchste Priorität
  reasons: PriorityReason[];
  suggestedMinutesToday: number;
}

export interface PriorityReason {
  factor: string;
  weight: number;
  contribution: number;
  description: string;
}

// ─── Outcome Prediction ──────────────────────────────────────
export interface OutcomePrediction {
  moduleId: string;
  currentTrajectory: number | null; // prognostizierte Endnote
  targetGrade: number | null;
  gapToTarget: number | null; // Differenz zum Ziel
  requiredPerformance: RequiredPerformance | null;
  passProbability: number; // 0-100%
  scenarioAnalysis: Scenario[];
}

export interface RequiredPerformance {
  nextExamGrade: number; // benötigte Note
  remainingComponentAverage: number; // Durchschnitt verbleibender Komponenten
  description: string; // "Du brauchst mindestens 4.5 in der Klausur"
}

export interface Scenario {
  name: string; // "Best Case", "Realistic", "Worst Case"
  finalGrade: number;
  passed: boolean;
  assumptions: string;
}

// ─── Concrete Actions ────────────────────────────────────────
export interface Action {
  id: string;
  moduleId: string;
  moduleName: string;
  moduleColor?: string;
  type: ActionType;
  urgency: ActionUrgency;
  title: string;
  description: string;
  estimatedMinutes: number;
  reason: string; // Warum diese Aktion wichtig ist
  impact: string; // Was passiert wenn man es tut/nicht tut
  relatedEntityId?: string;
  relatedEntityType?: "task" | "exam" | "topic" | "flashcard";
  metadata?: Record<string, unknown>;
}

export type ActionType =
  | "study_topic" // Thema lernen
  | "complete_task" // Aufgabe erledigen
  | "review_flashcards" // Karteikarten wiederholen
  | "prepare_exam" // Prüfung vorbereiten
  | "start_studying" // Überhaupt anfangen zu lernen
  | "increase_time" // Mehr Zeit investieren
  | "seek_help" // Hilfe suchen (Note kritisch)
  | "create_material" // Lernmaterial erstellen
  | "review_weak_topics" // Schwache Themen nacharbeiten
  | "submit_component"; // Assessment-Komponente abgeben

// ─── Daily Plan ──────────────────────────────────────────────
export interface DailyPlan {
  date: string; // ISO date
  totalMinutes: number;
  actions: Action[];
  focusModule: {
    id: string;
    name: string;
    color?: string;
    reason: string;
  } | null;
  alerts: Alert[];
}

export interface Alert {
  level: RiskLevel;
  title: string;
  message: string;
  moduleId?: string;
  moduleName?: string;
  actionRequired: boolean;
}

// ─── Command Center State ────────────────────────────────────
/** Alles was das Command Center Dashboard braucht */
export interface CommandCenterState {
  // Heutiger Plan
  today: DailyPlan;

  // Module nach Priorität
  moduleRankings: ModulePriority[];

  // Risiko-Übersicht
  risks: {
    critical: ModuleRisk[];
    high: ModuleRisk[];
    medium: ModuleRisk[];
    modules: Map<string, ModuleRisk>;
  };

  // Prognosen
  predictions: Map<string, OutcomePrediction>;

  // Globale Metriken
  overview: {
    totalModules: number;
    activeModules: number;
    atRiskModules: number;
    ectsEarned: number;
    ectsTarget: number;
    overallGPA: number | null;
    studyStreak: number;
    totalStudyMinutesThisWeek: number;
    tasksOverdue: number;
    examsThisWeek: ExamSnapshot[];
    examsThisMonth: ExamSnapshot[];
  };

  // Zeitstempel
  computedAt: string;
}

// ─── AI Context ──────────────────────────────────────────────
/** Kontext der an die KI übergeben wird */
export interface AIDecisionContext {
  moduleId: string;
  moduleName: string;
  currentGrade: number | null;
  targetGrade: number | null;
  riskLevel: RiskLevel;
  riskFactors: string[];
  weakTopics: string[];
  daysUntilExam: number | null;
  studyMinutesLast7Days: number;
  tasksOverdue: number;
  requiredExamGrade: number | null;
  recentActions: string[];
}

// ─── Behavior Tracking ───────────────────────────────────────
export interface StudyBehavior {
  userId: string;
  preferredStudyHours: number[]; // 0-23, wann der User typisch lernt
  averageSessionMinutes: number;
  consistencyScore: number; // 0-100, wie regelmässig
  peakProductivityDay: string; // "monday" etc.
  totalActiveDays: number;
  last30DaysPattern: DailyPattern[];
}

export interface DailyPattern {
  date: string;
  totalMinutes: number;
  modules: string[];
  sessionCount: number;
}

// ─── Lern-DNA Profile ───────────────────────────────────────
/** DNA-Scores aus learning_dna_snapshots, beeinflusst Engine-Gewichtung */
export interface DnaProfile {
  consistencyScore: number;   // 0-100
  focusScore: number;         // 0-100
  enduranceScore: number;     // 0-100
  adaptabilityScore: number;  // 0-100
  planningScore: number;      // 0-100
  overallScore: number;       // 0-100
  learnerType: string;
}

// ─── Engine Configuration ────────────────────────────────────
export interface DecisionEngineConfig {
  // Gewichtungen für Priority-Score
  weights: {
    examProximity: number; // Standard: 35
    gradeRisk: number; // Standard: 25
    taskUrgency: number; // Standard: 15
    activityGap: number; // Standard: 15
    knowledgeGap: number; // Standard: 10
  };

  // Schwellwerte
  thresholds: {
    examSoonDays: number; // Standard: 14
    noActivityDays: number; // Standard: 5
    lowKnowledgeLevel: number; // Standard: 40
    criticalGradeBuffer: number; // Standard: 0.5
    minStudyMinutesPerWeek: number; // Standard: 120
    taskDueSoonDays: number; // Standard: 3
  };

  // Schätzungen
  estimates: {
    minutesPerTopic: number; // Standard: 45
    minutesPerFlashcardDeck: number; // Standard: 20
    minutesPerExamPrep: number; // Standard: 120
  };
}

export const DEFAULT_ENGINE_CONFIG: DecisionEngineConfig = {
  weights: {
    examProximity: 35,
    gradeRisk: 25,
    taskUrgency: 15,
    activityGap: 15,
    knowledgeGap: 10,
  },
  thresholds: {
    examSoonDays: 14,
    noActivityDays: 5,
    lowKnowledgeLevel: 40,
    criticalGradeBuffer: 0.5,
    minStudyMinutesPerWeek: 120,
    taskDueSoonDays: 3,
  },
  estimates: {
    minutesPerTopic: 45,
    minutesPerFlashcardDeck: 20,
    minutesPerExamPrep: 120,
  },
};
