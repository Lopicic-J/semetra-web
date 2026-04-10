-- ════════════════════════════════════════════════════════════════════════════════
-- BATCH 1: Foundations (Migrations 047-053)
-- ════════════════════════════════════════════════════════════════════════════════
-- Contents:
--   047: Achievements, XP & Extended Analytics
--   048: Platform API Keys & Plugin System
--   049: Group Chat (Messages)
--   050: Exam-Module Link
--   051: Fix RLS infinite recursion on study_group_members
--   052: Builder Roles & Institution Ownership
--   053: Plugin Purchases & Monetization
--
-- This batch establishes core gamification, plugin infrastructure, and role-based access control.
-- ════════════════════════════════════════════════════════════════════════════════


-- ═══ MIGRATION 047: Achievements, XP & Extended Analytics ═══

-- ── 1. achievement_definitions ──────────────────────────────
-- Static catalog of all possible achievements
CREATE TABLE IF NOT EXISTS achievement_definitions (
  id          text PRIMARY KEY,                       -- e.g. "streak_7", "grade_first_a"
  category    text NOT NULL CHECK (category IN (
    'streak','grade','module','task','time','learning','special'
  )),
  name_key    text NOT NULL,                          -- i18n key for display name
  desc_key    text NOT NULL,                          -- i18n key for description
  icon        text NOT NULL DEFAULT 'trophy',         -- lucide icon name
  tier        text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','diamond')),
  xp_reward   int NOT NULL DEFAULT 50,
  threshold   int NOT NULL DEFAULT 1,                 -- numeric target to unlock
  sort_order  int NOT NULL DEFAULT 0
);

-- ── 2. user_achievements ────────────────────────────────────
-- Tracks which achievements each user has unlocked
CREATE TABLE IF NOT EXISTS user_achievements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id  text NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  unlocked_at     timestamptz NOT NULL DEFAULT now(),
  progress        int NOT NULL DEFAULT 0,             -- current progress toward threshold
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_achievements' AND policyname='achievements_own') THEN
    CREATE POLICY achievements_own ON user_achievements FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- ── 3. XP & Level columns on profiles ──────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'xp_total'
  ) THEN
    ALTER TABLE profiles ADD COLUMN xp_total int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'level'
  ) THEN
    ALTER TABLE profiles ADD COLUMN level int NOT NULL DEFAULT 1;
  END IF;
END $$;

