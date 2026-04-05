-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 035: Production Hardening
-- Closes gaps between initial foundation (032) and production spec:
--   1. module_prerequisites (separate table, replaces JSON approach)
--   2. student_programs (explicit student↔program link)
--   3. program_completion_policies (dedicated table)
--   4. Missing columns: honours_label, is_resit, recognition_mode
--   5. Unique constraints & additional indexes
--   6. Materialized views: transcript_view, student_program_progress_view
--   7. Updated_at triggers
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Module Prerequisites (proper relational table)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS module_prerequisites (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id       uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  prerequisite_module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  prerequisite_type text NOT NULL DEFAULT 'required',
  -- required: must be passed before enrollment
  -- recommended: advised but not enforced
  -- corequisite: must be taken in same or earlier term
  notes           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(module_id, prerequisite_module_id),
  CHECK (module_id <> prerequisite_module_id)
);

CREATE INDEX IF NOT EXISTS idx_module_prereqs_module ON module_prerequisites(module_id);
CREATE INDEX IF NOT EXISTS idx_module_prereqs_prereq ON module_prerequisites(prerequisite_module_id);

ALTER TABLE module_prerequisites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
CREATE POLICY "Authenticated read module_prerequisites" ON module_prerequisites
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Student Programs (explicit enrollment of a user in a program)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_programs (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id          uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  institution_id      uuid REFERENCES institutions(id),
  enrollment_date     date,
  expected_graduation date,
  status              text NOT NULL DEFAULT 'active',
  -- active, on_leave, graduated, withdrawn, expelled
  matriculation_number text,
  specialisation      text,
  minor_program_id    uuid REFERENCES programs(id),
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(user_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_student_programs_user ON student_programs(user_id);
CREATE INDEX IF NOT EXISTS idx_student_programs_program ON student_programs(program_id);

ALTER TABLE student_programs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
CREATE POLICY "Users own student_programs" ON student_programs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Program Completion Policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS program_completion_policies (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id              uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  min_total_credits       numeric NOT NULL DEFAULT 180,
  min_gpa                 numeric,                      -- nullable: not all programs enforce GPA minimum
  max_failed_modules      integer,                      -- nullable: unlimited if not set
  max_duration_terms      integer,                      -- max semesters allowed
  thesis_min_grade        numeric,                      -- nullable: no thesis requirement
  internship_required     boolean DEFAULT false,
  language_requirement    text,                         -- e.g. 'B2_EN' for English B2
  additional_rules_json   jsonb DEFAULT '{}',
  notes                   text,
  created_at              timestamptz DEFAULT now(),
  UNIQUE(program_id)
);

ALTER TABLE program_completion_policies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
CREATE POLICY "Authenticated read program_completion_policies" ON program_completion_policies
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Missing columns on existing tables
-- ─────────────────────────────────────────────────────────────────────────────

-- attempts: is_resit flag + honours_label
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS is_resit        boolean DEFAULT false;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS honours_label   text;  -- 'cum laude', 'mit Auszeichnung', etc.

-- component_results: honours_label
ALTER TABLE component_results ADD COLUMN IF NOT EXISTS honours_label text;

-- recognitions: recognition_mode
ALTER TABLE recognitions ADD COLUMN IF NOT EXISTS recognition_mode text DEFAULT 'credits_and_grade';
-- credits_only, credits_and_grade, exemption_only

-- enrollments: recognition_mode (for recognized modules)
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS recognition_mode text;

-- modules: unique constraint on (user_id, module_code) where module_code is not null
-- Note: modules already have user_id, adding constraint for data integrity
CREATE UNIQUE INDEX IF NOT EXISTS idx_modules_user_code
  ON modules(user_id, module_code) WHERE module_code IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Additional constraints & indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Enrollment: one active enrollment per user+module+term
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_user_module_term
  ON enrollments(user_id, module_id, term_id)
  WHERE status NOT IN ('withdrawn', 'recognised');

-- Attempt: unique attempt_number per enrollment
CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_enrollment_number
  ON attempts(enrollment_id, attempt_number);

-- Grade bands: composite index for lookups
CREATE INDEX IF NOT EXISTS idx_grade_bands_scale ON grade_bands(grade_scale_id, sort_order);

-- Assessment components: ensure weights don't wildly exceed 100
-- (soft check — compensated by engine validation)
DO $$ BEGIN
  ALTER TABLE assessment_components
    ADD CONSTRAINT chk_weight_range
    CHECK (weight_percent >= 0 AND weight_percent <= 150);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Programs: index for institution lookups
CREATE INDEX IF NOT EXISTS idx_programs_institution ON programs(institution_id);
CREATE INDEX IF NOT EXISTS idx_programs_faculty ON programs(faculty_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Updated_at trigger function (reusable)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
DO $$ BEGIN
  CREATE TRIGGER trg_enrollments_updated_at
    BEFORE UPDATE ON enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_student_programs_updated_at
    BEFORE UPDATE ON student_programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Materialized Views
-- ─────────────────────────────────────────────────────────────────────────────

-- Transcript view: flattened view of all module results per user
CREATE MATERIALIZED VIEW IF NOT EXISTS transcript_view AS
SELECT
  e.user_id,
  e.id AS enrollment_id,
  m.id AS module_id,
  m.name AS module_name,
  m.module_code,
  m.ects AS credits,
  m.ects_equivalent AS ects_equivalent,
  COALESCE(m.credit_scheme_id::text, 'ECTS') AS credit_scheme,
  e.status AS enrollment_status,
  e.current_final_grade,
  e.current_grade_label,
  e.current_passed,
  e.credits_awarded,
  e.local_grade_value,
  e.local_grade_label,
  e.normalized_score_0_100,
  e.normalization_method,
  e.conversion_confidence,
  e.academic_year,
  at2.term_label,
  at2.term_number,
  at2.academic_year_label,
  e.term_id,
  m.program_id,
  p.name AS program_name,
  r.recognition_status IS NOT NULL AS is_recognised,
  e.attempts_used,
  gs.code AS grade_scale_code,
  gs.country_code AS grade_scale_country
FROM enrollments e
  JOIN modules m ON m.id = e.module_id
  LEFT JOIN academic_terms at2 ON at2.id = e.term_id
  LEFT JOIN programs p ON p.id = m.program_id
  LEFT JOIN recognitions r ON r.user_id = e.user_id AND r.recognized_as_module_id = m.id AND r.recognition_status = 'accepted'
  LEFT JOIN grade_scales gs ON gs.id = m.grade_scale_id
ORDER BY e.user_id, at2.academic_year_label NULLS LAST, at2.term_number NULLS LAST, m.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transcript_view_enrollment ON transcript_view(enrollment_id);

-- Student program progress view
CREATE MATERIALIZED VIEW IF NOT EXISTS student_program_progress_view AS
SELECT
  sp.user_id,
  sp.program_id,
  p.name AS program_name,
  p.degree_level,
  p.required_total_credits,
  sp.status AS program_status,
  sp.enrollment_date,
  sp.expected_graduation,
  -- Aggregated stats
  COUNT(DISTINCT e.module_id) FILTER (WHERE e.current_passed = true) AS modules_passed,
  COUNT(DISTINCT e.module_id) FILTER (WHERE e.current_passed = false AND e.status = 'failed') AS modules_failed,
  COUNT(DISTINCT e.module_id) FILTER (WHERE e.status IN ('enrolled', 'ongoing')) AS modules_ongoing,
  COUNT(DISTINCT e.module_id) FILTER (WHERE e.status = 'planned') AS modules_planned,
  COALESCE(SUM(e.credits_awarded) FILTER (WHERE e.current_passed = true), 0) AS total_credits_earned,
  -- GPA (simple weighted average of passed modules)
  CASE
    WHEN COUNT(*) FILTER (WHERE e.current_passed = true AND e.current_final_grade IS NOT NULL AND m.ects > 0) > 0
    THEN ROUND(
      SUM(e.current_final_grade * m.ects) FILTER (WHERE e.current_passed = true AND e.current_final_grade IS NOT NULL)
      / NULLIF(SUM(m.ects) FILTER (WHERE e.current_passed = true AND e.current_final_grade IS NOT NULL), 0)
    , 2)
    ELSE NULL
  END AS weighted_gpa,
  -- Completion percentage
  CASE
    WHEN p.required_total_credits > 0
    THEN ROUND(
      COALESCE(SUM(e.credits_awarded) FILTER (WHERE e.current_passed = true), 0)
      / p.required_total_credits * 100
    , 1)
    ELSE 0
  END AS completion_percentage
FROM student_programs sp
  JOIN programs p ON p.id = sp.program_id
  LEFT JOIN enrollments e ON e.user_id = sp.user_id AND e.program_id = sp.program_id
  LEFT JOIN modules m ON m.id = e.module_id
GROUP BY sp.user_id, sp.program_id, p.name, p.degree_level, p.required_total_credits,
         sp.status, sp.enrollment_date, sp.expected_graduation;

-- Helper function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_academic_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY transcript_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY student_program_progress_view;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Seed default completion policies for common program types
-- ─────────────────────────────────────────────────────────────────────────────

-- These will be created when programs are set up, but provide defaults
-- via a helper function
CREATE OR REPLACE FUNCTION create_default_completion_policy(p_program_id uuid)
RETURNS uuid AS $$
DECLARE
  v_id uuid;
  v_degree text;
  v_credits numeric;
BEGIN
  SELECT degree_level, required_total_credits
    INTO v_degree, v_credits
    FROM programs WHERE id = p_program_id;

  INSERT INTO program_completion_policies (
    program_id, min_total_credits, max_duration_terms,
    thesis_min_grade, internship_required
  ) VALUES (
    p_program_id,
    v_credits,
    CASE v_degree
      WHEN 'bachelor' THEN 14  -- 7 years max for 6-semester bachelor
      WHEN 'master' THEN 8     -- 4 years max for 4-semester master
      WHEN 'phd' THEN 16       -- 8 years max
      ELSE 12
    END,
    CASE v_degree
      WHEN 'bachelor' THEN NULL
      WHEN 'master' THEN NULL  -- can be set per program
      WHEN 'phd' THEN 4.0     -- default minimum for thesis
      ELSE NULL
    END,
    false
  )
  ON CONFLICT (program_id) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
