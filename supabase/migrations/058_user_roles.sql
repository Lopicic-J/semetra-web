-- ═══════════════════════════════════════════════════════════════
-- Migration 058: 4-Rollen-System (user_role + Verifizierung)
-- Ersetzt builder_role mit user_role (admin, institution, student, non_student)
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Spalte umbenennen: builder_role → user_role ────────────────────────
ALTER TABLE profiles RENAME COLUMN builder_role TO user_role;

-- ─── 2. Alte Constraint entfernen ──────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_builder_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_builder_role;

-- ─── 3. Neue Verifizierungs-Spalten ───────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verification_status TEXT NOT NULL DEFAULT 'none';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verification_submitted_at TIMESTAMPTZ;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verification_reviewed_at TIMESTAMPTZ;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verification_reviewed_by UUID REFERENCES auth.users(id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verification_note TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  student_id_url TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  institution_proof_url TEXT;

-- ─── 4. Bestehende Rollen migrieren ───────────────────────────────────────
UPDATE profiles SET user_role = 'admin' WHERE user_role = 'platform_admin';
UPDATE profiles SET user_role = 'institution' WHERE user_role = 'institution_admin';
-- 'student' bleibt 'student'

-- ─── 5. Bestandsschutz: Alle bestehenden User als verifiziert markieren ──
UPDATE profiles SET verification_status = 'verified'
  WHERE user_role IN ('admin', 'institution', 'student');

-- Non-Students (neue Default-Rolle) brauchen keine Verifizierung
UPDATE profiles SET verification_status = 'none'
  WHERE user_role = 'non_student' AND verification_status = 'none';

-- ─── 6. Neue Constraints ──────────────────────────────────────────────────
ALTER TABLE profiles ADD CONSTRAINT check_user_role
  CHECK (user_role IN ('admin', 'institution', 'student', 'non_student'));

ALTER TABLE profiles ADD CONSTRAINT check_verification_status
  CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected'));

-- ─── 7. Default-Wert auf non_student ändern ───────────────────────────────
ALTER TABLE profiles ALTER COLUMN user_role SET DEFAULT 'non_student';

-- ─── 8. Index umbenennen ──────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_profiles_builder_role;
CREATE INDEX IF NOT EXISTS idx_profiles_user_role ON profiles(user_role);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);

-- ─── 9. RLS-Hilfsfunktionen aktualisieren ─────────────────────────────────

-- is_platform_admin → is_admin
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND user_role = 'admin'
  );
$$;

-- is_institution_admin aktualisieren
CREATE OR REPLACE FUNCTION is_institution_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND user_role = 'institution'
  );
$$;

-- Neue Hilfsfunktion: Kann User Builder-Bereich nutzen?
CREATE OR REPLACE FUNCTION can_use_builder(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
      AND user_role IN ('admin', 'institution')
      AND (verification_status = 'verified' OR user_role = 'admin')
  );
$$;

-- Neue Hilfsfunktion: Ist User verifiziert?
CREATE OR REPLACE FUNCTION is_verified(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
      AND (verification_status = 'verified' OR user_role = 'non_student')
  );
$$;

-- ─── 10. RLS Policies aktualisieren ───────────────────────────────────────

-- Bestehende Policies die builder_role / platform_admin referenzieren updaten
-- (Diese müssen ggf. manuell angepasst werden je nach bestehenden Policies)

-- Institutions: Nur Admin + verifizierte Institutions-User können erstellen
DROP POLICY IF EXISTS "Admins can manage institutions" ON institutions;
CREATE POLICY "Admins can manage institutions" ON institutions
  FOR ALL USING (
    is_admin() OR (
      is_institution_admin() AND
      EXISTS (
        SELECT 1 FROM institution_admins
        WHERE institution_admins.institution_id = institutions.id
          AND institution_admins.user_id = auth.uid()
      )
    )
  );

-- ─── 11. Alte Funktion als Alias beibehalten (Übergang) ───────────────────
CREATE OR REPLACE FUNCTION is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT is_admin(p_user_id);
$$;

-- ═══════════════════════════════════════════════════════════════
-- WICHTIG: Diese Migration muss auf Supabase manuell ausgeführt werden!
-- ═══════════════════════════════════════════════════════════════
