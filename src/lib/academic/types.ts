/**
 * Semetra Academic Domain Types — Maximum Edition
 *
 * Clean separation of concerns:
 *   A. Credit System   — workload, not performance
 *   B. Grade System    — evaluation, not credits
 *   C. Pass Logic      — pass/fail determination
 *   D. Assessment      — sub-components and weights
 *   E. Progress Logic  — study advancement
 *   F. Completion      — degree requirements
 *   G. Recognition     — transfer and conversion
 */

// ═══════════════════════════════════════════════════════════════════════════════
// A. Credit System
// ═══════════════════════════════════════════════════════════════════════════════

export type CreditSchemeCode = "ECTS" | "CFU" | "CATS" | "LOCAL";

/** Common fields on all reference/policy tables (DB defaults apply) */
export interface BaseEntity {
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreditScheme extends BaseEntity {
  id: string;
  code: CreditSchemeCode;
  name: string;
  unitsPerFullTimeYear: number;
  conversionToEcts: number;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// B. Grade System
// ═══════════════════════════════════════════════════════════════════════════════

export type GradeScaleType =
  | "numeric" | "numeric_reverse_quality" | "numeric_with_honours"
  | "percentage" | "classification" | "pass_fail" | "hybrid";
export type GradeDirection = "higher_is_better" | "lower_is_better";

export interface GradeScale extends BaseEntity {
  id: string;
  code: string;
  name: string;
  countryCode: string | null;
  type: GradeScaleType;
  minValue: number;
  maxValue: number;
  passValue: number;
  stepSize: number;
  decimalPlaces: number;
  higherIsBetter: boolean;
  supportsHonours: boolean;
  specialLabels: Record<string, string>;
}

export interface GradeBand extends BaseEntity {
  id: string;
  gradeScaleId: string;
  fromValue: number;
  toValue: number;
  label: string;
  shortLabel?: string;
  isPassing: boolean;
  honourLevel?: string;
  sortOrder: number;
}

/** Four-layer grade storage: NEVER destroy local grades */
export interface GradeRecord {
  localGradeValue: number | null;
  localGradeLabel: string | null;
  normalizedScore0to100: number | null;
  normalizationMethod: string | null;
  conversionConfidence: number | null; // 0.0–1.0
}

// ═══════════════════════════════════════════════════════════════════════════════
// C. Pass Logic
// ═══════════════════════════════════════════════════════════════════════════════

export type PassPolicyType =
  | "overall_threshold"
  | "all_mandatory_components"
  | "threshold_plus_component_minimums"
  | "pass_fail_only"
  | "compensation_model";

export interface PassPolicy extends BaseEntity {
  id: string;
  code: string;
  name: string;
  policyType: PassPolicyType;
  overallPassThreshold: number | null;
  allowCompensation: boolean;
  requiresAllMandatory: boolean;
  partialCreditAllowed: boolean;
  rulesJson: Record<string, unknown>;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// D. Assessment Structure
// ═══════════════════════════════════════════════════════════════════════════════

export type AssessmentType =
  | "written_exam" | "oral_exam" | "project" | "lab"
  | "homework" | "presentation" | "participation"
  | "thesis" | "attendance_requirement" | "pass_fail_requirement";

export interface AssessmentComponent extends BaseEntity {
  id: string;
  moduleId: string;
  name: string;
  componentType: AssessmentType;
  weightPercent: number;
  gradeScaleId?: string;
  passPolicyId?: string;
  minPassRequired: boolean;
  contributesToFinal: boolean;
  mandatoryToPass: boolean;
  sequenceOrder: number;
}

export interface ComponentResult {
  id: string;
  attemptId: string;
  componentId: string;
  rawScore: number | null;
  gradeValue: number | null;
  gradeLabel: string | null;
  passed: boolean | null;
  weightApplied: number | null;
  honoursLabel?: string;
  graderNotes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// E. Retake & Rounding
// ═══════════════════════════════════════════════════════════════════════════════

export type GradeReplacement = "best_attempt" | "latest_attempt" | "average_attempts" | "first_pass_only";

export interface RetakePolicy extends BaseEntity {
  id: string;
  code: string;
  name: string;
  maxAttempts: number;
  retakeIfPassed: boolean;
  gradeReplacement: GradeReplacement;
  resitAllowed: boolean;
  resitSameTerm: boolean;
  cooldownDays: number;
  notes?: string;
}

export type RoundingMethod = "normal" | "floor" | "ceil" | "bankers";
export type RoundingScope = "component" | "final_grade" | "transcript_only";

export interface RoundingPolicy extends BaseEntity {
  id: string;
  code: string;
  name: string;
  roundTo: number;
  method: RoundingMethod;
  applyTo: RoundingScope;
}

// ═══════════════════════════════════════════════════════════════════════════════
// F. Country, Institution, Program
// ═══════════════════════════════════════════════════════════════════════════════

export interface CountrySystem {
  countryCode: string;
  name: string;
  flag?: string;
  defaultCreditSchemeId?: string;
  defaultGradeScaleId?: string;
  defaultRoundingPolicyId?: string;
  defaultPassPolicyId?: string;
  defaultRetakePolicyId?: string;
  defaultCalendarType: string;
  usesHonours: boolean;
}

export type InstitutionType = "university" | "university_of_applied_sciences" | "college" | "polytechnic";

export interface Institution extends BaseEntity {
  id: string;
  name: string;
  code?: string;
  countryCode: string;
  institutionType: InstitutionType;
  officialLanguage?: string;
  academicYearStartMonth: number;
  defaultCreditSchemeId?: string;
  defaultGradeScaleId?: string;
  defaultRoundingPolicyId?: string;
  defaultPassPolicyId?: string;
  defaultRetakePolicyId?: string;
  defaultClassificationSchemeId?: string;
  defaultGpaSchemeId?: string;
  timezone?: string;
  website?: string;
}

export type DegreeLevel = "short_cycle" | "bachelor" | "master" | "phd" | "diploma";

export interface Program extends BaseEntity {
  id: string;
  institutionId?: string;
  facultyId?: string;
  code?: string;
  name: string;
  degreeLevel: DegreeLevel;
  requiredTotalCredits: number;
  creditSchemeId?: string;
  ectsTotal?: number;
  ectsEquivalentTotal?: number;
  durationStandardTerms: number;
  classificationSchemeId?: string;
  gpaSchemeId?: string;
  completionPolicyId?: string;
  completionRules: Record<string, unknown>;
  thesisRequired: boolean;
  internshipRequired: boolean;
  finalExamRequired: boolean;
  status: string;
}

export type RequirementGroupType =
  | "compulsory" | "elective_required" | "elective_free"
  | "specialisation" | "minor" | "thesis" | "internship" | "final_exam";

export type RequirementRuleType = "any_of" | "all_of" | "choose_n" | "choose_credits";

export interface ProgramRequirementGroup extends BaseEntity {
  id: string;
  programId: string;
  name: string;
  groupType: RequirementGroupType;
  minCreditsRequired?: number;
  minModulesRequired?: number;
  maxModulesCounted?: number;
  ruleType: RequirementRuleType;
  parentGroupId?: string;
  sortOrder: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// G. Enrollment, Attempt, Credit Award
// ═══════════════════════════════════════════════════════════════════════════════

export type EnrollmentStatus =
  | "planned" | "enrolled" | "ongoing"
  | "passed" | "failed" | "withdrawn" | "recognised";

export interface Enrollment {
  id: string;
  userId: string;
  moduleId: string;
  programId?: string;
  academicYear?: string;
  termId?: string;
  status: EnrollmentStatus;
  attemptsUsed: number;
  currentFinalGrade: number | null;
  currentGradeLabel: string | null;
  currentPassed: boolean | null;
  creditsAwarded: number;
  // Normalization
  localGradeValue: number | null;
  localGradeLabel: string | null;
  normalizedScore0to100: number | null;
  normalizationMethod: string | null;
  conversionConfidence: number | null;
  recognitionMode?: RecognitionMode;
}

export type AttemptStatus =
  | "in_progress" | "submitted" | "graded"
  | "passed" | "failed" | "void" | "withdrawn";

export interface Attempt {
  id: string;
  enrollmentId: string;
  attemptNumber: number;
  dateStarted?: string;
  dateCompleted?: string;
  status: AttemptStatus;
  finalGradeValue: number | null;
  finalGradeLabel: string | null;
  passed: boolean | null;
  creditsAwarded: number;
  countsTowardRecord: boolean;
  isResit: boolean;
  honoursLabel?: string;
  notes?: string;
}

export type CreditAwardReason =
  | "passed_module" | "transfer" | "recognition" | "exemption" | "prior_learning";

export interface CreditAward {
  id: string;
  userId: string;
  moduleId?: string;
  attemptId?: string;
  creditsAwardedValue: number;
  creditSchemeId?: string;
  ectsEquivalent?: number;
  awardReason: CreditAwardReason;
  awardedAt: string;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// H. Recognition / Transfer
// ═══════════════════════════════════════════════════════════════════════════════

export type RecognitionStatus = "pending" | "accepted" | "partial" | "rejected";
export type RecognitionMode = "credits_only" | "credits_and_grade" | "exemption_only";

export interface Recognition {
  id: string;
  userId: string;
  sourceInstitution: string;
  sourceModuleName: string;
  sourceCreditValue?: number;
  sourceCreditScheme?: string;
  sourceGradeValue?: number;
  sourceGradeScale?: string;
  recognizedAsModuleId?: string;
  recognizedEcts?: number;
  recognizedGradeValue?: number;
  recognitionStatus: RecognitionStatus;
  evidenceDocumentRef?: string;
  decisionNotes?: string;
  decidedAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// I. Classification & GPA
// ═══════════════════════════════════════════════════════════════════════════════

export type ClassificationRule = {
  min: number;
  label: string;
  short?: string;
  requiresUnanimous?: boolean;
};

export interface ClassificationScheme extends BaseEntity {
  id: string;
  code: string;
  name: string;
  countryCode?: string;
  schemeType: string;
  rules: ClassificationRule[];
}

export type GPACalculationType =
  | "weighted_average" | "simple_average" | "weighted_by_credits" | "custom";

export type GPAScope =
  | "all_modules" | "passed_modules_only" | "final_stage_only" | "degree_relevant_only";

export interface GPAScheme extends BaseEntity {
  id: string;
  code: string;
  name: string;
  calculationType: GPACalculationType;
  includesFailed: boolean;
  includesRepeats: boolean;
  dropLowestAllowed: boolean;
  calculationScope: GPAScope;
}

// ═══════════════════════════════════════════════════════════════════════════════
// J. Academic Term
// ═══════════════════════════════════════════════════════════════════════════════

export type TermType = "semester" | "trimester" | "quarter" | "yearly" | "block";

export interface AcademicTerm extends BaseEntity {
  id: string;
  userId: string;
  institutionId?: string;
  academicYearLabel: string;
  termType: TermType;
  termNumber: number;
  termLabel?: string;
  startDate?: string;
  endDate?: string;
  teachingEndDate?: string;
  examStartDate?: string;
  examEndDate?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// K. Module (extended)
// ═══════════════════════════════════════════════════════════════════════════════

export type DeliveryMode = "onsite" | "online" | "hybrid";

export interface AcademicModule {
  id: string;
  userId: string;
  name: string;
  moduleCode?: string;
  description?: string;
  ects: number;
  creditSchemeId?: string;
  ectsEquivalent?: number;
  gradeScaleId?: string;
  passPolicyId?: string;
  retakePolicyId?: string;
  roundingPolicyId?: string;
  programId?: string;
  requirementGroupId?: string;
  termType?: string;
  defaultTermNumber?: number;
  isCompulsory: boolean;
  isRepeatable: boolean;
  attendanceRequired: boolean;
  language?: string;
  deliveryMode: DeliveryMode;
  prerequisitesJson: string[];
  // Existing fields maintained for backward compatibility
  semester?: string;
  color?: string;
  professor?: string;
  status?: string;
  targetGrade?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// L. Transcript & Progress
// ═══════════════════════════════════════════════════════════════════════════════

export interface TranscriptEntry {
  module: AcademicModule;
  enrollment: Enrollment;
  localCredits: number;
  ectsCredits: number;
  localGrade: number | null;
  gradeLabel: string | null;
  status: EnrollmentStatus;
  isRecognised: boolean;
  isRepeated: boolean;
  institution?: string;
  date?: string;
}

export interface ProgressSnapshot {
  totalCreditsRequired: number;
  totalCreditsEarned: number;
  totalEctsEarned: number;
  creditsPerGroup: Record<string, { required: number; earned: number; groupName: string }>;
  gpa: number | null;
  classificationForecast: string | null;
  modulesPassedCount: number;
  modulesFailedCount: number;
  modulesOngoingCount: number;
  modulesPlannedCount: number;
  estimatedGraduationTerm?: string;
  workloadCurrentTerm?: number;
  workloadRecommended?: number;
  isOverloaded: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// M. Module Prerequisites
// ═══════════════════════════════════════════════════════════════════════════════

export type PrerequisiteType = "required" | "recommended" | "corequisite";

export interface ModulePrerequisite {
  id: string;
  moduleId: string;
  prerequisiteModuleId: string;
  prerequisiteType: PrerequisiteType;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// N. Student Programs
// ═══════════════════════════════════════════════════════════════════════════════

export type StudentProgramStatus =
  | "active" | "on_leave" | "graduated" | "withdrawn" | "expelled";

export interface StudentProgram {
  id: string;
  userId: string;
  programId: string;
  institutionId?: string;
  enrollmentDate?: string;
  expectedGraduation?: string;
  status: StudentProgramStatus;
  matriculationNumber?: string;
  specialisation?: string;
  minorProgramId?: string;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// O. Program Completion Policies
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProgramCompletionPolicy {
  id: string;
  programId: string;
  minTotalCredits: number;
  minGpa?: number;
  maxFailedModules?: number;
  maxDurationTerms?: number;
  thesisMinGrade?: number;
  internshipRequired: boolean;
  languageRequirement?: string;
  additionalRulesJson: Record<string, unknown>;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// P. Component Result (extended)
// ═══════════════════════════════════════════════════════════════════════════════
// Note: ComponentResult already exists above; honoursLabel is added via
// the extended Attempt and ComponentResult interfaces.
// The honoursLabel on ComponentResult is available via:
//   componentResult.honoursLabel
