-- ============================================================================
-- Migration 078: Add study_mode (TZ/VZ) support + semester/ECTS fields
-- ============================================================================

-- 1. Programs: Add study mode config + part-time duration
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS study_mode_available text NOT NULL DEFAULT 'both'
    CHECK (study_mode_available IN ('full_time', 'part_time', 'both')),
  ADD COLUMN IF NOT EXISTS duration_terms_part_time integer DEFAULT NULL;

COMMENT ON COLUMN programs.study_mode_available IS 'Which study modes this program offers: full_time, part_time, or both';
COMMENT ON COLUMN programs.duration_terms_part_time IS 'Duration in semesters for part-time variant (NULL = same as full-time)';

-- 2. Profiles: Add study_mode + existing_ects for students
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS study_mode text NOT NULL DEFAULT 'full_time'
    CHECK (study_mode IN ('full_time', 'part_time')),
  ADD COLUMN IF NOT EXISTS existing_ects numeric(6,1) NOT NULL DEFAULT 0;

COMMENT ON COLUMN profiles.study_mode IS 'Student''s chosen study mode: full_time or part_time';
COMMENT ON COLUMN profiles.existing_ects IS 'ECTS credits the student brings from prior semesters (declared at registration)';

-- 3. Student Programs: Add study_mode
ALTER TABLE student_programs
  ADD COLUMN IF NOT EXISTS study_mode text NOT NULL DEFAULT 'full_time'
    CHECK (study_mode IN ('full_time', 'part_time'));

-- 4. Modules (templates): Add part-time semester mapping
ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS semester_part_time text DEFAULT NULL;

COMMENT ON COLUMN modules.semester_part_time IS 'Semester assignment for part-time students (NULL = same as full-time semester)';

-- 5. Document the new "credited" status for modules
COMMENT ON COLUMN modules.status IS 'Module status: planned, active, completed, paused, credited';

-- 6. Populate study_mode_available for existing programs based on institution type
-- Fernhochschulen: both modes
UPDATE programs SET study_mode_available = 'both',
  duration_terms_part_time = CASE
    WHEN duration_standard_terms IS NOT NULL THEN CEIL(duration_standard_terms * 1.5)
    ELSE NULL
  END
WHERE institution_id IN (
  SELECT id FROM institutions WHERE
    name ILIKE '%fern%' OR name ILIKE '%distance%'
);

-- FHs: both modes
UPDATE programs SET study_mode_available = 'both',
  duration_terms_part_time = CASE
    WHEN duration_standard_terms IS NOT NULL THEN CEIL(duration_standard_terms * 1.5)
    ELSE NULL
  END
WHERE institution_id IN (
  SELECT id FROM institutions WHERE
    (name ILIKE '%fachhochschule%' OR name ILIKE '%FH %' OR name ILIKE '%haute école%'
     OR name ILIKE '%HES%' OR name ILIKE '%HAW%' OR name ILIKE '%hochschule%')
    AND name NOT ILIKE '%fern%'
)
AND study_mode_available = 'both';

-- Universities: full_time only
UPDATE programs SET study_mode_available = 'full_time'
WHERE institution_id IN (
  SELECT id FROM institutions WHERE
    (name ILIKE '%universit%' OR name ILIKE '%ETH%' OR name ILIKE '%EPFL%'
     OR name ILIKE '%TU %' OR name ILIKE '%technische universit%')
    AND name NOT ILIKE '%fern%'
    AND name NOT ILIKE '%fachhochschule%'
)
AND study_mode_available = 'both'
AND duration_terms_part_time IS NULL;
