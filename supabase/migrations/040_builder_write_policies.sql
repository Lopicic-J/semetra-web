-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 040: Builder Write Policies
-- Adds INSERT/UPDATE/DELETE policies for academic builder tables.
-- Previously only SELECT policies existed, silently blocking all writes via RLS.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Institutions: any authenticated user can create/edit/delete ─────────────
DO $$ BEGIN
CREATE POLICY "Authenticated write institutions" ON institutions
  FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated update institutions" ON institutions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated delete institutions" ON institutions
  FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Faculties ──────────────────────────────────────────────────────────────
DO $$ BEGIN
CREATE POLICY "Authenticated write faculties" ON faculties
  FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated update faculties" ON faculties
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated delete faculties" ON faculties
  FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Programs ───────────────────────────────────────────────────────────────
DO $$ BEGIN
CREATE POLICY "Authenticated write programs" ON programs
  FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated update programs" ON programs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated delete programs" ON programs
  FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Program Requirement Groups ─────────────────────────────────────────────
DO $$ BEGIN
CREATE POLICY "Authenticated write program_requirement_groups" ON program_requirement_groups
  FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated update program_requirement_groups" ON program_requirement_groups
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated delete program_requirement_groups" ON program_requirement_groups
  FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Assessment Components ──────────────────────────────────────────────────
DO $$ BEGIN
CREATE POLICY "Authenticated write assessment_components" ON assessment_components
  FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated update assessment_components" ON assessment_components
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated delete assessment_components" ON assessment_components
  FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Classification Schemes (read-only seed data, but allow admin writes) ───
DO $$ BEGIN
CREATE POLICY "Authenticated write classification_schemes" ON classification_schemes
  FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated update classification_schemes" ON classification_schemes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── GPA Schemes ────────────────────────────────────────────────────────────
DO $$ BEGIN
CREATE POLICY "Authenticated write gpa_schemes" ON gpa_schemes
  FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated update gpa_schemes" ON gpa_schemes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Module Prerequisites (from migration 035) ─────────────────────────────
DO $$ BEGIN
CREATE POLICY "Authenticated write module_prerequisites" ON module_prerequisites
  FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated update module_prerequisites" ON module_prerequisites
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated delete module_prerequisites" ON module_prerequisites
  FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Program Completion Policies (from migration 035) ───────────────────────
DO $$ BEGIN
CREATE POLICY "Authenticated write program_completion_policies" ON program_completion_policies
  FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated update program_completion_policies" ON program_completion_policies
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