-- ── 4. Seed achievement definitions ─────────────────────────
INSERT INTO achievement_definitions (id, category, name_key, desc_key, icon, tier, xp_reward, threshold, sort_order) VALUES
  -- Streak achievements
  ('streak_3',       'streak',   'achievement.streak3.name',       'achievement.streak3.desc',       'flame',       'bronze',  25,  3,   10),
  ('streak_7',       'streak',   'achievement.streak7.name',       'achievement.streak7.desc',       'flame',       'silver',  50,  7,   11),
  ('streak_14',      'streak',   'achievement.streak14.name',      'achievement.streak14.desc',      'flame',       'silver',  100, 14,  12),
  ('streak_30',      'streak',   'achievement.streak30.name',      'achievement.streak30.desc',      'flame',       'gold',    200, 30,  13),
  ('streak_100',     'streak',   'achievement.streak100.name',     'achievement.streak100.desc',     'flame',       'diamond', 500, 100, 14),

  -- Grade achievements
  ('grade_first',    'grade',    'achievement.gradeFirst.name',    'achievement.gradeFirst.desc',    'star',        'bronze',  25,  1,   20),
  ('grade_top',      'grade',    'achievement.gradeTop.name',      'achievement.gradeTop.desc',      'award',       'gold',    150, 1,   21),
  ('grade_10',       'grade',    'achievement.grade10.name',       'achievement.grade10.desc',       'trending-up', 'silver',  100, 10,  22),
  ('grade_all_pass', 'grade',    'achievement.gradeAllPass.name',  'achievement.gradeAllPass.desc',  'check-circle','gold',    200, 1,   23),

  -- Module achievements
  ('module_first',   'module',   'achievement.moduleFirst.name',   'achievement.moduleFirst.desc',   'book-open',   'bronze',  25,  1,   30),
  ('module_5',       'module',   'achievement.module5.name',       'achievement.module5.desc',       'book-open',   'silver',  100, 5,   31),
  ('module_10',      'module',   'achievement.module10.name',      'achievement.module10.desc',      'book-open',   'gold',    200, 10,  32),
  ('module_20',      'module',   'achievement.module20.name',      'achievement.module20.desc',      'book-open',   'diamond', 400, 20,  33),

  -- Task achievements
  ('task_first',     'task',     'achievement.taskFirst.name',     'achievement.taskFirst.desc',     'check-square','bronze',  15,  1,   40),
  ('task_10',        'task',     'achievement.task10.name',        'achievement.task10.desc',        'check-square','bronze',  50,  10,  41),
  ('task_50',        'task',     'achievement.task50.name',        'achievement.task50.desc',        'check-square','silver',  100, 50,  42),
  ('task_100',       'task',     'achievement.task100.name',       'achievement.task100.desc',       'check-square','gold',    200, 100, 43),

  -- Time achievements (hours)
  ('time_10h',       'time',     'achievement.time10.name',        'achievement.time10.desc',        'clock',       'bronze',  50,  10,  50),
  ('time_50h',       'time',     'achievement.time50.name',        'achievement.time50.desc',        'clock',       'silver',  150, 50,  51),
  ('time_100h',      'time',     'achievement.time100.name',       'achievement.time100.desc',       'clock',       'gold',    300, 100, 52),
  ('time_500h',      'time',     'achievement.time500.name',       'achievement.time500.desc',       'clock',       'diamond', 500, 500, 53),

  -- Learning achievements
  ('flash_first',    'learning', 'achievement.flashFirst.name',    'achievement.flashFirst.desc',    'layers',      'bronze',  25,  1,   60),
  ('flash_100',      'learning', 'achievement.flash100.name',      'achievement.flash100.desc',      'layers',      'silver',  100, 100, 61),
  ('flash_500',      'learning', 'achievement.flash500.name',      'achievement.flash500.desc',      'layers',      'gold',    200, 500, 62),
  ('notes_10',       'learning', 'achievement.notes10.name',       'achievement.notes10.desc',       'file-text',   'bronze',  50,  10,  63),

  -- Special achievements
  ('early_bird',     'special',  'achievement.earlyBird.name',     'achievement.earlyBird.desc',     'sunrise',     'silver',  75,  5,   70),
  ('night_owl',      'special',  'achievement.nightOwl.name',      'achievement.nightOwl.desc',      'moon',        'silver',  75,  5,   71),
  ('semester_done',  'special',  'achievement.semesterDone.name',  'achievement.semesterDone.desc',  'graduation-cap','gold',  300, 1,   72),
  ('plan_master',    'special',  'achievement.planMaster.name',    'achievement.planMaster.desc',    'calendar-check','silver',100, 1,   73)
ON CONFLICT (id) DO NOTHING;

-- ── 5. Grant XP RPC (atomic) ────────────────────────────────
CREATE OR REPLACE FUNCTION grant_xp(p_user_id uuid, p_amount int)
RETURNS TABLE(new_xp int, new_level int) AS $$
DECLARE
  v_xp int;
  v_level int;
BEGIN
  UPDATE profiles
  SET xp_total = xp_total + p_amount
  WHERE id = p_user_id
  RETURNING profiles.xp_total INTO v_xp;

  -- Level formula: level = floor(sqrt(xp / 100)) + 1, capped at 50
  v_level := LEAST(FLOOR(SQRT(v_xp::float / 100)) + 1, 50)::int;

  UPDATE profiles SET level = v_level WHERE id = p_user_id;

  RETURN QUERY SELECT v_xp, v_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. Unlock achievement RPC ───────────────────────────────
CREATE OR REPLACE FUNCTION unlock_achievement(p_user_id uuid, p_achievement_id text, p_progress int DEFAULT 0)
RETURNS boolean AS $$
DECLARE
  v_def achievement_definitions%ROWTYPE;
  v_exists boolean;
