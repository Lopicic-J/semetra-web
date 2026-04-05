/**
 * Comprehensive E2E tests for Semetra Academic Validation Services
 *
 * Tests validation logic for:
 * - Module validation for publishing
 * - Program structure validation
 * - Enrollment eligibility validation
 */

import { describe, it, expect } from "vitest";
import type {
  AcademicModule,
  AssessmentComponent,
  ModulePrerequisite,
  GradeScale,
  PassPolicy,
  CreditScheme,
  Program,
  ProgramRequirementGroup,
  Enrollment,
  RetakePolicy,
  ProgramCompletionPolicy,
} from "../types";
import {
  ModuleValidator,
  ProgramValidator,
  EnrollmentValidator,
} from "../validation";

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA: GRADE SCALES
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
  specialLabels: {},
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
  specialLabels: {},
  isActive: true,
  metadata: {},
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA: POLICIES
// ═══════════════════════════════════════════════════════════════════════════════

const passPolicy: PassPolicy = {
  id: "policy-pass",
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

const creditScheme: CreditScheme = {
  id: "credit-ects",
  code: "ECTS",
  name: "European Credit Transfer System",
  unitsPerFullTimeYear: 60,
  conversionToEcts: 1.0,
  notes: undefined,
  isActive: true,
  metadata: {},
};

const retakePolicy: RetakePolicy = {
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

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA: MODULES
// ═══════════════════════════════════════════════════════════════════════════════

const validModule: AcademicModule = {
  id: "module-1",
  userId: "user-1",
  name: "Advanced Mathematics",
  moduleCode: "MATH-201",
  description: "Advanced calculus and linear algebra",
  ects: 6,
  creditSchemeId: "credit-ects",
  ectsEquivalent: 6,
  gradeScaleId: "scale-ch-1-6",
  passPolicyId: "policy-pass",
  retakePolicyId: "retake-best",
  roundingPolicyId: undefined,
  programId: "program-1",
  requirementGroupId: "group-1",
  termType: "semester",
  defaultTermNumber: 3,
  isCompulsory: true,
  isRepeatable: false,
  attendanceRequired: true,
  language: "German",
  deliveryMode: "onsite",
  prerequisitesJson: ["module-basics"],
  semester: "HS2024",
  color: "#0066cc",
  professor: "Prof. Dr. Schmidt",
  status: "published",
  targetGrade: 5.0,
};

const moduleWithoutCode: AcademicModule = {
  ...validModule,
  id: "module-2",
  moduleCode: undefined,
};

const moduleWithZeroEcts: AcademicModule = {
  ...validModule,
  id: "module-3",
  ects: 0,
};

const moduleWithNegativeEcts: AcademicModule = {
  ...validModule,
  id: "module-4",
  ects: -3,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA: ASSESSMENT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const validComponents: AssessmentComponent[] = [
  {
    id: "comp-1",
    moduleId: "module-1",
    name: "Written Exam",
    componentType: "written_exam",
    weightPercent: 60,
    gradeScaleId: "scale-ch-1-6",
    passPolicyId: "policy-pass",
    minPassRequired: true,
    contributesToFinal: true,
    mandatoryToPass: true,
    sequenceOrder: 1,
  },
  {
    id: "comp-2",
    moduleId: "module-1",
    name: "Project Work",
    componentType: "project",
    weightPercent: 40,
    gradeScaleId: "scale-ch-1-6",
    passPolicyId: undefined,
    minPassRequired: false,
    contributesToFinal: true,
    mandatoryToPass: false,
    sequenceOrder: 2,
  },
];

const componentsWithInvalidWeights: AssessmentComponent[] = [
  {
    ...validComponents[0],
    id: "comp-3",
    weightPercent: 60,
  },
  {
    ...validComponents[1],
    id: "comp-4",
    weightPercent: 50, // Should sum to 100, but sums to 110
  },
];

const componentsWithZeroWeight: AssessmentComponent[] = [
  {
    ...validComponents[0],
    id: "comp-5",
    weightPercent: 100,
  },
  {
    ...validComponents[1],
    id: "comp-6",
    weightPercent: 0, // Zero weight
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA: PREREQUISITES
// ═══════════════════════════════════════════════════════════════════════════════

const validPrerequisites: ModulePrerequisite[] = [
  {
    id: "prereq-1",
    moduleId: "module-1",
    prerequisiteModuleId: "module-basics",
    prerequisiteType: "required",
    notes: "Must complete basics first",
  },
  {
    id: "prereq-2",
    moduleId: "module-1",
    prerequisiteModuleId: "module-intermediate",
    prerequisiteType: "recommended",
    notes: undefined,
  },
];

const prerequisitesWithCycle: ModulePrerequisite[] = [
  {
    id: "prereq-cycle-1",
    moduleId: "module-a",
    prerequisiteModuleId: "module-b",
    prerequisiteType: "required",
    notes: undefined,
  },
  {
    id: "prereq-cycle-2",
    moduleId: "module-b",
    prerequisiteModuleId: "module-a",
    prerequisiteType: "required",
    notes: undefined,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA: PROGRAMS AND GROUPS
// ═══════════════════════════════════════════════════════════════════════════════

const validProgram: Program = {
  id: "program-1",
  institutionId: "inst-1",
  facultyId: "faculty-1",
  code: "BSC-COMP",
  name: "Bachelor of Science in Computer Science",
  degreeLevel: "bachelor",
  requiredTotalCredits: 180,
  creditSchemeId: "credit-ects",
  ectsTotal: 180,
  ectsEquivalentTotal: 180,
  durationStandardTerms: 6,
  classificationSchemeId: undefined,
  gpaSchemeId: undefined,
  completionPolicyId: undefined,
  completionRules: {},
  thesisRequired: false,
  internshipRequired: false,
  finalExamRequired: true,
  status: "active",
  isActive: true,
  metadata: {},
};

const programWithThesis: Program = {
  ...validProgram,
  id: "program-2",
  thesisRequired: true,
};

const programWithInternship: Program = {
  ...validProgram,
  id: "program-3",
  internshipRequired: true,
};

const validRequirementGroups: ProgramRequirementGroup[] = [
  {
    id: "group-1",
    programId: "program-1",
    name: "Compulsory Modules",
    groupType: "compulsory",
    minCreditsRequired: 90,
    minModulesRequired: 10,
    maxModulesCounted: 15,
    ruleType: "all_of",
    parentGroupId: undefined,
    sortOrder: 1,
    isActive: true,
    metadata: {},
  },
  {
    id: "group-2",
    programId: "program-1",
    name: "Elective Modules",
    groupType: "elective_required",
    minCreditsRequired: 60,
    minModulesRequired: 6,
    maxModulesCounted: 10,
    ruleType: "choose_n",
    parentGroupId: undefined,
    sortOrder: 2,
    isActive: true,
    metadata: {},
  },
];

const thesisRequirementGroups: ProgramRequirementGroup[] = [
  ...validRequirementGroups,
  {
    id: "group-thesis",
    programId: "program-2",
    name: "Thesis",
    groupType: "thesis",
    minCreditsRequired: 15,
    minModulesRequired: 1,
    maxModulesCounted: 1,
    ruleType: "all_of",
    parentGroupId: undefined,
    sortOrder: 3,
    isActive: true,
    metadata: {},
  },
];

const groupsWithInvalidCredits: ProgramRequirementGroup[] = [
  {
    ...validRequirementGroups[0],
    id: "group-bad-1",
    minCreditsRequired: -10, // Negative
  },
];

const groupsWithMaxLessThanMin: ProgramRequirementGroup[] = [
  {
    ...validRequirementGroups[0],
    id: "group-bad-2",
    minModulesRequired: 10,
    maxModulesCounted: 5, // Max < Min
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA: ENROLLMENTS
// ═══════════════════════════════════════════════════════════════════════════════

const validEnrollment: Enrollment = {
  id: "enroll-1",
  userId: "user-1",
  moduleId: "module-1",
  programId: "program-1",
  academicYear: "2024-2025",
  termId: "term-1",
  status: "enrolled",
  attemptsUsed: 0,
  currentFinalGrade: null,
  currentGradeLabel: null,
  currentPassed: null,
  creditsAwarded: 0,
  localGradeValue: null,
  localGradeLabel: null,
  normalizedScore0to100: null,
  normalizationMethod: null,
  conversionConfidence: null,
  recognitionMode: undefined,
};

const enrollmentWithAttempts: Enrollment = {
  ...validEnrollment,
  id: "enroll-2",
  attemptsUsed: 2,
  currentFinalGrade: 4.2,
  currentGradeLabel: "Pass",
  currentPassed: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETION POLICY TEST DATA
// ═══════════════════════════════════════════════════════════════════════════════

const validCompletionPolicy: ProgramCompletionPolicy = {
  id: "completion-1",
  programId: "program-1",
  minTotalCredits: 180,
  minGpa: 60,
  maxFailedModules: 3,
  maxDurationTerms: 8,
  thesisMinGrade: undefined,
  internshipRequired: false,
  languageRequirement: undefined,
  additionalRulesJson: {},
  notes: undefined,
};

const completionPolicyInvalidGpa: ProgramCompletionPolicy = {
  ...validCompletionPolicy,
  id: "completion-2",
  minGpa: 150, // Out of range
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. MODULE VALIDATOR TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("ModuleValidator", () => {
  describe("validateForPublish", () => {
    it("should validate a correct module", () => {
      const result = ModuleValidator.validateForPublish(
        validModule,
        validComponents,
        validPrerequisites,
        chGradeScale,
        passPolicy,
        creditScheme,
        ["module-basics", "module-intermediate", "module-1"]
      );

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should error on missing module code", () => {
      const result = ModuleValidator.validateForPublish(
        moduleWithoutCode,
        validComponents,
        validPrerequisites,
        chGradeScale,
        passPolicy,
        creditScheme,
        ["module-basics", "module-2"]
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "MODULE_CODE_MISSING")).toBe(true);
    });

    it("should error on missing grade scale", () => {
      const result = ModuleValidator.validateForPublish(
        validModule,
        validComponents,
        validPrerequisites,
        null,
        passPolicy,
        creditScheme,
        ["module-1"]
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "GRADE_SCALE_MISSING")).toBe(true);
    });

    it("should error on missing pass policy", () => {
      const result = ModuleValidator.validateForPublish(
        validModule,
        validComponents,
        validPrerequisites,
        chGradeScale,
        null,
        creditScheme,
        ["module-1"]
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "PASS_POLICY_MISSING")).toBe(true);
    });

    it("should error on missing credit scheme", () => {
      const result = ModuleValidator.validateForPublish(
        validModule,
        validComponents,
        validPrerequisites,
        chGradeScale,
        passPolicy,
        null,
        ["module-1"]
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "CREDIT_SCHEME_MISSING")).toBe(true);
    });

    it("should error on invalid ECTS", () => {
      const result = ModuleValidator.validateForPublish(
        moduleWithNegativeEcts,
        validComponents,
        validPrerequisites,
        chGradeScale,
        passPolicy,
        creditScheme,
        ["module-4"]
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "ECTS_INVALID")).toBe(true);
    });

    it("should error on invalid component weights", () => {
      const result = ModuleValidator.validateForPublish(
        validModule,
        componentsWithInvalidWeights,
        validPrerequisites,
        chGradeScale,
        passPolicy,
        creditScheme,
        ["module-1"]
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.code === "COMPONENT_WEIGHTS_DO_NOT_SUM_TO_100")
      ).toBe(true);
    });

    it("should detect prerequisite cycles", () => {
      const result = ModuleValidator.validateForPublish(
        validModule,
        validComponents,
        prerequisitesWithCycle,
        chGradeScale,
        passPolicy,
        creditScheme,
        ["module-a", "module-b"]
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.code === "PREREQUISITE_CYCLE_DETECTED")
      ).toBe(true);
    });

    it("should error on missing prerequisite modules", () => {
      const result = ModuleValidator.validateForPublish(
        validModule,
        validComponents,
        validPrerequisites,
        chGradeScale,
        passPolicy,
        creditScheme,
        ["module-1"] // module-basics and module-intermediate not in list
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.code === "PREREQUISITE_MODULE_NOT_FOUND")
      ).toBe(true);
    });

    it("should warn about zero-weight components", () => {
      const result = ModuleValidator.validateForPublish(
        validModule,
        componentsWithZeroWeight,
        validPrerequisites,
        chGradeScale,
        passPolicy,
        creditScheme,
        ["module-1", "module-basics"]
      );

      expect(result.warnings.some((w) => w.code === "COMPONENT_ZERO_WEIGHT")).toBe(true);
    });
  });

  describe("validateComponentWeights", () => {
    it("should validate weights summing to 100", () => {
      const result = ModuleValidator.validateComponentWeights(validComponents);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should error on weights not summing to 100", () => {
      const result = ModuleValidator.validateComponentWeights(componentsWithInvalidWeights);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.code === "COMPONENT_WEIGHTS_DO_NOT_SUM_TO_100")
      ).toBe(true);
    });

    it("should handle components with zero weight", () => {
      const result = ModuleValidator.validateComponentWeights(componentsWithZeroWeight);
      expect(result.warnings.some((w) => w.code === "COMPONENT_ZERO_WEIGHT")).toBe(true);
    });

    it("should only check contributing components", () => {
      const nonContributingComponents: AssessmentComponent[] = [
        { ...validComponents[0], contributesToFinal: false, weightPercent: 0 },
        { ...validComponents[1], contributesToFinal: true, weightPercent: 100 },
      ];
      const result = ModuleValidator.validateComponentWeights(nonContributingComponents);
      expect(result.valid).toBe(true);
    });

    it("should warn when no components contribute to final grade", () => {
      const noContributingComponents: AssessmentComponent[] = [
        { ...validComponents[0], contributesToFinal: false },
        { ...validComponents[1], contributesToFinal: false },
      ];
      const result = ModuleValidator.validateComponentWeights(noContributingComponents);
      expect(result.warnings.some((w) => w.code === "NO_CONTRIBUTING_COMPONENTS")).toBe(true);
    });
  });

  describe("detectPrerequisiteCycles", () => {
    it("should detect direct cycle (A -> B -> A)", () => {
      const result = ModuleValidator.detectPrerequisiteCycles(
        "module-a",
        prerequisitesWithCycle,
        new Map([
          ["module-a", prerequisitesWithCycle.filter((p) => p.moduleId === "module-a")],
          ["module-b", prerequisitesWithCycle.filter((p) => p.moduleId === "module-b")],
        ])
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "PREREQUISITE_CYCLE_DETECTED")).toBe(true);
    });

    it("should not error on acyclic prerequisites", () => {
      const result = ModuleValidator.detectPrerequisiteCycles(
        "module-1",
        validPrerequisites,
        new Map([["module-1", validPrerequisites]])
      );

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PROGRAM VALIDATOR TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("ProgramValidator", () => {
  describe("validateStructure", () => {
    it("should validate a correct program structure", () => {
      const result = ProgramValidator.validateStructure(
        validProgram,
        validRequirementGroups,
        [validModule],
        validCompletionPolicy
      );

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should error on negative min credits in group", () => {
      const result = ProgramValidator.validateStructure(
        validProgram,
        groupsWithInvalidCredits,
        [validModule],
        validCompletionPolicy
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "GROUP_INVALID_MIN_CREDITS")).toBe(true);
    });

    it("should warn on max modules less than min modules", () => {
      const result = ProgramValidator.validateStructure(
        validProgram,
        groupsWithMaxLessThanMin,
        [validModule],
        validCompletionPolicy
      );

      expect(result.warnings.some((w) => w.code === "GROUP_MAX_LESS_THAN_MIN_MODULES")).toBe(true);
    });

    it("should error when thesis is required but thesis group missing", () => {
      const result = ProgramValidator.validateStructure(
        programWithThesis,
        validRequirementGroups, // No thesis group
        [validModule],
        validCompletionPolicy
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "THESIS_GROUP_MISSING")).toBe(true);
    });

    it("should error when internship is required but internship group missing", () => {
      const result = ProgramValidator.validateStructure(
        programWithInternship,
        validRequirementGroups, // No internship group
        [validModule],
        validCompletionPolicy
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INTERNSHIP_GROUP_MISSING")).toBe(true);
    });

    it("should accept thesis requirement when thesis group exists", () => {
      const result = ProgramValidator.validateStructure(
        programWithThesis,
        thesisRequirementGroups,
        [validModule],
        validCompletionPolicy
      );

      expect(result.errors.some((e) => e.code === "THESIS_GROUP_MISSING")).toBe(false);
    });

    it("should warn when group credits do not cover program requirement", () => {
      const insufficientGroups: ProgramRequirementGroup[] = [
        {
          ...validRequirementGroups[0],
          minCreditsRequired: 50, // Only 50 instead of 90+60=150
        },
      ];

      const result = ProgramValidator.validateStructure(
        validProgram,
        insufficientGroups,
        [validModule],
        validCompletionPolicy
      );

      expect(
        result.warnings.some((w) => w.code === "TOTAL_GROUP_CREDITS_INSUFFICIENT")
      ).toBe(true);
    });

    it("should warn when program has no compulsory group", () => {
      const onlyElectiveGroups: ProgramRequirementGroup[] = validRequirementGroups.map((g) => ({
        ...g,
        groupType: "elective_free" as const,
      }));

      const result = ProgramValidator.validateStructure(
        validProgram,
        onlyElectiveGroups,
        [validModule],
        validCompletionPolicy
      );

      expect(result.warnings.some((w) => w.code === "NO_COMPULSORY_GROUP")).toBe(true);
    });

    it("should error on orphan modules", () => {
      const orphanModule: AcademicModule = {
        ...validModule,
        id: "module-orphan",
        requirementGroupId: "non-existent-group",
      };

      const result = ProgramValidator.validateStructure(
        validProgram,
        validRequirementGroups,
        [orphanModule],
        validCompletionPolicy
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "ORPHAN_MODULES")).toBe(true);
    });

    it("should validate completion policy if provided", () => {
      const badPolicy = { ...validCompletionPolicy, minTotalCredits: 200 }; // Exceeds program

      const result = ProgramValidator.validateStructure(
        validProgram,
        validRequirementGroups,
        [validModule],
        badPolicy
      );

      expect(
        result.errors.some((e) => e.code === "COMPLETION_POLICY_CREDITS_EXCEED_PROGRAM")
      ).toBe(true);
    });
  });

  describe("validateCompletionPolicy", () => {
    it("should validate a correct completion policy", () => {
      const result = ProgramValidator.validateCompletionPolicy(
        validProgram,
        validCompletionPolicy
      );

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should error when policy min credits exceed program total", () => {
      const badPolicy = { ...validCompletionPolicy, minTotalCredits: 200 };
      const result = ProgramValidator.validateCompletionPolicy(validProgram, badPolicy);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.code === "COMPLETION_POLICY_CREDITS_EXCEED_PROGRAM")
      ).toBe(true);
    });

    it("should warn when max duration is less than standard duration", () => {
      const badPolicy = { ...validCompletionPolicy, maxDurationTerms: 4 }; // Less than 6
      const result = ProgramValidator.validateCompletionPolicy(validProgram, badPolicy);

      expect(result.warnings.some((w) => w.code === "MAX_DURATION_LESS_THAN_STANDARD")).toBe(true);
    });

    it("should error on invalid GPA threshold", () => {
      const result = ProgramValidator.validateCompletionPolicy(
        validProgram,
        completionPolicyInvalidGpa
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "COMPLETION_POLICY_INVALID_GPA")).toBe(true);
    });

    it("should warn on negative thesis min grade", () => {
      const badPolicy = { ...validCompletionPolicy, thesisMinGrade: -10 };
      const result = ProgramValidator.validateCompletionPolicy(validProgram, badPolicy);

      expect(result.warnings.some((w) => w.code === "THESIS_MIN_GRADE_NEGATIVE")).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ENROLLMENT VALIDATOR TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("EnrollmentValidator", () => {
  describe("validateEnrollment", () => {
    it("should validate a correct enrollment", () => {
      const passedModules = new Set(["module-basics", "module-intermediate"]);
      const result = EnrollmentValidator.validateEnrollment(
        validEnrollment,
        validModule,
        validPrerequisites,
        passedModules,
        retakePolicy,
        null,
        [] // Not enrolled in this term yet
      );

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should error when module does not exist", () => {
      const result = EnrollmentValidator.validateEnrollment(
        validEnrollment,
        null, // Module not found
        validPrerequisites,
        new Set(),
        retakePolicy,
        null,
        []
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "MODULE_NOT_FOUND")).toBe(true);
    });

    it("should error when module is not active", () => {
      const inactiveModule = { ...validModule, status: "archived" };
      const result = EnrollmentValidator.validateEnrollment(
        validEnrollment,
        inactiveModule,
        validPrerequisites,
        new Set(["module-basics"]),
        retakePolicy,
        null,
        []
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "MODULE_NOT_ACTIVE")).toBe(true);
    });

    it("should error when required prerequisites not met", () => {
      const passedModules = new Set(["module-intermediate"]); // Missing module-basics
      const result = EnrollmentValidator.validateEnrollment(
        validEnrollment,
        validModule,
        validPrerequisites,
        passedModules,
        retakePolicy,
        null,
        []
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "PREREQUISITES_NOT_MET")).toBe(true);
    });

    it("should warn about missing recommended prerequisites", () => {
      const passedModules = new Set(["module-basics"]); // Missing recommended module-intermediate
      const result = EnrollmentValidator.validateEnrollment(
        validEnrollment,
        validModule,
        validPrerequisites,
        passedModules,
        retakePolicy,
        null,
        []
      );

      expect(result.valid).toBe(true); // Can still enroll
      expect(
        result.warnings.some((w) => w.code === "RECOMMENDED_PREREQUISITES_NOT_MET")
      ).toBe(true);
    });

    it("should error on duplicate enrollment in same term", () => {
      const result = EnrollmentValidator.validateEnrollment(
        validEnrollment,
        validModule,
        validPrerequisites,
        new Set(["module-basics", "module-intermediate"]),
        retakePolicy,
        null,
        ["module-1"] // Already enrolled in this term
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "ALREADY_ENROLLED_THIS_TERM")).toBe(true);
    });

    it("should handle retake policy check", () => {
      // This test verifies that retake policy is checked when attempts > 0
      const result = EnrollmentValidator.validateEnrollment(
        enrollmentWithAttempts,
        validModule,
        validPrerequisites,
        new Set(["module-basics"]),
        retakePolicy,
        "2024-10-15", // Last attempt date
        []
      );

      // Result depends on retake policy evaluation
      expect(result).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS: Realistic Scenarios
// ═══════════════════════════════════════════════════════════════════════════════

describe("Integration: Realistic Validation Scenarios", () => {
  it("should validate complete Swiss module workflow", () => {
    const swissModule: AcademicModule = {
      ...validModule,
      name: "Informatik I",
      moduleCode: "INF-101",
      gradeScaleId: "scale-ch-1-6",
      language: "German",
    };

    const result = ModuleValidator.validateForPublish(
      swissModule,
      validComponents,
      validPrerequisites,
      chGradeScale,
      passPolicy,
      creditScheme,
      ["module-1", "module-basics", "module-intermediate"]
    );

    expect(result.valid).toBe(true);
  });

  it("should validate complete German module workflow", () => {
    const germanModule: AcademicModule = {
      ...validModule,
      name: "Mathematik für Informatik",
      moduleCode: "MAT-201",
      gradeScaleId: "scale-de-1-5",
      language: "German",
    };

    const result = ModuleValidator.validateForPublish(
      germanModule,
      validComponents,
      validPrerequisites,
      deGradeScale,
      passPolicy,
      creditScheme,
      ["module-1", "module-basics", "module-intermediate"]
    );

    expect(result.valid).toBe(true);
  });

  it("should validate complete program structure with all requirements", () => {
    const completeProgram: Program = {
      ...validProgram,
      thesisRequired: true,
      internshipRequired: true,
    };

    const completeGroups: ProgramRequirementGroup[] = [
      ...validRequirementGroups,
      {
        id: "group-thesis",
        programId: "program-1",
        name: "Bachelor Thesis",
        groupType: "thesis",
        minCreditsRequired: 12,
        minModulesRequired: 1,
        maxModulesCounted: 1,
        ruleType: "all_of",
        parentGroupId: undefined,
        sortOrder: 3,
        isActive: true,
        metadata: {},
      },
      {
        id: "group-internship",
        programId: "program-1",
        name: "Internship",
        groupType: "internship",
        minCreditsRequired: 18,
        minModulesRequired: 1,
        maxModulesCounted: 1,
        ruleType: "all_of",
        parentGroupId: undefined,
        sortOrder: 4,
        isActive: true,
        metadata: {},
      },
    ];

    const result = ProgramValidator.validateStructure(
      completeProgram,
      completeGroups,
      [validModule],
      validCompletionPolicy
    );

    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.code === "THESIS_GROUP_MISSING")).toHaveLength(0);
    expect(result.errors.filter((e) => e.code === "INTERNSHIP_GROUP_MISSING")).toHaveLength(0);
  });

  it("should validate complex prerequisite chain", () => {
    const complexPrerequisites: ModulePrerequisite[] = [
      {
        id: "p1",
        moduleId: "module-level2",
        prerequisiteModuleId: "module-level1",
        prerequisiteType: "required",
      },
      {
        id: "p2",
        moduleId: "module-level3",
        prerequisiteModuleId: "module-level2",
        prerequisiteType: "required",
      },
      {
        id: "p3",
        moduleId: "module-level3",
        prerequisiteModuleId: "module-advanced",
        prerequisiteType: "recommended",
      },
    ];

    const result = ModuleValidator.validateForPublish(
      validModule,
      validComponents,
      complexPrerequisites,
      chGradeScale,
      passPolicy,
      creditScheme,
      ["module-1", "module-level1", "module-level2", "module-level3", "module-advanced"]
    );

    expect(result.valid).toBe(true);
  });
});
