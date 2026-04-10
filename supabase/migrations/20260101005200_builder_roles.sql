-- =============================================================================
-- Migration 052: Builder Roles & Institution Ownership
-- Adds a 3-tier role system: platform_admin / institution_admin / student
-- Replaces blanket "authenticated = full access" with role-based policies.
-- =============================================================================

-- ─── 1. Add builder_role to profiles ────────────────────────────────────────
-- Default is 'student' — the most common user type.
-- platform_admin: full access (Lopicic Technologies)
-- institution_admin: manages own institution(s)
-- student: read-only on academic data, manages own modules
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN builder_role text NOT NULL DEFAULT 'student'
    CHECK (builder_role IN ('platform_admin', 'institution_admin', 'student'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_builder_role
  ON profiles(builder_role) WHERE builder_role != 'student';

-- ─── 2. Institution Admins junction table ───────────────────────────────────
-- Links users to institutions they can manage.
-- A platform_admin doesn't need entries here (they have blanket access).
CREATE TABLE IF NOT EXISTS institution_admins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'admin'
              CHECK (role IN ('admin', 'editor')),
  granted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, institution_id)
);

ALTER TABLE institution_admins ENABLE ROW LEVEL SECURITY;

-- Institution admins can see their own assignments
DO $$ BEGIN
CREATE POLICY "institution_admins_self_read" ON institution_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Platform admins can see all assignments
DO $$ BEGIN
CREATE POLICY "institution_admins_platform_read" ON institution_admins
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND builder_role = 'platform_admin'
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Platform admins can manage all assignments
DO $$ BEGIN
CREATE POLICY "institution_admins_platform_manage" ON institution_admins
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND builder_role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND builder_role = 'platform_admin'
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. Helper function: check builder access ───────────────────────────────
-- Returns true if the user can write to a given institution's data.
CREATE OR REPLACE FUNCTION can_manage_institution(p_user_id uuid, p_institution_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    -- Platform admin: can manage everything
    SELECT 1 FROM profiles WHERE id = p_user_id AND builder_role = 'platform_admin'
  ) OR EXISTS (
    -- Institution admin: can manage their assigned institution(s)
    SELECT 1 FROM institution_admins
    WHERE user_id = p_user_id AND institution_id = p_institution_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── 4. Helper: is platform admin ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_platform_admin(p_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND builder_role = 'platform_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── 5. Replace open write policies with role-based ones ────────────────────
-- Drop old blanket policies, create new role-based ones.

-- ── Institutions ────────────────────────────────────────────────────────────
-- SELECT: everyone (students need to browse institutions for enrollment)
-- INSERT/UPDATE/DELETE: platform_admin only (institutions are curated)

DROP POLICY IF EXISTS "Authenticated write institutions" ON institutions;
DROP POLICY IF EXISTS "Authenticated update institutions" ON institutions;
DROP POLICY IF EXISTS "Authenticated delete institutions" ON institutions;

DO $$ BEGIN
CREATE POLICY "institutions_insert_admin" ON institutions
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "institutions_update_admin" ON institutions
  FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()) OR can_manage_institution(auth.uid(), id))
  WITH CHECK (is_platform_admin(auth.uid()) OR can_manage_institution(auth.uid(), id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "institutions_delete_admin" ON institutions
  FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Faculties ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write faculties" ON faculties;
DROP POLICY IF EXISTS "Authenticated update faculties" ON faculties;
DROP POLICY IF EXISTS "Authenticated delete faculties" ON faculties;

DO $$ BEGIN
CREATE POLICY "faculties_insert_role" ON faculties
  FOR INSERT TO authenticated
  WITH CHECK (can_manage_institution(auth.uid(), institution_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "faculties_update_role" ON faculties
  FOR UPDATE TO authenticated
  USING (can_manage_institution(auth.uid(), institution_id))
  WITH CHECK (can_manage_institution(auth.uid(), institution_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "faculties_delete_role" ON faculties
  FOR DELETE TO authenticated
  USING (can_manage_institution(auth.uid(), institution_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Programs ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write programs" ON programs;
DROP POLICY IF EXISTS "Authenticated update programs" ON programs;
DROP POLICY IF EXISTS "Authenticated delete programs" ON programs;

DO $$ BEGIN
CREATE POLICY "programs_insert_role" ON programs
  FOR INSERT TO authenticated
  WITH CHECK (can_manage_institution(auth.uid(), institution_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "programs_update_role" ON programs
  FOR UPDATE TO authenticated
  USING (can_manage_institution(auth.uid(), institution_id))
  WITH CHECK (can_manage_institution(auth.uid(), institution_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "programs_delete_role" ON programs
  FOR DELETE TO authenticated
  USING (can_manage_institution(auth.uid(), institution_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Program Requirement Groups ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write program_requirement_groups" ON program_requirement_groups;
DROP POLICY IF EXISTS "Authenticated update program_requirement_groups" ON program_requirement_groups;
DROP POLICY IF EXISTS "Authenticated delete program_requirement_groups" ON program_requirement_groups;

DO $$ BEGIN
CREATE POLICY "req_groups_insert_role" ON program_requirement_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    can_manage_institution(auth.uid(), (SELECT institution_id FROM programs WHERE id = program_id))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "req_groups_update_role" ON program_requirement_groups
  FOR UPDATE TO authenticated
  USING (
    can_manage_institution(auth.uid(), (SELECT institution_id FROM programs WHERE id = program_id))
  )
  WITH CHECK (
    can_manage_institution(auth.uid(), (SELECT institution_id FROM programs WHERE id = program_id))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "req_groups_delete_role" ON program_requirement_groups
  FOR DELETE TO authenticated
  USING (
    can_manage_institution(auth.uid(), (SELECT institution_id FROM programs WHERE id = program_id))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Assessment Components ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write assessment_components" ON assessment_components;
DROP POLICY IF EXISTS "Authenticated update assessment_components" ON assessment_components;
DROP POLICY IF EXISTS "Authenticated delete assessment_components" ON assessment_components;

DO $$ BEGIN
CREATE POLICY "components_insert_role" ON assessment_components
  FOR INSERT TO authenticated
  WITH CHECK (
    -- User owns the module (student) OR can manage the institution
    EXISTS (SELECT 1 FROM modules m WHERE m.id = module_id AND m.user_id = auth.uid())
    OR can_manage_institution(auth.uid(),
      (SELECT p.institution_id FROM modules m JOIN programs p ON p.id = m.program_id WHERE m.id = module_id)
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "components_update_role" ON assessment_components
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM modules m WHERE m.id = module_id AND m.user_id = auth.uid())
    OR can_manage_institution(auth.uid(),
      (SELECT p.institution_id FROM modules m JOIN programs p ON p.id = m.program_id WHERE m.id = module_id)
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM modules m WHERE m.id = module_id AND m.user_id = auth.uid())
    OR can_manage_institution(auth.uid(),
      (SELECT p.institution_id FROM modules m JOIN programs p ON p.id = m.program_id WHERE m.id = module_id)
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "components_delete_role" ON assessment_components
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM modules m WHERE m.id = module_id AND m.user_id = auth.uid())
    OR can_manage_institution(auth.uid(),
      (SELECT p.institution_id FROM modules m JOIN programs p ON p.id = m.program_id WHERE m.id = module_id)
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Classification Schemes & GPA Schemes (platform admin only) ──────────────
DROP POLICY IF EXISTS "Authenticated write classification_schemes" ON classification_schemes;
DROP POLICY IF EXISTS "Authenticated update classification_schemes" ON classification_schemes;
DROP POLICY IF EXISTS "Authenticated write gpa_schemes" ON gpa_schemes;
DROP POLICY IF EXISTS "Authenticated update gpa_schemes" ON gpa_schemes;

DO $$ BEGIN
CREATE POLICY "schemes_write_admin" ON classification_schemes
  FOR INSERT TO authenticated WITH CHECK (is_platform_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "schemes_update_admin" ON classification_schemes
  FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "gpa_write_admin" ON gpa_schemes
  FOR INSERT TO authenticated WITH CHECK (is_platform_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "gpa_update_admin" ON gpa_schemes
  FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Module Prerequisites ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write module_prerequisites" ON module_prerequisites;
DROP POLICY IF EXISTS "Authenticated update module_prerequisites" ON module_prerequisites;
DROP POLICY IF EXISTS "Authenticated delete module_prerequisites" ON module_prerequisites;

DO $$ BEGIN
CREATE POLICY "prereqs_insert_role" ON module_prerequisites
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM modules m WHERE m.id = module_id AND m.user_id = auth.uid())
    OR can_manage_institution(auth.uid(),
      (SELECT p.institution_id FROM modules m JOIN programs p ON p.id = m.program_id WHERE m.id = module_id)
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "prereqs_update_role" ON module_prerequisites
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM modules m WHERE m.id = module_id AND m.user_id = auth.uid())
    OR can_manage_institution(auth.uid(),
      (SELECT p.institution_id FROM modules m JOIN programs p ON p.id = m.program_id WHERE m.id = module_id)
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM modules m WHERE m.id = module_id AND m.user_id = auth.uid())
    OR can_manage_institution(auth.uid(),
      (SELECT p.institution_id FROM modules m JOIN programs p ON p.id = m.program_id WHERE m.id = module_id)
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "prereqs_delete_role" ON module_prerequisites
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM modules m WHERE m.id = module_id AND m.user_id = auth.uid())
    OR can_manage_institution(auth.uid(),
      (SELECT p.institution_id FROM modules m JOIN programs p ON p.id = m.program_id WHERE m.id = module_id)
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Program Completion Policies ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated write program_completion_policies" ON program_completion_policies;
DROP POLICY IF EXISTS "Authenticated update program_completion_policies" ON program_completion_policies;

DO $$ BEGIN
CREATE POLICY "completion_write_admin" ON program_completion_policies
  FOR INSERT TO authenticated WITH CHECK (is_platform_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "completion_update_admin" ON program_completion_policies
  FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 6. Audit log for builder changes ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS builder_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        text NOT NULL,         -- 'create' | 'update' | 'delete'
  entity_type   text NOT NULL,         -- 'institution' | 'program' | 'module' | 'faculty'
  entity_id     uuid NOT NULL,
  entity_name   text,                  -- human-readable name for quick reference
  changes       jsonb,                 -- what changed (old → new for updates)
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE builder_audit_log ENABLE ROW LEVEL SECURITY;

-- Platform admins can read all logs
DO $$ BEGIN
CREATE POLICY "audit_read_admin" ON builder_audit_log
  FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Anyone can insert (API routes will log)
DO $$ BEGIN
CREATE POLICY "audit_insert_auth" ON builder_audit_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_builder_audit_entity
  ON builder_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_builder_audit_user
  ON builder_audit_log(user_id, created_at DESC);

-- ─── 7. Auto-import function for enrollment ─────────────────────────────────
-- When a student sets active_program_id, copy all template modules from that
-- program into their personal modules (if they don't already have them).
CREATE OR REPLACE FUNCTION auto_import_program_modules()
RETURNS TRIGGER AS $$
DECLARE
  template_mod RECORD;
BEGIN
  -- Only act when active_program_id changes to a non-null value
  IF NEW.active_program_id IS NOT NULL AND
     (OLD.active_program_id IS DISTINCT FROM NEW.active_program_id) THEN

    -- Copy each "template" module from the program that the student doesn't own yet
    FOR template_mod IN
      SELECT m.* FROM modules m
      WHERE m.program_id = NEW.active_program_id
        AND m.user_id IS NULL  -- template modules have no user_id
    LOOP
      -- Skip if student already has a module with same code in this program
      IF NOT EXISTS (
        SELECT 1 FROM modules
        WHERE user_id = NEW.id
          AND program_id = NEW.active_program_id
          AND module_code = template_mod.module_code
      ) THEN
        INSERT INTO modules (
          user_id, name, code, professor, ects, semester,
          day, time_start, time_end, room, color, notes,
          module_type, program_id, requirement_group_id,
          credit_scheme_id, grade_scale_id, pass_policy_id,
          retake_policy_id, rounding_policy_id,
          term_type, default_term_number, is_compulsory,
          language, delivery_mode, description, module_code,
          ects_equivalent, prerequisites_json, status, in_plan
        ) VALUES (
          NEW.id, template_mod.name, template_mod.code,
          template_mod.professor, template_mod.ects, template_mod.semester,
          template_mod.day, template_mod.time_start, template_mod.time_end,
          template_mod.room, COALESCE(template_mod.color, '#6366f1'),
          template_mod.notes, template_mod.module_type,
          NEW.active_program_id, template_mod.requirement_group_id,
          template_mod.credit_scheme_id, template_mod.grade_scale_id,
          template_mod.pass_policy_id, template_mod.retake_policy_id,
          template_mod.rounding_policy_id, template_mod.term_type,
          template_mod.default_term_number, template_mod.is_compulsory,
          template_mod.language, template_mod.delivery_mode,
          template_mod.description, template_mod.module_code,
          template_mod.ects_equivalent,
          COALESCE(template_mod.prerequisites_json, '{}'),
          'planned', true
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger (runs AFTER the existing sync_student_program trigger)
DO $$ BEGIN
  CREATE TRIGGER trg_auto_import_modules
    AFTER UPDATE OF active_program_id ON profiles
    FOR EACH ROW EXECUTE FUNCTION auto_import_program_modules();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
