/**
 * Semetra Academic Module — Public API
 *
 * Usage:
 *   import { calculateModuleGrade, normalizeGrade, ... } from "@/lib/academic";
 *   import type { GradeScale, Enrollment, ... } from "@/lib/academic";
 */

// Types
export type {
  BaseEntity,
  CreditSchemeCode,
  CreditScheme,
  GradeScaleType,
  GradeDirection,
  GradeScale,
  GradeBand,
  GradeRecord,
  PassPolicyType,
  PassPolicy,
  AssessmentType,
  AssessmentComponent,
  ComponentResult,
  GradeReplacement,
  RetakePolicy,
  RoundingMethod,
  RoundingScope,
  RoundingPolicy,
  CountrySystem,
  InstitutionType,
  Institution,
  DegreeLevel,
  Program,
  RequirementGroupType,
  RequirementRuleType,
  ProgramRequirementGroup,
  EnrollmentStatus,
  Enrollment,
  AttemptStatus,
  Attempt,
  CreditAwardReason,
  CreditAward,
  RecognitionStatus,
  RecognitionMode,
  Recognition,
  ClassificationRule,
  ClassificationScheme,
  GPACalculationType,
  GPAScope,
  GPAScheme,
  TermType,
  AcademicTerm,
  DeliveryMode,
  AcademicModule,
  TranscriptEntry,
  ProgressSnapshot,
  PrerequisiteType,
  ModulePrerequisite,
  StudentProgramStatus,
  StudentProgram,
  ProgramCompletionPolicy,
} from "./types";

// Engine functions
export {
  // Rounding
  applyRounding,
  // Grades
  isValidGrade,
  isPassingGrade,
  compareGrades,
  bestGrade,
  getGradeBand,
  roundGradeToStep,
  formatGradeValue,
  // Normalization & Conversion
  normalizeGrade,
  convertGrade,
  convertViaBayerischeFormel,
  // Recognition
  evaluateRecognition,
  // Credits
  convertCredits,
  toEcts,
  termWorkload,
  // Assessment
  calculateModuleGrade,
  // Pass Logic
  evaluatePassPolicy,
  // Attempts
  resolveEffectiveAttempt,
  // GPA
  calculateGPA,
  // Classification
  classifyDegree,
  // Progress
  evaluateRequirementGroup,
  calculateCompletionPercentage,
  estimateGraduation,
  // Programme Completion
  checkProgramCompletion,
  buildProgressSnapshot,
  // Scenario
  gradeNeededForTarget,
  gradeNeededOnComponent,
  // Validation
  validateComponentWeights,
  checkRetakeEligibility,
  // Prerequisites
  checkPrerequisites,
  // Completion Policy
  evaluateCompletionPolicy,
} from "./engine";

export type {
  GPAInput,
  GroupProgress,
  RecognitionResult,
  ProgramCompletionResult,
  PrerequisiteCheckResult,
  CompletionPolicyResult,
} from "./engine";

// Validators
export {
  ModuleValidator,
  ProgramValidator,
  InstitutionValidator,
  EnrollmentValidator,
} from "./validation";

export type {
  ValidationError,
  ValidationResult,
} from "./validation";
