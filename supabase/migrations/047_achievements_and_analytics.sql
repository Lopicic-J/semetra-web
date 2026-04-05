-- ============================================================
-- Migration 047: Achievements, XP & Extended Analytics
-- ============================================================

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
