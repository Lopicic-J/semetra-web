-- ============================================================================
-- SEMETRA CONNECT — Cross-institution student networking
-- ============================================================================

-- 1. Connect Profile Extension
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS connect_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS connect_contactable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS connect_show_institution boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS connect_show_semester boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS connect_show_progress boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS connect_bio text DEFAULT '';

-- 2. Student Connections Table
CREATE TABLE IF NOT EXISTS student_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  message text DEFAULT '',
  program_match text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_connection UNIQUE (requester_id, addressee_id),
  CONSTRAINT no_self_connect CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_requester ON student_connections(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_connections_addressee ON student_connections(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_connections_status ON student_connections(status) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION update_connection_timestamp()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_connection_updated ON student_connections;
CREATE TRIGGER trg_connection_updated
  BEFORE UPDATE ON student_connections
  FOR EACH ROW EXECUTE FUNCTION update_connection_timestamp();

-- 3. RLS
ALTER TABLE student_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
  ON student_connections FOR SELECT
  USING (auth.uid() IN (requester_id, addressee_id));

CREATE POLICY "Users can send connection requests"
  ON student_connections FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update own connections"
  ON student_connections FOR UPDATE
  USING (
    (auth.uid() = requester_id AND status = 'pending')
    OR (auth.uid() = addressee_id AND status IN ('pending', 'accepted'))
  );

CREATE POLICY "Users can delete own connections"
  ON student_connections FOR DELETE
  USING (auth.uid() IN (requester_id, addressee_id));

-- 4. Discovery RPC
CREATE OR REPLACE FUNCTION discover_connect_students(
  p_limit int DEFAULT 20, p_offset int DEFAULT 0, p_search text DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid, username text, full_name text, avatar_url text,
  institution_name text, program_name text, degree_level text,
  current_semester int, study_progress numeric, connect_bio text,
  connect_show_institution boolean, connect_show_semester boolean,
  connect_show_progress boolean, level int, xp_total int,
  online_status text, connection_status text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_program_id uuid;
  v_program_name text;
  v_degree text;
BEGIN
  SELECT p.active_program_id INTO v_program_id FROM profiles p WHERE p.id = v_uid;
  IF v_program_id IS NULL THEN RETURN; END IF;
  SELECT prog.name, prog.degree_level INTO v_program_name, v_degree FROM programs prog WHERE prog.id = v_program_id;
  IF v_program_name IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT prof.id, prof.username::text, prof.full_name::text, prof.avatar_url::text,
    inst.name::text, prog.name::text, prog.degree_level::text, prof.current_semester::int,
    CASE WHEN prog.ects_total > 0 THEN ROUND((COALESCE(prof.existing_ects,0)::numeric / prog.ects_total::numeric)*100,1) ELSE 0 END,
    prof.connect_bio::text, prof.connect_show_institution, prof.connect_show_semester, prof.connect_show_progress,
    prof.level::int, prof.xp_total::int, prof.online_status::text, sc.status::text
  FROM profiles prof
  JOIN programs prog ON prog.id = prof.active_program_id
  LEFT JOIN institutions inst ON inst.id = prof.institution_id
  LEFT JOIN student_connections sc ON (
    (sc.requester_id = v_uid AND sc.addressee_id = prof.id) OR (sc.addressee_id = v_uid AND sc.requester_id = prof.id)
  )
  WHERE prof.id <> v_uid AND prof.connect_visible = true AND prof.onboarding_completed = true
    AND prog.name = v_program_name AND prog.degree_level = v_degree
    AND NOT EXISTS (
      SELECT 1 FROM student_connections bl WHERE bl.status = 'blocked'
      AND ((bl.requester_id = v_uid AND bl.addressee_id = prof.id) OR (bl.addressee_id = v_uid AND bl.requester_id = prof.id))
    )
    AND (p_search IS NULL OR (prof.username ILIKE '%'||p_search||'%' OR prof.full_name ILIKE '%'||p_search||'%' OR inst.name ILIKE '%'||p_search||'%'))
  ORDER BY ABS(COALESCE(prof.current_semester,0) - COALESCE((SELECT pr.current_semester FROM profiles pr WHERE pr.id = v_uid),0)), prof.level DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 5. Connection Count RPC
CREATE OR REPLACE FUNCTION get_connect_counts()
RETURNS TABLE (total_connections bigint, pending_received bigint, pending_sent bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    (SELECT count(*) FROM student_connections WHERE status = 'accepted' AND (requester_id = auth.uid() OR addressee_id = auth.uid())),
    (SELECT count(*) FROM student_connections WHERE status = 'pending' AND addressee_id = auth.uid()),
    (SELECT count(*) FROM student_connections WHERE status = 'pending' AND requester_id = auth.uid());
$$;
