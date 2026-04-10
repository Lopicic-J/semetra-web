-- ═══════════════════════════════════════════════════════════════════════════════
-- 073: Institution Email-Domain Enforcement
--
-- Enforces that students with known university emails are auto-assigned to
-- the correct institution and cannot choose a different one.
--
-- 1. Adds email_domains column to institutions table
-- 2. Seeds known domains for all Swiss institutions
-- 3. Demotes existing students with email/institution mismatch to non_student
-- 4. Creates a trigger to enforce domain matching on profile updates
-- ═══════════════════════════════════════════════════════════════════════════════

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
