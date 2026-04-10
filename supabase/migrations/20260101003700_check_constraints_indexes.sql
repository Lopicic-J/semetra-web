-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 037: CHECK Constraints + Missing Indexes
-- Production-grade data integrity layer
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CHECK Constraints
-- ─────────────────────────────────────────────────────────────────────────────

-- credit_schemes: positive values
DO $$ BEGIN
  ALTER TABLE credit_schemes ADD CONSTRAINT chk_credit_schemes_positive_year CHECK (units_per_full_time_year > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE credit_schemes ADD CONSTRAINT chk_credit_schemes_positive_conversion CHECK (conversion_to_ects > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- grade_scales: range validity
DO $$ BEGIN
  ALTER TABLE grade_scales ADD CONSTRAINT chk_grade_scales_range CHECK (min_value IS NULL OR max_value IS NULL OR max_value >= min_value);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE grade_scales ADD CONSTRAINT chk_grade_scales_step CHECK (step_size IS NULL OR step_size > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE grade_scales ADD CONSTRAINT chk_grade_scales_decimals CHECK (decimal_places IS NULL OR decimal_places >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE grade_scales ADD CONSTRAINT chk_grade_scales_country_len CHECK (country_code IS NULL OR char_length(country_code) = 2);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- grade_bands: range validity
DO $$ BEGIN
  ALTER TABLE grade_bands ADD CONSTRAINT chk_grade_bands_range CHECK (to_value >= from_value);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- rounding_policies: positive round_to
DO $$ BEGIN
  ALTER TABLE rounding_policies ADD CONSTRAINT chk_rounding_positive CHECK (round_to IS NULL OR round_to > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- retake_policies: positive attempts
DO $$ BEGIN
  ALTER TABLE retake_policies ADD CONSTRAINT chk_retake_positive_attempts CHECK (max_attempts > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE retake_policies ADD CONSTRAINT chk_retake_cooldown CHECK (cooldown_days IS NULL OR cooldown_days >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- programs: positive credits
DO $$ BEGIN
  ALTER TABLE programs ADD CONSTRAINT chk_programs_positive_credits CHECK (required_total_credits > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE programs ADD CONSTRAINT chk_programs_positive_duration CHECK (duration_standard_terms IS NULL OR duration_standard_terms > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE programs ADD CONSTRAINT chk_programs_ects_total CHECK (ects_total IS NULL OR ects_total > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- academic_terms: date logic
DO $$ BEGIN
  ALTER TABLE academic_terms ADD CONSTRAINT chk_terms_dates CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE academic_terms ADD CONSTRAINT chk_terms_exam_dates CHECK (exam_start_date IS NULL OR exam_end_date IS NULL OR exam_end_date >= exam_start_date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- institutions: valid month
DO $$ BEGIN
  ALTER TABLE institutions ADD CONSTRAINT chk_institutions_start_month CHECK (academic_year_start_month IS NULL OR (academic_year_start_month BETWEEN 1 AND 12));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- enrollments: data validity
DO $$ BEGIN
  ALTER TABLE enrollments ADD CONSTRAINT chk_enrollments_credits CHECK (credits_awarded IS NULL OR credits_awarded >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE enrollments ADD CONSTRAINT chk_enrollments_confidence CHECK (conversion_confidence IS NULL OR (conversion_confidence >= 0 AND conversion_confidence <= 1));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE enrollments ADD CONSTRAINT chk_enrollments_normalized CHECK (normalized_score_0_100 IS NULL OR (normalized_score_0_100 >= 0 AND normalized_score_0_100 <= 100));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- program_completion_policies: valid values
DO $$ BEGIN
  ALTER TABLE program_completion_policies ADD CONSTRAINT chk_completion_credits CHECK (min_total_credits IS NULL OR min_total_credits > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE program_completion_policies ADD CONSTRAINT chk_completion_duration CHECK (max_duration_terms IS NULL OR max_duration_terms > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE program_completion_policies ADD CONSTRAINT chk_completion_gpa CHECK (min_gpa IS NULL OR min_gpa >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE program_completion_policies ADD CONSTRAINT chk_completion_failed CHECK (max_failed_modules IS NULL OR max_failed_modules >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- program_requirement_groups: valid ranges
DO $$ BEGIN
  ALTER TABLE program_requirement_groups ADD CONSTRAINT chk_req_groups_credits CHECK (min_credits_required IS NULL OR min_credits_required >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE program_requirement_groups ADD CONSTRAINT chk_req_groups_modules CHECK (min_modules_required IS NULL OR min_modules_required >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE program_requirement_groups ADD CONSTRAINT chk_req_groups_max CHECK (max_modules_counted IS NULL OR max_modules_counted >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Comprehensive Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- credit_schemes
CREATE INDEX IF NOT EXISTS idx_credit_schemes_active ON credit_schemes(is_active);

-- grade_scales
CREATE INDEX IF NOT EXISTS idx_grade_scales_country ON grade_scales(country_code);
CREATE INDEX IF NOT EXISTS idx_grade_scales_type ON grade_scales(type);
CREATE INDEX IF NOT EXISTS idx_grade_scales_active ON grade_scales(is_active);

-- pass_policies
CREATE INDEX IF NOT EXISTS idx_pass_policies_type ON pass_policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_pass_policies_active ON pass_policies(is_active);

-- retake_policies
CREATE INDEX IF NOT EXISTS idx_retake_policies_strategy ON retake_policies(grade_replacement);
CREATE INDEX IF NOT EXISTS idx_retake_policies_active ON retake_policies(is_active);

-- rounding_policies
CREATE INDEX IF NOT EXISTS idx_rounding_policies_method ON rounding_policies(method);
CREATE INDEX IF NOT EXISTS idx_rounding_policies_apply_to ON rounding_policies(apply_to);
CREATE INDEX IF NOT EXISTS idx_rounding_policies_active ON rounding_policies(is_active);

-- country_systems
CREATE INDEX IF NOT EXISTS idx_country_systems_active ON country_systems(is_active);

-- institutions
CREATE INDEX IF NOT EXISTS idx_institutions_country ON institutions(country_code);
CREATE INDEX IF NOT EXISTS idx_institutions_active ON institutions(is_active);
CREATE INDEX IF NOT EXISTS idx_institutions_type ON institutions(institution_type);

-- programs
CREATE INDEX IF NOT EXISTS idx_programs_degree_level ON programs(degree_level);
CREATE INDEX IF NOT EXISTS idx_programs_active ON programs(is_active);
CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);
CREATE INDEX IF NOT EXISTS idx_programs_credit_scheme ON programs(credit_scheme_id);

-- program_requirement_groups
CREATE INDEX IF NOT EXISTS idx_req_groups_program ON program_requirement_groups(program_id);
CREATE INDEX IF NOT EXISTS idx_req_groups_parent ON program_requirement_groups(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_req_groups_sort ON program_requirement_groups(program_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_req_groups_active ON program_requirement_groups(is_active);

-- classification_schemes
CREATE INDEX IF NOT EXISTS idx_classification_country ON classification_schemes(country_code);
CREATE INDEX IF NOT EXISTS idx_classification_type ON classification_schemes(scheme_type);
CREATE INDEX IF NOT EXISTS idx_classification_active ON classification_schemes(is_active);

-- gpa_schemes
CREATE INDEX IF NOT EXISTS idx_gpa_schemes_type ON gpa_schemes(calculation_type);
CREATE INDEX IF NOT EXISTS idx_gpa_schemes_scope ON gpa_schemes(calculation_scope);
CREATE INDEX IF NOT EXISTS idx_gpa_schemes_active ON gpa_schemes(is_active);

-- assessment_components
CREATE INDEX IF NOT EXISTS idx_components_module ON assessment_components(module_id);
CREATE INDEX IF NOT EXISTS idx_components_order ON assessment_components(module_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_components_type ON assessment_components(component_type);
CREATE INDEX IF NOT EXISTS idx_components_active ON assessment_components(is_active);

-- academic_terms
CREATE INDEX IF NOT EXISTS idx_terms_institution ON academic_terms(institution_id);
CREATE INDEX IF NOT EXISTS idx_terms_year ON academic_terms(academic_year_label);
CREATE INDEX IF NOT EXISTS idx_terms_dates ON academic_terms(start_date, end_date);

-- enrollments (extend beyond what 032 has)
CREATE INDEX IF NOT EXISTS idx_enrollments_program ON enrollments(program_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_term ON enrollments(term_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_passed ON enrollments(user_id, current_passed) WHERE current_passed = true;

-- attempts
CREATE INDEX IF NOT EXISTS idx_attempts_enrollment ON attempts(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts(status);

-- component_results
CREATE INDEX IF NOT EXISTS idx_comp_results_attempt ON component_results(attempt_id);
CREATE INDEX IF NOT EXISTS idx_comp_results_component ON component_results(component_id);

-- credit_awards
CREATE INDEX IF NOT EXISTS idx_credit_awards_module ON credit_awards(module_id);
CREATE INDEX IF NOT EXISTS idx_credit_awards_reason ON credit_awards(award_reason);

-- recognitions
CREATE INDEX IF NOT EXISTS idx_recognitions_module ON recognitions(recognized_as_module_id);
CREATE INDEX IF NOT EXISTS idx_recognitions_status ON recognitions(recognition_status);

-- modules: additional indexes
CREATE INDEX IF NOT EXISTS idx_modules_program ON modules(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_modules_grade_scale ON modules(grade_scale_id) WHERE grade_scale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_modules_status ON modules(status);

-- program_completion_policies
CREATE INDEX IF NOT EXISTS idx_completion_policies_active ON program_completion_policies(is_active);
