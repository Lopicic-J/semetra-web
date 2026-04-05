/**
 * Comprehensive E2E tests for Semetra Academic Engine
 *
 * Tests all calculation functions with realistic international grade scales:
 * - Swiss (CH_1_6): 1-6 scale, higher is better, pass at 4.0
 * - German (DE_1_5): 1-5 scale, lower is better, pass at 4.0
 * - UK (UK_PERCENTAGE): 0-100 percentage, higher is better, pass at 40
 * - Italian (IT_18_30_LODE): 18-30 scale, higher is better, with honours
 */

import { describe, it, expect } from "vitest";
import type {
  GradeScale,
  GradeBand,
  PassPolicy,
  RoundingPolicy,
  RetakePolicy,
  AssessmentComponent,
  ComponentResult,
  Attempt,
  CreditScheme,
  ClassificationScheme,
  GPAScheme,
  ModulePrerequisite,
  ProgramCompletionPolicy,
} from "../types";
import {
  applyRounding,
  isPassingGrade,
  compareGrades,
  normalizeGrade,
  convertGrade,
  convertViaBayerischeFormel,
  calculateModuleGrade,
  evaluatePassPolicy,
  resolveEffectiveAttempt,
  calculateGPA,
  classifyDegree,
  checkPrerequisites,
  evaluateCompletionPolicy,
} from "../engine";

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA: INTERNATIONAL GRADE SCALES
// ═══════════════════════════════════════════════════════════════════════════════

const chGradeScale: GradeScale = {
  id: "scale-ch-1-6",
  code: "CH_1_6",
  name: "Swiss 1-6 Scale",
  countryCode: "CH",
  type: "numeric",
  minValue: 1.0,
  maxValue: 6.0,
  passValue: 4.0,
  stepSize: 0.1,
  decimalPlaces: 1,
  higherIsBetter: true,
  supportsHonours: false,
  specialLabels: {},
  isActive: true,
  metadata: {},
};

const deGradeScale: GradeScale = {
  id: "scale-de-1-5",
  code: "DE_1_5",
  name: "German 1-5 Scale",
  countryCode: "DE",
  type: "numeric_reverse_quality",
  minValue: 1.0,
  maxValue: 5.0,
  passValue: 4.0,
  stepSize: 0.1,
  decimalPlaces: 1,
  higherIsBetter: false,
  supportsHonours: false,
  specialLabels: { "1.0": "Sehr gut", "4.0": "Ausreichend", "5.0": "Nicht bestanden" },
  isActive: true,
  metadata: {},
};

const ukGradeScale: GradeScale = {
  id: "scale-uk-percentage",
  code: "UK_PERCENTAGE",
  name: "UK Percentage Scale",
  countryCode: "GB",
  type: "percentage",
  minValue: 0,
  maxValue: 100,
  passValue: 40,
  stepSize: 1,
  decimalPlaces: 0,
  higherIsBetter: true,
  supportsHonours: true,
  specialLabels: { "70": "First Class", "60": "Upper Second", "50": "Lower Second" },
  isActive: true,
  metadata: {},
};

const itGradeScale: GradeScale = {
  id: "scale-it-18-30",
  code: "IT_18_30_LODE",
  name: "Italian 18-30 Scale with Honours",
  countryCode: "IT",
  type: "numeric_with_honours",
  minValue: 0,
  maxValue: 30,
  passValue: 18,
  stepSize: 1,
  decimalPlaces: 0,
  higherIsBetter: true,
  supportsHonours: true,
  specialLabels: { "30": "30 e lode" },
  isActive: true,
  metadata: {},
};