BEGIN
  -- Check if definition exists
  SELECT * INTO v_def FROM achievement_definitions WHERE id = p_achievement_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Check if already unlocked
  SELECT EXISTS(
    SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_id = p_achievement_id
  ) INTO v_exists;

  IF v_exists THEN RETURN false; END IF;

  -- Check threshold
  IF p_progress < v_def.threshold THEN
    -- Update progress only
    INSERT INTO user_achievements (user_id, achievement_id, progress)
    VALUES (p_user_id, p_achievement_id, p_progress)
    ON CONFLICT (user_id, achievement_id)
    DO UPDATE SET progress = GREATEST(user_achievements.progress, p_progress);
    RETURN false;
  END IF;

  -- Unlock!
  INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked_at)
  VALUES (p_user_id, p_achievement_id, p_progress, now())
  ON CONFLICT (user_id, achievement_id)
  DO UPDATE SET progress = p_progress, unlocked_at = now();

  -- Grant XP
  PERFORM grant_xp(p_user_id, v_def.xp_reward);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══ MIGRATION 048: Platform API Keys & Plugin System ═══

-- ── 1. api_keys — Developer API access ──────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  key_hash    text NOT NULL,                         -- SHA-256 hash of the key (never store plaintext)
  key_prefix  text NOT NULL,                         -- First 8 chars for identification: "sk_xxxx..."
  scopes      text[] NOT NULL DEFAULT '{"read"}',    -- e.g. read, write, modules, grades, notes
  rate_limit  int NOT NULL DEFAULT 100,              -- requests per minute
  last_used   timestamptz,
  expires_at  timestamptz,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_keys' AND policyname='api_keys_own') THEN
    CREATE POLICY api_keys_own ON api_keys FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- ── 2. api_usage_log — Rate limiting & analytics ────────────
CREATE TABLE IF NOT EXISTS api_usage_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id  uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  method      text NOT NULL,
  status_code int NOT NULL,
  response_ms int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_usage_log' AND policyname='api_log_own') THEN
    CREATE POLICY api_log_own ON api_usage_log FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM api_keys WHERE id = api_usage_log.api_key_id AND user_id = auth.uid())
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_log_key_time ON api_usage_log(api_key_id, created_at DESC);

-- ── 3. plugins — Installable extensions ─────────────────────
CREATE TABLE IF NOT EXISTS plugins (
  id          text PRIMARY KEY,                      -- e.g. "moodle-sync", "notion-import"
  name        text NOT NULL,
  description text,
  author      text NOT NULL,
  version     text NOT NULL DEFAULT '1.0.0',
  icon_url    text,
  homepage    text,
  category    text NOT NULL DEFAULT 'integration' CHECK (category IN (
    'integration','productivity','analytics','social','theme','other'
  )),
  config_schema jsonb,                               -- JSON Schema for plugin settings
  permissions text[] NOT NULL DEFAULT '{}',           -- Required scopes
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 4. user_plugins — Plugin installations per user ─────────
CREATE TABLE IF NOT EXISTS user_plugins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id   text NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  enabled     boolean NOT NULL DEFAULT true,
  config      jsonb NOT NULL DEFAULT '{}',           -- User-specific plugin settings
  installed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, plugin_id)
);

ALTER TABLE user_plugins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_plugins' AND policyname='user_plugins_own') THEN
    CREATE POLICY user_plugins_own ON user_plugins FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_plugins_user ON user_plugins(user_id);

-- ── 5. webhooks — Event-driven integrations ─────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url         text NOT NULL,
  secret      text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events      text[] NOT NULL DEFAULT '{}',          -- e.g. grade.created, task.completed
  active      boolean NOT NULL DEFAULT true,
  last_triggered timestamptz,
  failure_count int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='webhooks' AND policyname='webhooks_own') THEN
    CREATE POLICY webhooks_own ON webhooks FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 6. Seed initial plugin catalog ──────────────────────────
