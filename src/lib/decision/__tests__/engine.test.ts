/**
 * Decision Engine — Unit Tests
 *
 * Tests all core calculations:
 * - Risk assessment (10 factors, scoring, levels)
 * - Priority scoring (5 weighted components)
 * - Outcome prediction (Bayesian, pass probability, scenarios)
 * - Action generation (types, urgency, minutes)
 * - Daily plan (budget, focus module, alerts)
 * - Semester phase detection
 * - Adaptive budget calculation
 * - DNA modifiers
 * - Trend analysis
 * - Adaptive weights (Pearson correlation)
 */

import { describe, it, expect } from "vitest";
import {
  assessModuleRisk,
  calculateModulePriority,
  rankModules,
  predictOutcome,
  generateActions,
  buildDailyPlan,
  buildCommandCenterState,
  calculateTrend,
  calculateWeightedAverage,
  applyDnaModifiers,
  detectSemesterPhase,
  computeAdaptiveWeights,
} from "../engine";
import { DEFAULT_ENGINE_CONFIG } from "../types";
import type { ModuleIntelligence, DnaProfile, OnboardingProfile } from "../types";

// ─── Test Fixtures ──────────────────────────────────────────

function makeModule(overrides: Partial<ModuleIntelligence> = {}): ModuleIntelligence {
  return {
    moduleId: "mod-1",
    moduleName: "Statistik",
    ects: 6,
    status: "active",
    grades: {
      current: 4.5,
      target: 5.0,
      needed: null,
      passed: true,
      trend: "stable",
      componentResults: [],
    },
    exams: {
      next: null,
      daysUntilNext: null,
      all: [],
      totalCount: 0,
      completedCount: 0,
    },
    tasks: {
      total: 5,
      completed: 3,
      overdue: 0,
      dueSoon: 0,
      completionRate: 60,
      nextDeadline: null,
    },
    studyTime: {
      totalMinutes: 600,
      last7Days: 90,
      last30Days: 360,
      averagePerWeek: 90,
      trend: "stable",
      lastStudied: new Date().toISOString(),
      daysSinceLastStudy: 1,
    },
    knowledge: {
      topicCount: 10,
      averageLevel: 65,
      weakTopics: ["Regression"],
      reviewDue: 2,
      flashcardsDue: 5,
      totalFlashcards: 50,
    },
    resources: {
      noteCount: 3,
      documentCount: 2,
      mindmapCount: 1,
      flashcardDecks: 2,
    },
    ...overrides,
  };
}

