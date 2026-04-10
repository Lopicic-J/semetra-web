-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 071: Tighten Builder Write Policies
-- Replaces overly permissive WITH CHECK (true) from 040 with role-based checks.
-- Only admin and verified institution users can write to academic builder tables.
-- Uses helper functions from migration 058 (is_admin, is_institution_admin, etc.)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper: check if current user is admin or verified institution role
CREATE OR REPLACE FUNCTION is_builder_writer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND user_role IN ('admin', 'institution')
      AND (verification_status = 'verified' OR user_role = 'admin')
  );
$$;

-- ─── Institutions ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write institutions" ON institutions;
DROP POLICY IF EXISTS "Authenticated update institutions" ON institutions;
DROP POLICY IF EXISTS "Authenticated delete institutions" ON institutions;

CREATE POLICY "Builder write institutions" ON institutions
  FOR INSERT TO authenticated WITH CHECK (is_builder_writer());

CREATE POLICY "Builder update institutions" ON institutions
  FOR UPDATE TO authenticated USING (is_builder_writer()) WITH CHECK (is_builder_writer());

CREATE POLICY "Builder delete institutions" ON institutions
  FOR DELETE TO authenticated USING (is_builder_writer());

-- ─── Faculties ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write faculties" ON faculties;
DROP POLICY IF EXISTS "Authenticated update faculties" ON faculties;
DROP POLICY IF EXISTS "Authenticated delete faculties" ON faculties;

CREATE POLICY "Builder write faculties" ON faculties
  FOR INSERT TO authenticated WITH CHECK (is_builder_writer());

CREATE POLICY "Builder update faculties" ON faculties
  FOR UPDATE TO authenticated USING (is_builder_writer()) WITH CHECK (is_builder_writer());

CREATE POLICY "Builder delete faculties" ON faculties
  FOR DELETE TO authenticated USING (is_builder_writer());

-- ─── Programs ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write programs" ON programs;
DROP POLICY IF EXISTS "Authenticated update programs" ON programs;
DROP POLICY IF EXISTS "Authenticated delete programs" ON programs;

CREATE POLICY "Builder write programs" ON programs
  FOR INSERT TO authenticated WITH CHECK (is_builder_writer());

CREATE POLICY "Builder update programs" ON programs
  FOR UPDATE TO authenticated USING (is_builder_writer()) WITH CHECK (is_builder_writer());

CREATE POLICY "Builder delete programs" ON programs
  FOR DELETE TO authenticated USING (is_builder_writer());

-- ─── Program Requirement Groups ────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write program_requirement_groups" ON program_requirement_groups;
DROP POLICY IF EXISTS "Authenticated update program_requirement_groups" ON program_requirement_groups;
DROP POLICY IF EXISTS "Authenticated delete program_requirement_groups" ON program_requirement_groups;

CREATE POLICY "Builder write program_requirement_groups" ON program_requirement_groups
  FOR INSERT TO authenticated WITH CHECK (is_builder_writer());

CREATE POLICY "Builder update program_requirement_groups" ON program_requirement_groups
  FOR UPDATE TO authenticated USING (is_builder_writer()) WITH CHECK (is_builder_writer());

CREATE POLICY "Builder delete program_requirement_groups" ON program_requirement_groups
  FOR DELETE TO authenticated USING (is_builder_writer());

-- ─── Assessment Components ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write assessment_components" ON assessment_components;
DROP POLICY IF EXISTS "Authenticated update assessment_components" ON assessment_components;
DROP POLICY IF EXISTS "Authenticated delete assessment_components" ON assessment_components;

CREATE POLICY "Builder write assessment_components" ON assessment_components
  FOR INSERT TO authenticated WITH CHECK (is_builder_writer());

CREATE POLICY "Builder update assessment_components" ON assessment_components
  FOR UPDATE TO authenticated USING (is_builder_writer()) WITH CHECK (is_builder_writer());

CREATE POLICY "Builder delete assessment_components" ON assessment_components
  FOR DELETE TO authenticated USING (is_builder_writer());

-- ─── Classification Schemes (admin only) ───────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write classification_schemes" ON classification_schemes;
DROP POLICY IF EXISTS "Authenticated update classification_schemes" ON classification_schemes;

CREATE POLICY "Admin write classification_schemes" ON classification_schemes
  FOR INSERT TO authenticated WITH CHECK (is_builder_writer());

CREATE POLICY "Admin update classification_schemes" ON classification_schemes
  FOR UPDATE TO authenticated USING (is_builder_writer()) WITH CHECK (is_builder_writer());

-- ─── GPA Schemes (admin only) ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write gpa_schemes" ON gpa_schemes;
DROP POLICY IF EXISTS "Authenticated update gpa_schemes" ON gpa_schemes;

CREATE POLICY "Admin write gpa_schemes" ON gpa_schemes
  FOR INSERT TO authenticated WITH CHECK (is_builder_writer());

CREATE POLICY "Admin update gpa_schemes" ON gpa_schemes
  FOR UPDATE TO authenticated USING (is_builder_writer()) WITH CHECK (is_builder_writer());

-- ─── Module Prerequisites ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write module_prerequisites" ON module_prerequisites;
DROP POLICY IF EXISTS "Authenticated update module_prerequisites" ON module_prerequisites;
DROP POLICY IF EXISTS "Authenticated delete module_prerequisites" ON module_prerequisites;

CREATE POLICY "Builder write module_prerequisites" ON module_prerequisites
  FOR INSERT TO authenticated WITH CHECK (is_builder_writer());

CREATE POLICY "Builder update module_prerequisites" ON module_prerequisites
  FOR UPDATE TO authenticated USING (is_builder_writer()) WITH CHECK (is_builder_writer());

CREATE POLICY "Builder delete module_prerequisites" ON module_prerequisites
  FOR DELETE TO authenticated USING (is_builder_writer());

-- ─── Program Completion Policies ───────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write program_completion_policies" ON program_completion_policies;
DROP POLICY IF EXISTS "Authenticated update program_completion_policies" ON program_completion_policies;

CREATE POLICY "Builder write program_completion_policies" ON program_completion_policies
  FOR INSERT TO authenticated WITH CHECK (is_builder_writer());

CREATE POLICY "Builder update program_completion_policies" ON program_completion_policies
  FOR UPDATE TO authenticated USING (is_builder_writer()) WITH CHECK (is_builder_writer());