INSERT INTO plugins (id, name, description, author, version, category, permissions) VALUES
  ('moodle-sync',    'Moodle Sync',        'Synchronisiere Module und Noten mit Moodle LMS.',         'Semetra',  '1.0.0', 'integration',  '{"read","write","modules","grades"}'),
  ('ilias-sync',     'ILIAS Sync',         'Verbinde dein ILIAS-Konto mit Semetra.',                  'Semetra',  '1.0.0', 'integration',  '{"read","write","modules"}'),
  ('canvas-sync',    'Canvas LMS Sync',    'Import von Kursen und Aufgaben aus Canvas.',               'Semetra',  '1.0.0', 'integration',  '{"read","write","modules","tasks"}'),
  ('notion-import',  'Notion Import',      'Importiere Notizen und Dokumente aus Notion.',             'Semetra',  '1.0.0', 'productivity', '{"read","write","notes"}'),
  ('calendar-sync',  'Google Calendar',    'Bidirektionale Synchronisation mit Google Calendar.',      'Semetra',  '1.0.0', 'integration',  '{"read","write","calendar"}'),
  ('pomodoro-plus',  'Pomodoro Plus',      'Erweiterte Pomodoro-Technik mit anpassbaren Intervallen.', 'Semetra',  '1.0.0', 'productivity', '{"read","time_logs"}'),
  ('grade-export',   'Notenexport',        'Exportiere Noten als CSV, PDF oder Excel.',                'Semetra',  '1.0.0', 'analytics',    '{"read","grades"}'),
  ('study-buddy',    'Study Buddy',        'Finde Lernpartner an deiner Hochschule.',                  'Semetra',  '1.0.0', 'social',       '{"read","profile"}')
ON CONFLICT (id) DO NOTHING;

-- ── 7. updated_at trigger for plugins ───────────────────────
DROP TRIGGER IF EXISTS set_updated_at_plugins ON plugins;
CREATE TRIGGER set_updated_at_plugins
  BEFORE UPDATE ON plugins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 8. Rate limit check function ────────────────────────────
CREATE OR REPLACE FUNCTION check_api_rate_limit(p_key_prefix text)
RETURNS TABLE(allowed boolean, remaining int, key_id uuid, owner_id uuid) AS $$
DECLARE
  v_key api_keys%ROWTYPE;
  v_count int;
BEGIN
  -- Find key
  SELECT * INTO v_key FROM api_keys
  WHERE key_prefix = p_key_prefix AND active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- Check expiry
  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    RETURN QUERY SELECT false, 0, v_key.id, v_key.user_id;
    RETURN;
  END IF;

  -- Count requests in last minute
  SELECT COUNT(*) INTO v_count FROM api_usage_log
  WHERE api_key_id = v_key.id AND created_at > now() - interval '1 minute';

  IF v_count >= v_key.rate_limit THEN
    RETURN QUERY SELECT false, 0, v_key.id, v_key.user_id;
    RETURN;
  END IF;

  -- Update last_used
  UPDATE api_keys SET last_used = now() WHERE id = v_key.id;

  RETURN QUERY SELECT true, (v_key.rate_limit - v_count - 1), v_key.id, v_key.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══ MIGRATION 049: Group Chat (Messages) ═══

CREATE TABLE IF NOT EXISTS group_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  reply_to uuid REFERENCES group_messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_group_messages_group ON group_messages(group_id, created_at DESC);
CREATE INDEX idx_group_messages_user ON group_messages(user_id);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- Members can read messages in their groups
DO $$ BEGIN
CREATE POLICY "Members can read group messages" ON group_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM study_group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Members can insert messages
DO $$ BEGIN
CREATE POLICY "Members can send group messages" ON group_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM study_group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users can update their own messages
DO $$ BEGIN
CREATE POLICY "Users can edit own messages" ON group_messages
  FOR UPDATE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users can delete their own messages, admins can delete any
DO $$ BEGIN
CREATE POLICY "Users can delete own messages" ON group_messages
  FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM study_group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ═══ MIGRATION 050: Exam-Module Link ═══

-- 1. Add module_id column to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE SET NULL;

