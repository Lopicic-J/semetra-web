/**
 * Semetra Academic Engine — Maximum Edition
 *
 * Pure calculation functions — no side effects, no database calls.
 * The engine computes; the UI explains; the KI advises.
 *
 * Architecture:
 *   - Grade Engine     → scale operations, normalization, conversion
 *   - Credit Engine    → credit math, ECTS conversion, workload
 *   - Pass Engine      → pass/fail determination per policy
 *   - Assessment Engine → weighted component calculation
 *   - Attempt Engine   → retake logic, grade replacement
 *   - Progress Engine  → requirement group fulfillment, completion
 *   - Rounding Engine  → policy-aware rounding
 *   - Classification   → honours, distinction, degree class
 *   - Normalization    → international comparison (0-100 internal)
 */

import type {
  GradeScale,
  GradeBand,
  PassPolicy,
  RetakePolicy,
  RoundingPolicy,
  AssessmentComponent,
  ComponentResult,
  Attempt,
  Enrollment,
  CreditScheme,
  ClassificationScheme,
  GPAScheme,
  ProgramRequirementGroup,
  GradeRecord,
  Program,
  ProgressSnapshot,
  ModulePrerequisite,
  ProgramCompletionPolicy,
  StudentProgram,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ROUNDING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export function applyRounding(value: number, policy: RoundingPolicy): number {
  const { roundTo, method } = policy;
  if (roundTo <= 0) return value;

  switch (method) {
    case "floor":
      return Math.floor(value / roundTo) * roundTo;
    case "ceil":
      return Math.ceil(value / roundTo) * roundTo;
    case "bankers": {
      // Banker's rounding: round half to even
      const quotient = value / roundTo;
      const rounded = Math.round(quotient);
      if (Math.abs(quotient - Math.floor(quotient) - 0.5) < 1e-10) {
        return (rounded % 2 === 0 ? rounded : rounded - 1) * roundTo;
      }
      return rounded * roundTo;
    }
    default: // "normal"
      return Math.round(value / roundTo) * roundTo;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. GRADE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/** Check if a grade value is within the valid range of a scale */
export function isValidGrade(grade: number, scale: GradeScale): boolean {
  return grade >= scale.minValue && grade <= scale.maxValue;
}

/** Check if a grade counts as passed in a given scale */
export function isPassingGrade(grade: number, scale: GradeScale): boolean {
  if (scale.higherIsBetter) {
    return grade >= scale.passValue;
  }
  return grade <= scale.passValue;
}

/** Compare two grades: returns positive if `a` is better than `b` */
export function compareGrades(a: number, b: number, scale: GradeScale): number {
  return scale.higherIsBetter ? a - b : b - a;
}

/** Find the best grade from an array */
export function bestGrade(grades: number[], scale: GradeScale): number | null {
  if (grades.length === 0) return null;
  return grades.reduce((best, g) =>
    compareGrades(g, best, scale) > 0 ? g : best
  );
}

/** Get the grade band (qualitative label) for a grade value */
export function getGradeBand(grade: number, bands: GradeBand[]): GradeBand | null {
  const sorted = [...bands].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const band of sorted) {
    if (grade >= band.fromValue && grade <= band.toValue) {
      return band;
    }
  }
  return null;
}

/** Round a grade according to a scale's step size */
export function roundGradeToStep(grade: number, scale: GradeScale): number {
  return Math.round(grade / scale.stepSize) * scale.stepSize;
}

/** Format a grade for display */
export function formatGradeValue(grade: number, scale: GradeScale): string {
  const rounded = roundGradeToStep(grade, scale);
  return rounded.toFixed(scale.decimalPlaces);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. NORMALIZATION ENGINE (international comparison)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize a local grade to a 0-100 internal score.
 *
 * Important: This is for ANALYSIS and COMPARISON only.
 * Local grades are NEVER destroyed. We always store 4 layers:
 *   1. local_grade_value
 *   2. local_grade_label
 *   3. normalized_internal_score (0-100)
 *   4. conversion_confidence (0.0-1.0)
 */
export function normalizeGrade(
  localGrade: number,
  scale: GradeScale,
  bands?: GradeBand[]
): GradeRecord {
  let normalized: number;
  let confidence = 0.8; // Default: reasonable confidence

  if (scale.higherIsBetter) {
    // Map [min..max] → [0..100]
    normalized = ((localGrade - scale.minValue) / (scale.maxValue - scale.minValue)) * 100;
  } else {
    // Inverted scales (DE, AT, CZ): lower is better
    // Map [min..max] → [100..0]
    normalized = ((scale.maxValue - localGrade) / (scale.maxValue - scale.minValue)) * 100;
  }

  // Clamp to [0, 100]
  normalized = Math.max(0, Math.min(100, normalized));

  // Reduce confidence for extreme edge cases
  if (scale.type === "classification") {
    confidence = 0.6; // Letter grades lose granularity
  }

  const band = getGradeBand(localGrade, bands ?? []);
  const label = band?.label ?? null;

  return {
    localGradeValue: localGrade,
    localGradeLabel: label,
    normalizedScore0to100: Math.round(normalized * 100) / 100,
    normalizationMethod: "linear_scale_mapping",
    conversionConfidence: confidence,
  };
}

/**
 * Convert a grade from one scale to another.
 * Returns the target grade + confidence.
 */
export function convertGrade(
  sourceGrade: number,
  sourceScale: GradeScale,
  targetScale: GradeScale
): { grade: number; confidence: number } {
  // Step 1: Normalize source to 0-100
  const normalized = normalizeGrade(sourceGrade, sourceScale);
  const score = normalized.normalizedScore0to100 ?? 0;

  // Step 2: Map 0-100 to target scale
  let targetGrade: number;
  if (targetScale.higherIsBetter) {
    targetGrade = targetScale.minValue + (score / 100) * (targetScale.maxValue - targetScale.minValue);
  } else {
    targetGrade = targetScale.maxValue - (score / 100) * (targetScale.maxValue - targetScale.minValue);
  }

  // Step 3: Round to target step
  targetGrade = roundGradeToStep(targetGrade, targetScale);

  // Clamp
  targetGrade = Math.max(targetScale.minValue, Math.min(targetScale.maxValue, targetGrade));

  // Confidence drops when converting between very different systems
  const confidence = Math.min(
    normalized.conversionConfidence ?? 0.8,
    sourceScale.type === targetScale.type ? 0.85 : 0.65
  );

  return { grade: targetGrade, confidence };
}

/**
 * Modifizierte Bayerische Formel — official reference at many German universities (e.g. TUM).
 * Converts any "higher_is_better" grade to German 1.0–5.0 scale.
 *
 * Formula: German = 1 + 3 × (Nmax − Nd) / (Nmax − Nmin_pass)
 *
 * Where:
 *   Nmax = best achievable grade in source system
 *   Nd   = achieved grade
 *   Nmin_pass = lowest passing grade in source system
 *
 * For "lower_is_better" sources (already German-like), no conversion needed.
 * Clamped to [1.0, 5.0]. Confidence is medium — this is advisory, not binding.
 */
export function convertViaBayerischeFormel(
  sourceGrade: number,
  sourceScale: GradeScale
): { germanGrade: number; confidence: number; method: string } {
  // If source is already lower_is_better (e.g. German or Austrian), return directly
  if (!sourceScale.higherIsBetter) {
    return {
      germanGrade: Math.max(1.0, Math.min(5.0, sourceGrade)),
      confidence: 0.95,
      method: "direct_compatible_scale",
    };
  }

  const Nmax = sourceScale.maxValue;
  const Nd = sourceGrade;
  const NminPass = sourceScale.passValue;

  // Guard: if Nmax == NminPass, formula divides by zero
  if (Nmax === NminPass) {
    return { germanGrade: sourceGrade >= Nmax ? 1.0 : 5.0, confidence: 0.3, method: "bayerische_formel_degenerate" };
  }

  let german = 1 + 3 * (Nmax - Nd) / (Nmax - NminPass);

  // Clamp to valid German range
  german = Math.max(1.0, Math.min(5.0, german));

  // Round to 0.1 (German standard step)
  german = Math.round(german * 10) / 10;

  return {
    germanGrade: german,
    confidence: 0.7, // Medium — advisory, not binding
    method: "modifizierte_bayerische_formel",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3b. RECOGNITION / TRANSFER ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export type RecognitionMode = "credits_only" | "credits_and_grade" | "exemption_only";

export interface RecognitionResult {
  mode: RecognitionMode;
  recognizedEcts: number;
  recognizedGradeValue: number | null;
  recognizedGradeLabel: string | null;
  conversionMethod: string | null;
  conversionConfidence: number | null;
  notes: string;
}

/**
 * Evaluate a recognition / transfer credit request.
 *
 * Modes:
 * - credits_only: Award ECTS, no grade transferred
 * - credits_and_grade: Award ECTS + convert grade to target scale
 * - exemption_only: Mark module as exempt, no credits or grade
 */
export function evaluateRecognition(
  mode: RecognitionMode,
  sourceGradeValue: number | null,
  sourceScale: GradeScale | null,
  targetScale: GradeScale | null,
  sourceCredits: number,
  sourceCreditScheme: CreditScheme | null,
  targetCreditScheme: CreditScheme | null
): RecognitionResult {
  // Credits conversion: source → ECTS → target
  // Formula: sourceCredits * (sourceCreditScheme.conversionToEcts / targetCreditScheme.conversionToEcts)
  // This first converts source credits to ECTS, then divides by target scheme's conversion factor
  // to get the equivalent credits in the target credit system.
  let recognizedEcts = sourceCredits;
  if (sourceCreditScheme && targetCreditScheme) {
    recognizedEcts = sourceCredits * (sourceCreditScheme.conversionToEcts / targetCreditScheme.conversionToEcts);
  } else if (sourceCreditScheme) {
    recognizedEcts = sourceCredits * sourceCreditScheme.conversionToEcts;
  }

  if (mode === "exemption_only") {
    return {
      mode,
      recognizedEcts: 0,
      recognizedGradeValue: null,
      recognizedGradeLabel: null,
      conversionMethod: null,
      conversionConfidence: null,
      notes: "Module exemption — no credits or grade awarded",
    };
  }

  if (mode === "credits_only") {
    return {
      mode,
      recognizedEcts: Math.round(recognizedEcts * 10) / 10,
      recognizedGradeValue: null,
      recognizedGradeLabel: null,
      conversionMethod: null,
      conversionConfidence: null,
      notes: `${sourceCredits} source credits → ${recognizedEcts.toFixed(1)} ECTS (credits only, no grade transferred)`,
    };
  }

  // credits_and_grade
  if (sourceGradeValue == null || !sourceScale || !targetScale) {
    return {
      mode,
      recognizedEcts: Math.round(recognizedEcts * 10) / 10,
      recognizedGradeValue: null,
      recognizedGradeLabel: null,
      conversionMethod: null,
      conversionConfidence: null,
      notes: "Grade conversion not possible — missing source grade or scale info",
    };
  }

  // Try Bayerische Formel if target is German
  if (!targetScale.higherIsBetter && targetScale.minValue === 1.0 && targetScale.maxValue <= 5.0) {
    const result = convertViaBayerischeFormel(sourceGradeValue, sourceScale);
    return {
      mode,
      recognizedEcts: Math.round(recognizedEcts * 10) / 10,
      recognizedGradeValue: result.germanGrade,
      recognizedGradeLabel: null,
      conversionMethod: result.method,
      conversionConfidence: result.confidence,
      notes: `Bayerische Formel: ${sourceGradeValue} (${sourceScale.code}) → ${result.germanGrade} (${targetScale.code})`,
    };
  }

  // Generic conversion via normalization
  const converted = convertGrade(sourceGradeValue, sourceScale, targetScale);
  return {
    mode,
    recognizedEcts: Math.round(recognizedEcts * 10) / 10,
    recognizedGradeValue: converted.grade,
    recognizedGradeLabel: null,
    conversionMethod: "linear_normalization",
    conversionConfidence: converted.confidence,
    notes: `${sourceGradeValue} (${sourceScale.code}) → ${converted.grade} (${targetScale.code})`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CREDIT ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/** Convert credits between systems */
export function convertCredits(
  value: number,
  fromScheme: CreditScheme,
  toScheme: CreditScheme
): number {
  // Convert to ECTS first, then to target
  const ects = value * fromScheme.conversionToEcts;
  return ects / toScheme.conversionToEcts;
}

/** Calculate ECTS equivalent for a credit value */
export function toEcts(value: number, scheme: CreditScheme): number {
  return value * scheme.conversionToEcts;
}

/** Calculate workload for a term */
export function termWorkload(
  creditValues: number[],
  scheme: CreditScheme,
  termType: "semester" | "trimester" | "quarter" = "semester"
): { total: number; recommended: number; isOverloaded: boolean } {
  const total = creditValues.reduce((s, c) => s + c, 0);
  const termsPerYear = termType === "semester" ? 2 : termType === "trimester" ? 3 : 4;
  const recommended = scheme.unitsPerFullTimeYear / termsPerYear;

  return {
    total,
    recommended,
    isOverloaded: total > recommended * 1.2, // 20% tolerance
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ASSESSMENT ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate the final grade for a module from its component results.
 *
 * Handles:
 *   - Weighted average of contributing components
 *   - Mandatory components that must pass independently
 *   - Components that don't contribute to grade but must be passed
 */
export function calculateModuleGrade(
  components: AssessmentComponent[],
  results: ComponentResult[],
  scale: GradeScale,
  roundingPolicy?: RoundingPolicy
): {
  finalGrade: number | null;
  finalGradeRounded: number | null;
  passed: boolean | null;
  allMandatoryPassed: boolean;
  missingMandatory: string[];
  componentDetails: Array<{
    component: AssessmentComponent;
    result: ComponentResult | null;
    contributedGrade: number | null;
    passed: boolean | null;
  }>;
} {
  const resultMap = new Map(results.map((r) => [r.componentId, r]));
  const details: ReturnType<typeof calculateModuleGrade>["componentDetails"] = [];

  let weightedSum = 0;
  let totalWeight = 0;
  let allMandatoryPassed = true;
  const missingMandatory: string[] = [];

  for (const comp of components) {
    const result = resultMap.get(comp.id) ?? null;
    let contributedGrade: number | null = null;
    let compPassed: boolean | null = null;

    if (result) {
      compPassed = result.passed ?? null;

      if (comp.contributesToFinal && result.gradeValue != null) {
        contributedGrade = result.gradeValue * (comp.weightPercent / 100);
        weightedSum += result.gradeValue * (comp.weightPercent / 100);
        totalWeight += comp.weightPercent / 100;
      }

      if (comp.mandatoryToPass && !result.passed) {
        allMandatoryPassed = false;
        missingMandatory.push(comp.name);
      }
    } else if (comp.mandatoryToPass) {
      allMandatoryPassed = false;
      missingMandatory.push(comp.name);
    }

    details.push({ component: comp, result, contributedGrade, passed: compPassed });
  }

  let finalGrade: number | null = null;
  let finalGradeRounded: number | null = null;
  let passed: boolean | null = null;

  if (totalWeight > 0) {
    finalGrade = weightedSum / totalWeight;

    if (roundingPolicy) {
      finalGradeRounded = applyRounding(finalGrade, roundingPolicy);
    } else {
      finalGradeRounded = roundGradeToStep(finalGrade, scale);
    }

    const gradePasses = isPassingGrade(finalGradeRounded, scale);
    passed = gradePasses && allMandatoryPassed;
  }

  return { finalGrade, finalGradeRounded, passed, allMandatoryPassed, missingMandatory, componentDetails: details };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PASS ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine if a module is passed according to its pass policy.
 */
export function evaluatePassPolicy(
  finalGrade: number | null,
  scale: GradeScale,
  policy: PassPolicy,
  allMandatoryPassed: boolean,
  componentResults?: Array<{ passed: boolean | null; mandatory: boolean }>
): { passed: boolean; reason: string } {
  switch (policy.policyType) {
    case "pass_fail_only":
      return {
        passed: allMandatoryPassed,
        reason: allMandatoryPassed ? "All requirements met" : "Not all requirements met",
      };

    case "overall_threshold":
      if (finalGrade == null) return { passed: false, reason: "No grade available" };
      return {
        passed: isPassingGrade(finalGrade, scale),
        reason: isPassingGrade(finalGrade, scale)
          ? `Grade ${finalGrade} meets threshold ${scale.passValue}`
          : `Grade ${finalGrade} below threshold ${scale.passValue}`,
      };

    case "all_mandatory_components":
      return {
        passed: allMandatoryPassed,
        reason: allMandatoryPassed
          ? "All mandatory components passed"
          : "Not all mandatory components passed",
      };

    case "threshold_plus_component_minimums":
      if (finalGrade == null) return { passed: false, reason: "No grade available" };
      const gradeOk = isPassingGrade(finalGrade, scale);
      return {
        passed: gradeOk && allMandatoryPassed,
        reason: !gradeOk
          ? `Grade ${finalGrade} below threshold`
          : !allMandatoryPassed
          ? "Mandatory components not all passed"
          : "Grade threshold and all mandatory components met",
      };

    case "compensation_model":
      if (finalGrade == null) return { passed: false, reason: "No grade available" };
      // Compensation: overall average must pass, individual failures allowed
      return {
        passed: isPassingGrade(finalGrade, scale),
        reason: `Compensation model: overall grade ${finalGrade} ${
          isPassingGrade(finalGrade, scale) ? "passes" : "fails"
        }`,
      };

    default:
      return { passed: false, reason: `Unknown policy type: ${policy.policyType}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. ATTEMPT ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine the effective grade from multiple attempts.
 */
export function resolveEffectiveAttempt(
  attempts: Attempt[],
  retakePolicy: RetakePolicy,
  scale: GradeScale
): {
  effectiveGrade: number | null;
  effectiveAttempt: Attempt | null;
  attemptsRemaining: number;
  canRetake: boolean;
} {
  const validAttempts = attempts.filter((a) => a.countsTowardRecord && a.finalGradeValue != null);
  const gradedAttempts = validAttempts.filter((a) => a.status === "graded" || a.status === "passed" || a.status === "failed");

  if (gradedAttempts.length === 0) {
    return {
      effectiveGrade: null,
      effectiveAttempt: null,
      attemptsRemaining: retakePolicy.maxAttempts - attempts.length,
      canRetake: attempts.length < retakePolicy.maxAttempts,
    };
  }

  let effectiveGrade: number;
  let effectiveAttempt: Attempt;

  switch (retakePolicy.gradeReplacement) {
    case "best_attempt":
      effectiveAttempt = gradedAttempts.reduce((best, a) =>
        compareGrades(a.finalGradeValue!, best.finalGradeValue!, scale) > 0 ? a : best
      );
      effectiveGrade = effectiveAttempt.finalGradeValue!;
      break;

    case "latest_attempt":
      effectiveAttempt = gradedAttempts[gradedAttempts.length - 1];
      effectiveGrade = effectiveAttempt.finalGradeValue!;
      break;

    case "average_attempts":
      const sum = gradedAttempts.reduce((s, a) => s + a.finalGradeValue!, 0);
      effectiveGrade = sum / gradedAttempts.length;
      effectiveAttempt = gradedAttempts[gradedAttempts.length - 1]; // reference last
      break;

    case "first_pass_only":
      const firstPass = gradedAttempts.find((a) => a.passed);
      effectiveAttempt = firstPass ?? gradedAttempts[gradedAttempts.length - 1];
      effectiveGrade = effectiveAttempt.finalGradeValue!;
      break;

    default:
      effectiveAttempt = gradedAttempts[gradedAttempts.length - 1];
      effectiveGrade = effectiveAttempt.finalGradeValue!;
  }

  const hasPassed = gradedAttempts.some((a) => a.passed);
  const canRetake =
    attempts.length < retakePolicy.maxAttempts &&
    (retakePolicy.retakeIfPassed || !hasPassed);

  return {
    effectiveGrade,
    effectiveAttempt,
    attemptsRemaining: Math.max(0, retakePolicy.maxAttempts - attempts.length),
    canRetake,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. GPA / AVERAGE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export interface GPAInput {
  grade: number;
  credits: number;
  passed: boolean;
  isRepeat: boolean;
}

/**
 * Calculate GPA according to a scheme.
 */
export function calculateGPA(
  entries: GPAInput[],
  scheme: GPAScheme
): { gpa: number | null; totalCredits: number; countedEntries: number } {
  let filtered = [...entries];

  // Filter by scope
  if (!scheme.includesFailed) {
    filtered = filtered.filter((e) => e.passed);
  }
  if (!scheme.includesRepeats) {
    filtered = filtered.filter((e) => !e.isRepeat);
  }

  if (filtered.length === 0) {
    return { gpa: null, totalCredits: 0, countedEntries: 0 };
  }

  // Drop lowest-performing entry if allowed (and there's more than one entry)
  if (scheme.dropLowestAllowed && filtered.length > 1) {
    filtered.sort((a, b) => a.grade - b.grade);
    filtered = filtered.slice(1); // Remove the worst (lowest) entry
  }

  let gpa: number;
  const totalCredits = filtered.reduce((s, e) => s + e.credits, 0);

  switch (scheme.calculationType) {
    case "weighted_by_credits":
      if (totalCredits === 0) return { gpa: null, totalCredits: 0, countedEntries: 0 };
      gpa = filtered.reduce((s, e) => s + e.grade * e.credits, 0) / totalCredits;
      break;

    case "simple_average":
      gpa = filtered.reduce((s, e) => s + e.grade, 0) / filtered.length;
      break;

    case "weighted_average":
      gpa = filtered.reduce((s, e) => s + e.grade * e.credits, 0) / totalCredits;
      break;

    default:
      gpa = filtered.reduce((s, e) => s + e.grade * e.credits, 0) / totalCredits;
  }

  return { gpa, totalCredits, countedEntries: filtered.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. CLASSIFICATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine degree classification based on GPA or average.
 */
export function classifyDegree(
  averageGrade: number,
  scheme: ClassificationScheme,
  scale: GradeScale
): { classification: string; shortLabel?: string } | null {
  if (!scheme.rules || scheme.rules.length === 0) return null;

  // Sort rules by min value (descending for higher_is_better, ascending otherwise)
  const sorted = [...scheme.rules].sort((a, b) =>
    scale.higherIsBetter ? b.min - a.min : a.min - b.min
  );

  for (const rule of sorted) {
    const meetsThreshold = scale.higherIsBetter
      ? averageGrade >= rule.min
      : averageGrade <= rule.min;

    if (meetsThreshold) {
      return { classification: rule.label, shortLabel: rule.short };
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. PROGRESS ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export interface GroupProgress {
  group: ProgramRequirementGroup;
  earnedCredits: number;
  requiredCredits: number;
  passedModules: number;
  requiredModules: number | null;
  fulfilled: boolean;
}

/**
 * Evaluate fulfillment of a requirement group.
 */
export function evaluateRequirementGroup(
  group: ProgramRequirementGroup,
  enrollments: Enrollment[],
  moduleCredits: Map<string, number>
): GroupProgress {
  const groupEnrollments = enrollments.filter(
    (e) => e.status === "passed" || e.status === "recognised"
  );

  const earnedCredits = groupEnrollments.reduce(
    (s, e) => s + (e.creditsAwarded || moduleCredits.get(e.moduleId) || 0),
    0
  );
  const passedModules = groupEnrollments.length;
  const requiredCredits = group.minCreditsRequired ?? 0;
  const requiredModules = group.minModulesRequired ?? null;

  let fulfilled = true;

  switch (group.ruleType) {
    case "all_of":
      // All modules in the group must be passed
      fulfilled = requiredModules != null ? passedModules >= requiredModules : earnedCredits >= requiredCredits;
      break;
    case "choose_n":
      fulfilled = requiredModules != null ? passedModules >= requiredModules : true;
      break;
    case "choose_credits":
      fulfilled = earnedCredits >= requiredCredits;
      break;
    case "any_of":
      fulfilled = passedModules > 0;
      break;
  }

  return {
    group,
    earnedCredits,
    requiredCredits,
    passedModules,
    requiredModules,
    fulfilled,
  };
}

/**
 * Calculate overall program completion percentage.
 */
export function calculateCompletionPercentage(
  totalCreditsRequired: number,
  totalCreditsEarned: number
): number {
  if (totalCreditsRequired <= 0) return 0;
  return Math.min(100, Math.round((totalCreditsEarned / totalCreditsRequired) * 1000) / 10);
}

/**
 * Estimate graduation based on current velocity.
 */
export function estimateGraduation(
  totalCreditsRequired: number,
  totalCreditsEarned: number,
  creditsPerTermHistory: number[],
  currentTermNumber: number
): { estimatedTermsRemaining: number; estimatedGraduationTerm: number } | null {
  const remaining = totalCreditsRequired - totalCreditsEarned;
  if (remaining <= 0) return { estimatedTermsRemaining: 0, estimatedGraduationTerm: currentTermNumber };

  if (creditsPerTermHistory.length === 0) return null;

  const avgPerTerm = creditsPerTermHistory.reduce((s, c) => s + c, 0) / creditsPerTermHistory.length;
  if (avgPerTerm <= 0) return null;

  const termsRemaining = Math.ceil(remaining / avgPerTerm);
  return {
    estimatedTermsRemaining: termsRemaining,
    estimatedGraduationTerm: currentTermNumber + termsRemaining,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. WHAT-IF / SCENARIO ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate: "What grade do I need on the next assessment to reach target GPA?"
 */
export function gradeNeededForTarget(
  currentGPA: number,
  currentCredits: number,
  targetGPA: number,
  nextModuleCredits: number,
  scale: GradeScale
): number | null {
  // Formula: targetGPA = (currentGPA * currentCredits + X * nextCredits) / (currentCredits + nextCredits)
  // Solve for X: X = (targetGPA * (currentCredits + nextCredits) - currentGPA * currentCredits) / nextCredits
  if (nextModuleCredits <= 0) return null;

  const needed =
    (targetGPA * (currentCredits + nextModuleCredits) - currentGPA * currentCredits) /
    nextModuleCredits;

  // Check if achievable
  if (scale.higherIsBetter) {
    if (needed > scale.maxValue) return null; // Impossible
    if (needed < scale.minValue) return scale.minValue; // Already achieved
  } else {
    if (needed < scale.minValue) return null; // Impossible (need better than best)
    if (needed > scale.maxValue) return scale.maxValue;
  }

  return roundGradeToStep(needed, scale);
}

/**
 * Calculate: "What grade do I need on this component to pass the module?"
 */
export function gradeNeededOnComponent(
  existingResults: { weight: number; grade: number }[],
  targetComponentWeight: number,
  targetModuleGrade: number
): number | null {
  const existingWeightedSum = existingResults.reduce((s, r) => s + r.grade * r.weight, 0);
  const existingWeight = existingResults.reduce((s, r) => s + r.weight, 0);
  const totalWeight = existingWeight + targetComponentWeight;

  if (targetComponentWeight <= 0 || totalWeight <= 0) return null;

  // targetModuleGrade = (existingWeightedSum + X * targetWeight) / totalWeight
  const needed = (targetModuleGrade * totalWeight - existingWeightedSum) / targetComponentWeight;
  return Math.round(needed * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 12. PROGRAMME COMPLETION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProgramCompletionResult {
  completed: boolean;
  earnedCredits: number;
  requiredCredits: number;
  remainingCredits: number;
  allGroupsFulfilled: boolean;
  groupResults: GroupProgress[];
  thesisOk: boolean;
  internshipOk: boolean;
  finalExamOk: boolean;
  blockers: string[];
}

/**
 * Evaluate whether a student has completed all requirements for a program.
 * Checks: total credits, all requirement groups, thesis, internship, final exam.
 */
export function checkProgramCompletion(
  program: Program,
  requirementGroups: ProgramRequirementGroup[],
  enrollments: Enrollment[],
  moduleCredits: Map<string, number>,
  moduleToGroupMap?: Map<string, string>
): ProgramCompletionResult {
  const blockers: string[] = [];

  // Evaluate each requirement group
  const groupResults = requirementGroups.map((g) =>
    evaluateRequirementGroup(g, enrollments, moduleCredits)
  );

  const allGroupsFulfilled = groupResults.every((g) => g.fulfilled);
  if (!allGroupsFulfilled) {
    groupResults
      .filter((g) => !g.fulfilled)
      .forEach((g) => blockers.push(`Anforderungsgruppe "${g.group.name}" nicht erfüllt`));
  }

  // Total credits
  const passedOrRecognised = enrollments.filter(
    (e) => e.status === "passed" || e.status === "recognised"
  );
  const earnedCredits = passedOrRecognised.reduce(
    (s, e) => s + (e.creditsAwarded || moduleCredits.get(e.moduleId) || 0),
    0
  );
  const remainingCredits = Math.max(0, program.requiredTotalCredits - earnedCredits);

  if (earnedCredits < program.requiredTotalCredits) {
    blockers.push(
      `${remainingCredits} ECTS fehlen (${earnedCredits}/${program.requiredTotalCredits})`
    );
  }

  // Thesis check — look for a passed enrollment in a thesis group
  const thesisGroups = requirementGroups.filter((g) => g.groupType === "thesis");
  const thesisGroupIds = new Set(thesisGroups.map((g) => g.id));

  // Check if any passed enrollment belongs to a thesis group
  // If moduleToGroupMap is provided, use it for direct lookup; otherwise check via groupResults
  let thesisOk = !program.thesisRequired;
  if (program.thesisRequired) {
    if (moduleToGroupMap && moduleToGroupMap.size > 0) {
      // Use the provided mapping
      thesisOk = enrollments.some(
        (e) => e.status === "passed" && thesisGroupIds.has(moduleToGroupMap.get(e.moduleId) ?? "")
      );
    } else {
      // Fallback: check if any thesis group is fulfilled
      thesisOk = groupResults.some(
        (g) => g.group.groupType === "thesis" && g.fulfilled
      );
    }
  }

  if (program.thesisRequired && !thesisOk) {
    blockers.push("Thesis nicht abgeschlossen");
  }

  // Internship check
  const internshipGroupOk = !program.internshipRequired || groupResults.some(
    (g) => g.group.groupType === "internship" && g.fulfilled
  );
  if (program.internshipRequired && !internshipGroupOk) {
    blockers.push("Praktikum nicht abgeschlossen");
  }

  // Final exam (less common — some programs require a final oral exam)
  let finalExamOk = !program.finalExamRequired;
  if (program.finalExamRequired) {
    // Check if there's a final_exam type requirement group and it's fulfilled
    finalExamOk = groupResults.some(
      (g) => g.group.groupType === "final_exam" && g.fulfilled
    );
  }

  const completed =
    earnedCredits >= program.requiredTotalCredits &&
    allGroupsFulfilled &&
    (thesisOk || !program.thesisRequired) &&
    internshipGroupOk &&
    finalExamOk;

  return {
    completed,
    earnedCredits,
    requiredCredits: program.requiredTotalCredits,
    remainingCredits,
    allGroupsFulfilled,
    groupResults,
    thesisOk: thesisOk || !program.thesisRequired,
    internshipOk: internshipGroupOk,
    finalExamOk,
    blockers,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 13. AGGREGATE PROGRESS SNAPSHOT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a complete ProgressSnapshot for a student — aggregates all data.
 */
export function buildProgressSnapshot(
  program: Program,
  requirementGroups: ProgramRequirementGroup[],
  enrollments: Enrollment[],
  moduleCredits: Map<string, number>,
  gpaResult: { gpa: number | null } | null,
  classificationForecast: string | null,
  estimatedGradTerm: string | null,
  currentTermCredits: number
): ProgressSnapshot {
  const completionResult = checkProgramCompletion(
    program,
    requirementGroups,
    enrollments,
    moduleCredits
  );

  const creditsPerGroup: ProgressSnapshot["creditsPerGroup"] = {};
  completionResult.groupResults.forEach((gr) => {
    creditsPerGroup[gr.group.id] = {
      required: gr.requiredCredits,
      earned: gr.earnedCredits,
      groupName: gr.group.name,
    };
  });

  const statusCounts = {
    passed: 0,
    failed: 0,
    ongoing: 0,
    planned: 0,
  };
  enrollments.forEach((e) => {
    if (e.status === "passed" || e.status === "recognised") statusCounts.passed++;
    else if (e.status === "failed") statusCounts.failed++;
    else if (e.status === "ongoing" || e.status === "enrolled") statusCounts.ongoing++;
    else if (e.status === "planned") statusCounts.planned++;
  });

  const recommendedPerTerm = program.requiredTotalCredits / program.durationStandardTerms;

  return {
    totalCreditsRequired: program.requiredTotalCredits,
    totalCreditsEarned: completionResult.earnedCredits,
    totalEctsEarned: completionResult.earnedCredits, // Assumes ECTS
    creditsPerGroup,
    gpa: gpaResult?.gpa ?? null,
    classificationForecast,
    modulesPassedCount: statusCounts.passed,
    modulesFailedCount: statusCounts.failed,
    modulesOngoingCount: statusCounts.ongoing,
    modulesPlannedCount: statusCounts.planned,
    estimatedGraduationTerm: estimatedGradTerm ?? undefined,
    workloadCurrentTerm: currentTermCredits,
    workloadRecommended: Math.round(recommendedPerTerm),
    isOverloaded: currentTermCredits > recommendedPerTerm * 1.25,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 14. VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate that assessment component weights sum to approximately 100%.
 * Returns warnings if they don't.
 */
export function validateComponentWeights(
  components: AssessmentComponent[]
): { valid: boolean; totalWeight: number; warnings: string[] } {
  const contributing = components.filter((c) => c.contributesToFinal);
  const totalWeight = contributing.reduce((s, c) => s + c.weightPercent, 0);
  const warnings: string[] = [];

  if (Math.abs(totalWeight - 100) > 0.01) {
    warnings.push(
      `Komponentengewichte summieren sich auf ${totalWeight.toFixed(1)}% statt 100%`
    );
  }

  // Check for mandatory components without weight
  const mandatoryNoWeight = components.filter(
    (c) => c.mandatoryToPass && !c.contributesToFinal
  );
  if (mandatoryNoWeight.length > 0) {
    warnings.push(
      `${mandatoryNoWeight.length} Pflichtkomponente(n) tragen nicht zur Endnote bei`
    );
  }

  return {
    valid: warnings.length === 0,
    totalWeight,
    warnings,
  };
}

/**
 * Check whether a student is eligible for a retake.
 */
export function checkRetakeEligibility(
  enrollment: Enrollment,
  retakePolicy: RetakePolicy,
  lastAttemptDate: string | null
): { eligible: boolean; reason: string } {
  // Max attempts check
  if (enrollment.attemptsUsed >= retakePolicy.maxAttempts) {
    return { eligible: false, reason: `Maximale Versuche erreicht (${retakePolicy.maxAttempts})` };
  }

  // Already passed and retake not allowed
  if (enrollment.currentPassed && !retakePolicy.retakeIfPassed) {
    return { eligible: false, reason: "Modul bereits bestanden, Notenverbesserung nicht erlaubt" };
  }

  // Cooldown check
  if (retakePolicy.cooldownDays > 0 && lastAttemptDate) {
    const daysSince = Math.floor(
      (Date.now() - new Date(lastAttemptDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince < retakePolicy.cooldownDays) {
      return {
        eligible: false,
        reason: `Sperrfrist: noch ${retakePolicy.cooldownDays - daysSince} Tage warten`,
      };
    }
  }

  return { eligible: true, reason: "Wiederholung möglich" };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 16. PREREQUISITE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export interface PrerequisiteCheckResult {
  canEnroll: boolean;
  missingRequired: string[];   // prerequisite module IDs not yet passed
  missingRecommended: string[]; // recommended prerequisites not yet passed
  missingCorequisites: string[]; // corequisites not enrolled in same/earlier term
}

/**
 * Check whether a student meets all prerequisites for a module.
 *
 * @param prerequisites - prerequisite rules for the target module
 * @param passedModuleIds - Set of module IDs the student has already passed
 * @param currentTermModuleIds - Set of module IDs enrolled in the current term (for corequisites)
 */
export function checkPrerequisites(
  prerequisites: ModulePrerequisite[],
  passedModuleIds: Set<string>,
  currentTermModuleIds: Set<string> = new Set()
): PrerequisiteCheckResult {
  const missingRequired: string[] = [];
  const missingRecommended: string[] = [];
  const missingCorequisites: string[] = [];

  for (const prereq of prerequisites) {
    const prereqId = prereq.prerequisiteModuleId;

    switch (prereq.prerequisiteType) {
      case "required":
        if (!passedModuleIds.has(prereqId)) {
          missingRequired.push(prereqId);
        }
        break;
      case "recommended":
        if (!passedModuleIds.has(prereqId)) {
          missingRecommended.push(prereqId);
        }
        break;
      case "corequisite":
        if (!passedModuleIds.has(prereqId) && !currentTermModuleIds.has(prereqId)) {
          missingCorequisites.push(prereqId);
        }
        break;
    }
  }

  return {
    canEnroll: missingRequired.length === 0 && missingCorequisites.length === 0,
    missingRequired,
    missingRecommended,
    missingCorequisites,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 17. COMPLETION POLICY ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export interface CompletionPolicyResult {
  eligible: boolean;
  reasons: string[];
  creditsMet: boolean;
  gpaMet: boolean;
  failedModulesOk: boolean;
  durationOk: boolean;
  thesisOk: boolean;
  internshipOk: boolean;
}

/**
 * Evaluate whether a student meets the program completion policy.
 *
 * @param policy - the completion policy for the program
 * @param totalCreditsEarned - total credits the student has earned
 * @param gpa - student's current GPA (null if not calculated)
 * @param failedModuleCount - number of currently failed modules
 * @param termsEnrolled - number of terms the student has been enrolled
 * @param thesisGrade - thesis grade if applicable (null if no thesis or not graded)
 * @param internshipCompleted - whether internship is completed
 */
export function evaluateCompletionPolicy(
  policy: ProgramCompletionPolicy,
  totalCreditsEarned: number,
  gpa: number | null,
  failedModuleCount: number,
  termsEnrolled: number,
  thesisGrade: number | null,
  internshipCompleted: boolean
): CompletionPolicyResult {
  const reasons: string[] = [];

  const creditsMet = totalCreditsEarned >= policy.minTotalCredits;
  if (!creditsMet) {
    reasons.push(`Credits: ${totalCreditsEarned}/${policy.minTotalCredits} ECTS`);
  }

  const gpaMet = policy.minGpa == null || (gpa != null && gpa >= policy.minGpa);
  if (!gpaMet) {
    reasons.push(`GPA: ${gpa?.toFixed(2) ?? "n/a"} < ${policy.minGpa}`);
  }

  const failedModulesOk =
    policy.maxFailedModules == null || failedModuleCount <= policy.maxFailedModules;
  if (!failedModulesOk) {
    reasons.push(`Nicht bestandene Module: ${failedModuleCount} > ${policy.maxFailedModules}`);
  }

  const durationOk =
    policy.maxDurationTerms == null || termsEnrolled <= policy.maxDurationTerms;
  if (!durationOk) {
    reasons.push(`Studiendauer: ${termsEnrolled} Semester > ${policy.maxDurationTerms} max`);
  }

  const thesisOk =
    policy.thesisMinGrade == null ||
    (thesisGrade != null && thesisGrade >= policy.thesisMinGrade);
  if (!thesisOk) {
    reasons.push(
      `Thesis-Note: ${thesisGrade?.toFixed(1) ?? "nicht bewertet"} < ${policy.thesisMinGrade}`
    );
  }

  const internshipOk = !policy.internshipRequired || internshipCompleted;
  if (!internshipOk) {
    reasons.push("Praktikum nicht abgeschlossen");
  }

  return {
    eligible: creditsMet && gpaMet && failedModulesOk && durationOk && thesisOk && internshipOk,
    reasons,
    creditsMet,
    gpaMet,
    failedModulesOk,
    durationOk,
    thesisOk,
    internshipOk,
  };
}
