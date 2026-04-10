-- ════════════════════════════════════════════════════════════════════════════════
-- BATCH 4: Final (Migrations 068-074)
-- ════════════════════════════════════════════════════════════════════════════════
-- Contents:
--   068: Module fields (max_retakes)
--   069: Module description fields
--   070: Academic reference data expansion
--   071: Tighten builder RLS policies
--   072: Activate Study Buddy plugin
--   073: Institution Email-Domain Enforcement
--   074: Smart Schedule v2 — Intelligent Scheduling Engine (with DROP FUNCTION)
--
-- This batch contains module enhancements, policy tightening, and the final smart scheduling engine.
-- ════════════════════════════════════════════════════════════════════════════════


-- ═══ MIGRATION 068: Module fields (max_retakes) ═══

-- Add max_retakes column to modules table
-- Tracks how many times a student can retake a module (when is_repeatable = true)

ALTER TABLE modules ADD COLUMN IF NOT EXISTS max_retakes integer DEFAULT NULL;

COMMENT ON COLUMN modules.max_retakes IS 'Maximum number of retake attempts allowed (NULL = unlimited, only relevant when is_repeatable = true)';


-- ═══ MIGRATION 069: Module description fields ═══

-- Split module description into 4 structured text blocks
-- description (already exists) = Modulbeschreibung
-- learning_objectives = Lernziele
-- module_contents = Inhalte
-- remarks = Bemerkungen

ALTER TABLE modules ADD COLUMN IF NOT EXISTS learning_objectives text DEFAULT NULL;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS module_contents     text DEFAULT NULL;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS remarks             text DEFAULT NULL;

COMMENT ON COLUMN modules.learning_objectives IS 'Lernziele: was Studierende nach Abschluss können';
COMMENT ON COLUMN modules.module_contents     IS 'Inhalte: Themen, Kapitel, Schwerpunkte';
COMMENT ON COLUMN modules.remarks             IS 'Bemerkungen: zusätzliche Hinweise, Literatur etc.';


-- ═══ MIGRATION 070: Academic reference data expansion ═══

-- ─── 1. Add institution_id to reference tables for custom entries ───────────

ALTER TABLE grade_scales      ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE pass_policies     ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE retake_policies   ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE rounding_policies ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE;

-- Add description columns for better UX
ALTER TABLE pass_policies     ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE retake_policies   ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE rounding_policies ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE grade_scales      ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN grade_scales.institution_id      IS 'NULL = global/system entry, set = institution-specific custom entry';
COMMENT ON COLUMN pass_policies.institution_id     IS 'NULL = global/system entry, set = institution-specific custom entry';
COMMENT ON COLUMN retake_policies.institution_id   IS 'NULL = global/system entry, set = institution-specific custom entry';
COMMENT ON COLUMN rounding_policies.institution_id IS 'NULL = global/system entry, set = institution-specific custom entry';

-- ─── 2. Add missing grade scales (JP, KR, BR) ──────────────────────────────

INSERT INTO grade_scales (code, name, country_code, type, min_value, max_value, pass_value, step_size, decimal_places, higher_is_better, supports_honours, special_labels, description) VALUES
  ('JP_0_100',  'Japan 0–100 (S/A/B/C/F)',     'JP', 'numeric',    0,   100,  60,   1,   0, true,  false, '{"90":"S","80":"A","70":"B","60":"C","0":"F"}',
   'Japanische Notenskala: S(90+), A(80-89), B(70-79), C(60-69), F(<60)'),
  ('KR_0_4_5',  'South Korea GPA 0.0–4.5',     'KR', 'numeric',    0.0, 4.5,  1.0,  0.5, 1, true,  false, '{"4.5":"A+","4.0":"A","3.5":"B+","3.0":"B","2.5":"C+","2.0":"C","1.5":"D+","1.0":"D","0":"F"}',
   'Koreanische GPA-Skala mit A+ bis F'),
  ('BR_0_10',   'Brazil 0–10',                 'BR', 'numeric',    0,   10,   5.0,  0.5, 1, true,  false, '{}',
   'Brasilianische Skala: 0-10, Bestehen ab 5.0 (Bachelor) bzw. 6.0 (Master)')
ON CONFLICT (code) DO NOTHING;

-- ─── 3. Add country systems for JP, KR, BR ──────────────────────────────────