-- 2. Create index for fast module-based exam queries
CREATE INDEX IF NOT EXISTS idx_events_module_id ON events(module_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_module_type ON events(module_id, event_type) WHERE event_type = 'exam';

-- 3. Backfill: Link existing exams to modules via grades
UPDATE events e
SET module_id = g.module_id
FROM grades g
WHERE g.exam_id = e.id
  AND g.module_id IS NOT NULL
  AND e.module_id IS NULL
  AND e.event_type = 'exam';

-- 4. Backfill: Link remaining exams via topics
UPDATE events e
SET module_id = t.module_id
FROM topics t
WHERE t.exam_id = e.id
  AND t.module_id IS NOT NULL
  AND e.module_id IS NULL
  AND e.event_type = 'exam';

-- 5. Backfill: Link remaining exams via module.exam_date matching
UPDATE events e
SET module_id = m.id
FROM modules m
WHERE m.exam_date IS NOT NULL
  AND m.user_id = e.user_id
  AND DATE(m.exam_date) = DATE(e.start_dt)
  AND e.module_id IS NULL
  AND e.event_type = 'exam';

-- 6. Enable RLS (events should already have RLS, but ensure policy covers new column)
-- No new policy needed — existing user_id-based policies already cover this.

-- 7. Add composite index for Decision Engine queries
CREATE INDEX IF NOT EXISTS idx_events_user_exam_module
  ON events(user_id, event_type, module_id)
  WHERE event_type = 'exam';


-- ═══ MIGRATION 051: Fix RLS infinite recursion on study_group_members ═══

-- ── 1. Helper function: check if user is a member of a group ──
CREATE OR REPLACE FUNCTION is_group_member(gid uuid, uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM study_group_members
    WHERE group_id = gid AND user_id = uid
  );
$$;

-- ── 2. Helper function: check if user is owner or admin of a group ──
CREATE OR REPLACE FUNCTION is_group_admin(gid uuid, uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM study_group_members
    WHERE group_id = gid AND user_id = uid AND role IN ('owner', 'admin')
  );
$$;

-- ── 3. Drop the problematic self-referencing policies ──
DROP POLICY IF EXISTS group_members_self_read ON study_group_members;
DROP POLICY IF EXISTS group_members_admin_manage ON study_group_members;

-- ── 4. Recreate policies using the SECURITY DEFINER functions ──

-- Members can see all members in their groups
CREATE POLICY group_members_self_read ON study_group_members
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_group_member(group_id)
  );

-- Owners and admins can manage members
CREATE POLICY group_members_admin_manage ON study_group_members
  FOR ALL
  USING (is_group_admin(group_id))
  WITH CHECK (is_group_admin(group_id));

-- ── 5. Also fix study_groups read policy (references study_group_members) ──
DROP POLICY IF EXISTS groups_member_read ON study_groups;

CREATE POLICY groups_member_read ON study_groups
  FOR SELECT
  USING (
    auth.uid() = owner_id
    OR is_group_member(id)
  );

-- ── 6. Fix group_messages policies (they reference study_group_members too) ──
DROP POLICY IF EXISTS "Members can read group messages" ON group_messages;
DROP POLICY IF EXISTS "Members can send group messages" ON group_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON group_messages;

CREATE POLICY "Members can read group messages" ON group_messages
  FOR SELECT
  USING (is_group_member(group_id));

CREATE POLICY "Members can send group messages" ON group_messages
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND is_group_member(group_id)
  );

CREATE POLICY "Users can delete own messages" ON group_messages
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR is_group_admin(group_id)
  );

-- ── 7. Fix group_shares policies (they reference study_group_members too) ──
DROP POLICY IF EXISTS group_shares_member_read ON group_shares;

CREATE POLICY group_shares_member_read ON group_shares
  FOR SELECT
  USING (is_group_member(group_id));

-- ── 8. Allow any authenticated user to INSERT into study_group_members ──
-- (needed for joining groups via invite code — the join API runs as the user)
-- The join route already validates the invite code server-side.
CREATE POLICY group_members_self_insert ON study_group_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ═══ MIGRATION 052: Builder Roles & Institution Ownership ═══

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


-- ═══ MIGRATION 053: Plugin Purchases & Monetization ═══