// Test bands for UK honours classification
const ukBands: GradeBand[] = [
  { id: "band-1", gradeScaleId: "scale-uk-percentage", fromValue: 70, toValue: 100, label: "First Class", shortLabel: "1st", isPassing: true, honourLevel: "first", sortOrder: 1 },
  { id: "band-2", gradeScaleId: "scale-uk-percentage", fromValue: 60, toValue: 69, label: "Upper Second", shortLabel: "2:1", isPassing: true, honourLevel: "upper_second", sortOrder: 2 },
  { id: "band-3", gradeScaleId: "scale-uk-percentage", fromValue: 50, toValue: 59, label: "Lower Second", shortLabel: "2:2", isPassing: true, honourLevel: "lower_second", sortOrder: 3 },
  { id: "band-4", gradeScaleId: "scale-uk-percentage", fromValue: 40, toValue: 49, label: "Third Class", shortLabel: "3rd", isPassing: true, honourLevel: "third", sortOrder: 4 },
  { id: "band-5", gradeScaleId: "scale-uk-percentage", fromValue: 0, toValue: 39, label: "Fail", shortLabel: "Fail", isPassing: false, sortOrder: 5 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA: POLICIES
// ═══════════════════════════════════════════════════════════════════════════════

const roundingNormal: RoundingPolicy = {
  id: "rounding-normal",
  code: "NORMAL",
  name: "Normal Rounding",
  roundTo: 0.1,
  method: "normal",
  applyTo: "final_grade",
  isActive: true,
  metadata: {},
};

const roundingBankers: RoundingPolicy = {
  id: "rounding-bankers",
  code: "BANKERS",
  name: "Bankers Rounding",
  roundTo: 0.5,
  method: "bankers",
  applyTo: "final_grade",
  isActive: true,
  metadata: {},
};

const passOverallThreshold: PassPolicy = {
  id: "policy-pass-threshold",
  code: "OVERALL_THRESHOLD",
  name: "Overall Threshold Pass Policy",
  policyType: "overall_threshold",
  overallPassThreshold: 40,
  allowCompensation: false,
  requiresAllMandatory: false,
  partialCreditAllowed: false,
  rulesJson: {},
  isActive: true,
  metadata: {},
};

const passMandatoryComponents: PassPolicy = {
  id: "policy-pass-mandatory",
  code: "MANDATORY_COMPONENTS",
  name: "All Mandatory Components Pass Policy",
  policyType: "all_mandatory_components",
  overallPassThreshold: null,
  allowCompensation: false,
  requiresAllMandatory: true,
  partialCreditAllowed: false,
  rulesJson: {},
  isActive: true,
  metadata: {},
};

const retakeBestAttempt: RetakePolicy = {
  id: "retake-best",
  code: "BEST_ATTEMPT",
  name: "Best Attempt Policy",
  maxAttempts: 3,
  retakeIfPassed: false,
  gradeReplacement: "best_attempt",
  resitAllowed: true,
  resitSameTerm: false,
  cooldownDays: 30,
  notes: undefined,
  isActive: true,
  metadata: {},
};

const retakeLatest: RetakePolicy = {
  id: "retake-latest",
  code: "LATEST_ATTEMPT",
  name: "Latest Attempt Policy",
  maxAttempts: 3,
  retakeIfPassed: true,
  gradeReplacement: "latest_attempt",
  resitAllowed: true,
  resitSameTerm: true,
  cooldownDays: 0,
  notes: undefined,
  isActive: true,
  metadata: {},
};

const creditSchemeEcts: CreditScheme = {
  id: "credit-ects",
  code: "ECTS",
  name: "European Credit Transfer and Accumulation System",
  unitsPerFullTimeYear: 60,
  conversionToEcts: 1.0,
  notes: undefined,
  isActive: true,
  metadata: {},
};

const gpaSchemeWeightedByCredits: GPAScheme = {
  id: "gpa-weighted-credits",
  code: "WEIGHTED_BY_CREDITS",
  name: "GPA Weighted by Credits",
  calculationType: "weighted_by_credits",
  includesFailed: false,
  includesRepeats: false,
  dropLowestAllowed: false,
  calculationScope: "passed_modules_only",
  isActive: true,
  metadata: {},
};

const ukClassificationScheme: ClassificationScheme = {
  id: "classification-uk",
  code: "UK_HONOURS",
  name: "UK Honours Classification",
  countryCode: "GB",
  schemeType: "honours",
  rules: [
    { min: 70, label: "First Class Honours", short: "1st" },
    { min: 60, label: "Upper Second Class Honours", short: "2:1" },
    { min: 50, label: "Lower Second Class Honours", short: "2:2" },
    { min: 40, label: "Third Class Honours", short: "3rd" },
    { min: 0, label: "Fail", short: "Fail" },
  ],
  isActive: true,
  metadata: {},
};

const completionPolicyStandard: ProgramCompletionPolicy = {
  id: "completion-standard",
  programId: "program-bachelor",
  minTotalCredits: 180,
  minGpa: 60,
  maxFailedModules: 3,
  maxDurationTerms: 8,
  thesisMinGrade: 40,
  internshipRequired: false,
  languageRequirement: undefined,
  additionalRulesJson: {},
  notes: undefined,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ROUNDING ENGINE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Rounding Engine", () => {
  it("should apply normal rounding", () => {
    const policy = { ...roundingNormal, roundTo: 0.5 };
    expect(applyRounding(3.24, policy)).toBe(3.0);
    expect(applyRounding(3.26, policy)).toBe(3.5);
    expect(applyRounding(3.75, policy)).toBe(4.0); // 3.75 / 0.5 = 7.5 → rounds up to 8 → 4.0
    expect(applyRounding(4.0, policy)).toBe(4.0);
  });

  it("should apply floor rounding", () => {
    const policy = { ...roundingNormal, method: "floor" as const, roundTo: 0.5 };
    expect(applyRounding(3.6, policy)).toBe(3.5);
    expect(applyRounding(3.99, policy)).toBe(3.5);
    expect(applyRounding(4.0, policy)).toBe(4.0);
  });

  it("should apply ceil rounding", () => {
    const policy = { ...roundingNormal, method: "ceil" as const, roundTo: 0.5 };
    expect(applyRounding(3.1, policy)).toBe(3.5);
    expect(applyRounding(3.5, policy)).toBe(3.5);
    expect(applyRounding(3.51, policy)).toBe(4.0);
  });

  it("should apply bankers rounding (round half to even)", () => {
    const policy = { ...roundingBankers };
    expect(applyRounding(3.25, policy)).toBe(3.0); // Half to even (2 is even)
    expect(applyRounding(3.75, policy)).toBe(4.0); // Half to even (4 is even)
    expect(applyRounding(3.5, policy)).toBe(3.5); // 3.5 / 0.5 = 7.0 → already on grid, no rounding needed
  });

  it("should handle roundTo of 0 or less", () => {
    const policy = { ...roundingNormal, roundTo: 0 };
    expect(applyRounding(3.14159, policy)).toBe(3.14159);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. GRADE VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Grade Validation", () => {
  describe("isPassingGrade", () => {
    it("should recognize passing Swiss grades (higher is better)", () => {
      expect(isPassingGrade(4.0, chGradeScale)).toBe(true);
      expect(isPassingGrade(5.0, chGradeScale)).toBe(true);
      expect(isPassingGrade(6.0, chGradeScale)).toBe(true);
      expect(isPassingGrade(3.9, chGradeScale)).toBe(false);
      expect(isPassingGrade(1.0, chGradeScale)).toBe(false);
    });

    it("should recognize passing German grades (lower is better)", () => {
      expect(isPassingGrade(4.0, deGradeScale)).toBe(true);
      expect(isPassingGrade(3.0, deGradeScale)).toBe(true);
      expect(isPassingGrade(1.0, deGradeScale)).toBe(true);
      expect(isPassingGrade(4.1, deGradeScale)).toBe(false);
      expect(isPassingGrade(5.0, deGradeScale)).toBe(false);
    });

    it("should recognize passing UK percentage grades", () => {
      expect(isPassingGrade(40, ukGradeScale)).toBe(true);
      expect(isPassingGrade(75, ukGradeScale)).toBe(true);
      expect(isPassingGrade(100, ukGradeScale)).toBe(true);
      expect(isPassingGrade(39, ukGradeScale)).toBe(false);
      expect(isPassingGrade(0, ukGradeScale)).toBe(false);
    });

    it("should recognize passing Italian grades", () => {
      expect(isPassingGrade(18, itGradeScale)).toBe(true);
      expect(isPassingGrade(30, itGradeScale)).toBe(true);
      expect(isPassingGrade(25, itGradeScale)).toBe(true);
      expect(isPassingGrade(17, itGradeScale)).toBe(false);
      expect(isPassingGrade(0, itGradeScale)).toBe(false);
    });
  });

  describe("compareGrades", () => {
    it("should compare Swiss grades correctly (higher is better)", () => {
      expect(compareGrades(5.0, 4.0, chGradeScale)).toBeGreaterThan(0);
      expect(compareGrades(4.0, 5.0, chGradeScale)).toBeLessThan(0);
      expect(compareGrades(4.5, 4.5, chGradeScale)).toBe(0);
    });

    it("should compare German grades correctly (lower is better)", () => {
      expect(compareGrades(3.0, 4.0, deGradeScale)).toBeGreaterThan(0);
      expect(compareGrades(4.0, 3.0, deGradeScale)).toBeLessThan(0);
      expect(compareGrades(3.5, 3.5, deGradeScale)).toBe(0);
    });

    it("should compare UK percentage grades correctly (higher is better)", () => {
      expect(compareGrades(75, 65, ukGradeScale)).toBeGreaterThan(0);
      expect(compareGrades(50, 60, ukGradeScale)).toBeLessThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. NORMALIZATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Normalization Engine", () => {
  it("should normalize Swiss grades to 0-100 scale", () => {
    const result = normalizeGrade(4.0, chGradeScale);
    expect(result.localGradeValue).toBe(4.0);
    expect(result.normalizedScore0to100).toBeGreaterThan(0);
    expect(result.normalizedScore0to100).toBeLessThanOrEqual(100);
    // 4.0 on 1-6 scale: (4-1)/(6-1)*100 = 60
    expect(result.normalizedScore0to100).toBe(60);
  });

  it("should normalize German grades with inverse mapping", () => {
    const result = normalizeGrade(4.0, deGradeScale);
    expect(result.localGradeValue).toBe(4.0);
    // German: lower is better, so 4.0 on 1-5 scale: (5-4)/(5-1)*100 = 25
    expect(result.normalizedScore0to100).toBe(25);
  });

  it("should normalize UK percentage grades linearly", () => {
    const result = normalizeGrade(50, ukGradeScale);
    expect(result.normalizedScore0to100).toBe(50);

    const resultHigh = normalizeGrade(80, ukGradeScale);
    expect(resultHigh.normalizedScore0to100).toBe(80);
  });

  it("should clamp normalized grades to 0-100", () => {
    const resultBelowMin = normalizeGrade(0.5, chGradeScale);
    expect(resultBelowMin.normalizedScore0to100).toBeGreaterThanOrEqual(0);

    const resultAboveMax = normalizeGrade(6.5, chGradeScale);
    expect(resultAboveMax.normalizedScore0to100).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. GRADE CONVERSION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Grade Conversion", () => {
  it("should convert Swiss to German grades", () => {
    const result = convertGrade(4.0, chGradeScale, deGradeScale);
    expect(result.grade).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should convert UK percentage to Swiss grades", () => {
    const result = convertGrade(70, ukGradeScale, chGradeScale);
    expect(result.grade).toBeGreaterThanOrEqual(chGradeScale.minValue);
    expect(result.grade).toBeLessThanOrEqual(chGradeScale.maxValue);
  });

  it("should convert same scale with high confidence", () => {
    const result = convertGrade(4.5, chGradeScale, chGradeScale);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("should convert Italian to UK grades", () => {
    const result = convertGrade(24, itGradeScale, ukGradeScale);
    expect(result.grade).toBeGreaterThanOrEqual(0);
    expect(result.grade).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. BAYERISCHE FORMEL TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Bayerische Formel Conversion", () => {
  it("should convert UK grades via Bayerische Formel", () => {
    const result = convertViaBayerischeFormel(70, ukGradeScale);
    expect(result.germanGrade).toBeGreaterThanOrEqual(1.0);
    expect(result.germanGrade).toBeLessThanOrEqual(5.0);
    expect(result.method).toBe("modifizierte_bayerische_formel");
  });

  it("should handle German scale directly without conversion", () => {
    const result = convertViaBayerischeFormel(3.5, deGradeScale);
    expect(result.germanGrade).toBe(3.5);
    expect(result.confidence).toBe(0.95);
    expect(result.method).toBe("direct_compatible_scale");
  });

  it("should convert Italian grade via Bayerische Formel", () => {
    const result = convertViaBayerischeFormel(24, itGradeScale);
    expect(result.germanGrade).toBeGreaterThanOrEqual(1.0);
    expect(result.germanGrade).toBeLessThanOrEqual(5.0);
  });

  it("should clamp result to valid German range", () => {
    const result = convertViaBayerischeFormel(100, ukGradeScale);
    expect(result.germanGrade).toBeLessThanOrEqual(5.0);

    const resultLow = convertViaBayerischeFormel(0, ukGradeScale);
    expect(resultLow.germanGrade).toBeGreaterThanOrEqual(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. MODULE GRADE CALCULATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Module Grade Calculation", () => {
  const components: AssessmentComponent[] = [
    {
      id: "comp-1",
      moduleId: "module-1",
      name: "Written Exam",
      componentType: "written_exam",
      weightPercent: 60,
      mandatoryToPass: true,
      contributesToFinal: true,
      minPassRequired: true,
      sequenceOrder: 1,
    },
    {
      id: "comp-2",
      moduleId: "module-1",
      name: "Project Work",
      componentType: "project",
      weightPercent: 40,
      mandatoryToPass: false,
      contributesToFinal: true,
      minPassRequired: false,
      sequenceOrder: 2,
    },
  ];

  it("should calculate weighted module grade", () => {
    const results: ComponentResult[] = [
      {
        id: "result-1",
        attemptId: "attempt-1",
        componentId: "comp-1",
        rawScore: 45,
        gradeValue: 4.5,
        gradeLabel: "Good",
        passed: true,
        weightApplied: 0.6,
      },
      {
        id: "result-2",
        attemptId: "attempt-1",
        componentId: "comp-2",
        rawScore: 42,
        gradeValue: 4.2,
        gradeLabel: "Good",
        passed: true,
        weightApplied: 0.4,
      },
    ];

    const result = calculateModuleGrade(components, results, chGradeScale, roundingNormal);
    expect(result.finalGrade).toBeDefined();
    // 4.5*0.6 + 4.2*0.4 = 2.7 + 1.68 = 4.38
    expect(result.finalGrade).toBeCloseTo(4.38, 1);
    expect(result.passed).toBe(true);
    expect(result.allMandatoryPassed).toBe(true);
    expect(result.missingMandatory.length).toBe(0);
  });

  it("should fail if mandatory component fails", () => {
    const results: ComponentResult[] = [
      {
        id: "result-1",
        attemptId: "attempt-1",
        componentId: "comp-1",
        rawScore: 30,
        gradeValue: 3.0,
        gradeLabel: "Pass",
        passed: false, // Mandatory failed
        weightApplied: 0.6,
      },
      {
        id: "result-2",
        attemptId: "attempt-1",
        componentId: "comp-2",
        rawScore: 42,
        gradeValue: 4.2,
        gradeLabel: "Good",
        passed: true,
        weightApplied: 0.4,
      },
    ];

    const result = calculateModuleGrade(components, results, chGradeScale);
    expect(result.allMandatoryPassed).toBe(false);
    expect(result.missingMandatory).toContain("Written Exam");
  });

  it("should handle missing component results", () => {
    const results: ComponentResult[] = [
      {
        id: "result-1",
        attemptId: "attempt-1",
        componentId: "comp-1",
        rawScore: 45,
        gradeValue: 4.5,
        gradeLabel: "Good",
        passed: true,
        weightApplied: 0.6,
      },
      // comp-2 missing, but not mandatory
    ];

    const result = calculateModuleGrade(components, results, chGradeScale);
    expect(result.finalGrade).toBeCloseTo(4.5, 1); // Only comp-1 contributes
  });

  it("should apply rounding policy to final grade", () => {
    const results: ComponentResult[] = [
      {
        id: "result-1",
        attemptId: "attempt-1",
        componentId: "comp-1",
        rawScore: 45,
        gradeValue: 4.55,
        gradeLabel: "Good",
        passed: true,
        weightApplied: 0.6,
      },
      {
        id: "result-2",
        attemptId: "attempt-1",
        componentId: "comp-2",
        rawScore: 42,
        gradeValue: 4.25,
        gradeLabel: "Good",
        passed: true,
        weightApplied: 0.4,
      },
    ];

    const roundingFloor = { ...roundingNormal, method: "floor" as const, roundTo: 0.5 };
    const result = calculateModuleGrade(components, results, chGradeScale, roundingFloor);
    expect(result.finalGradeRounded).toBe(Math.floor(result.finalGrade! / 0.5) * 0.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PASS POLICY EVALUATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Pass Policy Evaluation", () => {
  it("should evaluate overall threshold policy", () => {
    const result = evaluatePassPolicy(
      4.5,
      chGradeScale,
      passOverallThreshold,
      true
    );
    expect(result.passed).toBe(true);

    const resultFail = evaluatePassPolicy(
      3.9,
      chGradeScale,
      passOverallThreshold,
      true
    );
    expect(resultFail.passed).toBe(false);
  });

  it("should evaluate mandatory components policy", () => {
    const result = evaluatePassPolicy(
      4.0,
      chGradeScale,
      passMandatoryComponents,
      true // all mandatory passed
    );
    expect(result.passed).toBe(true);

    const resultFail = evaluatePassPolicy(
      4.0,
      chGradeScale,
      passMandatoryComponents,
      false // not all mandatory passed
    );
    expect(resultFail.passed).toBe(false);
  });

  it("should handle null grades", () => {
    const result = evaluatePassPolicy(
      null,
      chGradeScale,
      passOverallThreshold,
      true
    );
    expect(result.passed).toBe(false);
  });

  it("should evaluate German pass policy with lower-is-better scale", () => {
    const dePassPolicy: PassPolicy = {
      ...passOverallThreshold,
      overallPassThreshold: null,
    };
    const result = evaluatePassPolicy(3.5, deGradeScale, dePassPolicy, true);
    expect(result.passed).toBe(true);

    const resultFail = evaluatePassPolicy(4.5, deGradeScale, dePassPolicy, true);
    expect(resultFail.passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. RETAKE & ATTEMPT RESOLUTION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Attempt Resolution & Retake Logic", () => {
  it("should resolve best attempt from multiple attempts", () => {
    const attempts: Attempt[] = [
      {
        id: "attempt-1",
        enrollmentId: "enroll-1",
        attemptNumber: 1,
        dateCompleted: "2024-01-15",
        status: "graded",
        finalGradeValue: 3.5,
        finalGradeLabel: "Pass",
        passed: true,
        creditsAwarded: 6,
        countsTowardRecord: true,
        isResit: false,
      },
      {
        id: "attempt-2",
        enrollmentId: "enroll-1",
        attemptNumber: 2,
        dateCompleted: "2024-06-15",
        status: "graded",
        finalGradeValue: 4.5,
        finalGradeLabel: "Good",
        passed: true,
        creditsAwarded: 6,
        countsTowardRecord: true,
        isResit: true,
      },
    ];

    // Allow retake even after passing (best_attempt policy implies grade improvement)
    const retakeWithPassAllowed = { ...retakeBestAttempt, retakeIfPassed: true };
    const result = resolveEffectiveAttempt(
      attempts,
      retakeWithPassAllowed,
      chGradeScale
    );
    expect(result.effectiveGrade).toBe(4.5); // Best is 4.5
    expect(result.effectiveAttempt?.id).toBe("attempt-2");
    expect(result.canRetake).toBe(true); // More attempts allowed + retakeIfPassed=true
    expect(result.attemptsRemaining).toBe(1); // 3 max - 2 used
  });

  it("should resolve latest attempt", () => {
    const attempts: Attempt[] = [
      {
        id: "attempt-1",
        enrollmentId: "enroll-1",
        attemptNumber: 1,
        dateCompleted: "2024-01-15",
        status: "graded",
        finalGradeValue: 4.5,
        finalGradeLabel: "Good",
        passed: true,
        creditsAwarded: 6,
        countsTowardRecord: true,
        isResit: false,
      },
      {
        id: "attempt-2",
        enrollmentId: "enroll-1",
        attemptNumber: 2,
        dateCompleted: "2024-06-15",
        status: "graded",
        finalGradeValue: 3.5,
        finalGradeLabel: "Pass",
        passed: true,
        creditsAwarded: 6,
        countsTowardRecord: true,
        isResit: true,
      },
    ];

    const result = resolveEffectiveAttempt(attempts, retakeLatest, chGradeScale);
    expect(result.effectiveGrade).toBe(3.5); // Latest is 3.5
    expect(result.effectiveAttempt?.id).toBe("attempt-2");
  });

  it("should handle no valid attempts", () => {
    const attempts: Attempt[] = [
      {
        id: "attempt-1",
        enrollmentId: "enroll-1",
        attemptNumber: 1,
        dateCompleted: "2024-01-15",
        status: "in_progress",
        finalGradeValue: null,
        finalGradeLabel: null,
        passed: null,
        creditsAwarded: 0,
        countsTowardRecord: false,
        isResit: false,
      },
    ];

    const result = resolveEffectiveAttempt(attempts, retakeBestAttempt, chGradeScale);
    expect(result.effectiveGrade).toBeNull();
    expect(result.effectiveAttempt).toBeNull();
    expect(result.attemptsRemaining).toBe(2);
    expect(result.canRetake).toBe(true);
  });

  it("should prevent retake when max attempts reached", () => {
    const attempts: Attempt[] = [
      {
        id: "attempt-1",
        enrollmentId: "enroll-1",
        attemptNumber: 1,
        dateCompleted: "2024-01-15",
        status: "graded",
        finalGradeValue: 3.0,
        finalGradeLabel: "Pass",
        passed: false,
        creditsAwarded: 0,
        countsTowardRecord: true,
        isResit: false,
      },
      {
        id: "attempt-2",
        enrollmentId: "enroll-1",
        attemptNumber: 2,
        dateCompleted: "2024-06-15",
        status: "graded",
        finalGradeValue: 3.2,
        finalGradeLabel: "Pass",
        passed: false,
        creditsAwarded: 0,
        countsTowardRecord: true,
        isResit: true,
      },
      {
        id: "attempt-3",
        enrollmentId: "enroll-1",
        attemptNumber: 3,
        dateCompleted: "2024-12-15",
        status: "graded",
        finalGradeValue: 3.5,
        finalGradeLabel: "Pass",
        passed: false,
        creditsAwarded: 0,
        countsTowardRecord: true,
        isResit: true,
      },
    ];

    const result = resolveEffectiveAttempt(attempts, retakeBestAttempt, chGradeScale);
    expect(result.canRetake).toBe(false);
    expect(result.attemptsRemaining).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. GPA CALCULATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("GPA Calculation", () => {
  it("should calculate weighted GPA by credits", () => {
    const entries = [
      { grade: 4.5, credits: 6, passed: true, isRepeat: false },
      { grade: 4.0, credits: 6, passed: true, isRepeat: false },
      { grade: 3.5, credits: 4, passed: true, isRepeat: false },
    ];

    const result = calculateGPA(entries, gpaSchemeWeightedByCredits);
    expect(result.gpa).toBeDefined();
    expect(result.gpa).toBeGreaterThan(0);
    // (4.5*6 + 4.0*6 + 3.5*4) / (6+6+4) = (27 + 24 + 14) / 16 = 65 / 16 = 4.0625
    expect(result.gpa).toBeCloseTo(4.0625, 2);
    expect(result.totalCredits).toBe(16);
    expect(result.countedEntries).toBe(3);
  });

  it("should exclude failed modules when configured", () => {
    const entries = [
      { grade: 4.5, credits: 6, passed: true, isRepeat: false },
      { grade: 3.0, credits: 6, passed: false, isRepeat: false },
    ];

    const result = calculateGPA(entries, gpaSchemeWeightedByCredits);
    // Only passed modules counted
    expect(result.gpa).toBeCloseTo(4.5, 1);
    expect(result.countedEntries).toBe(1);
  });

  it("should exclude repeats when configured", () => {
    const entries = [
      { grade: 4.5, credits: 6, passed: true, isRepeat: false },
      { grade: 3.5, credits: 6, passed: true, isRepeat: true }, // Excluded
    ];

    const scheme = { ...gpaSchemeWeightedByCredits, includesRepeats: false };
    const result = calculateGPA(entries, scheme);
    expect(result.gpa).toBeCloseTo(4.5, 1);
    expect(result.countedEntries).toBe(1);
  });

  it("should handle empty GPA input", () => {
    const result = calculateGPA([], gpaSchemeWeightedByCredits);
    expect(result.gpa).toBeNull();
    expect(result.totalCredits).toBe(0);
    expect(result.countedEntries).toBe(0);
  });

  it("should handle zero credits scenario", () => {
    const entries = [{ grade: 4.5, credits: 0, passed: true, isRepeat: false }];
    const result = calculateGPA(entries, gpaSchemeWeightedByCredits);
    expect(result.gpa).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. DEGREE CLASSIFICATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Degree Classification", () => {
  it("should classify first class honours", () => {
    const result = classifyDegree(85, ukClassificationScheme, ukGradeScale);
    expect(result?.classification).toBe("First Class Honours");
    expect(result?.shortLabel).toBe("1st");
  });

  it("should classify upper second class honours", () => {
    const result = classifyDegree(65, ukClassificationScheme, ukGradeScale);
    expect(result?.classification).toBe("Upper Second Class Honours");
    expect(result?.shortLabel).toBe("2:1");
  });

  it("should classify lower second class honours", () => {
    const result = classifyDegree(55, ukClassificationScheme, ukGradeScale);
    expect(result?.classification).toBe("Lower Second Class Honours");
    expect(result?.shortLabel).toBe("2:2");
  });

  it("should classify third class honours", () => {
    const result = classifyDegree(45, ukClassificationScheme, ukGradeScale);
    expect(result?.classification).toBe("Third Class Honours");
    expect(result?.shortLabel).toBe("3rd");
  });

  it("should classify fail", () => {
    const result = classifyDegree(35, ukClassificationScheme, ukGradeScale);
    expect(result?.classification).toBe("Fail");
  });

  it("should handle boundary scores", () => {
    expect(classifyDegree(70, ukClassificationScheme, ukGradeScale)?.classification).toBe("First Class Honours");
    expect(classifyDegree(69.9, ukClassificationScheme, ukGradeScale)?.classification).toBe("Upper Second Class Honours");
    expect(classifyDegree(60, ukClassificationScheme, ukGradeScale)?.classification).toBe("Upper Second Class Honours");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. PREREQUISITE CHECK TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Prerequisite Checking", () => {
  const prerequisites: ModulePrerequisite[] = [
    {
      id: "prereq-1",
      moduleId: "module-advanced",
      prerequisiteModuleId: "module-basics",
      prerequisiteType: "required",
      notes: undefined,
    },
    {
      id: "prereq-2",
      moduleId: "module-advanced",
      prerequisiteModuleId: "module-intermediate",
      prerequisiteType: "recommended",
      notes: undefined,
    },
    {
      id: "prereq-3",
      moduleId: "module-thesis",
      prerequisiteModuleId: "module-capstone",
      prerequisiteType: "corequisite",
      notes: undefined,
    },
  ];

  it("should allow enrollment when all required prerequisites met", () => {
    // Only check module-advanced prerequisites (required + recommended), not corequisites for other modules
    const moduleAdvancedPrereqs = prerequisites.filter((p) => p.moduleId === "module-advanced");
    const passedModules = new Set(["module-basics", "module-intermediate"]);
    const result = checkPrerequisites(moduleAdvancedPrereqs, passedModules);
    expect(result.canEnroll).toBe(true);
    expect(result.missingRequired.length).toBe(0);
  });

  it("should block enrollment when required prerequisites missing", () => {
    const passedModules = new Set(["module-intermediate"]);
    const result = checkPrerequisites(prerequisites, passedModules);
    expect(result.canEnroll).toBe(false);
    expect(result.missingRequired).toContain("module-basics");
  });

  it("should warn about missing recommended prerequisites", () => {
    // Only check module-advanced prerequisites (skip corequisites for other modules)
    const moduleAdvancedPrereqs = prerequisites.filter((p) => p.moduleId === "module-advanced");
    const passedModules = new Set(["module-basics"]);
    const result = checkPrerequisites(moduleAdvancedPrereqs, passedModules);
    expect(result.canEnroll).toBe(true); // Required prereq met, recommended is only a warning
    expect(result.missingRecommended).toContain("module-intermediate");
  });

  it("should handle corequisites with current term enrollment", () => {
    const passedModules = new Set<string>();
    const currentTerm = new Set(["module-capstone"]);
    const result = checkPrerequisites(prerequisites, passedModules, currentTerm);
    expect(result.missingCorequisites.length).toBe(0);
  });

  it("should block enrollment when corequisite not available", () => {
    const passedModules = new Set<string>();
    const currentTerm = new Set<string>();
    const result = checkPrerequisites(prerequisites, passedModules, currentTerm);
    expect(result.canEnroll).toBe(false);
    expect(result.missingCorequisites).toContain("module-capstone");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. COMPLETION POLICY EVALUATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Program Completion Policy Evaluation", () => {
  it("should mark eligible when all requirements met", () => {
    const result = evaluateCompletionPolicy(
      completionPolicyStandard,
      180, // totalCreditsEarned
      75, // gpa
      0, // failedModuleCount
      6, // termsEnrolled
      85, // thesisGrade
      false // internshipCompleted
    );
    expect(result.eligible).toBe(true);
    expect(result.creditsMet).toBe(true);
    expect(result.gpaMet).toBe(true);
  });

  it("should report insufficient credits", () => {
    const result = evaluateCompletionPolicy(
      completionPolicyStandard,
      150, // Below required 180
      75,
      0,
      6,
      85,
      false
    );
    expect(result.creditsMet).toBe(false);
    expect(result.reasons).toContain("Credits: 150/180 ECTS");
  });

  it("should report insufficient GPA", () => {
    const result = evaluateCompletionPolicy(
      completionPolicyStandard,
      180,
      50, // Below required 60
      0,
      6,
      85,
      false
    );
    expect(result.gpaMet).toBe(false);
  });

  it("should report too many failed modules", () => {
    const result = evaluateCompletionPolicy(
      completionPolicyStandard,
      180,
      75,
      5, // Above max 3
      6,
      85,
      false
    );
    expect(result.failedModulesOk).toBe(false);
  });

  it("should report exceeded duration", () => {
    const result = evaluateCompletionPolicy(
      completionPolicyStandard,
      180,
      75,
      0,
      10, // Above max 8 terms
      85,
      false
    );
    expect(result.durationOk).toBe(false);
  });

  it("should mark ineligible when multiple requirements not met", () => {
    const result = evaluateCompletionPolicy(
      completionPolicyStandard,
      100, // Low credits
      40, // Low GPA
      5, // Too many failures
      10, // Too many terms
      30, // Low thesis grade
      false
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(2);
  });

  it("should handle null GPA gracefully", () => {
    // With minGpa set to 60 but GPA=null, gpaMet is false → not eligible
    const result = evaluateCompletionPolicy(
      completionPolicyStandard,
      180,
      null, // No GPA yet
      0,
      6,
      85,
      false
    );
    expect(result.eligible).toBe(false); // GPA requirement not met (null GPA)
    expect(result.gpaMet).toBe(false);
    expect(result.creditsMet).toBe(true);

    // But without GPA requirement, null GPA is fine
    const policyNoGpa = { ...completionPolicyStandard, minGpa: undefined };
    const result2 = evaluateCompletionPolicy(policyNoGpa, 180, null, 0, 6, 85, false);
    expect(result2.eligible).toBe(true);
    expect(result2.gpaMet).toBe(true);
  });

  it("should handle policy without GPA requirement", () => {
    const policyNoGpa = { ...completionPolicyStandard, minGpa: undefined };
    const result = evaluateCompletionPolicy(policyNoGpa, 180, null, 0, 6, 85, false);
    expect(result.gpaMet).toBe(true); // No GPA required
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS: Realistic Scenarios
// ═══════════════════════════════════════════════════════════════════════════════

describe("Integration: Realistic Scenarios", () => {
  it("should handle complete Swiss student workflow", () => {
    // Student takes exam, scores 4.2 on 1-6 scale
    const chScale = chGradeScale;
    const passesExam = isPassingGrade(4.2, chScale);
    expect(passesExam).toBe(true);

    // Grade normalized for international comparison
    const normalized = normalizeGrade(4.2, chScale);
    // Linear mapping: (4.2 - 1) / (6 - 1) * 100 = 64
    expect(normalized.normalizedScore0to100).toBeCloseTo(64, 0);

    // Convert to German scale for reference
    const converted = convertGrade(4.2, chScale, deGradeScale);
    expect(converted.grade).toBeGreaterThanOrEqual(deGradeScale.minValue);
    expect(converted.grade).toBeLessThanOrEqual(deGradeScale.maxValue);
  });

  it("should handle complete German student workflow", () => {
    // German student scores 2.3 (good)
    const deScale = deGradeScale;
    const passesExam = isPassingGrade(2.3, deScale);
    expect(passesExam).toBe(true);

    // Via Bayerische Formel for reference
    const bayerisch = convertViaBayerischeFormel(2.3, deScale);
    expect(bayerisch.germanGrade).toBe(2.3); // Already German
    expect(bayerisch.confidence).toBe(0.95);
  });

  it("should handle complete UK student degree classification", () => {
    // UK student with average score of 68
    const classification = classifyDegree(68, ukClassificationScheme, ukGradeScale);
    expect(classification?.classification).toBe("Upper Second Class Honours");

    // GPA-like metric
    const gpaEntries = [
      { grade: 75, credits: 20, passed: true, isRepeat: false },
      { grade: 68, credits: 20, passed: true, isRepeat: false },
      { grade: 62, credits: 20, passed: true, isRepeat: false },
    ];
    const gpaResult = calculateGPA(gpaEntries, gpaSchemeWeightedByCredits);
    expect(gpaResult.gpa).toBeCloseTo(68.33, 1);
  });

  it("should handle module with multiple assessment components", () => {
    const moduleComponents: AssessmentComponent[] = [
      {
        id: "comp-written",
        moduleId: "module-x",
        name: "Written Exam",
        componentType: "written_exam",
        weightPercent: 70,
        mandatoryToPass: true,
        contributesToFinal: true,
        minPassRequired: true,
        sequenceOrder: 1,
      },
      {
        id: "comp-project",
        moduleId: "module-x",
        name: "Project",
        componentType: "project",
        weightPercent: 30,
        mandatoryToPass: false,
        contributesToFinal: true,
        minPassRequired: false,
        sequenceOrder: 2,
      },
    ];

    const results: ComponentResult[] = [
      {
        id: "r1",
        attemptId: "att1",
        componentId: "comp-written",
        rawScore: 65,
        gradeValue: 65,
        gradeLabel: "Good",
        passed: true,
        weightApplied: 0.7,
      },
      {
        id: "r2",
        attemptId: "att1",
        componentId: "comp-project",
        rawScore: 72,
        gradeValue: 72,
        gradeLabel: "Very Good",
        passed: true,
        weightApplied: 0.3,
      },
    ];

    const result = calculateModuleGrade(moduleComponents, results, ukGradeScale);
    // 65*0.7 + 72*0.3 = 45.5 + 21.6 = 67.1
    expect(result.finalGrade).toBeCloseTo(67.1, 1);
    expect(result.passed).toBe(true);
  });
});
