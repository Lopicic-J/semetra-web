-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  Migration 079 – Social Community Features                                  ║
-- ║  • user_presence (online/offline/dnd tracking)                              ║
-- ║  • profiles.community_visible (opt-out from community listing)              ║
-- ║  • unread_dm_count helper function                                          ║
-- ║  • RLS policies for presence                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- 1. Add community_visible to profiles (default TRUE = visible)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS community_visible boolean NOT NULL DEFAULT true;

-- 2. Add online_status to profiles for quick access
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS online_status text NOT NULL DEFAULT 'offline'
  CHECK (online_status IN ('online', 'offline', 'dnd', 'away'));

-- 3. User presence table for detailed tracking
CREATE TABLE IF NOT EXISTS user_presence (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'dnd', 'away')),
  last_seen  timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see presence (needed for community list)
CREATE POLICY "Authenticated users can view presence"
  ON user_presence FOR SELECT
  TO authenticated
  USING (true);

-- Users can only update their own presence
CREATE POLICY "Users can upsert own presence"
  ON user_presence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
  ON user_presence FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Function: get unread DM count for current user
CREATE OR REPLACE FUNCTION get_unread_dm_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)
  FROM direct_messages
  WHERE receiver_id = auth.uid()
    AND read_at IS NULL;
$$;

-- 5. Function: get community members for a given institution (with optional program filter)
CREATE OR REPLACE FUNCTION get_community_members(
  p_institution_id uuid,
  p_program_id uuid DEFAULT NULL,
  p_semester int DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  institution_id uuid,
  active_program_id uuid,
  program_name text,
  institution_name text,
  current_semester int,
  user_role text,
  language text,
  plan text,
  xp_total int,
  level int,
  online_status text,
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.institution_id,
    p.active_program_id,
    prog.name AS program_name,
    inst.name AS institution_name,
    p.current_semester,
    p.user_role,
    p.language,
    p.plan,
    p.xp_total,
    p.level,
    p.online_status,
    p.last_seen_at
  FROM profiles p
  LEFT JOIN programs prog ON prog.id = p.active_program_id
  LEFT JOIN institutions inst ON inst.id = p.institution_id
  WHERE p.community_visible = true
    AND p.institution_id = p_institution_id
    AND p.id != auth.uid()
    AND p.onboarding_completed = true
    AND (p_program_id IS NULL OR p.active_program_id = p_program_id)
    AND (p_semester IS NULL OR p.current_semester = p_semester)
    AND (
      p_search IS NULL
      OR p.username ILIKE '%' || p_search || '%'
      OR p.full_name ILIKE '%' || p_search || '%'
    )
  ORDER BY p.online_status = 'online' DESC, p.last_seen_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- 6. Function: count community members (for pagination)
CREATE OR REPLACE FUNCTION get_community_member_count(
  p_institution_id uuid,
  p_program_id uuid DEFAULT NULL,
  p_semester int DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)
  FROM profiles p
  WHERE p.community_visible = true
    AND p.institution_id = p_institution_id
    AND p.id != auth.uid()
    AND p.onboarding_completed = true
    AND (p_program_id IS NULL OR p.active_program_id = p_program_id)
    AND (p_semester IS NULL OR p.current_semester = p_semester)
    AND (
      p_search IS NULL
      OR p.username ILIKE '%' || p_search || '%'
      OR p.full_name ILIKE '%' || p_search || '%'
    );
$$;

-- 7. Index for community queries
CREATE INDEX IF NOT EXISTS idx_profiles_community
  ON profiles (institution_id, community_visible, onboarding_completed)
  WHERE community_visible = true AND onboarding_completed = true;

CREATE INDEX IF NOT EXISTS idx_profiles_online_status
  ON profiles (online_status, last_seen_at DESC);

-- 8. Update last_seen trigger
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET last_seen_at = now(),
      online_status = NEW.status
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_presence_update_profile ON user_presence;
CREATE TRIGGER trg_presence_update_profile
  AFTER INSERT OR UPDATE ON user_presence
  FOR EACH ROW
  EXECUTE FUNCTION update_last_seen();
