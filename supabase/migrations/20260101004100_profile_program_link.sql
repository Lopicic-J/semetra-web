-- =============================================================================
-- Migration 041: Profile → Academic Program Link
-- Adds structured institution/program references to profiles table.
-- Enables: "Student X is enrolled in Program Y at Institution Z"
-- =============================================================================

-- 1. Add FK columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_program_id uuid REFERENCES programs(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_semester integer;

-- 2. Create student_programs entry automatically when profile links to a program
-- This function ensures a student_programs row exists whenever active_program_id is set.
CREATE OR REPLACE FUNCTION sync_student_program()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when active_program_id changes to a non-null value
  IF NEW.active_program_id IS NOT NULL AND
     (OLD.active_program_id IS DISTINCT FROM NEW.active_program_id) THEN

    INSERT INTO student_programs (user_id, program_id, institution_id, status, enrollment_date)
    VALUES (
      NEW.id,
      NEW.active_program_id,
      NEW.institution_id,
      'active',
      CURRENT_DATE
    )
    ON CONFLICT (user_id, program_id) DO UPDATE SET
      status = 'active',
      institution_id = EXCLUDED.institution_id,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  CREATE TRIGGER trg_sync_student_program
    AFTER UPDATE OF active_program_id ON profiles
    FOR EACH ROW EXECUTE FUNCTION sync_student_program();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_institution ON profiles(institution_id) WHERE institution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_program ON profiles(active_program_id) WHERE active_program_id IS NOT NULL;
