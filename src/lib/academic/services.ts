/**
 * Semetra Academic Services Layer
 *
 * Provides CRUD operations for all academic domain entities.
 * Uses SupabaseClient for both server-side and client-side usage.
 * All database responses use snake_case, converted to camelCase for the domain layer.
 *
 * Usage:
 *   const supabase = createClient();
 *   const result = await InstitutionService.create(supabase, { name: "ETH Zürich", ... });
 *   if (!result.error) { console.log(result.data); }
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type {
  Institution,
  Program,
  ProgramRequirementGroup,
  AcademicModule,
  AssessmentComponent,
  ModulePrerequisite,
  AcademicTerm,
  Enrollment,
  Attempt,
  StudentProgram,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// 0. Service Result Types & Mappers
// ═══════════════════════════════════════════════════════════════════════════════

export type ServiceResult<T> = { data: T; error: null } | { data: null; error: string };

/**
 * Faculty type (not in domain types yet, but needed for schema)
 * Represents a department/faculty within an institution
 */
export interface Faculty {
  id: string;
  institutionId: string;
  name: string;
  code?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Snake case to camel case conversion for Supabase responses */
function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return obj;
  const camelObj: Record<string, unknown> = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = obj[key];
    camelObj[camelKey] = Array.isArray(value)
      ? value.map((item) => (typeof item === "object" && item !== null ? snakeToCamel(item as Record<string, unknown>) : item))
      : typeof value === "object" && value !== null
        ? snakeToCamel(value as Record<string, unknown>)
        : value;
  }
  return camelObj;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Institution Service
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateInstitutionInput {
  name: string;
  countryCode: string;
  institutionType: "university" | "university_of_applied_sciences" | "college" | "polytechnic";
  officialLanguage?: string;
  academicYearStartMonth?: number;
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

export interface UpdateInstitutionInput extends Partial<CreateInstitutionInput> {
  isActive?: boolean;
}

export const InstitutionService = {
  async create(supabase: SupabaseClient, input: CreateInstitutionInput): Promise<ServiceResult<Institution>> {
    try {
      const { data, error } = await supabase
        .from("institutions")
        .insert([
          {
            name: input.name,
            country_code: input.countryCode,
            institution_type: input.institutionType,
            official_language: input.officialLanguage,
            academic_year_start_month: input.academicYearStartMonth ?? 9,
            default_credit_scheme_id: input.defaultCreditSchemeId,
            default_grade_scale_id: input.defaultGradeScaleId,
            default_rounding_policy_id: input.defaultRoundingPolicyId,
            default_pass_policy_id: input.defaultPassPolicyId,
            default_retake_policy_id: input.defaultRetakePolicyId,
            default_classification_scheme_id: input.defaultClassificationSchemeId,
            default_gpa_scheme_id: input.defaultGpaSchemeId,
            timezone: input.timezone,
            website: input.website,
          },
        ])
        .select();

      if (error) return { data: null, error: error.message };
      if (!data || !data[0]) return { data: null, error: "No data returned from insert" };

      return { data: snakeToCamel(data[0]) as unknown as Institution, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getById(supabase: SupabaseClient, id: string): Promise<ServiceResult<Institution>> {
    try {
      const { data, error } = await supabase
        .from("institutions")
        .select("*")
        .eq("id", id)
        .single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as Institution, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getAll(supabase: SupabaseClient, onlyActive: boolean = true): Promise<ServiceResult<Institution[]>> {
    try {
      let query = supabase.from("institutions").select("*");
      if (onlyActive) query = query.eq("is_active", true);
      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data || []).map((row) => snakeToCamel(row) as unknown as Institution), error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async update(supabase: SupabaseClient, id: string, input: UpdateInstitutionInput): Promise<ServiceResult<Institution>> {
    try {
      const updateData: Record<string, unknown> = {};
      if (input.name) updateData.name = input.name;
      if (input.countryCode) updateData.country_code = input.countryCode;
      if (input.institutionType) updateData.institution_type = input.institutionType;
      if (input.officialLanguage) updateData.official_language = input.officialLanguage;
      if (input.academicYearStartMonth) updateData.academic_year_start_month = input.academicYearStartMonth;
      if (input.defaultCreditSchemeId) updateData.default_credit_scheme_id = input.defaultCreditSchemeId;
      if (input.defaultGradeScaleId) updateData.default_grade_scale_id = input.defaultGradeScaleId;
      if (input.defaultRoundingPolicyId) updateData.default_rounding_policy_id = input.defaultRoundingPolicyId;
      if (input.defaultPassPolicyId) updateData.default_pass_policy_id = input.defaultPassPolicyId;
      if (input.defaultRetakePolicyId) updateData.default_retake_policy_id = input.defaultRetakePolicyId;
      if (input.defaultClassificationSchemeId) updateData.default_classification_scheme_id = input.defaultClassificationSchemeId;
      if (input.defaultGpaSchemeId) updateData.default_gpa_scheme_id = input.defaultGpaSchemeId;
      if (input.timezone) updateData.timezone = input.timezone;
      if (input.website) updateData.website = input.website;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("institutions")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as Institution, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async delete(supabase: SupabaseClient, id: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase.from("institutions").delete().eq("id", id);
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Faculty Service
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateFacultyInput {
  institutionId: string;
  name: string;
  code?: string;
}

export interface UpdateFacultyInput extends Partial<CreateFacultyInput> {}

export const FacultyService = {
  async create(supabase: SupabaseClient, input: CreateFacultyInput): Promise<ServiceResult<Faculty>> {
    try {
      const { data, error } = await supabase
        .from("faculties")
        .insert([
          {
            institution_id: input.institutionId,
            name: input.name,
            code: input.code,
          },
        ])
        .select();

      if (error) return { data: null, error: error.message };
      if (!data || !data[0]) return { data: null, error: "No data returned from insert" };

      return { data: snakeToCamel(data[0]) as unknown as Faculty, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getByInstitution(supabase: SupabaseClient, institutionId: string): Promise<ServiceResult<Faculty[]>> {
    try {
      const { data, error } = await supabase
        .from("faculties")
        .select("*")
        .eq("institution_id", institutionId)
        .order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data || []).map((row) => snakeToCamel(row) as unknown as Faculty), error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async update(supabase: SupabaseClient, id: string, input: UpdateFacultyInput): Promise<ServiceResult<Faculty>> {
    try {
      const updateData: Record<string, unknown> = {};
      if (input.institutionId) updateData.institution_id = input.institutionId;
      if (input.name) updateData.name = input.name;
      if (input.code) updateData.code = input.code;

      const { data, error } = await supabase
        .from("faculties")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as Faculty, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async delete(supabase: SupabaseClient, id: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase.from("faculties").delete().eq("id", id);
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Program Service
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateProgramInput {
  institutionId?: string;
  facultyId?: string;
  code?: string;
  name: string;
  degreeLevel: "short_cycle" | "bachelor" | "master" | "phd" | "diploma";
  requiredTotalCredits?: number;
  creditSchemeId?: string;
  ectsTotal?: number;
  ectsEquivalentTotal?: number;
  durationStandardTerms?: number;
  classificationSchemeId?: string;
  gpaSchemeId?: string;
  completionPolicyId?: string;
  completionRules?: Record<string, unknown>;
  thesisRequired?: boolean;
  internshipRequired?: boolean;
  finalExamRequired?: boolean;
  status?: string;
}

export interface UpdateProgramInput extends Partial<CreateProgramInput> {
  isActive?: boolean;
}

export const ProgramService = {
  async create(supabase: SupabaseClient, input: CreateProgramInput): Promise<ServiceResult<Program>> {
    try {
      const { data, error } = await supabase
        .from("programs")
        .insert([
          {
            institution_id: input.institutionId,
            faculty_id: input.facultyId,
            code: input.code,
            name: input.name,
            degree_level: input.degreeLevel,
            required_total_credits: input.requiredTotalCredits ?? 180,
            credit_scheme_id: input.creditSchemeId,
            ects_total: input.ectsTotal,
            ects_equivalent_total: input.ectsEquivalentTotal,
            duration_standard_terms: input.durationStandardTerms,
            classification_scheme_id: input.classificationSchemeId,
            gpa_scheme_id: input.gpaSchemeId,
            completion_policy_id: input.completionPolicyId,
            completion_rules: input.completionRules,
            thesis_required: input.thesisRequired ?? false,
            internship_required: input.internshipRequired ?? false,
            final_exam_required: input.finalExamRequired ?? false,
            status: input.status,
          },
        ])
        .select();

      if (error) return { data: null, error: error.message };
      if (!data || !data[0]) return { data: null, error: "No data returned from insert" };

      return { data: snakeToCamel(data[0]) as unknown as Program, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getById(supabase: SupabaseClient, id: string): Promise<ServiceResult<Program>> {
    try {
      const { data, error } = await supabase.from("programs").select("*").eq("id", id).single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as Program, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getByInstitution(supabase: SupabaseClient, institutionId: string): Promise<ServiceResult<Program[]>> {
    try {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("institution_id", institutionId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data || []).map((row) => snakeToCamel(row) as unknown as Program), error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async update(supabase: SupabaseClient, id: string, input: UpdateProgramInput): Promise<ServiceResult<Program>> {
    try {
      const updateData: Record<string, unknown> = {};
      if (input.institutionId) updateData.institution_id = input.institutionId;
      if (input.facultyId) updateData.faculty_id = input.facultyId;
      if (input.code) updateData.code = input.code;
      if (input.name) updateData.name = input.name;
      if (input.degreeLevel) updateData.degree_level = input.degreeLevel;
      if (input.requiredTotalCredits) updateData.required_total_credits = input.requiredTotalCredits;
      if (input.creditSchemeId) updateData.credit_scheme_id = input.creditSchemeId;
      if (input.ectsTotal) updateData.ects_total = input.ectsTotal;
      if (input.ectsEquivalentTotal) updateData.ects_equivalent_total = input.ectsEquivalentTotal;
      if (input.durationStandardTerms) updateData.duration_standard_terms = input.durationStandardTerms;
      if (input.classificationSchemeId) updateData.classification_scheme_id = input.classificationSchemeId;
      if (input.gpaSchemeId) updateData.gpa_scheme_id = input.gpaSchemeId;
      if (input.completionPolicyId) updateData.completion_policy_id = input.completionPolicyId;
      if (input.completionRules) updateData.completion_rules = input.completionRules;
      if (input.thesisRequired !== undefined) updateData.thesis_required = input.thesisRequired;
      if (input.internshipRequired !== undefined) updateData.internship_required = input.internshipRequired;
      if (input.finalExamRequired !== undefined) updateData.final_exam_required = input.finalExamRequired;
      if (input.status) updateData.status = input.status;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("programs")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as Program, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async delete(supabase: SupabaseClient, id: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase.from("programs").delete().eq("id", id);
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Program Requirement Group Service
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateRequirementGroupInput {
  programId: string;
  name: string;
  groupType:
    | "compulsory"
    | "elective_required"
    | "elective_free"
    | "specialisation"
    | "minor"
    | "thesis"
    | "internship";
  minCreditsRequired?: number;
  minModulesRequired?: number;
  maxModulesCounted?: number;
  ruleType?: "any_of" | "all_of" | "choose_n" | "choose_credits";
  parentGroupId?: string;
  sortOrder?: number;
}

export interface UpdateRequirementGroupInput extends Partial<CreateRequirementGroupInput> {
  isActive?: boolean;
}

export const RequirementGroupService = {
  async create(supabase: SupabaseClient, input: CreateRequirementGroupInput): Promise<ServiceResult<ProgramRequirementGroup>> {
    try {
      const { data, error } = await supabase
        .from("program_requirement_groups")
        .insert([
          {
            program_id: input.programId,
            name: input.name,
            group_type: input.groupType,
            min_credits_required: input.minCreditsRequired,
            min_modules_required: input.minModulesRequired,
            max_modules_counted: input.maxModulesCounted,
            rule_type: input.ruleType ?? "all_of",
            parent_group_id: input.parentGroupId,
            sort_order: input.sortOrder ?? 0,
          },
        ])
        .select();

      if (error) return { data: null, error: error.message };
      if (!data || !data[0]) return { data: null, error: "No data returned from insert" };

      return { data: snakeToCamel(data[0]) as unknown as ProgramRequirementGroup, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getByProgram(supabase: SupabaseClient, programId: string): Promise<ServiceResult<ProgramRequirementGroup[]>> {
    try {
      const { data, error } = await supabase
        .from("program_requirement_groups")
        .select("*")
        .eq("program_id", programId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) return { data: null, error: error.message };
      return { data: (data || []).map((row) => snakeToCamel(row) as unknown as ProgramRequirementGroup), error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async update(supabase: SupabaseClient, id: string, input: UpdateRequirementGroupInput): Promise<ServiceResult<ProgramRequirementGroup>> {
    try {
      const updateData: Record<string, unknown> = {};
      if (input.programId) updateData.program_id = input.programId;
      if (input.name) updateData.name = input.name;
      if (input.groupType) updateData.group_type = input.groupType;
      if (input.minCreditsRequired !== undefined) updateData.min_credits_required = input.minCreditsRequired;
      if (input.minModulesRequired !== undefined) updateData.min_modules_required = input.minModulesRequired;
      if (input.maxModulesCounted !== undefined) updateData.max_modules_counted = input.maxModulesCounted;
      if (input.ruleType) updateData.rule_type = input.ruleType;
      if (input.parentGroupId !== undefined) updateData.parent_group_id = input.parentGroupId;
      if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("program_requirement_groups")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as ProgramRequirementGroup, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async delete(supabase: SupabaseClient, id: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase.from("program_requirement_groups").delete().eq("id", id);
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async reorder(supabase: SupabaseClient, groupId: string, newSortOrder: number): Promise<ServiceResult<ProgramRequirementGroup>> {
    return RequirementGroupService.update(supabase, groupId, { sortOrder: newSortOrder });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Module Service
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateModuleInput {
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
  isCompulsory?: boolean;
  isRepeatable?: boolean;
  attendanceRequired?: boolean;
  language?: string;
  deliveryMode?: "onsite" | "online" | "hybrid";
  prerequisitesJson?: string[];
  semester?: string;
  color?: string;
  professor?: string;
  status?: string;
  targetGrade?: number;
}

export interface UpdateModuleInput extends Partial<CreateModuleInput> {
  isActive?: boolean;
}

export const ModuleService = {
  async create(supabase: SupabaseClient, input: CreateModuleInput): Promise<ServiceResult<AcademicModule>> {
    try {
      const { data, error } = await supabase
        .from("modules")
        .insert([
          {
            user_id: input.userId,
            name: input.name,
            module_code: input.moduleCode,
            description: input.description,
            ects: input.ects,
            credit_scheme_id: input.creditSchemeId,
            ects_equivalent: input.ectsEquivalent,
            grade_scale_id: input.gradeScaleId,
            pass_policy_id: input.passPolicyId,
            retake_policy_id: input.retakePolicyId,
            rounding_policy_id: input.roundingPolicyId,
            program_id: input.programId,
            requirement_group_id: input.requirementGroupId,
            term_type: input.termType,
            default_term_number: input.defaultTermNumber,
            is_compulsory: input.isCompulsory ?? true,
            is_repeatable: input.isRepeatable ?? true,
            attendance_required: input.attendanceRequired ?? false,
            language: input.language,
            delivery_mode: input.deliveryMode ?? "onsite",
            prerequisites_json: input.prerequisitesJson ?? [],
            semester: input.semester,
            color: input.color,
            professor: input.professor,
            status: input.status,
            target_grade: input.targetGrade,
          },
        ])
        .select();

      if (error) return { data: null, error: error.message };
      if (!data || !data[0]) return { data: null, error: "No data returned from insert" };

      return { data: snakeToCamel(data[0]) as unknown as AcademicModule, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getById(supabase: SupabaseClient, id: string): Promise<ServiceResult<AcademicModule>> {
    try {
      const { data, error } = await supabase.from("modules").select("*").eq("id", id).single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as AcademicModule, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getByProgram(supabase: SupabaseClient, programId: string): Promise<ServiceResult<AcademicModule[]>> {
    try {
      const { data, error } = await supabase
        .from("modules")
        .select("*")
        .eq("program_id", programId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data || []).map((row) => snakeToCamel(row) as unknown as AcademicModule), error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async update(supabase: SupabaseClient, id: string, input: UpdateModuleInput): Promise<ServiceResult<AcademicModule>> {
    try {
      const updateData: Record<string, unknown> = {};
      if (input.userId) updateData.user_id = input.userId;
      if (input.name) updateData.name = input.name;
      if (input.moduleCode) updateData.module_code = input.moduleCode;
      if (input.description) updateData.description = input.description;
      if (input.ects) updateData.ects = input.ects;
      if (input.creditSchemeId) updateData.credit_scheme_id = input.creditSchemeId;
      if (input.ectsEquivalent !== undefined) updateData.ects_equivalent = input.ectsEquivalent;
      if (input.gradeScaleId) updateData.grade_scale_id = input.gradeScaleId;
      if (input.passPolicyId) updateData.pass_policy_id = input.passPolicyId;
      if (input.retakePolicyId) updateData.retake_policy_id = input.retakePolicyId;
      if (input.roundingPolicyId) updateData.rounding_policy_id = input.roundingPolicyId;
      if (input.programId) updateData.program_id = input.programId;
      if (input.requirementGroupId) updateData.requirement_group_id = input.requirementGroupId;
      if (input.termType) updateData.term_type = input.termType;
      if (input.defaultTermNumber !== undefined) updateData.default_term_number = input.defaultTermNumber;
      if (input.isCompulsory !== undefined) updateData.is_compulsory = input.isCompulsory;
      if (input.isRepeatable !== undefined) updateData.is_repeatable = input.isRepeatable;
      if (input.attendanceRequired !== undefined) updateData.attendance_required = input.attendanceRequired;
      if (input.language) updateData.language = input.language;
      if (input.deliveryMode) updateData.delivery_mode = input.deliveryMode;
      if (input.prerequisitesJson) updateData.prerequisites_json = input.prerequisitesJson;
      if (input.semester) updateData.semester = input.semester;
      if (input.color) updateData.color = input.color;
      if (input.professor) updateData.professor = input.professor;
      if (input.status) updateData.status = input.status;
      if (input.targetGrade !== undefined) updateData.target_grade = input.targetGrade;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("modules")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as AcademicModule, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async delete(supabase: SupabaseClient, id: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase.from("modules").delete().eq("id", id);
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async publish(supabase: SupabaseClient, moduleId: string): Promise<ServiceResult<{ success: boolean; errors?: unknown[] }>> {
    try {
      const { data, error } = await supabase.rpc("publish_module", { p_module_id: moduleId });

      if (error) return { data: null, error: error.message };
      return { data: data, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Assessment Component Service
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateAssessmentComponentInput {
  moduleId: string;
  name: string;
  componentType:
    | "written_exam"
    | "oral_exam"
    | "project"
    | "lab"
    | "homework"
    | "presentation"
    | "participation"
    | "thesis"
    | "attendance_requirement"
    | "pass_fail_requirement";
  weightPercent?: number;
  gradeScaleId?: string;
  passPolicyId?: string;
  minPassRequired?: boolean;
  contributesToFinal?: boolean;
  mandatoryToPass?: boolean;
  sequenceOrder?: number;
}

export interface UpdateAssessmentComponentInput extends Partial<CreateAssessmentComponentInput> {
  isActive?: boolean;
}

export const AssessmentComponentService = {
  async create(supabase: SupabaseClient, input: CreateAssessmentComponentInput): Promise<ServiceResult<AssessmentComponent>> {
    try {
      const { data, error } = await supabase
        .from("assessment_components")
        .insert([
          {
            module_id: input.moduleId,
            name: input.name,
            component_type: input.componentType,
            weight_percent: input.weightPercent ?? 100,
            grade_scale_id: input.gradeScaleId,
            pass_policy_id: input.passPolicyId,
            min_pass_required: input.minPassRequired ?? false,
            contributes_to_final: input.contributesToFinal ?? true,
            mandatory_to_pass: input.mandatoryToPass ?? false,
            sequence_order: input.sequenceOrder ?? 1,
          },
        ])
        .select();

      if (error) return { data: null, error: error.message };
      if (!data || !data[0]) return { data: null, error: "No data returned from insert" };

      return { data: snakeToCamel(data[0]) as unknown as AssessmentComponent, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getByModule(supabase: SupabaseClient, moduleId: string): Promise<ServiceResult<AssessmentComponent[]>> {
    try {
      const { data, error } = await supabase
        .from("assessment_components")
        .select("*")
        .eq("module_id", moduleId)
        .eq("is_active", true)
        .order("sequence_order", { ascending: true });

      if (error) return { data: null, error: error.message };
      return { data: (data || []).map((row) => snakeToCamel(row) as unknown as AssessmentComponent), error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async update(supabase: SupabaseClient, id: string, input: UpdateAssessmentComponentInput): Promise<ServiceResult<AssessmentComponent>> {
    try {
      const updateData: Record<string, unknown> = {};
      if (input.moduleId) updateData.module_id = input.moduleId;
      if (input.name) updateData.name = input.name;
      if (input.componentType) updateData.component_type = input.componentType;
      if (input.weightPercent !== undefined) updateData.weight_percent = input.weightPercent;
      if (input.gradeScaleId) updateData.grade_scale_id = input.gradeScaleId;
      if (input.passPolicyId) updateData.pass_policy_id = input.passPolicyId;
      if (input.minPassRequired !== undefined) updateData.min_pass_required = input.minPassRequired;
      if (input.contributesToFinal !== undefined) updateData.contributes_to_final = input.contributesToFinal;
      if (input.mandatoryToPass !== undefined) updateData.mandatory_to_pass = input.mandatoryToPass;
      if (input.sequenceOrder !== undefined) updateData.sequence_order = input.sequenceOrder;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("assessment_components")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as AssessmentComponent, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async delete(supabase: SupabaseClient, id: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase.from("assessment_components").delete().eq("id", id);
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async reorder(supabase: SupabaseClient, componentId: string, newSequenceOrder: number): Promise<ServiceResult<AssessmentComponent>> {
    return AssessmentComponentService.update(supabase, componentId, { sequenceOrder: newSequenceOrder });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Module Prerequisite Service
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreatePrerequisiteInput {
  moduleId: string;
  prerequisiteModuleId: string;
  prerequisiteType?: "required" | "recommended" | "corequisite";
  notes?: string;
}

export const PrerequisiteService = {
  async create(supabase: SupabaseClient, input: CreatePrerequisiteInput): Promise<ServiceResult<ModulePrerequisite>> {
    try {
      const { data, error } = await supabase
        .from("module_prerequisites")
        .insert([
          {
            module_id: input.moduleId,
            prerequisite_module_id: input.prerequisiteModuleId,
            prerequisite_type: input.prerequisiteType ?? "required",
            notes: input.notes,
          },
        ])
        .select();

      if (error) return { data: null, error: error.message };
      if (!data || !data[0]) return { data: null, error: "No data returned from insert" };

      return { data: snakeToCamel(data[0]) as unknown as ModulePrerequisite, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getByModule(supabase: SupabaseClient, moduleId: string): Promise<ServiceResult<ModulePrerequisite[]>> {
    try {
      const { data, error } = await supabase
        .from("module_prerequisites")
        .select("*")
        .eq("module_id", moduleId)
        .order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data || []).map((row) => snakeToCamel(row) as unknown as ModulePrerequisite), error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async delete(supabase: SupabaseClient, id: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase.from("module_prerequisites").delete().eq("id", id);
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Academic Term Service
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateTermInput {
  userId: string;
  institutionId?: string;
  academicYearLabel: string;
  termType?: "semester" | "trimester" | "quarter" | "yearly" | "block";
  termNumber: number;
  termLabel?: string;
  startDate?: string;
  endDate?: string;
  teachingEndDate?: string;
  examStartDate?: string;
  examEndDate?: string;
}

export interface UpdateTermInput extends Partial<CreateTermInput> {}

export const TermService = {
  async create(supabase: SupabaseClient, input: CreateTermInput): Promise<ServiceResult<AcademicTerm>> {
    try {
      const { data, error } = await supabase
        .from("academic_terms")
        .insert([
          {
            user_id: input.userId,
            institution_id: input.institutionId,
            academic_year_label: input.academicYearLabel,
            term_type: input.termType ?? "semester",
            term_number: input.termNumber,
            term_label: input.termLabel,
            start_date: input.startDate,
            end_date: input.endDate,
            teaching_end_date: input.teachingEndDate,
            exam_start_date: input.examStartDate,
            exam_end_date: input.examEndDate,
          },
        ])
        .select();

      if (error) return { data: null, error: error.message };
      if (!data || !data[0]) return { data: null, error: "No data returned from insert" };

      return { data: snakeToCamel(data[0]) as unknown as AcademicTerm, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getByInstitution(supabase: SupabaseClient, institutionId: string): Promise<ServiceResult<AcademicTerm[]>> {
    try {
      const { data, error } = await supabase
        .from("academic_terms")
        .select("*")
        .eq("institution_id", institutionId)
        .order("academic_year_label", { ascending: false })
        .order("term_number", { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data || []).map((row) => snakeToCamel(row) as unknown as AcademicTerm), error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async update(supabase: SupabaseClient, id: string, input: UpdateTermInput): Promise<ServiceResult<AcademicTerm>> {
    try {
      const updateData: Record<string, unknown> = {};
      if (input.userId) updateData.user_id = input.userId;
      if (input.institutionId) updateData.institution_id = input.institutionId;
      if (input.academicYearLabel) updateData.academic_year_label = input.academicYearLabel;
      if (input.termType) updateData.term_type = input.termType;
      if (input.termNumber) updateData.term_number = input.termNumber;
      if (input.termLabel) updateData.term_label = input.termLabel;
      if (input.startDate) updateData.start_date = input.startDate;
      if (input.endDate) updateData.end_date = input.endDate;
      if (input.teachingEndDate) updateData.teaching_end_date = input.teachingEndDate;
      if (input.examStartDate) updateData.exam_start_date = input.examStartDate;
      if (input.examEndDate) updateData.exam_end_date = input.examEndDate;

      const { data, error } = await supabase
        .from("academic_terms")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as AcademicTerm, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Enrollment Service
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateEnrollmentInput {
  userId: string;
  moduleId: string;
  programId?: string;
  academicYear?: string;
  termId?: string;
  status?: "planned" | "enrolled" | "ongoing" | "passed" | "failed" | "withdrawn" | "recognised";
  creditsAwarded?: number;
}

export interface UpdateEnrollmentInput extends Partial<CreateEnrollmentInput> {
  attemptsUsed?: number;
  currentFinalGrade?: number | null;
  currentGradeLabel?: string | null;
  currentPassed?: boolean | null;
}

export const EnrollmentService = {
  async create(supabase: SupabaseClient, input: CreateEnrollmentInput): Promise<ServiceResult<Enrollment>> {
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .insert([
          {
            user_id: input.userId,
            module_id: input.moduleId,
            program_id: input.programId,
            academic_year: input.academicYear,
            term_id: input.termId,
            status: input.status ?? "planned",
            credits_awarded: input.creditsAwarded ?? 0,
          },
        ])
        .select();

      if (error) return { data: null, error: error.message };
      if (!data || !data[0]) return { data: null, error: "No data returned from insert" };

      return { data: snakeToCamel(data[0]) as unknown as Enrollment, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getByUser(supabase: SupabaseClient, userId: string): Promise<ServiceResult<Enrollment[]>> {
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data || []).map((row) => snakeToCamel(row) as unknown as Enrollment), error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getByModule(supabase: SupabaseClient, moduleId: string): Promise<ServiceResult<Enrollment[]>> {
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("module_id", moduleId)
        .order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data || []).map((row) => snakeToCamel(row) as unknown as Enrollment), error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async update(supabase: SupabaseClient, id: string, input: UpdateEnrollmentInput): Promise<ServiceResult<Enrollment>> {
    try {
      const updateData: Record<string, unknown> = {};
      if (input.userId) updateData.user_id = input.userId;
      if (input.moduleId) updateData.module_id = input.moduleId;
      if (input.programId) updateData.program_id = input.programId;
      if (input.academicYear) updateData.academic_year = input.academicYear;
      if (input.termId) updateData.term_id = input.termId;
      if (input.status) updateData.status = input.status;
      if (input.attemptsUsed !== undefined) updateData.attempts_used = input.attemptsUsed;
      if (input.currentFinalGrade !== undefined) updateData.current_final_grade = input.currentFinalGrade;
      if (input.currentGradeLabel !== undefined) updateData.current_grade_label = input.currentGradeLabel;
      if (input.currentPassed !== undefined) updateData.current_passed = input.currentPassed;
      if (input.creditsAwarded !== undefined) updateData.credits_awarded = input.creditsAwarded;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("enrollments")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as Enrollment, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Attempt Service
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateAttemptInput {
  enrollmentId: string;
  attemptNumber?: number;
  dateStarted?: string;
  dateCompleted?: string;
  status?: "in_progress" | "submitted" | "graded" | "passed" | "failed" | "void" | "withdrawn";
  finalGradeValue?: number | null;
  finalGradeLabel?: string | null;
  passed?: boolean | null;
  creditsAwarded?: number;
  countsTowardRecord?: boolean;
  isResit?: boolean;
  honoursLabel?: string;
  notes?: string;
}

export interface UpdateAttemptInput extends Partial<CreateAttemptInput> {}

export const AttemptService = {
  async create(supabase: SupabaseClient, input: CreateAttemptInput): Promise<ServiceResult<Attempt>> {
    try {
      const { data, error } = await supabase
        .from("attempts")
        .insert([
          {
            enrollment_id: input.enrollmentId,
            attempt_number: input.attemptNumber ?? 1,
            date_started: input.dateStarted,
            date_completed: input.dateCompleted,
            status: input.status ?? "in_progress",
            final_grade_value: input.finalGradeValue,
            final_grade_label: input.finalGradeLabel,
            passed: input.passed,
            credits_awarded: input.creditsAwarded ?? 0,
            counts_toward_record: input.countsTowardRecord ?? true,
            is_resit: input.isResit ?? false,
            honours_label: input.honoursLabel,
            notes: input.notes,
          },
        ])
        .select();

      if (error) return { data: null, error: error.message };
      if (!data || !data[0]) return { data: null, error: "No data returned from insert" };

      return { data: snakeToCamel(data[0]) as unknown as Attempt, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getByEnrollment(supabase: SupabaseClient, enrollmentId: string): Promise<ServiceResult<Attempt[]>> {
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("*")
        .eq("enrollment_id", enrollmentId)
        .order("attempt_number", { ascending: true });

      if (error) return { data: null, error: error.message };
      return { data: (data || []).map((row) => snakeToCamel(row) as unknown as Attempt), error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async update(supabase: SupabaseClient, id: string, input: UpdateAttemptInput): Promise<ServiceResult<Attempt>> {
    try {
      const updateData: Record<string, unknown> = {};
      if (input.enrollmentId) updateData.enrollment_id = input.enrollmentId;
      if (input.attemptNumber !== undefined) updateData.attempt_number = input.attemptNumber;
      if (input.dateStarted) updateData.date_started = input.dateStarted;
      if (input.dateCompleted) updateData.date_completed = input.dateCompleted;
      if (input.status) updateData.status = input.status;
      if (input.finalGradeValue !== undefined) updateData.final_grade_value = input.finalGradeValue;
      if (input.finalGradeLabel !== undefined) updateData.final_grade_label = input.finalGradeLabel;
      if (input.passed !== undefined) updateData.passed = input.passed;
      if (input.creditsAwarded !== undefined) updateData.credits_awarded = input.creditsAwarded;
      if (input.countsTowardRecord !== undefined) updateData.counts_toward_record = input.countsTowardRecord;
      if (input.isResit !== undefined) updateData.is_resit = input.isResit;
      if (input.honoursLabel !== undefined) updateData.honours_label = input.honoursLabel;
      if (input.notes) updateData.notes = input.notes;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("attempts")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as Attempt, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 11. Student Program Service
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateStudentProgramInput {
  userId: string;
  programId: string;
  institutionId?: string;
  enrollmentDate?: string;
  expectedGraduation?: string;
  status?: "active" | "on_leave" | "graduated" | "withdrawn" | "expelled";
  matriculationNumber?: string;
  specialisation?: string;
  minorProgramId?: string;
  notes?: string;
}

export interface UpdateStudentProgramInput extends Partial<CreateStudentProgramInput> {}

export const StudentProgramService = {
  async create(supabase: SupabaseClient, input: CreateStudentProgramInput): Promise<ServiceResult<StudentProgram>> {
    try {
      const { data, error } = await supabase
        .from("student_programs")
        .insert([
          {
            user_id: input.userId,
            program_id: input.programId,
            institution_id: input.institutionId,
            enrollment_date: input.enrollmentDate,
            expected_graduation: input.expectedGraduation,
            status: input.status ?? "active",
            matriculation_number: input.matriculationNumber,
            specialisation: input.specialisation,
            minor_program_id: input.minorProgramId,
            notes: input.notes,
          },
        ])
        .select();

      if (error) return { data: null, error: error.message };
      if (!data || !data[0]) return { data: null, error: "No data returned from insert" };

      return { data: snakeToCamel(data[0]) as unknown as StudentProgram, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async getByUser(supabase: SupabaseClient, userId: string): Promise<ServiceResult<StudentProgram[]>> {
    try {
      const { data, error } = await supabase
        .from("student_programs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data || []).map((row) => snakeToCamel(row) as unknown as StudentProgram), error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  async update(supabase: SupabaseClient, id: string, input: UpdateStudentProgramInput): Promise<ServiceResult<StudentProgram>> {
    try {
      const updateData: Record<string, unknown> = {};
      if (input.userId) updateData.user_id = input.userId;
      if (input.programId) updateData.program_id = input.programId;
      if (input.institutionId) updateData.institution_id = input.institutionId;
      if (input.enrollmentDate) updateData.enrollment_date = input.enrollmentDate;
      if (input.expectedGraduation) updateData.expected_graduation = input.expectedGraduation;
      if (input.status) updateData.status = input.status;
      if (input.matriculationNumber) updateData.matriculation_number = input.matriculationNumber;
      if (input.specialisation) updateData.specialisation = input.specialisation;
      if (input.minorProgramId) updateData.minor_program_id = input.minorProgramId;
      if (input.notes) updateData.notes = input.notes;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("student_programs")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: snakeToCamel(data) as unknown as StudentProgram, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },
};