-- ── 1. Extend plugins table with pricing ────────────────────
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'free'
  CHECK (pricing_type IN ('free', 'premium'));
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS price_chf numeric(5,2) DEFAULT 0;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS requires_pro boolean NOT NULL DEFAULT false;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS legal_disclaimer text;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS third_party_name text;         -- e.g. 'Google', 'Notion', 'Moodle'
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS third_party_terms_url text;    -- link to 3rd party TOS
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS data_processing_note text;     -- DSG/GDPR note
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'coming_soon'
  CHECK (status IN ('active', 'coming_soon', 'beta', 'deprecated'));

-- ── 2. Plugin purchases tracking ────────────────────────────
CREATE TABLE IF NOT EXISTS plugin_purchases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id       text NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  amount_chf      numeric(5,2) NOT NULL DEFAULT 1.90,
  currency        text NOT NULL DEFAULT 'CHF',
  status          text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  granted_via     text NOT NULL DEFAULT 'purchase'
    CHECK (granted_via IN ('purchase', 'institution', 'promo', 'admin')),
  institution_id  uuid,                                   -- if granted via institution
  purchased_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, plugin_id)                              -- one purchase per user per plugin
);

ALTER TABLE plugin_purchases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='plugin_purchases' AND policyname='purchases_own') THEN
    CREATE POLICY purchases_own ON plugin_purchases FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plugin_purchases_user ON plugin_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_purchases_plugin ON plugin_purchases(plugin_id);

-- ── 3. Helper: Check if user can access a plugin ────────────
CREATE OR REPLACE FUNCTION can_access_plugin(p_user_id uuid, p_plugin_id text)
RETURNS boolean AS $$
DECLARE
  v_plugin plugins%ROWTYPE;
  v_profile RECORD;
  v_purchased boolean;
BEGIN
  -- Get plugin
  SELECT * INTO v_plugin FROM plugins WHERE id = p_plugin_id AND active = true;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Free plugins are always accessible
  IF v_plugin.pricing_type = 'free' THEN RETURN true; END IF;

  -- Get user profile
  SELECT plan, institution_id INTO v_profile FROM profiles WHERE id = p_user_id;

  -- Must be Pro for premium plugins
  IF v_profile.plan != 'pro' THEN RETURN false; END IF;

  -- Institution users get all plugins free
  IF v_profile.institution_id IS NOT NULL THEN RETURN true; END IF;

  -- Check if purchased
  SELECT EXISTS (
    SELECT 1 FROM plugin_purchases
    WHERE user_id = p_user_id AND plugin_id = p_plugin_id AND status = 'completed'
  ) INTO v_purchased;

  RETURN v_purchased;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Auto-grant institution plugins ───────────────────────
