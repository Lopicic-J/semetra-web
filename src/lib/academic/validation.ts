/**
 * Semetra Academic Validation Services
 *
 * Pure validation logic for app-layer business rules.
 * These validators complement database constraints and operate on in-memory data.
 *
 * Architecture:
 *   - ModuleValidator    → Module structure, components, prerequisites
 *   - ProgramValidator   → Program structure, completion policies
 *   - InstitutionValidator → Institution consistency
 *   - EnrollmentValidator → Enrollment eligibility
 *
 * All validators are pure functions: no database calls, deterministic,
 * receive all required data as parameters.
 */

import type {
  AcademicModule,
  AssessmentComponent,
  ModulePrerequisite,
  GradeScale,
  PassPolicy,
  CreditScheme,
  Program,
  ProgramRequirementGroup,
  Institution,
  Enrollment,
  RetakePolicy,
  ProgramCompletionPolicy,
} from "./types";
import { checkRetakeEligibility } from "./engine";

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  detail?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[]; // non-blocking issues
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

export const ModuleValidator = {
  /**
   * Comprehensive module validation for publishing.
   * Ensures all required metadata and constraints are met.
   */
  validateForPublish(
    module: AcademicModule,
    components: AssessmentComponent[],
    prerequisites: ModulePrerequisite[],
    gradeScale: GradeScale | null,
    passPolicy: PassPolicy | null,
    creditScheme: CreditScheme | null,
    allModuleIds: string[]
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Module code validation
    if (!module.moduleCode || module.moduleCode.trim() === "") {
      errors.push({
        code: "MODULE_CODE_MISSING",
        message: "Modulcode ist erforderlich",
        field: "moduleCode",
      });
    }

    // Grade scale validation
    if (!gradeScale) {
      errors.push({
        code: "GRADE_SCALE_MISSING",
        message: "Notenskala ist erforderlich",
        field: "gradeScaleId",
      });
    }

    // Pass policy validation
    if (!passPolicy) {
      errors.push({
        code: "PASS_POLICY_MISSING",
        message: "Bestehensrichtlinie ist erforderlich",
        field: "passPolicyId",
      });
    }

    // Credit scheme validation
    if (!creditScheme) {
      errors.push({
        code: "CREDIT_SCHEME_MISSING",
        message: "Kreditsystem ist erforderlich",
        field: "creditSchemeId",
      });
    }

    // ECTS validation
    if (module.ects <= 0) {
      errors.push({
        code: "ECTS_INVALID",
        message: "ECTS-Punkte müssen größer als 0 sein",
        field: "ects",
        detail: { value: module.ects },
      });
    }

    // Component weight validation (only if we have components)
    if (components.length > 0) {
      const weightResult = this.validateComponentWeights(components);
      // Always propagate errors AND warnings (warnings exist even when valid=true)
      errors.push(...weightResult.errors);
      warnings.push(...weightResult.warnings);
    }

    // Check for mixed pass_fail and numeric grades
    if (gradeScale && components.length > 0) {
      const hasPassFailComponent = components.some(
        (c) => c.componentType === "pass_fail_requirement"
      );
      const hasNumericComponent = components.some(
        (c) => c.componentType !== "pass_fail_requirement"
      );

      if (hasPassFailComponent && hasNumericComponent && gradeScale.type !== "pass_fail") {
        warnings.push({
          code: "MIXED_ASSESSMENT_TYPES",
          message:
            "Modul enthält sowohl Pass/Fail- als auch numerische Bewertungskomponenten. Dies kann zu Konflikten führen.",
          field: "components",
          detail: { gradeScaleType: gradeScale.type },
        });
      }
    }

    // Prerequisite validation
    const prerequisiteError = this.detectPrerequisiteCycles(
      module.id,
      prerequisites,
      new Map(prerequisites.map((p) => [p.moduleId, [p]]))
    );
    if (!prerequisiteError.valid) {
      errors.push(...prerequisiteError.errors);
    }

    // Check that all prerequisite module IDs exist
    const missingPrereqs = prerequisites
      .map((p) => p.prerequisiteModuleId)
      .filter((id) => !allModuleIds.includes(id));

    if (missingPrereqs.length > 0) {
      errors.push({
        code: "PREREQUISITE_MODULE_NOT_FOUND",
        message: `Voraussetzungsmodule nicht gefunden: ${missingPrereqs.join(", ")}`,
        field: "prerequisites",
        detail: { missingModuleIds: missingPrereqs },
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Validates that assessment component weights sum to 100%
   * Only for components where contributesToFinal is true.
   */
  validateComponentWeights(components: AssessmentComponent[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Only check weights for components that contribute to final grade
    const contributingComponents = components.filter((c) => c.contributesToFinal);

    if (contributingComponents.length === 0) {
      warnings.push({
        code: "NO_CONTRIBUTING_COMPONENTS",
        message: "Keine Bewertungskomponenten tragen zur Endnote bei",
        field: "components",
      });
      return { valid: true, errors, warnings };
    }

    const totalWeight = contributingComponents.reduce(
      (sum, c) => sum + c.weightPercent,
      0
    );
    const weightSum = Math.round(totalWeight * 100) / 100; // Handle floating point errors

    // Allow 0.01% tolerance for floating point precision
    if (Math.abs(weightSum - 100) > 0.01) {
      errors.push({
        code: "COMPONENT_WEIGHTS_DO_NOT_SUM_TO_100",
        message: `Gewichtungen summieren sich auf ${weightSum}%, sollten aber 100% sein`,
        field: "components",
        detail: {
          totalWeight: weightSum,
          components: contributingComponents.map((c) => ({
            id: c.id,
            name: c.name,
            weight: c.weightPercent,
          })),
        },
      });
    }

    // Warn about individual component weights that seem unusual
    for (const comp of contributingComponents) {
      if (comp.weightPercent <= 0) {
        warnings.push({
          code: "COMPONENT_ZERO_WEIGHT",
          message: `Komponente "${comp.name}" hat Gewichtung ≤ 0%`,
          field: "components",
          detail: { componentId: comp.id, weight: comp.weightPercent },
        });
      }
      if (comp.weightPercent > 100) {
        warnings.push({
          code: "COMPONENT_WEIGHT_EXCEEDS_100",
          message: `Komponente "${comp.name}" hat Gewichtung > 100%`,
          field: "components",
          detail: { componentId: comp.id, weight: comp.weightPercent },
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Detects circular dependencies in module prerequisites using DFS.
   * Returns validation error if a cycle is found.
   */
  detectPrerequisiteCycles(
    moduleId: string,
    prerequisites: ModulePrerequisite[],
    allPrerequisites: Map<string, ModulePrerequisite[]>
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Build adjacency map: moduleId -> list of prerequisite module IDs
    const adjMap = new Map<string, string[]>();
    for (const prereq of prerequisites) {
      if (!adjMap.has(prereq.moduleId)) {
        adjMap.set(prereq.moduleId, []);
      }
      adjMap.get(prereq.moduleId)!.push(prereq.prerequisiteModuleId);
    }

    // DFS to detect cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = adjMap.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Back edge found: cycle detected
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    // Check for cycles starting from the given module AND all nodes in the graph
    // (cycles might exist between other modules in the prerequisite chain)
    const allNodesArr = [moduleId, ...Array.from(adjMap.keys())];
    const allNodes = new Set(allNodesArr);
    let cycleFound = false;
    for (const node of Array.from(allNodes)) {
      if (!visited.has(node) && hasCycle(node)) {
        cycleFound = true;
        break;
      }
    }

    if (cycleFound) {
      errors.push({
        code: "PREREQUISITE_CYCLE_DETECTED",
        message: `Zirkuläre Abhängigkeit erkannt in den Voraussetzungen des Moduls`,
        field: "prerequisites",
        detail: { moduleId },
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRAM VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

export const ProgramValidator = {
  /**
   * Validates overall program structure and requirement groups.
   */
  validateStructure(
    program: Program,
    groups: ProgramRequirementGroup[],
    modules: AcademicModule[],
    completionPolicy: ProgramCompletionPolicy | null
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate that requirement groups have valid credit requirements
    for (const group of groups) {
      if (group.minCreditsRequired !== undefined && group.minCreditsRequired < 0) {
        errors.push({
          code: "GROUP_INVALID_MIN_CREDITS",
          message: `Anforderungsgruppe "${group.name}" hat ungültige Mindestkredit-Anforderung`,
          field: "groups",
          detail: { groupId: group.id, minCredits: group.minCreditsRequired },
        });
      }

      if (group.minModulesRequired !== undefined && group.minModulesRequired < 0) {
        errors.push({
          code: "GROUP_INVALID_MIN_MODULES",
          message: `Anforderungsgruppe "${group.name}" hat ungültige Mindestmodul-Anforderung`,
          field: "groups",
          detail: { groupId: group.id, minModules: group.minModulesRequired },
        });
      }

      // Warn if maxModulesCounted < minModulesRequired
      if (
        group.maxModulesCounted !== undefined &&
        group.minModulesRequired !== undefined &&
        group.maxModulesCounted < group.minModulesRequired
      ) {
        warnings.push({
          code: "GROUP_MAX_LESS_THAN_MIN_MODULES",
          message: `Anforderungsgruppe "${group.name}": Maximale Module < Mindestmodule`,
          field: "groups",
          detail: {
            groupId: group.id,
            minModules: group.minModulesRequired,
            maxModules: group.maxModulesCounted,
          },
        });
      }
    }

    // Validate total group credits cover program requirement
    const totalGroupCreditsRequired = groups.reduce((sum, g) => {
      return sum + (g.minCreditsRequired ?? 0);
    }, 0);

    if (totalGroupCreditsRequired < program.requiredTotalCredits) {
      warnings.push({
        code: "TOTAL_GROUP_CREDITS_INSUFFICIENT",
        message: `Summe der Gruppenminimalkredite (${totalGroupCreditsRequired}) deckt nicht das Programmminimum (${program.requiredTotalCredits})`,
        field: "groups",
        detail: {
          groupMinimumSum: totalGroupCreditsRequired,
          programRequired: program.requiredTotalCredits,
        },
      });
    }

    // Check that at least one compulsory group exists
    const hasCompulsoryGroup = groups.some((g) => g.groupType === "compulsory");
    if (!hasCompulsoryGroup) {
      warnings.push({
        code: "NO_COMPULSORY_GROUP",
        message: "Programm hat keine Pflichtgruppe",
        field: "groups",
      });
    }

    // Check thesis requirement
    if (program.thesisRequired) {
      const hasThesisGroup = groups.some((g) => g.groupType === "thesis");
      if (!hasThesisGroup) {
        errors.push({
          code: "THESIS_GROUP_MISSING",
          message: "Abschlussarbeit erforderlich, aber keine Thesis-Gruppe definiert",
          field: "groups",
        });
      }
    }

    // Check internship requirement
    if (program.internshipRequired) {
      const hasInternshipGroup = groups.some((g) => g.groupType === "internship");
      if (!hasInternshipGroup) {
        errors.push({
          code: "INTERNSHIP_GROUP_MISSING",
          message: "Praktikum erforderlich, aber keine Praktikums-Gruppe definiert",
          field: "groups",
        });
      }
    }

    // Validate all modules belong to groups that belong to this program
    const groupIds = new Set(groups.map((g) => g.id));
    const orphanModules = modules.filter(
      (m) => m.programId === program.id && m.requirementGroupId && !groupIds.has(m.requirementGroupId)
    );

    if (orphanModules.length > 0) {
      errors.push({
        code: "ORPHAN_MODULES",
        message: `${orphanModules.length} Module sind Anforderungsgruppen zugeordnet, die nicht zum Programm gehören`,
        field: "modules",
        detail: {
          orphanModuleIds: orphanModules.map((m) => m.id),
        },
      });
    }

    // Validate completion policy if provided
    if (completionPolicy) {
      const policyError = this.validateCompletionPolicy(program, completionPolicy);
      if (!policyError.valid) {
        errors.push(...policyError.errors);
      }
      warnings.push(...policyError.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Validates program completion policy requirements.
   */
  validateCompletionPolicy(
    program: Program,
    policy: ProgramCompletionPolicy
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Min credits must be <= program total
    if (policy.minTotalCredits > program.requiredTotalCredits) {
      errors.push({
        code: "COMPLETION_POLICY_CREDITS_EXCEED_PROGRAM",
        message: `Mindestkredite in Abschlussrichtlinie (${policy.minTotalCredits}) übersteigen Programmminimum (${program.requiredTotalCredits})`,
        field: "completionPolicy",
        detail: {
          policyMinCredits: policy.minTotalCredits,
          programRequiredCredits: program.requiredTotalCredits,
        },
      });
    }

    // Duration validation
    if (policy.maxDurationTerms && policy.maxDurationTerms < program.durationStandardTerms) {
      warnings.push({
        code: "MAX_DURATION_LESS_THAN_STANDARD",
        message: `Maximale Dauer (${policy.maxDurationTerms} Semester) ist kürzer als Standarddauer (${program.durationStandardTerms})`,
        field: "completionPolicy",
        detail: {
          maxDuration: policy.maxDurationTerms,
          standardDuration: program.durationStandardTerms,
        },
      });
    }

    // GPA threshold validation (very basic: should be between 0 and 100)
    if (policy.minGpa !== undefined) {
      if (policy.minGpa < 0 || policy.minGpa > 100) {
        errors.push({
          code: "COMPLETION_POLICY_INVALID_GPA",
          message: `GPA-Schwelle muss zwischen 0 und 100 liegen, erhalten: ${policy.minGpa}`,
          field: "completionPolicy",
          detail: { minGpa: policy.minGpa },
        });
      }
    }

    // Thesis min grade validation
    if (policy.thesisMinGrade !== undefined && policy.thesisMinGrade < 0) {
      warnings.push({
        code: "THESIS_MIN_GRADE_NEGATIVE",
        message: `Mindestnotenfor Thesis ist negativ: ${policy.thesisMinGrade}`,
        field: "completionPolicy",
        detail: { thesisMinGrade: policy.thesisMinGrade },
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// INSTITUTION VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

export const InstitutionValidator = {
  /**
   * Validates institution consistency: all related entities reference this institution.
   */
  validateConsistency(
    institution: Institution,
    faculties: Array<{ id: string; institutionId: string }>,
    programs: Program[]
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate all programs reference this institution
    const unrelatedPrograms = programs.filter((p) => p.institutionId && p.institutionId !== institution.id);
    if (unrelatedPrograms.length > 0) {
      errors.push({
        code: "PROGRAMS_NOT_BELONG_TO_INSTITUTION",
        message: `${unrelatedPrograms.length} Programme verweisen nicht auf diese Institution`,
        field: "programs",
        detail: { programIds: unrelatedPrograms.map((p) => p.id) },
      });
    }

    // Validate all faculties reference this institution
    const unrelatedFaculties = faculties.filter((f) => f.institutionId !== institution.id);
    if (unrelatedFaculties.length > 0) {
      errors.push({
        code: "FACULTIES_NOT_BELONG_TO_INSTITUTION",
        message: `${unrelatedFaculties.length} Fakultäten verweisen nicht auf diese Institution`,
        field: "faculties",
        detail: { facultyIds: unrelatedFaculties.map((f) => f.id) },
      });
    }

    // Validate default policy references (basic existence check)
    const requiredPolicies = [
      { field: "defaultCreditSchemeId", name: "Kreditsystem" },
      { field: "defaultGradeScaleId", name: "Notenskala" },
      { field: "defaultPassPolicyId", name: "Bestehensrichtlinie" },
    ];

    for (const policy of requiredPolicies) {
      const value = institution[policy.field as keyof Institution];
      if (!value) {
        errors.push({
          code: "INSTITUTION_DEFAULT_POLICY_MISSING",
          message: `Institution hat kein Standard-${policy.name} festgelegt`,
          field: policy.field,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ENROLLMENT VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

export const EnrollmentValidator = {
  /**
   * Validates enrollment eligibility for a student in a module.
   * Checks prerequisites, retake eligibility, duplicate enrollment, and module status.
   */
  validateEnrollment(
    enrollment: Enrollment,
    module: AcademicModule | null,
    prerequisites: ModulePrerequisite[],
    passedModules: Set<string>,
    retakePolicy: RetakePolicy | null,
    lastAttemptDate: string | null,
    currentTermEnrollments: string[] // module IDs already enrolled in same term
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Module must exist and be published
    if (!module) {
      errors.push({
        code: "MODULE_NOT_FOUND",
        message: "Modul existiert nicht",
        field: "moduleId",
        detail: { moduleId: enrollment.moduleId },
      });
      return { valid: false, errors, warnings };
    }

    if (module.status && module.status !== "published" && module.status !== "active") {
      errors.push({
        code: "MODULE_NOT_ACTIVE",
        message: `Modul ist nicht verfügbar (Status: ${module.status})`,
        field: "moduleId",
        detail: { status: module.status },
      });
    }

    // Check prerequisites
    const unmetPrerequisites = prerequisites
      .filter((p) => p.prerequisiteType === "required")
      .filter((p) => !passedModules.has(p.prerequisiteModuleId))
      .map((p) => p.prerequisiteModuleId);

    if (unmetPrerequisites.length > 0) {
      errors.push({
        code: "PREREQUISITES_NOT_MET",
        message: `Voraussetzungen nicht erfüllt: ${unmetPrerequisites.join(", ")}`,
        field: "prerequisites",
        detail: { missingPrerequisiteIds: unmetPrerequisites },
      });
    }

    // Check recommended prerequisites (warning only)
    const unmetRecommendedPrereqs = prerequisites
      .filter((p) => p.prerequisiteType === "recommended")
      .filter((p) => !passedModules.has(p.prerequisiteModuleId))
      .map((p) => p.prerequisiteModuleId);

    if (unmetRecommendedPrereqs.length > 0) {
      warnings.push({
        code: "RECOMMENDED_PREREQUISITES_NOT_MET",
        message: `Empfohlene Voraussetzungen nicht erfüllt: ${unmetRecommendedPrereqs.join(", ")}`,
        field: "prerequisites",
        detail: { missingRecommendedIds: unmetRecommendedPrereqs },
      });
    }

    // Check for duplicate enrollment in same term
    if (currentTermEnrollments.includes(enrollment.moduleId)) {
      errors.push({
        code: "ALREADY_ENROLLED_THIS_TERM",
        message: "Student ist in diesem Semester bereits für dieses Modul angemeldet",
        field: "termId",
        detail: { moduleId: enrollment.moduleId },
      });
    }

    // Check retake eligibility if module was already attempted
    if (enrollment.attemptsUsed > 0 && retakePolicy) {
      const retakeCheck = checkRetakeEligibility(enrollment, retakePolicy, lastAttemptDate);
      if (!retakeCheck.eligible) {
        errors.push({
          code: "RETAKE_NOT_ELIGIBLE",
          message: retakeCheck.reason,
          field: "retakePolicy",
          detail: { reason: retakeCheck.reason },
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },
};