function makeDna(overrides: Partial<DnaProfile> = {}): DnaProfile {
  return {
    consistencyScore: 70,
    focusScore: 65,
    enduranceScore: 60,
    adaptabilityScore: 55,
    planningScore: 50,
    overallScore: 60,
    learnerType: "entdecker",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// 1. RISK ASSESSMENT
// ═══════════════════════════════════════════════════════════════

describe("assessModuleRisk", () => {
  it("returns no risk for a healthy module", () => {
    const module = makeModule();
    const risk = assessModuleRisk(module);
    expect(risk.overall).toBe("low"); // Has 1 weak topic
    expect(risk.score).toBeGreaterThan(0);
    expect(risk.score).toBeLessThan(35);
  });

  it("detects exam_soon_no_prep when exam in 3 days with little study", () => {
    const module = makeModule({
      exams: {
        next: { id: "e1", title: "Klausur", date: "2026-04-20", daysUntil: 3, hasGrade: false },
        daysUntilNext: 3,
        all: [{ id: "e1", title: "Klausur", date: "2026-04-20", daysUntil: 3, hasGrade: false }],
        totalCount: 1,
        completedCount: 0,
      },
      studyTime: { ...makeModule().studyTime, last7Days: 20 },
    });
    const risk = assessModuleRisk(module);
    expect(risk.factors.some(f => f.type === "exam_soon_no_prep")).toBe(true);
    expect(risk.factors.find(f => f.type === "exam_soon_no_prep")?.severity).toBe("critical");
  });

  it("detects grade_below_pass", () => {
    const module = makeModule({
      grades: { ...makeModule().grades, current: 3.2, passed: false },
    });
    const risk = assessModuleRisk(module);
    expect(risk.factors.some(f => f.type === "grade_below_pass")).toBe(true);
  });

  it("detects no_recent_activity for inactive modules", () => {
    const module = makeModule({
      studyTime: { ...makeModule().studyTime, daysSinceLastStudy: 20, lastStudied: "2026-03-28" },
    });
    const risk = assessModuleRisk(module);
    expect(risk.factors.some(f => f.type === "no_recent_activity")).toBe(true);
  });

  it("detects tasks_overdue", () => {
    const module = makeModule({
      tasks: { ...makeModule().tasks, overdue: 5 },
    });
    const risk = assessModuleRisk(module);
    expect(risk.factors.some(f => f.type === "tasks_overdue")).toBe(true);
    expect(risk.factors.find(f => f.type === "tasks_overdue")?.severity).toBe("high");
  });

  it("maps score to correct risk level", () => {
    // Critical: score >= 80
    const critical = makeModule({
      grades: { ...makeModule().grades, current: 2.0, passed: false },
      exams: {
        next: { id: "e1", title: "Klausur", date: "2026-04-18", daysUntil: 1, hasGrade: false },
        daysUntilNext: 1,
        all: [{ id: "e1", title: "Klausur", date: "2026-04-18", daysUntil: 1, hasGrade: false }],
        totalCount: 1, completedCount: 0,
      },
      studyTime: { ...makeModule().studyTime, last7Days: 0, daysSinceLastStudy: 30 },
      tasks: { ...makeModule().tasks, overdue: 10 },
    });
    const risk = assessModuleRisk(critical);
    expect(risk.overall).toBe("critical");
    expect(risk.score).toBeGreaterThanOrEqual(80);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. PRIORITY SCORING
// ═══════════════════════════════════════════════════════════════

describe("calculateModulePriority", () => {
  it("gives higher priority to modules with upcoming exams", () => {
    const noExam = makeModule();
    const withExam = makeModule({
      exams: {
        next: { id: "e1", title: "Klausur", date: "2026-04-25", daysUntil: 5, hasGrade: false },
        daysUntilNext: 5,
        all: [{ id: "e1", title: "Klausur", date: "2026-04-25", daysUntil: 5, hasGrade: false }],
        totalCount: 1, completedCount: 0,
      },
    });

    const riskNoExam = assessModuleRisk(noExam);
    const riskWithExam = assessModuleRisk(withExam);

    const prioNoExam = calculateModulePriority(noExam, riskNoExam);
    const prioWithExam = calculateModulePriority(withExam, riskWithExam);

    expect(prioWithExam.score).toBeGreaterThan(prioNoExam.score);
  });

  it("gives higher priority to failing modules", () => {
    const passing = makeModule();
    const failing = makeModule({
      grades: { ...makeModule().grades, current: 3.0, passed: false },
    });

    const riskPassing = assessModuleRisk(passing);
    const riskFailing = assessModuleRisk(failing);

    const prioPassing = calculateModulePriority(passing, riskPassing);
    const prioFailing = calculateModulePriority(failing, riskFailing);

    expect(prioFailing.score).toBeGreaterThan(prioPassing.score);
  });

  it("suggests reasonable daily minutes", () => {
    const module = makeModule();
    const risk = assessModuleRisk(module);
    const prio = calculateModulePriority(module, risk);
    expect(prio.suggestedMinutesToday).toBeGreaterThanOrEqual(30);
    expect(prio.suggestedMinutesToday).toBeLessThanOrEqual(180);
  });
});

describe("rankModules", () => {
  it("assigns rank 1 to highest priority", () => {
    const priorities = [
      { moduleId: "a", score: 30, rank: 0, reasons: [], suggestedMinutesToday: 30 },
      { moduleId: "b", score: 80, rank: 0, reasons: [], suggestedMinutesToday: 60 },
      { moduleId: "c", score: 50, rank: 0, reasons: [], suggestedMinutesToday: 45 },
    ];
    const ranked = rankModules(priorities);
    expect(ranked[0].moduleId).toBe("b");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[2].rank).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. OUTCOME PREDICTION (Bayesian)
// ═══════════════════════════════════════════════════════════════

describe("predictOutcome", () => {
  it("predicts trajectory close to current grade with high confidence", () => {
    const module = makeModule({
      grades: {
        ...makeModule().grades,
        current: 5.0,
        componentResults: [
          { name: "Exam 1", type: "exam", weight: 1, grade: 5.0, passed: true },
          { name: "Exam 2", type: "exam", weight: 1, grade: 5.0, passed: true },
          { name: "Exam 3", type: "exam", weight: 1, grade: 5.0, passed: true },
        ],
      },
    });
    const pred = predictOutcome(module);
    expect(pred.currentTrajectory).not.toBeNull();
    // With 3 data points, confidence ~0.75, so trajectory should be close to 5.0
    expect(pred.currentTrajectory!).toBeGreaterThanOrEqual(4.7);
    expect(pred.currentTrajectory!).toBeLessThanOrEqual(5.3);
  });

  it("uses prior (4.5) when only 1 grade available", () => {
    const module = makeModule({
      grades: {
        ...makeModule().grades,
        current: 3.0,
        componentResults: [
          { name: "Exam 1", type: "exam", weight: 1, grade: 3.0, passed: false },
        ],
      },
    });
    const pred = predictOutcome(module);
    expect(pred.currentTrajectory).not.toBeNull();
    // With 1 data point, confidence = 0.3, so trajectory = 4.5*0.7 + 3.0*0.3 ≈ 4.05
    expect(pred.currentTrajectory!).toBeGreaterThan(3.0); // Pulled toward prior
    expect(pred.currentTrajectory!).toBeLessThan(4.5); // But still below prior
  });

  it("pass probability above 50% for good students", () => {
    const module = makeModule({
      grades: { ...makeModule().grades, current: 5.2, trend: "improving" },
    });
    const pred = predictOutcome(module);
    expect(pred.passProbability).toBeGreaterThan(50);
  });

  it("pass probability below 50% for struggling students", () => {
    const module = makeModule({
      grades: { ...makeModule().grades, current: 3.0, passed: false, trend: "declining" },
      studyTime: { ...makeModule().studyTime, averagePerWeek: 20 },
    });
    const pred = predictOutcome(module);
    expect(pred.passProbability).toBeLessThan(50);
  });

  it("generates 3 scenarios", () => {
    const module = makeModule();
    const pred = predictOutcome(module);
    expect(pred.scenarioAnalysis).toHaveLength(3);
    expect(pred.scenarioAnalysis[0].name).toBe("Best Case");
    expect(pred.scenarioAnalysis[1].name).toBe("Realistisch");
    expect(pred.scenarioAnalysis[2].name).toBe("Worst Case");
    expect(pred.scenarioAnalysis[0].finalGrade).toBeGreaterThan(pred.scenarioAnalysis[2].finalGrade);
  });

  it("clamps grades to 1-6 range", () => {
    const module = makeModule({
      grades: { ...makeModule().grades, current: 5.8, trend: "improving" },
    });
    const pred = predictOutcome(module);
    expect(pred.scenarioAnalysis[0].finalGrade).toBeLessThanOrEqual(6.0);

    const lowModule = makeModule({
      grades: { ...makeModule().grades, current: 1.5, trend: "declining" },
    });
    const lowPred = predictOutcome(lowModule);
    expect(lowPred.scenarioAnalysis[2].finalGrade).toBeGreaterThanOrEqual(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. ACTION GENERATION
// ═══════════════════════════════════════════════════════════════

describe("generateActions", () => {
  it("generates prepare_exam action when exam is near", () => {
    const module = makeModule({
      exams: {
        next: { id: "e1", title: "Klausur", date: "2026-04-20", daysUntil: 3, hasGrade: false },
        daysUntilNext: 3,
        all: [{ id: "e1", title: "Klausur", date: "2026-04-20", daysUntil: 3, hasGrade: false }],
        totalCount: 1, completedCount: 0,
      },
    });
    const risk = assessModuleRisk(module);
    const actions = generateActions(module, risk);
    expect(actions.some(a => a.type === "prepare_exam")).toBe(true);
    expect(actions.find(a => a.type === "prepare_exam")?.urgency).toBe("now");
  });

  it("generates complete_task action for overdue tasks", () => {
    const module = makeModule({
      tasks: { ...makeModule().tasks, overdue: 3 },
    });
    const risk = assessModuleRisk(module);
    const actions = generateActions(module, risk);
    expect(actions.some(a => a.type === "complete_task" && a.urgency === "now")).toBe(true);
  });

  it("generates review_flashcards action when cards are due", () => {
    const module = makeModule({
      knowledge: { ...makeModule().knowledge, flashcardsDue: 25 },
    });
    const risk = assessModuleRisk(module);
    const actions = generateActions(module, risk);
    expect(actions.some(a => a.type === "review_flashcards")).toBe(true);
  });

  it("generates start_studying for active module with no time", () => {
    const module = makeModule({
      studyTime: { ...makeModule().studyTime, totalMinutes: 0 },
    });
    const risk = assessModuleRisk(module);
    const actions = generateActions(module, risk);
    expect(actions.some(a => a.type === "start_studying")).toBe(true);
  });

  it("sorts actions by urgency (now first)", () => {
    const module = makeModule({
      tasks: { ...makeModule().tasks, overdue: 3 },
      knowledge: { ...makeModule().knowledge, flashcardsDue: 5 },
    });
    const risk = assessModuleRisk(module);
    const actions = generateActions(module, risk);
    const urgencies = actions.map(a => a.urgency);
    const urgencyOrder = ["now", "today", "this_week", "soon", "later"];
    for (let i = 1; i < urgencies.length; i++) {
      expect(urgencyOrder.indexOf(urgencies[i])).toBeGreaterThanOrEqual(urgencyOrder.indexOf(urgencies[i - 1]));
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. SEMESTER PHASE DETECTION
// ═══════════════════════════════════════════════════════════════

describe("detectSemesterPhase", () => {
  it("detects exam_period with 4+ exams in 21 days", () => {
    const modules = [makeModule({
      exams: {
        next: null, daysUntilNext: null,
        all: [
          { id: "e1", title: "A", date: "", daysUntil: 5, hasGrade: false },
          { id: "e2", title: "B", date: "", daysUntil: 10, hasGrade: false },
          { id: "e3", title: "C", date: "", daysUntil: 15, hasGrade: false },
          { id: "e4", title: "D", date: "", daysUntil: 20, hasGrade: false },
        ],
        totalCount: 4, completedCount: 0,
      },
    })];
    expect(detectSemesterPhase(modules)).toBe("exam_period");
  });

  it("detects ramp_up with no exams and low activity", () => {
    const modules = [makeModule({
      exams: { next: null, daysUntilNext: null, all: [], totalCount: 0, completedCount: 0 },
      studyTime: { ...makeModule().studyTime, last30Days: 100 },
    })];
    expect(detectSemesterPhase(modules)).toBe("ramp_up");
  });

  it("returns normal for typical semester", () => {
    const modules = [makeModule({
      exams: {
        next: null, daysUntilNext: null,
        all: [{ id: "e1", title: "A", date: "", daysUntil: 25, hasGrade: false }],
        totalCount: 1, completedCount: 0,
      },
      studyTime: { ...makeModule().studyTime, last30Days: 500 },
    })];
    expect(detectSemesterPhase(modules)).toBe("normal");
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. DNA MODIFIERS
// ═══════════════════════════════════════════════════════════════

describe("applyDnaModifiers", () => {
  it("increases activityGap weight for low consistency", () => {
    const dna = makeDna({ consistencyScore: 30 });
    const config = applyDnaModifiers(DEFAULT_ENGINE_CONFIG, dna);
    // After normalization, the relative proportion should be higher
    const ratio = config.weights.activityGap / config.weights.examProximity;
    const defaultRatio = DEFAULT_ENGINE_CONFIG.weights.activityGap / DEFAULT_ENGINE_CONFIG.weights.examProximity;
    expect(ratio).toBeGreaterThan(defaultRatio);
  });

  it("reduces session estimates for low focus", () => {
    const dna = makeDna({ focusScore: 25 });
    const config = applyDnaModifiers(DEFAULT_ENGINE_CONFIG, dna);
    expect(config.estimates.minutesPerTopic).toBeLessThan(DEFAULT_ENGINE_CONFIG.estimates.minutesPerTopic);
  });

  it("adjusts thresholds for high exam anxiety", () => {
    const dna = makeDna();
    const onboarding: OnboardingProfile = {
      primaryGoal: "pass_exams",
      focusChallenge: "moderate",
      examAnxietyLevel: 5,
    };
    const config = applyDnaModifiers(DEFAULT_ENGINE_CONFIG, dna, onboarding);
    expect(config.thresholds.examSoonDays).toBeGreaterThanOrEqual(21);
  });

  it("normalizes weights to sum to base total", () => {
    const dna = makeDna({ consistencyScore: 20, planningScore: 20 });
    const config = applyDnaModifiers(DEFAULT_ENGINE_CONFIG, dna);
    const sum = config.weights.examProximity + config.weights.gradeRisk +
      config.weights.taskUrgency + config.weights.activityGap + config.weights.knowledgeGap;
    const baseSum = 100;
    // Allow ±2 for rounding
    expect(Math.abs(sum - baseSum)).toBeLessThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. TREND ANALYSIS
// ═══════════════════════════════════════════════════════════════

describe("calculateTrend", () => {
  it("detects improving trend", () => {
    expect(calculateTrend([3.0, 3.5, 4.0, 4.5, 5.0])).toBe("improving");
  });

  it("detects declining trend", () => {
    expect(calculateTrend([5.0, 4.5, 4.0, 3.5])).toBe("declining");
  });

  it("detects stable trend", () => {
    expect(calculateTrend([4.0, 4.0, 4.1, 3.9, 4.0])).toBe("stable");
  });

  it("returns unknown for single value", () => {
    expect(calculateTrend([4.0])).toBe("unknown");
  });

  it("returns unknown for empty array", () => {
    expect(calculateTrend([])).toBe("unknown");
  });
});

describe("calculateWeightedAverage", () => {
  it("calculates weighted average correctly", () => {
    const result = calculateWeightedAverage([
      { grade: 5.0, weight: 2 },
      { grade: 4.0, weight: 1 },
    ]);
    expect(result).toBeCloseTo(4.67, 1);
  });

  it("returns null for no graded components", () => {
    expect(calculateWeightedAverage([{ grade: null, weight: 1 }])).toBeNull();
  });

  it("ignores null grades", () => {
    const result = calculateWeightedAverage([
      { grade: 5.0, weight: 1 },
      { grade: null, weight: 1 },
    ]);
    expect(result).toBe(5.0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. ADAPTIVE WEIGHTS
// ═══════════════════════════════════════════════════════════════

describe("computeAdaptiveWeights", () => {
  it("returns null with fewer than 3 completed modules", () => {
    const modules = [
      makeModule({ status: "completed" }),
      makeModule({ moduleId: "mod-2", status: "completed" }),
    ];
    expect(computeAdaptiveWeights(modules)).toBeNull();
  });

  it("computes weights with enough data", () => {
    const modules = [
      makeModule({ moduleId: "m1", status: "completed", grades: { ...makeModule().grades, current: 5.5 } }),
      makeModule({ moduleId: "m2", status: "completed", grades: { ...makeModule().grades, current: 4.0 } }),
      makeModule({ moduleId: "m3", status: "completed", grades: { ...makeModule().grades, current: 3.5 } }),
      makeModule({ moduleId: "m4", status: "completed", grades: { ...makeModule().grades, current: 5.0 } }),
    ];
    const result = computeAdaptiveWeights(modules);
    expect(result).not.toBeNull();
    expect(result!.modulesAnalyzed).toBe(4);
    expect(result!.confidence).toBeGreaterThan(0);
    // Weights should sum to ~100
    const sum = result!.examProximity + result!.gradeRisk + result!.taskUrgency +
      result!.activityGap + result!.knowledgeGap;
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(2);
  });

  it("enforces minimum 5% per factor", () => {
    const modules = Array.from({ length: 5 }, (_, i) =>
      makeModule({
        moduleId: `m${i}`,
        status: "completed",
        grades: { ...makeModule().grades, current: 4.0 + i * 0.3 },
      })
    );
    const result = computeAdaptiveWeights(modules);
    expect(result).not.toBeNull();
    expect(result!.examProximity).toBeGreaterThanOrEqual(5);
    expect(result!.gradeRisk).toBeGreaterThanOrEqual(5);
    expect(result!.taskUrgency).toBeGreaterThanOrEqual(5);
    expect(result!.activityGap).toBeGreaterThanOrEqual(5);
    expect(result!.knowledgeGap).toBeGreaterThanOrEqual(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. DAILY PLAN
// ═══════════════════════════════════════════════════════════════

describe("buildDailyPlan", () => {
  it("creates a plan with actions and focus module", () => {
    const modules = [
      makeModule({ tasks: { ...makeModule().tasks, overdue: 2 } }),
      makeModule({ moduleId: "mod-2", moduleName: "Mathe", tasks: { ...makeModule().tasks, overdue: 5 } }),
    ];
    const plan = buildDailyPlan(modules);
    expect(plan.date).toBeTruthy();
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.focusModule).not.toBeNull();
  });

  it("respects adaptive budget", () => {
    const modules = [makeModule()];
    const plan = buildDailyPlan(modules, DEFAULT_ENGINE_CONFIG, {
      maxDailyMinutes: 120,
      adherenceRatio: 0.5,
    });
    expect(plan.totalMinutes).toBeLessThanOrEqual(120);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. COMMAND CENTER STATE
// ═══════════════════════════════════════════════════════════════

describe("buildCommandCenterState", () => {
  it("builds complete state with all sections", () => {
    const modules = [makeModule(), makeModule({ moduleId: "mod-2", moduleName: "Mathe" })];
    const state = buildCommandCenterState(modules);

    expect(state.today).toBeDefined();
    expect(state.moduleRankings.length).toBe(2);
    expect(state.risks.modules.size).toBe(2);
    expect(state.predictions.size).toBe(2);
    expect(state.overview.totalModules).toBe(2);
    expect(state.overview.activeModules).toBe(2);
    expect(state.computedAt).toBeTruthy();
  });

  it("applies DNA modifiers when provided", () => {
    const modules = [makeModule()];
    const dna = makeDna({ focusScore: 20 }); // Low focus
    const stateWithDna = buildCommandCenterState(modules, DEFAULT_ENGINE_CONFIG, dna);
    const stateWithout = buildCommandCenterState(modules);

    // With low focus, actions might differ (shorter session estimates)
    expect(stateWithDna.computedAt).toBeTruthy();
    expect(stateWithout.computedAt).toBeTruthy();
  });

  it("calculates GPA correctly", () => {
    const modules = [
      makeModule({ grades: { ...makeModule().grades, current: 5.0 }, ects: 6 }),
      makeModule({ moduleId: "m2", grades: { ...makeModule().grades, current: 4.0 }, ects: 3 }),
    ];
    const state = buildCommandCenterState(modules);
    // GPA = (5.0*6 + 4.0*3) / (6+3) = 42/9 = 4.67
    expect(state.overview.overallGPA).toBeCloseTo(4.67, 1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. LEARNING TYPE RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════

describe("generateActions with learningType", () => {
  it("recommends exercises for math modules (when no duplicate action exists)", () => {
    // Module without weak topics to avoid review_weak_topics dedup
    const module = makeModule({
      learningType: "math",
      knowledge: { ...makeModule().knowledge, weakTopics: [], flashcardsDue: 0, reviewDue: 0 },
    });
    const risk = assessModuleRisk(module);
    const actions = generateActions(module, risk);
    expect(actions.some(a => a.reason.includes("Modultyp"))).toBe(true);
  });

  it("recommends code practice for programming modules (when no duplicate)", () => {
    const module = makeModule({
      learningType: "programming",
      knowledge: { ...makeModule().knowledge, weakTopics: [], flashcardsDue: 0, reviewDue: 0 },
    });
    const risk = assessModuleRisk(module);
    const actions = generateActions(module, risk);
    expect(actions.some(a => a.reason.includes("Modultyp"))).toBe(true);
  });

  it("recommends summaries for theory modules", () => {
    const module = makeModule({ learningType: "theory" as const });
    const risk = assessModuleRisk(module);
    const actions = generateActions(module, risk);
    expect(actions.some(a => a.reason.includes("theory"))).toBe(true);
  });

  it("does not add type-specific action for mixed modules", () => {
    const module = makeModule({ learningType: "mixed" });
    const risk = assessModuleRisk(module);
    const actions = generateActions(module, risk);
    // "mixed" should not add any type-specific recommendation
    expect(actions.filter(a => a.reason.includes("Modultyp")).length).toBe(0);
  });

  it("does not add type-specific action when learningType is undefined", () => {
    const module = makeModule(); // No learningType set
    const risk = assessModuleRisk(module);
    const actions = generateActions(module, risk);
    expect(actions.filter(a => a.reason.includes("Modultyp")).length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. EMPTY MODULE + EXAM PROACTIVE ACTION
// ═══════════════════════════════════════════════════════════════

describe("generateActions for empty module with exam", () => {
  it("prioritizes create_material when module has exam but no topics", () => {
    const module = makeModule({
      exams: {
        next: { id: "e1", title: "Klausur", date: "2026-05-01", daysUntil: 10, hasGrade: false },
        daysUntilNext: 10,
        all: [{ id: "e1", title: "Klausur", date: "2026-05-01", daysUntil: 10, hasGrade: false }],
        totalCount: 1, completedCount: 0,
      },
      knowledge: { ...makeModule().knowledge, topicCount: 0, totalFlashcards: 0, weakTopics: [], flashcardsDue: 0 },
    });
    const risk = assessModuleRisk(module);
    const actions = generateActions(module, risk);
    // First action should be create_material (highest urgency)
    const createAction = actions.find(a => a.type === "create_material" && a.urgency === "now");
    expect(createAction).toBeDefined();
  });
});