-- When a user sets their institution_id, auto-grant all premium plugins
CREATE OR REPLACE FUNCTION auto_grant_institution_plugins()
RETURNS trigger AS $$
BEGIN
  IF NEW.institution_id IS NOT NULL AND
     (OLD.institution_id IS NULL OR OLD.institution_id != NEW.institution_id) AND
     NEW.plan = 'pro' THEN

    INSERT INTO plugin_purchases (user_id, plugin_id, amount_chf, status, granted_via, institution_id)
    SELECT NEW.id, p.id, 0, 'completed', 'institution', NEW.institution_id
    FROM plugins p
    WHERE p.pricing_type = 'premium' AND p.active = true
    ON CONFLICT (user_id, plugin_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_grant_institution_plugins ON profiles;
CREATE TRIGGER trg_auto_grant_institution_plugins
  AFTER UPDATE OF institution_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION auto_grant_institution_plugins();

-- ── 5. Update existing plugins with pricing & legal info ────
UPDATE plugins SET
  pricing_type = 'premium',
  price_chf = 1.90,
  requires_pro = true,
  status = 'coming_soon',
  third_party_name = 'Google',
  third_party_terms_url = 'https://developers.google.com/terms',
  data_processing_note = 'Semetra greift via OAuth auf deinen Google Calendar zu. Deine Daten werden ausschliesslich lokal und in deinem Semetra-Konto gespeichert. Semetra gibt keine Daten an Dritte weiter.',
  legal_disclaimer = 'Dieses Plugin nutzt die öffentliche Google Calendar API. Semetra ist kein offizieller Google-Partner. Google und Google Calendar sind Marken der Google LLC.'
WHERE id = 'calendar-sync';

UPDATE plugins SET
  pricing_type = 'premium',
  price_chf = 1.90,
  requires_pro = true,
  status = 'coming_soon',
  third_party_name = 'Notion',
  third_party_terms_url = 'https://www.notion.so/Terms-and-Privacy-28ffee083dc3473e9c2da6ec011b58ac',
  data_processing_note = 'Semetra greift via Notion-API auf deine Workspaces zu. Importierte Inhalte werden nur in deinem Semetra-Konto gespeichert.',
  legal_disclaimer = 'Dieses Plugin nutzt die öffentliche Notion API. Semetra ist kein offizieller Notion-Partner. Notion ist eine Marke der Notion Labs, Inc.'
WHERE id = 'notion-import';

UPDATE plugins SET
  pricing_type = 'premium',
  price_chf = 1.90,
  requires_pro = true,
  status = 'coming_soon',
  third_party_name = 'Moodle',
  third_party_terms_url = 'https://moodle.org/mod/page/view.php?id=8835',
  data_processing_note = 'Semetra verbindet sich mit der Moodle-Instanz deiner Hochschule via REST-API. Dein Moodle-Token wird verschlüsselt gespeichert und nie an Dritte weitergegeben.',
  legal_disclaimer = 'Dieses Plugin nutzt die öffentliche Moodle REST-API. Moodle ist Open-Source-Software (GPL). Semetra ist kein offizieller Moodle-Partner.'
WHERE id = 'moodle-sync';

UPDATE plugins SET
  pricing_type = 'premium',
  price_chf = 1.90,
  requires_pro = true,
  status = 'coming_soon',
  third_party_name = 'ILIAS',
  third_party_terms_url = 'https://www.ilias.de/docu/',
  data_processing_note = 'Semetra verbindet sich mit deiner ILIAS-Instanz via REST-API. Dein Token wird verschlüsselt gespeichert.',
  legal_disclaimer = 'Dieses Plugin nutzt die öffentliche ILIAS REST-API. ILIAS ist Open-Source-Software (GPL). Semetra ist kein offizieller ILIAS-Partner.'
WHERE id = 'ilias-sync';

UPDATE plugins SET
  pricing_type = 'premium',
  price_chf = 1.90,
  requires_pro = true,
  status = 'coming_soon',
  third_party_name = 'Canvas (Instructure)',
  third_party_terms_url = 'https://www.instructure.com/policies/acceptable-use',
  data_processing_note = 'Semetra greift via Canvas REST-API auf deine Kurse zu. Importierte Daten werden nur in deinem Semetra-Konto gespeichert.',
  legal_disclaimer = 'Dieses Plugin nutzt die öffentliche Canvas LMS API. Canvas ist eine Marke der Instructure, Inc. Semetra ist kein offizieller Instructure-Partner.'
WHERE id = 'canvas-sync';

-- Free plugins (no purchase needed)
UPDATE plugins SET
  pricing_type = 'free',
  price_chf = 0,
  requires_pro = false,
  status = 'active'
WHERE id IN ('grade-export', 'pomodoro-plus');

UPDATE plugins SET
  pricing_type = 'free',
  price_chf = 0,
  requires_pro = true,
  status = 'coming_soon',
  data_processing_note = 'Study Buddy verwendet anonymisierte Profildaten. Dein vollständiger Name wird nur mit deiner Zustimmung angezeigt.'
WHERE id = 'study-buddy';

-- ── 6. Plugin Terms of Service acceptance tracking ──────────────
CREATE TABLE IF NOT EXISTS plugin_tos_acceptance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id   text NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  tos_version text NOT NULL DEFAULT '1.0',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address  text,
  UNIQUE(user_id, plugin_id, tos_version)
);

ALTER TABLE plugin_tos_acceptance ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='plugin_tos_acceptance' AND policyname='tos_own') THEN
    CREATE POLICY tos_own ON plugin_tos_acceptance FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
