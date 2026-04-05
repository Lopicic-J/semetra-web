-- ============================================================================
-- 042: RLS Write Policies for enrollments, attempts, component_results
-- ============================================================================
-- Enables the Grade-Bridge dual-write: when a legacy grade is saved,
-- the bridge also creates/updates enrollments + attempts in the engine tables.
-- ============================================================================

-- ── enrollments ─────────────────────────────────────────────────────────────

-- SELECT (users can read their own enrollments)
DO $$ BEGIN
  CREATE POLICY enrollments_select ON enrollments
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT (users can create their own enrollments)
DO $$ BEGIN
  CREATE POLICY enrollments_insert ON enrollments
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE (users can update their own enrollments)
DO $$ BEGIN
  CREATE POLICY enrollments_update ON enrollments
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DELETE (users can delete their own enrollments)
DO $$ BEGIN
  CREATE POLICY enrollments_delete ON enrollments
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── attempts ────────────────────────────────────────────────────────────────

-- SELECT (users can read attempts for their own enrollments)
DO $$ BEGIN
  CREATE POLICY attempts_select ON attempts
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.id = attempts.enrollment_id AND e.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT (users can create attempts for their own enrollments)
DO $$ BEGIN
  CREATE POLICY attempts_insert ON attempts
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.id = enrollment_id AND e.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE (users can update attempts for their own enrollments)
DO $$ BEGIN
  CREATE POLICY attempts_update ON attempts
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.id = attempts.enrollment_id AND e.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DELETE (users can delete attempts for their own enrollments)
DO $$ BEGIN
  CREATE POLICY attempts_delete ON attempts
    FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.id = attempts.enrollment_id AND e.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── component_results ───────────────────────────────────────────────────────

-- SELECT (users can read component results for their own attempts)
DO $$ BEGIN
  CREATE POLICY component_results_select ON component_results
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM attempts a
        JOIN enrollments e ON e.id = a.enrollment_id
        WHERE a.id = component_results.attempt_id AND e.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT
DO $$ BEGIN
  CREATE POLICY component_results_insert ON component_results
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM attempts a
        JOIN enrollments e ON e.id = a.enrollment_id
        WHERE a.id = attempt_id AND e.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE
DO $$ BEGIN
  CREATE POLICY component_results_update ON component_results
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM attempts a
        JOIN enrollments e ON e.id = a.enrollment_id
        WHERE a.id = component_results.attempt_id AND e.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DELETE
DO $$ BEGIN
  CREATE POLICY component_results_delete ON component_results
    FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM attempts a
        JOIN enrollments e ON e.id = a.enrollment_id
        WHERE a.id = component_results.attempt_id AND e.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Indexes for policy performance ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_enrollments_user_module
  ON enrollments(user_id, module_id);

CREATE INDEX IF NOT EXISTS idx_attempts_enrollment_notes
  ON attempts(enrollment_id, notes);