INSERT INTO country_systems (country_code, name, flag, default_credit_scheme_id, default_grade_scale_id, default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id, default_calendar_type, uses_honours) VALUES
  ('JP', '日本 (Japan)',         '🇯🇵',
    (SELECT id FROM credit_schemes WHERE code='LOCAL'),
    (SELECT id FROM grade_scales WHERE code='JP_0_100'),
    (SELECT id FROM rounding_policies WHERE code='ROUND_1'),
    (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'),
    (SELECT id FROM retake_policies WHERE code='DEFAULT_2_BEST'),
    'semester', false),
  ('KR', '대한민국 (South Korea)', '🇰🇷',
    (SELECT id FROM credit_schemes WHERE code='LOCAL'),
    (SELECT id FROM grade_scales WHERE code='KR_0_4_5'),
    (SELECT id FROM rounding_policies WHERE code='ROUND_01'),
    (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'),
    (SELECT id FROM retake_policies WHERE code='IMPROVE_ALLOWED'),
    'semester', false),
  ('BR', 'Brasil',               '🇧🇷',
    (SELECT id FROM credit_schemes WHERE code='LOCAL'),
    (SELECT id FROM grade_scales WHERE code='BR_0_10'),
    (SELECT id FROM rounding_policies WHERE code='ROUND_05'),
    (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'),
    (SELECT id FROM retake_policies WHERE code='DEFAULT_2_BEST'),
    'semester', false)
ON CONFLICT (country_code) DO NOTHING;

-- ─── 4. Refine existing country defaults based on research ────────────────────

-- Switzerland: typical is 1-2 retakes (use DEFAULT_2_BEST instead of 3)
UPDATE country_systems SET default_retake_policy_id = (SELECT id FROM retake_policies WHERE code='DEFAULT_2_BEST')
WHERE country_code = 'CH';

-- Austria: 3 retakes allowed
UPDATE country_systems SET default_retake_policy_id = (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST')
WHERE country_code = 'AT';

-- Italy: unlimited retakes, can even retake if passed
UPDATE country_systems SET default_retake_policy_id = (SELECT id FROM retake_policies WHERE code='IMPROVE_ALLOWED')
WHERE country_code = 'IT';

-- Spain: unlimited retakes, latest counts
INSERT INTO retake_policies (code, name, max_attempts, retake_if_passed, grade_replacement, description) VALUES
  ('UNLIMITED_LATEST', 'Unlimited attempts, latest counts', 99, false, 'latest_attempt', 'Unbegrenzte Versuche, letzter Versuch zählt')
ON CONFLICT (code) DO NOTHING;
UPDATE country_systems SET default_retake_policy_id = (SELECT id FROM retake_policies WHERE code='UNLIMITED_LATEST')
WHERE country_code = 'ES';

-- Netherlands: compensation model for pass policy
UPDATE country_systems SET default_pass_policy_id = (SELECT id FROM pass_policies WHERE code='THRESHOLD_PLUS_MANDATORY')
WHERE country_code = 'NL';

-- UK: 40% pass for undergrad
UPDATE country_systems SET uses_honours = true WHERE country_code = 'UK';

-- ─── 5. Add descriptions to existing policies for better UX ─────────────────

UPDATE pass_policies SET description = 'Bestanden wenn Endnote ≥ Bestehensgrenze der Notenskala' WHERE code = 'SIMPLE_THRESHOLD' AND description IS NULL;
UPDATE pass_policies SET description = 'Endnote ≥ Grenze UND alle Pflichtkomponenten bestanden' WHERE code = 'THRESHOLD_PLUS_MANDATORY' AND description IS NULL;
UPDATE pass_policies SET description = 'Jede einzelne Bewertungskomponente muss bestanden sein' WHERE code = 'ALL_COMPONENTS' AND description IS NULL;
UPDATE pass_policies SET description = 'Nur Bestanden/Nicht bestanden, keine Note' WHERE code = 'PASS_FAIL' AND description IS NULL;
UPDATE pass_policies SET description = 'Schwache Ergebnisse können durch starke kompensiert werden' WHERE code = 'COMPENSATION' AND description IS NULL;

UPDATE retake_policies SET description = 'Max. 3 Versuche, bester zählt' WHERE code = 'DEFAULT_3_BEST' AND description IS NULL;
UPDATE retake_policies SET description = 'Max. 3 Versuche, letzter zählt' WHERE code = 'DEFAULT_3_LATEST' AND description IS NULL;
UPDATE retake_policies SET description = 'Max. 2 Versuche, bester zählt' WHERE code = 'DEFAULT_2_BEST' AND description IS NULL;
UPDATE retake_policies SET description = 'Unbegrenzte Versuche, bester zählt' WHERE code = 'UNLIMITED_BEST' AND description IS NULL;
UPDATE retake_policies SET description = 'Keine Wiederholung erlaubt' WHERE code = 'NO_RETAKE' AND description IS NULL;
UPDATE retake_policies SET description = 'Auch bei Bestehen wiederholbar, bester zählt' WHERE code = 'IMPROVE_ALLOWED' AND description IS NULL;
UPDATE retake_policies SET description = 'Unbegrenzte Versuche, letzter zählt' WHERE code = 'UNLIMITED_LATEST' AND description IS NULL;

UPDATE rounding_policies SET description = 'Auf 0.25 runden (z.B. 4.63 → 4.75)' WHERE code = 'ROUND_025' AND description IS NULL;
UPDATE rounding_policies SET description = 'Auf 0.5 runden (z.B. 4.63 → 4.5)' WHERE code = 'ROUND_05' AND description IS NULL;
UPDATE rounding_policies SET description = 'Auf 0.1 runden (z.B. 4.63 → 4.6)' WHERE code = 'ROUND_01' AND description IS NULL;
UPDATE rounding_policies SET description = 'Auf ganze Zahl runden (z.B. 4.6 → 5)' WHERE code = 'ROUND_1' AND description IS NULL;
UPDATE rounding_policies SET description = 'Abrunden auf 0.5 (z.B. 4.74 → 4.5)' WHERE code = 'FLOOR_05' AND description IS NULL;
UPDATE rounding_policies SET description = 'Keine Rundung (2 Dezimalstellen)' WHERE code = 'NO_ROUND' AND description IS NULL;
UPDATE rounding_policies SET description = 'Auf 0.5 runden, nur auf Zeugnis' WHERE code = 'TRANSCRIPT_05' AND description IS NULL;

-- ─── 6. Add grade scale descriptions ─────────────────────────────────────────

UPDATE grade_scales SET description = '1 (tiefste) bis 6 (beste), Bestehen ab 4.0. Schrittweite 0.25 oder 0.5.' WHERE code = 'CH_1_6' AND description IS NULL;
UPDATE grade_scales SET description = '1.0 (beste) bis 5.0 (nicht bestanden), Bestehen bis 4.0. Schritte: 0.3.' WHERE code = 'DE_1_5' AND description IS NULL;
UPDATE grade_scales SET description = '1 (Sehr gut) bis 5 (Nicht genügend), Bestehen bis 4 (Genügend).' WHERE code = 'AT_1_5' AND description IS NULL;
UPDATE grade_scales SET description = '0 bis 20, Bestehen ab 10. Mention: 12=AB, 14=B, 16=TB.' WHERE code = 'FR_0_20' AND description IS NULL;
UPDATE grade_scales SET description = '18 bis 30 e lode, Bestehen ab 18. 30L = Auszeichnung.' WHERE code = 'IT_18_30_LODE' AND description IS NULL;
UPDATE grade_scales SET description = '1 bis 10, Bestehen ab 5.5 (6.0 gerundet). Dezimalschritte.' WHERE code = 'NL_1_10' AND description IS NULL;
UPDATE grade_scales SET description = '0 bis 10, Bestehen ab 5.0. Matrícula de Honor ab 9.0.' WHERE code = 'ES_0_10' AND description IS NULL;
UPDATE grade_scales SET description = '0–100%, Bestehen ab 40% (UG) / 50% (PG). First=70%+.' WHERE code = 'UK_PERCENTAGE' AND description IS NULL;
UPDATE grade_scales SET description = 'GPA 0.0–4.0. A=4.0, B=3.0, C=2.0, D=1.0, F=0.' WHERE code = 'US_GPA' AND description IS NULL;
UPDATE grade_scales SET description = 'A–F (ECTS-Skala). Bestehen ab E.' WHERE code = 'SE_A_F' AND description IS NULL;
UPDATE grade_scales SET description = '2 bis 5, Bestehen ab 3.0. Halbe Schritte (3.5, 4.5).' WHERE code = 'PL_2_5' AND description IS NULL;
UPDATE grade_scales SET description = '1 (výborně) bis 4 (dostatečně), Nicht bestanden = 4+.' WHERE code = 'CZ_1_4' AND description IS NULL;
UPDATE grade_scales SET description = '7-Stufen: -3, 00, 02, 4, 7, 10, 12. Bestehen ab 02.' WHERE code = 'DK_M3_12' AND description IS NULL;
UPDATE grade_scales SET description = '0 bis 5, Bestehen ab 1. 50% = Note 1.' WHERE code = 'FI_0_5' AND description IS NULL;
UPDATE grade_scales SET description = '0 bis 20, Bestehen ab 10.' WHERE code = 'PT_0_20' AND description IS NULL;
UPDATE grade_scales SET description = '0 bis 20, Bestehen ab 10. Wie Frankreich.' WHERE code = 'BE_0_20' AND description IS NULL;
UPDATE grade_scales SET description = 'A–F (ECTS-Skala). Bestehen ab E.' WHERE code = 'NO_A_F' AND description IS NULL;


-- ═══ MIGRATION 071: Tighten builder RLS policies ═══

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


-- ═══ MIGRATION 072: Activate Study Buddy plugin ═══

-- Study Buddy is an internal feature (no external API keys needed)
-- so it should be active, not coming_soon.

UPDATE plugins SET
  status = 'active'
WHERE id = 'study-buddy';


-- ═══ MIGRATION 073: Institution Email-Domain Enforcement ═══

BEGIN;

-- ─── 1. Add email_domains column to institutions ────────────────────────────
-- Array of known email domains for this institution
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS email_domains text[] DEFAULT '{}';

COMMENT ON COLUMN institutions.email_domains IS
  'Known email domains for this institution (e.g. {"zhaw.ch","students.zhaw.ch"}). Used for auto-assignment and validation.';

-- ─── 2. Seed known domains for Swiss institutions ───────────────────────────
-- Using the institution code to match

UPDATE institutions SET email_domains = ARRAY['zhaw.ch', 'students.zhaw.ch']
  WHERE code = 'ZHAW';

UPDATE institutions SET email_domains = ARRAY['fhnw.ch', 'students.fhnw.ch']
  WHERE code = 'FHNW';

UPDATE institutions SET email_domains = ARRAY['bfh.ch', 'students.bfh.ch']
  WHERE code = 'BFH';

UPDATE institutions SET email_domains = ARRAY['hslu.ch', 'stud.hslu.ch']
  WHERE code = 'HSLU';

UPDATE institutions SET email_domains = ARRAY['fhgr.ch']
  WHERE code = 'FHGR';

UPDATE institutions SET email_domains = ARRAY['ost.ch', 'students.ost.ch']
  WHERE code = 'OST';

UPDATE institutions SET email_domains = ARRAY['hes-so.ch']
  WHERE code = 'HES-SO';

UPDATE institutions SET email_domains = ARRAY['supsi.ch']
  WHERE code = 'SUPSI';

UPDATE institutions SET email_domains = ARRAY['ethz.ch', 'student.ethz.ch']
  WHERE code = 'ETHZ';

UPDATE institutions SET email_domains = ARRAY['uzh.ch', 's.uzh.ch']
  WHERE code = 'UZH';

UPDATE institutions SET email_domains = ARRAY['unibe.ch', 'students.unibe.ch']
  WHERE code = 'UNIBE';

UPDATE institutions SET email_domains = ARRAY['unisg.ch', 'student.unisg.ch']
  WHERE code = 'UNISG';

UPDATE institutions SET email_domains = ARRAY['unifr.ch']
  WHERE code = 'UNIFR';

UPDATE institutions SET email_domains = ARRAY['unil.ch']
  WHERE code = 'UNIL';

UPDATE institutions SET email_domains = ARRAY['epfl.ch']
  WHERE code = 'EPFL';

UPDATE institutions SET email_domains = ARRAY['unibas.ch', 'stud.unibas.ch']
  WHERE code = 'UNIBAS';

UPDATE institutions SET email_domains = ARRAY['unilu.ch']
  WHERE code = 'UNILU';

UPDATE institutions SET email_domains = ARRAY['usi.ch']
  WHERE code = 'USI';

UPDATE institutions SET email_domains = ARRAY['unine.ch']
  WHERE code = 'UNINE';

UPDATE institutions SET email_domains = ARRAY['phzh.ch']
  WHERE code = 'PHZH';

UPDATE institutions SET email_domains = ARRAY['phbern.ch']
  WHERE code = 'PHBERN';

UPDATE institutions SET email_domains = ARRAY['phtg.ch']
  WHERE code = 'PHTG';

UPDATE institutions SET email_domains = ARRAY['phsg.ch']
  WHERE code = 'PHSG';

UPDATE institutions SET email_domains = ARRAY['phlu.ch']
  WHERE code = 'PHLU';

UPDATE institutions SET email_domains = ARRAY['phzg.ch']
  WHERE code = 'PHZG';

UPDATE institutions SET email_domains = ARRAY['phsz.ch']
  WHERE code = 'PHSZ';

UPDATE institutions SET email_domains = ARRAY['zhdk.ch']
  WHERE code = 'ZHDK';

UPDATE institutions SET email_domains = ARRAY['hkb.bfh.ch']
  WHERE code = 'HKB';


-- ─── 3. Demote mismatched students to non_student ───────────────────────────
-- Find students whose email domain doesn't match their assigned institution
-- and demote them to non_student.

-- First: extract email domain from auth.users and check against institution
WITH mismatched AS (
  SELECT p.id AS profile_id,
         p.institution_id,
         p.user_role,
         split_part(au.email, '@', 2) AS email_domain,
         i.code AS inst_code,
         i.email_domains AS inst_domains
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
  LEFT JOIN institutions i ON i.id = p.institution_id
  WHERE p.user_role IN ('student', 'institution')  -- admin is exempt
    AND p.institution_id IS NOT NULL
    -- Student has a known university email domain
    AND split_part(au.email, '@', 2) IN (
      SELECT unnest(email_domains) FROM institutions WHERE email_domains != '{}'
    )
    -- But their assigned institution doesn't match their email domain
    AND NOT (
      split_part(au.email, '@', 2) = ANY(COALESCE(i.email_domains, '{}'))
    )
)
UPDATE profiles
SET user_role = 'non_student',
    verification_status = 'none',
    institution_id = NULL,
    active_program_id = NULL
FROM mismatched
WHERE profiles.id = mismatched.profile_id;


-- ─── 4. Function to validate institution-email match ────────────────────────
-- Called by trigger on profile insert/update

CREATE OR REPLACE FUNCTION enforce_institution_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email_domain text;
  v_correct_inst_id uuid;
BEGIN
  -- Platform admins (user_role = 'admin') are exempt — they can belong to any institution
  IF NEW.user_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Only enforce for students and institution-admins with an institution_id
  IF NEW.institution_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the user's email domain
  SELECT split_part(email, '@', 2) INTO v_email_domain
  FROM auth.users WHERE id = NEW.id;

  IF v_email_domain IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this email domain belongs to ANY institution
  SELECT id INTO v_correct_inst_id
  FROM institutions
  WHERE v_email_domain = ANY(email_domains)
  LIMIT 1;

  -- If the email domain is a known university domain...
  IF v_correct_inst_id IS NOT NULL THEN
    -- For students: force-correct to the matching institution
    -- For institution-admins: also force to matching institution (they can only admin their own)
    IF NEW.institution_id != v_correct_inst_id THEN
      NEW.institution_id := v_correct_inst_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_enforce_institution_email ON profiles;

-- Create trigger: fires on INSERT and UPDATE
CREATE TRIGGER trg_enforce_institution_email
  BEFORE INSERT OR UPDATE OF institution_id, user_role
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_institution_email_domain();

COMMENT ON FUNCTION enforce_institution_email_domain() IS
  'Ensures students with known university emails are always assigned to the correct institution. Prevents "Blindgänger" in wrong institutions.';

COMMIT;


-- ═══ MIGRATION 074: Smart Schedule v2 — Intelligent Scheduling Engine ═══

-- DROP FUNCTION at the beginning of 074 (as per requirements)
DROP FUNCTION IF EXISTS check_all_missed_blocks();

-- ═══════════════════════════════════════════════════════════════════════════
-- Fixes:
--   0. Fix broken auto_detect_missed_blocks() column references (from 064)
--   1. Add missing FK on study_plan_item_id (from 063)
-- New Schema:
--   2. Extend user_schedule_preferences (available_from/until, auto flags)
-- New Functions:
--   3. sync_stundenplan_to_schedule()  — smart upsert replacing old import
--   4. auto_fill_free_slots()         — gap detection + priority-based fill
--   5. auto_rescue_missed_blocks()    — detect + auto-reschedule
--   6. compute_exam_study_plan()      — backward-scheduling from exams
-- Data Fixes:
--   7. Backfill orphaned stundenplan_import blocks with stundenplan_id
--   8. Seed available_from/until from existing wake/sleep
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 0. FIX: auto_detect_missed_blocks() — broken column references from 064 ───
-- Migration 064 used: schedule_block_id, action, reason
-- Correct columns:    original_block_id, trigger, original_start, original_end

CREATE OR REPLACE FUNCTION auto_detect_missed_blocks()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only fire if block was 'scheduled' and its end_time is 30+ min in the past
  IF NEW.status = 'scheduled' AND OLD.status = 'scheduled'
     AND NEW.end_time < (now() - INTERVAL '30 minutes') THEN

    -- Check if ANY timer session exists for this block
    IF NOT EXISTS (
      SELECT 1 FROM timer_sessions
      WHERE schedule_block_id = NEW.id
        AND status IN ('completed', 'active', 'paused')
    ) THEN
      NEW.status := 'skipped';
      NEW.updated_at := now();

      -- Log to reschedule_log with CORRECT column names
      BEGIN
        INSERT INTO reschedule_log (
          user_id, original_block_id, trigger,
          original_start, original_end,
          resolution, module_id, block_type, reason, auto_generated
        ) VALUES (
          NEW.user_id,
          NEW.id,
          'missed',
          NEW.start_time,
          NEW.end_time,
          'pending',
          NEW.module_id,
          NEW.block_type,
          'Automatisch als verpasst erkannt (Zeitfenster +30 Min abgelaufen)',
          true
        );
      EXCEPTION WHEN undefined_table OR undefined_column THEN
        NULL; -- Graceful fallback
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ─── 1. FIX: Missing FK on study_plan_item_id (from migration 063) ─────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_schedule_blocks_study_plan_item'
  ) THEN
    BEGIN
      ALTER TABLE schedule_blocks
        ADD CONSTRAINT fk_schedule_blocks_study_plan_item
        FOREIGN KEY (study_plan_item_id) REFERENCES study_plan_items(id) ON DELETE SET NULL;
    EXCEPTION WHEN undefined_table THEN
      NULL; -- study_plan_items may not exist yet
    END;
  END IF;
END $$;


-- ─── 2. Extend user_schedule_preferences ──────────────────────────────────────

-- Available learning window: when the student can ACTUALLY study
-- (e.g. 15:00-23:00 for students who work mornings)
ALTER TABLE user_schedule_preferences
  ADD COLUMN IF NOT EXISTS available_from time DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS available_until time DEFAULT '23:00';

-- Automation flags
ALTER TABLE user_schedule_preferences
  ADD COLUMN IF NOT EXISTS auto_sync_stundenplan boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_fill_gaps boolean DEFAULT false;

-- Exam planning preferences
ALTER TABLE user_schedule_preferences
  ADD COLUMN IF NOT EXISTS exam_prep_start_days_before smallint DEFAULT 14,
  ADD COLUMN IF NOT EXISTS exam_prep_min_hours smallint DEFAULT 10,
  ADD COLUMN IF NOT EXISTS exam_prep_daily_max_minutes smallint DEFAULT 120;


-- ─── 3. Ensure stundenplan_id column + index ──────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_blocks' AND column_name = 'stundenplan_id'
  ) THEN
    ALTER TABLE schedule_blocks
      ADD COLUMN stundenplan_id uuid REFERENCES stundenplan(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_stundenplan_id
  ON schedule_blocks(stundenplan_id) WHERE stundenplan_id IS NOT NULL;

-- Add source type 'stundenplan_sync' if not already in check constraint
-- (Migration 061 should have added it, but ensure it)
DO $$ BEGIN
  ALTER TABLE schedule_blocks DROP CONSTRAINT IF EXISTS schedule_blocks_source_check;
  ALTER TABLE schedule_blocks ADD CONSTRAINT schedule_blocks_source_check
    CHECK (source IN (
      'manual', 'auto_plan', 'stundenplan_import', 'stundenplan_sync',
      'calendar_sync', 'study_plan', 'decision_engine', 'exam_prep_auto', 'auto_fill'
    ));
EXCEPTION WHEN others THEN NULL;
END $$;


-- ─── 4. sync_stundenplan_to_schedule() — Smart upsert (replaces old import) ────
-- Tracks stundenplan_id so moves/deletions propagate correctly.
-- Returns JSON: { created, updated, deleted, conflicts }

CREATE OR REPLACE FUNCTION sync_stundenplan_to_schedule(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entry record;
  v_existing record;
  v_day_offset integer;
  v_today date := CURRENT_DATE;
  v_week_start date;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_created integer := 0;
  v_updated integer := 0;
  v_deleted integer := 0;
  v_conflicts integer := 0;
  v_active_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Monday of current week
  v_week_start := v_today - ((EXTRACT(ISODOW FROM v_today)::integer - 1));

  FOR v_entry IN
    SELECT * FROM stundenplan WHERE user_id = p_user_id
  LOOP
    v_day_offset := CASE v_entry.day
      WHEN 'Mo' THEN 0 WHEN 'Di' THEN 1 WHEN 'Mi' THEN 2
      WHEN 'Do' THEN 3 WHEN 'Fr' THEN 4 WHEN 'Sa' THEN 5
      ELSE NULL
    END;
    IF v_day_offset IS NULL THEN CONTINUE; END IF;

    v_active_ids := array_append(v_active_ids, v_entry.id);
    v_start_ts := (v_week_start + v_day_offset)::date + v_entry.time_start::time;
    v_end_ts   := (v_week_start + v_day_offset)::date + v_entry.time_end::time;

    -- Find existing schedule_block for this stundenplan entry
    SELECT * INTO v_existing
    FROM schedule_blocks
    WHERE stundenplan_id = v_entry.id AND user_id = p_user_id AND layer = 1
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      -- UPDATE if anything changed
      IF v_existing.start_time::time != v_entry.time_start::time
         OR v_existing.end_time::time != v_entry.time_end::time
         OR v_existing.title != v_entry.title
         OR COALESCE(v_existing.module_id::text, '') != COALESCE(v_entry.module_id::text, '') THEN

        UPDATE schedule_blocks SET
          start_time = v_start_ts, end_time = v_end_ts,
          title = v_entry.title, color = v_entry.color,
          module_id = v_entry.module_id,
          source = 'stundenplan_sync', updated_at = now()
        WHERE id = v_existing.id;
        v_updated := v_updated + 1;

        -- Check if this move conflicts with any Layer 2 block
        IF EXISTS (
          SELECT 1 FROM schedule_blocks
          WHERE user_id = p_user_id AND layer = 2
            AND status = 'scheduled' AND id != v_existing.id
            AND start_time < v_end_ts AND end_time > v_start_ts
        ) THEN
          v_conflicts := v_conflicts + 1;
        END IF;
      END IF;
    ELSE
      -- INSERT new block
      INSERT INTO schedule_blocks (
        user_id, block_type, layer, title, color, module_id,
        start_time, end_time, recurrence, source, stundenplan_id,
        status, priority
      ) VALUES (
        p_user_id, 'lecture', 1, v_entry.title, v_entry.color, v_entry.module_id,
        v_start_ts, v_end_ts, 'weekly', 'stundenplan_sync', v_entry.id,
        'scheduled', 'medium'
      );
      v_created := v_created + 1;
    END IF;
  END LOOP;

  -- Remove orphans (deleted stundenplan entries)
  WITH deleted AS (
    DELETE FROM schedule_blocks
    WHERE user_id = p_user_id AND layer = 1
      AND source IN ('stundenplan_sync', 'stundenplan_import')
      AND stundenplan_id IS NOT NULL
      AND NOT (stundenplan_id = ANY(v_active_ids))
    RETURNING id
  )
  SELECT count(*) INTO v_deleted FROM deleted;

  RETURN jsonb_build_object(
    'created', v_created, 'updated', v_updated,
    'deleted', v_deleted, 'conflicts', v_conflicts
  );
END;
$$;


-- ─── 5. auto_fill_free_slots() — Gap detection + priority-based fill ──────────
-- Scans a day for free time, creates study blocks for highest-priority modules.
-- Respects: available_from/until, max_daily_study_minutes, min/max block duration.
-- Returns: { filled_slots, total_minutes, modules_scheduled }

CREATE OR REPLACE FUNCTION auto_fill_free_slots(
  p_user_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefs record;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_occupied tstzrange[];
  v_block record;
  v_session record;
  v_module record;
  v_slot_start timestamptz;
  v_cursor timestamptz;
  v_gap_minutes integer;
  v_budget_remaining integer;
  v_filled integer := 0;
  v_total_minutes integer := 0;
  v_modules_scheduled text[] := ARRAY[]::text[];
  v_block_duration integer;
BEGIN
  -- 1. Load preferences
  SELECT * INTO v_prefs FROM user_schedule_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    v_prefs := ROW(p_user_id, '07:00'::time, '23:00'::time, '07:00'::time, '23:00'::time,
                   25, 90, 10, 360, 3, 3, 3, true, true, 240, false, true, true, false,
                   14, 10, 120, 25, 5, 15, 4, now(), now());
  END IF;

  v_day_start := p_date + COALESCE(v_prefs.available_from, v_prefs.wake_time);
  v_day_end   := p_date + COALESCE(v_prefs.available_until, v_prefs.sleep_time);

  -- 2. Calculate remaining budget
  SELECT COALESCE(v_prefs.max_daily_study_minutes, 360)
    - COALESCE(SUM(
        EXTRACT(EPOCH FROM (sb.end_time - sb.start_time)) / 60
      ), 0)
  INTO v_budget_remaining
  FROM schedule_blocks sb
  WHERE sb.user_id = p_user_id AND sb.layer = 2
    AND sb.status IN ('scheduled', 'in_progress')
    AND sb.start_time >= v_day_start AND sb.start_time < v_day_end;

  IF v_budget_remaining <= 0 THEN
    RETURN jsonb_build_object('filled_slots', 0, 'total_minutes', 0,
      'message', 'Tages-Budget bereits ausgeschöpft');
  END IF;

  -- 3. Collect ALL occupied intervals (Layer 1 + Layer 2 + active sessions)
  v_occupied := ARRAY[]::tstzrange[];
  FOR v_block IN
    SELECT start_time, end_time FROM schedule_blocks
    WHERE user_id = p_user_id
      AND status NOT IN ('skipped', 'rescheduled')
      AND start_time >= v_day_start AND end_time <= v_day_end
  LOOP
    -- 5min buffer around Layer 1 blocks
    v_occupied := array_append(v_occupied,
      tstzrange(v_block.start_time - INTERVAL '5 minutes',
                v_block.end_time + INTERVAL '5 minutes'));
  END LOOP;

  FOR v_session IN
    SELECT started_at, COALESCE(ended_at, now()) AS ended_at FROM timer_sessions
    WHERE user_id = p_user_id AND status IN ('active', 'paused', 'completed')
      AND started_at >= v_day_start AND started_at < v_day_end
  LOOP
    v_occupied := array_append(v_occupied, tstzrange(v_session.started_at, v_session.ended_at));
  END LOOP;

  -- 4. Get priority-ranked modules (by exam proximity + grade risk)
  -- For each gap >= min_study_block_minutes: create a study block
  v_cursor := v_day_start;

  FOR v_module IN
    SELECT m.id, m.name, m.color, m.exam_date,
      CASE
        WHEN m.exam_date IS NOT NULL AND m.exam_date::date - p_date BETWEEN 0 AND 7 THEN 100
        WHEN m.exam_date IS NOT NULL AND m.exam_date::date - p_date BETWEEN 8 AND 14 THEN 80
        WHEN m.exam_date IS NOT NULL AND m.exam_date::date - p_date BETWEEN 15 AND 30 THEN 60
        ELSE 40
      END AS priority_score
    FROM modules m
    WHERE m.user_id = p_user_id AND m.status = 'active'
    ORDER BY priority_score DESC, m.exam_date ASC NULLS LAST
    LIMIT 5
  LOOP
    -- Find next free gap for this module
    v_cursor := v_day_start;

    WHILE v_cursor < v_day_end AND v_budget_remaining > 0 LOOP
      -- Skip past any occupied interval
      DECLARE
        v_occupied_item tstzrange;
        v_advanced boolean := false;
      BEGIN
        FOREACH v_occupied_item IN ARRAY v_occupied LOOP
          IF v_cursor >= lower(v_occupied_item) AND v_cursor < upper(v_occupied_item) THEN
            v_cursor := upper(v_occupied_item);
            v_advanced := true;
          END IF;
        END LOOP;
        IF NOT v_advanced THEN
          -- Find how much space until next occupied
          v_slot_start := v_cursor;
          v_gap_minutes := EXTRACT(EPOCH FROM (v_day_end - v_cursor))::integer / 60;

          FOREACH v_occupied_item IN ARRAY v_occupied LOOP
            IF lower(v_occupied_item) > v_cursor THEN
              v_gap_minutes := LEAST(v_gap_minutes,
                EXTRACT(EPOCH FROM (lower(v_occupied_item) - v_cursor))::integer / 60);
            END IF;
          END LOOP;

          IF v_gap_minutes >= COALESCE(v_prefs.min_study_block_minutes, 25) THEN
            v_block_duration := LEAST(
              v_gap_minutes - COALESCE(v_prefs.preferred_break_minutes, 10),
              COALESCE(v_prefs.max_study_block_minutes, 90),
              v_budget_remaining
            );

            IF v_block_duration >= COALESCE(v_prefs.min_study_block_minutes, 25) THEN
              INSERT INTO schedule_blocks (
                user_id, block_type, layer, title, color, module_id,
                start_time, end_time, source, status, priority
              ) VALUES (
                p_user_id, 'study', 2, 'Lernen: ' || v_module.name, v_module.color, v_module.id,
                v_slot_start, v_slot_start + (v_block_duration || ' minutes')::interval,
                'auto_fill', 'scheduled',
                CASE WHEN v_module.priority_score >= 80 THEN 'high'
                     WHEN v_module.priority_score >= 60 THEN 'medium'
                     ELSE 'low' END
              );

              v_filled := v_filled + 1;
              v_total_minutes := v_total_minutes + v_block_duration;
              v_budget_remaining := v_budget_remaining - v_block_duration;
              v_modules_scheduled := array_append(v_modules_scheduled, v_module.name);

              -- Mark this slot as occupied for next module
              v_occupied := array_append(v_occupied,
                tstzrange(v_slot_start, v_slot_start + (v_block_duration || ' minutes')::interval));

              EXIT; -- Next module
            END IF;
          END IF;

          -- No valid gap found, advance past current area
          v_cursor := v_cursor + INTERVAL '15 minutes';
        END IF;
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'filled_slots', v_filled,
    'total_minutes', v_total_minutes,
    'modules_scheduled', to_jsonb(v_modules_scheduled),
    'budget_remaining', v_budget_remaining
  );
END;
$$;


-- ─── 6. auto_rescue_missed_blocks() — Detect + auto-reschedule ────────────────
-- Finds missed blocks (end_time passed, no session) and reschedules them
-- within the next N days into free slots. Returns: { rescued, dropped, details }

CREATE OR REPLACE FUNCTION auto_rescue_missed_blocks(
  p_user_id uuid,
  p_look_ahead_days integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_missed record;
  v_prefs record;
  v_rescued integer := 0;
  v_dropped integer := 0;
  v_details jsonb[] := ARRAY[]::jsonb[];
  v_target_date date;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_found boolean;
  v_duration_minutes integer;
  v_new_block_id uuid;
BEGIN
  SELECT * INTO v_prefs FROM user_schedule_preferences WHERE user_id = p_user_id;

  -- Find all missed Layer 2 blocks (past, scheduled, no session)
  FOR v_missed IN
    SELECT sb.* FROM schedule_blocks sb
    WHERE sb.user_id = p_user_id
      AND sb.layer = 2
      AND sb.status = 'scheduled'
      AND sb.end_time < now() - INTERVAL '15 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM timer_sessions ts
        WHERE ts.schedule_block_id = sb.id AND ts.status IN ('completed', 'active')
      )
    ORDER BY
      CASE sb.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                        WHEN 'medium' THEN 2 ELSE 3 END,
      sb.start_time
    LIMIT 10
  LOOP
    v_duration_minutes := EXTRACT(EPOCH FROM (v_missed.end_time - v_missed.start_time))::integer / 60;
    v_found := false;

    -- Try to find a free slot in the next N days
    FOR d IN 0..p_look_ahead_days LOOP
      v_target_date := CURRENT_DATE + d;
      v_day_start := v_target_date + COALESCE(v_prefs.available_from, v_prefs.wake_time, '07:00'::time);
      v_day_end   := v_target_date + COALESCE(v_prefs.available_until, v_prefs.sleep_time, '23:00'::time);

      -- Skip past time on today
      IF d = 0 AND v_day_start < now() THEN
        v_day_start := now() + INTERVAL '15 minutes';
      END IF;

      -- Find first gap >= duration using the free slots approach
      SELECT fs.slot_start, fs.slot_end INTO v_slot_start, v_slot_end
      FROM get_free_slots(p_user_id, v_target_date,
                          COALESCE(v_prefs.min_study_block_minutes, 25)) fs
      WHERE fs.duration_minutes >= v_duration_minutes
      ORDER BY fs.slot_start
      LIMIT 1;

      IF v_slot_start IS NOT NULL THEN
        -- Create new block in the free slot
        INSERT INTO schedule_blocks (
          user_id, block_type, layer, title, color, module_id,
          start_time, end_time, source, status, priority,
          original_block_id, reschedule_reason
        ) VALUES (
          p_user_id, v_missed.block_type, 2,
          v_missed.title, v_missed.color, v_missed.module_id,
          v_slot_start, v_slot_start + (v_duration_minutes || ' minutes')::interval,
          'auto_plan', 'scheduled', v_missed.priority,
          v_missed.id, 'Auto-Rescue: Verpasster Block vom ' || v_missed.start_time::date
        )
        RETURNING id INTO v_new_block_id;

        -- Mark original as rescheduled
        UPDATE schedule_blocks SET
          status = 'rescheduled', updated_at = now(),
          reschedule_reason = 'Auto-Rescue → ' || v_slot_start::date
        WHERE id = v_missed.id;

        -- Log to reschedule_log
        BEGIN
          INSERT INTO reschedule_log (
            user_id, original_block_id, new_block_id, trigger,
            original_start, original_end, new_start, new_end,
            resolution, module_id, block_type, reason, auto_generated
          ) VALUES (
            p_user_id, v_missed.id, v_new_block_id, 'missed',
            v_missed.start_time, v_missed.end_time,
            v_slot_start, v_slot_start + (v_duration_minutes || ' minutes')::interval,
            'rescheduled', v_missed.module_id, v_missed.block_type,
            'Auto-Rescue: Nächster freier Slot gefunden', true
          );
        EXCEPTION WHEN others THEN NULL;
        END;

        v_rescued := v_rescued + 1;
        v_details := array_append(v_details, jsonb_build_object(
          'block_title', v_missed.title,
          'original_time', v_missed.start_time,
          'new_time', v_slot_start,
          'action', 'rescheduled'
        ));
        v_found := true;
        EXIT; -- Found a slot, next missed block
      END IF;
    END LOOP;

    -- If no slot found: mark as dropped (low priority) or keep pending (high)
    IF NOT v_found THEN
      IF v_missed.priority IN ('low', 'medium') THEN
        UPDATE schedule_blocks SET
          status = 'skipped', updated_at = now(),
          reschedule_reason = 'Kein freier Slot in den nächsten ' || p_look_ahead_days || ' Tagen'
        WHERE id = v_missed.id;
        v_dropped := v_dropped + 1;
      END IF;
      v_details := array_append(v_details, jsonb_build_object(
        'block_title', v_missed.title,
        'original_time', v_missed.start_time,
        'action', CASE WHEN v_missed.priority IN ('low', 'medium') THEN 'dropped' ELSE 'kept_pending' END
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'rescued', v_rescued,
    'dropped', v_dropped,
    'details', to_jsonb(v_details)
  );
END;
$$;


-- ─── 7. compute_exam_study_plan() — Backward-scheduling from exam dates ────────
-- For each module with an upcoming exam:
--   total_hours_needed / days_until_exam = daily_target
-- Creates exam_prep blocks in free slots leading up to the exam.

CREATE OR REPLACE FUNCTION compute_exam_study_plan(
  p_user_id uuid,
  p_horizon_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefs record;
  v_exam record;
  v_result jsonb[] := ARRAY[]::jsonb[];
  v_days_until integer;
  v_daily_minutes integer;
  v_already_planned integer;
  v_needed_minutes integer;
  v_target_date date;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_slot record;
  v_blocks_created integer := 0;
BEGIN
  SELECT * INTO v_prefs FROM user_schedule_preferences WHERE user_id = p_user_id;

  -- Find modules with upcoming exams
  FOR v_exam IN
    SELECT m.id AS module_id, m.name, m.color, e.start_dt AS exam_date,
      (e.start_dt::date - CURRENT_DATE) AS days_until
    FROM modules m
    JOIN events e ON e.module_id = m.id AND e.event_type = 'exam'
    WHERE m.user_id = p_user_id AND m.status = 'active'
      AND e.start_dt::date > CURRENT_DATE
      AND e.start_dt::date <= CURRENT_DATE + p_horizon_days
    ORDER BY e.start_dt
  LOOP
    v_days_until := GREATEST(v_exam.days_until, 1);

    -- Calculate how much prep already exists
    SELECT COALESCE(SUM(
      EXTRACT(EPOCH FROM (sb.end_time - sb.start_time)) / 60
    ), 0)::integer INTO v_already_planned
    FROM schedule_blocks sb
    WHERE sb.user_id = p_user_id AND sb.module_id = v_exam.module_id
      AND sb.layer = 2 AND sb.status IN ('scheduled', 'completed')
      AND sb.start_time >= now()
      AND sb.start_time < v_exam.exam_date;

    -- How much MORE is needed
    v_needed_minutes := GREATEST(0,
      COALESCE(v_prefs.exam_prep_min_hours, 10) * 60 - v_already_planned
    );

    IF v_needed_minutes <= 0 THEN
      v_result := array_append(v_result, jsonb_build_object(
        'module', v_exam.name, 'days_until', v_days_until,
        'status', 'sufficient', 'already_planned_min', v_already_planned
      ));
      CONTINUE;
    END IF;

    -- Distribute across remaining days
    v_daily_minutes := LEAST(
      CEIL(v_needed_minutes::float / v_days_until)::integer,
      COALESCE(v_prefs.exam_prep_daily_max_minutes, 120)
    );

    -- Create blocks for the next days (up to exam)
    FOR d IN 1..LEAST(v_days_until, 14) LOOP
      v_target_date := CURRENT_DATE + d;

      -- Find a free slot on this day
      SELECT fs.* INTO v_slot
      FROM get_free_slots(p_user_id, v_target_date,
                          COALESCE(v_prefs.min_study_block_minutes, 25)) fs
      WHERE fs.duration_minutes >= LEAST(v_daily_minutes, 45) -- at least 45min or daily target
      ORDER BY
        -- Prefer afternoon/evening for exam prep (typically higher focus)
        CASE WHEN EXTRACT(HOUR FROM fs.slot_start) BETWEEN 14 AND 20 THEN 0 ELSE 1 END,
        fs.duration_minutes DESC
      LIMIT 1;

      IF v_slot IS NOT NULL AND v_needed_minutes > 0 THEN
        DECLARE
          v_block_dur integer := LEAST(v_daily_minutes, v_slot.duration_minutes - 5,
                                        COALESCE(v_prefs.max_study_block_minutes, 90));
        BEGIN
          IF v_block_dur >= COALESCE(v_prefs.min_study_block_minutes, 25) THEN
            INSERT INTO schedule_blocks (
              user_id, block_type, layer, title, color, module_id,
              start_time, end_time, source, status, priority
            ) VALUES (
              p_user_id, 'exam_prep', 2,
              'Prüfungsvorbereitung: ' || v_exam.name,
              v_exam.color, v_exam.module_id,
              v_slot.slot_start,
              v_slot.slot_start + (v_block_dur || ' minutes')::interval,
              'exam_prep_auto', 'scheduled',
              CASE WHEN v_days_until <= 3 THEN 'critical'
                   WHEN v_days_until <= 7 THEN 'high'
                   ELSE 'medium' END
            );
            v_needed_minutes := v_needed_minutes - v_block_dur;
            v_blocks_created := v_blocks_created + 1;
          END IF;
        END;
      END IF;
    END LOOP;

    v_result := array_append(v_result, jsonb_build_object(
      'module', v_exam.name,
      'exam_date', v_exam.exam_date,
      'days_until', v_days_until,
      'daily_target_min', v_daily_minutes,
      'already_planned_min', v_already_planned,
      'remaining_needed_min', GREATEST(v_needed_minutes, 0),
      'status', CASE
        WHEN v_needed_minutes <= 0 THEN 'planned'
        WHEN v_needed_minutes <= v_daily_minutes * 2 THEN 'nearly_planned'
        ELSE 'needs_attention'
      END
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'exams', to_jsonb(v_result),
    'blocks_created', v_blocks_created
  );
END;
$$;


-- ─── 8. check_all_missed_blocks() — Enhanced version (replaces 064) ────────────
-- Can be called periodically (cron/API). Now also triggers auto-rescue.

CREATE OR REPLACE FUNCTION check_all_missed_blocks()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer := 0;
  v_user record;
  v_rescue_results jsonb;
  v_user_rescues jsonb[] := ARRAY[]::jsonb[];
BEGIN
  -- Mark all overdue scheduled blocks as skipped
  UPDATE schedule_blocks sb SET
    status = 'skipped', updated_at = now()
  WHERE sb.status = 'scheduled'
    AND sb.end_time < (now() - INTERVAL '30 minutes')
    AND sb.layer = 2
    AND NOT EXISTS (
      SELECT 1 FROM timer_sessions ts
      WHERE ts.schedule_block_id = sb.id AND ts.status IN ('completed', 'active')
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- For each affected user: try auto-rescue if preference is set
  FOR v_user IN
    SELECT DISTINCT sp.user_id
    FROM user_schedule_preferences sp
    WHERE sp.auto_reschedule_missed = true
  LOOP
    BEGIN
      v_rescue_results := auto_rescue_missed_blocks(v_user.user_id, 3);
      IF (v_rescue_results->>'rescued')::integer > 0 THEN
        v_user_rescues := array_append(v_user_rescues, jsonb_build_object(
          'user_id', v_user.user_id,
          'rescued', v_rescue_results->>'rescued'
        ));
      END IF;
    EXCEPTION WHEN others THEN
      NULL; -- Don't fail the whole batch
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'missed_marked', v_count,
    'auto_rescues', to_jsonb(v_user_rescues)
  );
END;
$$;


-- ─── 9. DATA FIXES ────────────────────────────────────────────────────────────

-- 9a. Backfill orphaned stundenplan_import blocks with stundenplan_id
UPDATE schedule_blocks sb
SET stundenplan_id = sp.id, source = 'stundenplan_sync'
FROM stundenplan sp
WHERE sb.source = 'stundenplan_import' AND sb.layer = 1
  AND sb.stundenplan_id IS NULL
  AND sb.user_id = sp.user_id AND sb.title = sp.title
  AND (sb.module_id = sp.module_id OR (sb.module_id IS NULL AND sp.module_id IS NULL));

-- 9b. Set available_from/until from wake/sleep for existing users
UPDATE user_schedule_preferences
SET available_from = wake_time, available_until = sleep_time
WHERE available_from = '07:00' AND wake_time != '07:00';
