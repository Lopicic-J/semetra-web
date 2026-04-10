-- ════════════════════════════════════════════════════════════════════════════════
-- BATCH 2: Schedule Engine (Migrations 054-060, skip 059)
-- ════════════════════════════════════════════════════════════════════════════════
-- Contents:
--   054: Smart Schedule Engine — Unified Time Layer
--   055: Auto-Planning, Study Patterns & Weekly Review
--   056: Module source tracking & soft-delete
--   057: Program Switch Cleanup
--   058: 4-Rollen-System (user_role + Verifizierung)
--   060: Email-Domain-Verification (skipped 059: DEPRECATED - GDPR)
--
-- This batch establishes the core scheduling infrastructure, study pattern analysis,
-- and user role/verification system.
-- ════════════════════════════════════════════════════════════════════════════════


-- ═══ MIGRATION 054: Smart Schedule Engine — Unified Time Layer ═══

-- ── 0. Immutable date helper ────────────────────────────────────────────────
-- timestamptz::date is NOT immutable (depends on session timezone).
-- Wrapping it in an IMMUTABLE function lets us use it in index expressions.
CREATE OR REPLACE FUNCTION tstz_date(ts timestamptz)
RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT ts::date $$;

-- ── 1. Schedule Blocks (Layer 1 + 2) ────────────────────────────────────────
-- Unified representation of ALL time blocks in the schedule
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What kind of block
  block_type    text NOT NULL CHECK (block_type IN (
    'lecture', 'exercise', 'lab', 'seminar',     -- Layer 1: Fixed academic
    'exam', 'deadline',                           -- Layer 1: Fixed academic events
    'work', 'appointment', 'commute',             -- Layer 1: Fixed personal
    'study', 'review', 'exam_prep', 'flashcards', -- Layer 2: Planned learning
    'deep_work', 'group_study',                   -- Layer 2: Planned learning
    'break', 'free'                               -- Utility
  )),
  layer         smallint NOT NULL DEFAULT 1 CHECK (layer IN (1, 2)),

  -- Time
  start_time    timestamptz NOT NULL,
  end_time      timestamptz NOT NULL,
  CHECK (end_time > start_time),

  -- Recurrence (for weekly lectures etc.)
  recurrence    text CHECK (recurrence IN (
    NULL, 'daily', 'weekly', 'biweekly', 'monthly'
  )),
  recurrence_end date,  -- NULL = forever

  -- Context links
  module_id     uuid REFERENCES modules(id) ON DELETE SET NULL,
  task_id       uuid REFERENCES tasks(id) ON DELETE SET NULL,
  topic_id      uuid REFERENCES topics(id) ON DELETE SET NULL,
  exam_id       uuid REFERENCES events(id) ON DELETE SET NULL,
  study_plan_id uuid REFERENCES study_plans(id) ON DELETE SET NULL,

  -- Display
  title         text NOT NULL,
  description   text,
  color         text DEFAULT '#6d28d9',
  icon          text,               -- lucide icon name
  priority      text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Status
  status        text DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'in_progress', 'completed', 'skipped', 'rescheduled'
  )),
  completion_percent smallint DEFAULT 0 CHECK (completion_percent BETWEEN 0 AND 100),

  -- For rescheduled blocks
  original_block_id uuid REFERENCES schedule_blocks(id) ON DELETE SET NULL,
  reschedule_reason text,

  -- Metadata
  estimated_minutes smallint,
  is_locked     boolean DEFAULT false,  -- User locked = can't be auto-rescheduled
  source        text DEFAULT 'manual' CHECK (source IN (
    'manual', 'auto_plan', 'stundenplan_import', 'calendar_sync', 'study_plan', 'decision_engine'
  )),

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_schedule_blocks_user_time ON schedule_blocks(user_id, start_time, end_time);
CREATE INDEX idx_schedule_blocks_user_date ON schedule_blocks(user_id, tstz_date(start_time));
CREATE INDEX idx_schedule_blocks_module ON schedule_blocks(module_id) WHERE module_id IS NOT NULL;
CREATE INDEX idx_schedule_blocks_layer ON schedule_blocks(user_id, layer);
CREATE INDEX idx_schedule_blocks_status ON schedule_blocks(user_id, status) WHERE status != 'completed';

-- RLS
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedule_blocks_own ON schedule_blocks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 2. Timer Sessions (Layer 3) ─────────────────────────────────────────────
-- Enhanced timer tracking — goes beyond time_logs with session state
CREATE TABLE IF NOT EXISTS timer_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session type
  session_type  text NOT NULL DEFAULT 'focus' CHECK (session_type IN (
    'focus', 'pomodoro', 'deep_work', 'review', 'flashcards', 'free'
  )),

  -- Timing
  started_at    timestamptz NOT NULL,
  ended_at      timestamptz,
  planned_duration_minutes smallint,
  actual_duration_seconds  integer,
  effective_seconds        integer,  -- Minus pauses/distractions

  -- Pauses
  pause_count   smallint DEFAULT 0,
  total_pause_seconds integer DEFAULT 0,

  -- Context
  module_id     uuid REFERENCES modules(id) ON DELETE SET NULL,
  task_id       uuid REFERENCES tasks(id) ON DELETE SET NULL,
  topic_id      uuid REFERENCES topics(id) ON DELETE SET NULL,
  exam_id       uuid REFERENCES events(id) ON DELETE SET NULL,

  -- Link to scheduled block (Plan vs. Reality)
  schedule_block_id uuid REFERENCES schedule_blocks(id) ON DELETE SET NULL,

  -- Quality
  focus_rating  smallint CHECK (focus_rating BETWEEN 1 AND 5),  -- User self-report
  energy_level  smallint CHECK (energy_level BETWEEN 1 AND 5),  -- Before session
  note          text,

  -- Alignment tracking
  alignment     text DEFAULT 'unplanned' CHECK (alignment IN (
    'within_plan',        -- Session falls entirely within a planned block
    'partial_overlap',    -- Partially overlaps with a planned block
    'unplanned',          -- No corresponding planned block
    'rescheduled'         -- Was a rescheduled block
  )),

  -- Status
  status        text DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'completed', 'abandoned'
  )),

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_timer_sessions_user_time ON timer_sessions(user_id, started_at);
CREATE INDEX idx_timer_sessions_user_date ON timer_sessions(user_id, tstz_date(started_at));
CREATE INDEX idx_timer_sessions_module ON timer_sessions(module_id) WHERE module_id IS NOT NULL;
CREATE INDEX idx_timer_sessions_block ON timer_sessions(schedule_block_id) WHERE schedule_block_id IS NOT NULL;
CREATE INDEX idx_timer_sessions_active ON timer_sessions(user_id) WHERE status = 'active';

-- RLS
ALTER TABLE timer_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY timer_sessions_own ON timer_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 3. User Schedule Preferences ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_schedule_preferences (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Availability window
  wake_time     time DEFAULT '07:00',
  sleep_time    time DEFAULT '23:00',

  -- Study preferences
  min_study_block_minutes  smallint DEFAULT 25,
  max_study_block_minutes  smallint DEFAULT 90,
  preferred_break_minutes  smallint DEFAULT 10,
  max_daily_study_minutes  smallint DEFAULT 360,

  -- Energy curve (1-5 per time slot)
  energy_morning    smallint DEFAULT 3 CHECK (energy_morning BETWEEN 1 AND 5),     -- 07-12
  energy_afternoon  smallint DEFAULT 3 CHECK (energy_afternoon BETWEEN 1 AND 5),   -- 12-17
  energy_evening    smallint DEFAULT 3 CHECK (energy_evening BETWEEN 1 AND 5),     -- 17-22

  -- Scheduling preferences
  prefer_consistent_times boolean DEFAULT true,   -- Same study times each day?
  allow_weekend_study     boolean DEFAULT true,
  weekend_max_minutes     smallint DEFAULT 240,

  -- Auto-planning
  auto_plan_enabled       boolean DEFAULT false,
  auto_reschedule_missed  boolean DEFAULT true,   -- Auto-reschedule skipped blocks?

  -- Pomodoro defaults
  pomodoro_focus_minutes   smallint DEFAULT 25,
  pomodoro_short_break     smallint DEFAULT 5,
  pomodoro_long_break      smallint DEFAULT 15,
  pomodoro_sessions_before_long smallint DEFAULT 4,

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE user_schedule_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY prefs_own ON user_schedule_preferences
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 4. Schedule Analytics (Daily Aggregates) ────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_daily_stats (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          date NOT NULL,

  -- Layer 2: Planned
  planned_blocks        smallint DEFAULT 0,
  planned_minutes       smallint DEFAULT 0,

  -- Layer 3: Actual
  completed_sessions    smallint DEFAULT 0,
  actual_minutes        smallint DEFAULT 0,
  effective_minutes     smallint DEFAULT 0,   -- Minus pauses

  -- Plan vs. Reality
  adherence_percent     smallint DEFAULT 0 CHECK (adherence_percent BETWEEN 0 AND 100),
  blocks_completed      smallint DEFAULT 0,
  blocks_skipped        smallint DEFAULT 0,
  blocks_rescheduled    smallint DEFAULT 0,

  -- Per-module breakdown (JSONB for flexibility)
  module_breakdown      jsonb DEFAULT '[]'::jsonb,
  -- Format: [{ moduleId, moduleName, plannedMin, actualMin, adherence }]

  -- Patterns
  most_productive_hour  smallint,  -- 0-23
  avg_session_minutes   smallint,
  longest_session_minutes smallint,

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_daily_stats_user_date ON schedule_daily_stats(user_id, date DESC);

-- RLS
ALTER TABLE schedule_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_stats_own ON schedule_daily_stats
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 5. Helper Functions ─────────────────────────────────────────────────────

-- Get free time slots for a user on a given date
CREATE OR REPLACE FUNCTION get_free_slots(
  p_user_id uuid,
  p_date date,
  p_min_duration_minutes integer DEFAULT 25
)
RETURNS TABLE (
  slot_start timestamptz,
  slot_end timestamptz,
  duration_minutes integer
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wake timestamptz;
  v_sleep timestamptz;
  v_prefs record;
BEGIN
  -- Get user preferences
  SELECT * INTO v_prefs FROM user_schedule_preferences WHERE user_id = p_user_id;

  IF v_prefs IS NULL THEN
    v_wake := (p_date + '07:00'::time)::timestamptz;
    v_sleep := (p_date + '23:00'::time)::timestamptz;
  ELSE
    v_wake := (p_date + v_prefs.wake_time)::timestamptz;
    v_sleep := (p_date + v_prefs.sleep_time)::timestamptz;
  END IF;

  -- Find gaps between occupied blocks
  RETURN QUERY
  WITH occupied AS (
    SELECT start_time AS s, end_time AS e
    FROM schedule_blocks
    WHERE user_id = p_user_id
      AND start_time::date = p_date
      AND status NOT IN ('skipped', 'rescheduled')
    UNION ALL
    SELECT started_at AS s,
           COALESCE(ended_at, started_at + (actual_duration_seconds || ' seconds')::interval) AS e
    FROM timer_sessions
    WHERE user_id = p_user_id
      AND started_at::date = p_date
      AND status IN ('active', 'completed')
    ORDER BY s
  ),
  merged AS (
    SELECT s, e,
           MAX(e) OVER (ORDER BY s ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_max_e
    FROM occupied
  ),
  gaps AS (
    SELECT
      GREATEST(COALESCE(prev_max_e, v_wake), v_wake) AS gap_start,
      s AS gap_end
    FROM merged
    WHERE s > COALESCE(prev_max_e, v_wake)
    UNION ALL
    -- Gap after last block until sleep
    SELECT
      COALESCE((SELECT MAX(e) FROM occupied), v_wake),
      v_sleep
  )
  SELECT
    gap_start,
    gap_end,
    EXTRACT(EPOCH FROM (gap_end - gap_start))::integer / 60
  FROM gaps
  WHERE EXTRACT(EPOCH FROM (gap_end - gap_start))::integer / 60 >= p_min_duration_minutes
  ORDER BY gap_start;
END;
$$;


-- Calculate daily adherence stats
CREATE OR REPLACE FUNCTION update_daily_schedule_stats(
  p_user_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_planned_blocks smallint;
  v_planned_min smallint;
  v_sessions smallint;
  v_actual_min smallint;
  v_effective_min smallint;
  v_completed smallint;
  v_skipped smallint;
  v_rescheduled smallint;
  v_adherence smallint;
  v_module_data jsonb;
  v_most_productive smallint;
  v_avg_session smallint;
  v_longest smallint;
BEGIN
  -- Planned (Layer 2 blocks)
  SELECT COUNT(*)::smallint, COALESCE(SUM(estimated_minutes), 0)::smallint
  INTO v_planned_blocks, v_planned_min
  FROM schedule_blocks
  WHERE user_id = p_user_id AND start_time::date = p_date AND layer = 2;

  -- Actual sessions
  SELECT COUNT(*)::smallint,
         COALESCE(SUM(actual_duration_seconds) / 60, 0)::smallint,
         COALESCE(SUM(effective_seconds) / 60, 0)::smallint,
         COALESCE(AVG(actual_duration_seconds) / 60, 0)::smallint,
         COALESCE(MAX(actual_duration_seconds) / 60, 0)::smallint
  INTO v_sessions, v_actual_min, v_effective_min, v_avg_session, v_longest
  FROM timer_sessions
  WHERE user_id = p_user_id AND started_at::date = p_date AND status = 'completed';

  -- Block completion
  SELECT
    COUNT(*) FILTER (WHERE status = 'completed')::smallint,
    COUNT(*) FILTER (WHERE status = 'skipped')::smallint,
    COUNT(*) FILTER (WHERE status = 'rescheduled')::smallint
  INTO v_completed, v_skipped, v_rescheduled
  FROM schedule_blocks
  WHERE user_id = p_user_id AND start_time::date = p_date AND layer = 2;

  -- Adherence
  IF v_planned_blocks > 0 THEN
    v_adherence := LEAST(100, (v_completed * 100 / v_planned_blocks))::smallint;
  ELSE
    v_adherence := CASE WHEN v_sessions > 0 THEN 100 ELSE 0 END;
  END IF;

  -- Most productive hour
  SELECT EXTRACT(HOUR FROM started_at)::smallint INTO v_most_productive
  FROM timer_sessions
  WHERE user_id = p_user_id AND started_at::date = p_date AND status = 'completed'
  GROUP BY EXTRACT(HOUR FROM started_at)
  ORDER BY SUM(effective_seconds) DESC
  LIMIT 1;

  -- Module breakdown
  SELECT COALESCE(jsonb_agg(row_to_json(m)), '[]'::jsonb)
  INTO v_module_data
  FROM (
    SELECT
      sb.module_id AS "moduleId",
      mod.name AS "moduleName",
      COALESCE(SUM(sb.estimated_minutes) FILTER (WHERE sb.layer = 2), 0) AS "plannedMin",
      COALESCE(SUM(ts.actual_duration_seconds) / 60, 0) AS "actualMin"
    FROM schedule_blocks sb
    LEFT JOIN modules mod ON mod.id = sb.module_id
    LEFT JOIN timer_sessions ts ON ts.schedule_block_id = sb.id AND ts.status = 'completed'
    WHERE sb.user_id = p_user_id AND sb.start_time::date = p_date AND sb.module_id IS NOT NULL
    GROUP BY sb.module_id, mod.name
  ) m;

  -- Upsert
  INSERT INTO schedule_daily_stats (
    user_id, date, planned_blocks, planned_minutes,
    completed_sessions, actual_minutes, effective_minutes,
    adherence_percent, blocks_completed, blocks_skipped, blocks_rescheduled,
    module_breakdown, most_productive_hour, avg_session_minutes, longest_session_minutes
  ) VALUES (
    p_user_id, p_date, v_planned_blocks, v_planned_min,
    v_sessions, v_actual_min, v_effective_min,
    v_adherence, v_completed, v_skipped, v_rescheduled,
    v_module_data, v_most_productive, v_avg_session, v_longest
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    planned_blocks = EXCLUDED.planned_blocks,
    planned_minutes = EXCLUDED.planned_minutes,
    completed_sessions = EXCLUDED.completed_sessions,
    actual_minutes = EXCLUDED.actual_minutes,
    effective_minutes = EXCLUDED.effective_minutes,
    adherence_percent = EXCLUDED.adherence_percent,
    blocks_completed = EXCLUDED.blocks_completed,
    blocks_skipped = EXCLUDED.blocks_skipped,
    blocks_rescheduled = EXCLUDED.blocks_rescheduled,
    module_breakdown = EXCLUDED.module_breakdown,
    most_productive_hour = EXCLUDED.most_productive_hour,
    avg_session_minutes = EXCLUDED.avg_session_minutes,
    longest_session_minutes = EXCLUDED.longest_session_minutes,
    updated_at = now();
END;
$$;


-- ── 6. Auto-update timer_sessions on completion ─────────────────────────────
CREATE OR REPLACE FUNCTION timer_session_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- When a timer session is completed, check alignment with schedule blocks
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Calculate effective seconds (actual minus pauses)
    NEW.effective_seconds := COALESCE(NEW.actual_duration_seconds, 0) - COALESCE(NEW.total_pause_seconds, 0);

    -- Check alignment with schedule blocks
    IF NEW.schedule_block_id IS NOT NULL THEN
      -- Direct link exists
      NEW.alignment := 'within_plan';

      -- Mark the schedule block as completed
      UPDATE schedule_blocks
      SET status = 'completed',
          completion_percent = LEAST(100,
            COALESCE(completion_percent, 0) +
            (NEW.effective_seconds * 100 / GREATEST(estimated_minutes * 60, 1))
          ),
          updated_at = now()
      WHERE id = NEW.schedule_block_id;
    ELSE
      -- Check for overlapping planned blocks
      PERFORM 1 FROM schedule_blocks
      WHERE user_id = NEW.user_id
        AND layer = 2
        AND start_time <= NEW.started_at
        AND end_time >= COALESCE(NEW.ended_at, now())
        AND status IN ('scheduled', 'in_progress')
      LIMIT 1;

      IF FOUND THEN
        NEW.alignment := 'partial_overlap';
      ELSE
        NEW.alignment := 'unplanned';
      END IF;
    END IF;

    -- Also insert/update a legacy time_log for backward compatibility
    INSERT INTO time_logs (
      user_id, module_id, exam_id, topic_id, task_id,
      duration_seconds, started_at, note
    ) VALUES (
      NEW.user_id, NEW.module_id, NEW.exam_id, NEW.topic_id, NEW.task_id,
      NEW.effective_seconds, NEW.started_at, NEW.note
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_timer_session_completed
  BEFORE UPDATE ON timer_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION timer_session_completed();


-- ── 7. Import existing stundenplan entries as schedule blocks ────────────────
-- This function can be called to migrate existing timetable entries
CREATE OR REPLACE FUNCTION import_stundenplan_to_schedule(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer := 0;
  v_entry record;
  v_day_offset integer;
  v_today date := CURRENT_DATE;
  v_week_start date;
BEGIN
  -- Get Monday of current week
  v_week_start := v_today - (EXTRACT(DOW FROM v_today)::integer - 1);
  IF EXTRACT(DOW FROM v_today) = 0 THEN
    v_week_start := v_today - 6;
  END IF;

  FOR v_entry IN
    SELECT * FROM stundenplan WHERE user_id = p_user_id
  LOOP
    -- Map day abbreviation to offset from Monday
    v_day_offset := CASE v_entry.day
      WHEN 'Mo' THEN 0 WHEN 'Di' THEN 1 WHEN 'Mi' THEN 2
      WHEN 'Do' THEN 3 WHEN 'Fr' THEN 4 WHEN 'Sa' THEN 5
      ELSE NULL
    END;

    IF v_day_offset IS NOT NULL THEN
      INSERT INTO schedule_blocks (
        user_id, block_type, layer, title, color, module_id,
        start_time, end_time, recurrence, source
      ) VALUES (
        p_user_id,
        'lecture',
        1,
        v_entry.title,
        v_entry.color,
        v_entry.module_id,
        (v_week_start + v_day_offset + v_entry.time_start::time)::timestamptz,
        (v_week_start + v_day_offset + v_entry.time_end::time)::timestamptz,
        'weekly',
        'stundenplan_import'
      )
      ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;


-- ═══ MIGRATION 055: Auto-Planning, Study Patterns & Weekly Review ═══

-- ── 1. Study Patterns ─────────────────────────────────────────────────────────
-- Stores learned patterns from user's timer session history.
-- Updated incrementally after each completed session.

CREATE TABLE IF NOT EXISTS study_patterns (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- When does the user study best?
  best_hours          jsonb NOT NULL DEFAULT '[]',       -- [{hour: 9, score: 0.85, avg_focus: 4.2, sessions: 12}, ...]
  worst_hours         jsonb NOT NULL DEFAULT '[]',       -- [{hour: 22, score: 0.3, avg_focus: 2.1, sessions: 5}, ...]

  -- Optimal session durations
  avg_session_minutes       real NOT NULL DEFAULT 0,
  preferred_duration_minutes real NOT NULL DEFAULT 45,   -- Mode of session durations (rounded to 5)
  longest_productive_session real NOT NULL DEFAULT 0,    -- Longest session with focus >= 4

  -- Module-specific patterns
  module_patterns     jsonb NOT NULL DEFAULT '{}',       -- {moduleId: {avgDuration, bestHour, avgFocus, totalSessions, weeklyTarget}}

  -- Day-of-week patterns
  day_patterns        jsonb NOT NULL DEFAULT '[]',       -- [{day: 0, avgMinutes: 120, avgSessions: 3, adherence: 0.75}, ...]

  -- Consistency & streaks
  current_streak_days     int NOT NULL DEFAULT 0,
  longest_streak_days     int NOT NULL DEFAULT 0,
  avg_weekly_study_minutes real NOT NULL DEFAULT 0,
  consistency_score       real NOT NULL DEFAULT 0,       -- 0-1, how consistently they follow their plan

  -- Plan adherence trends (last 4 weeks)
  adherence_trend     jsonb NOT NULL DEFAULT '[]',       -- [{week: "2026-W14", planned: 300, actual: 270, adherence: 0.9}, ...]

  -- Procrastination detection
  avg_start_delay_minutes real NOT NULL DEFAULT 0,       -- How late they typically start vs. planned
  skip_rate               real NOT NULL DEFAULT 0,       -- % of planned blocks skipped

  -- Energy curve (learned from focus_rating + energy_level)
  energy_curve        jsonb NOT NULL DEFAULT '{}',       -- {morning: 3.5, afternoon: 4.0, evening: 2.8}

  -- Metadata
  total_sessions_analyzed  int NOT NULL DEFAULT 0,
  last_analyzed_at   timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_patterns UNIQUE (user_id)
);

ALTER TABLE study_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_patterns_own" ON study_patterns
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 2. Weekly Reviews ─────────────────────────────────────────────────────────
-- Snapshot of each week's performance + AI-generated insights.

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start      date NOT NULL,                         -- Monday of the week
  week_end        date NOT NULL,                         -- Sunday

  -- Quantitative metrics
  total_planned_minutes     int NOT NULL DEFAULT 0,
  total_actual_minutes      int NOT NULL DEFAULT 0,
  total_effective_minutes   int NOT NULL DEFAULT 0,
  overall_adherence         real NOT NULL DEFAULT 0,      -- 0-1
  sessions_completed        int NOT NULL DEFAULT 0,
  blocks_completed          int NOT NULL DEFAULT 0,
  blocks_skipped            int NOT NULL DEFAULT 0,
  blocks_rescheduled        int NOT NULL DEFAULT 0,

  -- Module breakdown
  module_stats      jsonb NOT NULL DEFAULT '[]',          -- [{moduleId, name, planned, actual, adherence, trend}]

  -- Patterns detected this week
  best_day              text,                             -- "2026-04-01"
  best_hour             int,                              -- 0-23
  avg_session_minutes   real,
  avg_focus_rating      real,                             -- 1-5
  avg_energy_level      real,                             -- 1-5

  -- Comparisons
  vs_prev_week          jsonb NOT NULL DEFAULT '{}',      -- {plannedDelta, actualDelta, adherenceDelta, trendDirection}
  vs_4_week_avg         jsonb NOT NULL DEFAULT '{}',      -- Same structure

  -- Generated insights & recommendations
  insights              jsonb NOT NULL DEFAULT '[]',      -- [{type, severity, title_key, description_key, data}]
  recommendations       jsonb NOT NULL DEFAULT '[]',      -- [{type, priority, action_key, reason_key, data}]

  -- Goal tracking
  goals                 jsonb NOT NULL DEFAULT '[]',      -- [{type, target, actual, achieved}]

  -- User interaction
  user_reflection       text,                             -- User's own notes about the week
  mood_rating           int CHECK (mood_rating BETWEEN 1 AND 5),
  is_read               boolean NOT NULL DEFAULT false,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_week UNIQUE (user_id, week_start)
);

ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_reviews_own" ON weekly_reviews
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_weekly_reviews_user_week ON weekly_reviews(user_id, week_start DESC);


-- ── 3. Reschedule Log ─────────────────────────────────────────────────────────
-- Tracks every reschedule event (auto or manual) for pattern learning.

CREATE TABLE IF NOT EXISTS reschedule_log (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_block_id uuid REFERENCES schedule_blocks(id) ON DELETE SET NULL,
  new_block_id      uuid REFERENCES schedule_blocks(id) ON DELETE SET NULL,

  -- What happened
  trigger           text NOT NULL CHECK (trigger IN (
    'missed',           -- User didn't start the block
    'partial',          -- User started but didn't finish
    'conflict',         -- New event conflicts with planned block
    'energy_low',       -- User reported low energy
    'user_request',     -- Manual reschedule
    'auto_optimize',    -- System optimization
    'day_overflow'      -- Too many blocks for available time
  )),

  -- Original timing
  original_start    timestamptz NOT NULL,
  original_end      timestamptz NOT NULL,

  -- New timing (null if dropped/unresolved)
  new_start         timestamptz,
  new_end           timestamptz,

  -- Resolution
  resolution        text NOT NULL DEFAULT 'pending' CHECK (resolution IN (
    'pending',          -- Awaiting user decision
    'rescheduled',      -- Moved to new time
    'shortened',        -- Reduced duration
    'merged',           -- Combined with another block
    'dropped',          -- Removed entirely
    'completed_late'    -- Done later without formal reschedule
  )),

  -- Context
  module_id         uuid,
  block_type        text,
  reason            text,                                 -- Human-readable reason
  auto_generated    boolean NOT NULL DEFAULT false,       -- Was this an auto-reschedule?

  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reschedule_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reschedule_log_own" ON reschedule_log
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_reschedule_log_user_date ON reschedule_log(user_id, created_at DESC);
CREATE INDEX idx_reschedule_log_block ON reschedule_log(original_block_id);


-- ── 4. Helper Functions ───────────────────────────────────────────────────────

-- Compute hourly study distribution for a user over N days
CREATE OR REPLACE FUNCTION compute_hourly_study_distribution(
  p_user_id uuid,
  p_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      EXTRACT(HOUR FROM started_at) AS hour,
      COUNT(*)::int AS session_count,
      ROUND(AVG(effective_seconds / 60.0)::numeric, 1) AS avg_minutes,
      ROUND(AVG(COALESCE(focus_rating, 3))::numeric, 2) AS avg_focus,
      ROUND(AVG(COALESCE(energy_level, 3))::numeric, 2) AS avg_energy,
      SUM(effective_seconds)::int AS total_seconds
    FROM timer_sessions
    WHERE user_id = p_user_id
      AND status = 'completed'
      AND started_at >= now() - (p_days || ' days')::interval
    GROUP BY EXTRACT(HOUR FROM started_at)
    ORDER BY hour
  ) t;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Compute day-of-week study distribution
CREATE OR REPLACE FUNCTION compute_daily_study_distribution(
  p_user_id uuid,
  p_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      EXTRACT(DOW FROM started_at)::int AS day_of_week,
      COUNT(*)::int AS session_count,
      ROUND(SUM(effective_seconds / 60.0)::numeric, 0) AS total_minutes,
      ROUND(AVG(effective_seconds / 60.0)::numeric, 1) AS avg_session_minutes,
      COUNT(DISTINCT started_at::date)::int AS active_days
    FROM timer_sessions
    WHERE user_id = p_user_id
      AND status = 'completed'
      AND started_at >= now() - (p_days || ' days')::interval
    GROUP BY EXTRACT(DOW FROM started_at)
    ORDER BY day_of_week
  ) t;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Compute module study distribution
CREATE OR REPLACE FUNCTION compute_module_study_distribution(
  p_user_id uuid,
  p_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      ts.module_id,
      m.name AS module_name,
      COUNT(*)::int AS session_count,
      ROUND(SUM(ts.effective_seconds / 60.0)::numeric, 0) AS total_minutes,
      ROUND(AVG(ts.effective_seconds / 60.0)::numeric, 1) AS avg_session_minutes,
      ROUND(AVG(COALESCE(ts.focus_rating, 3))::numeric, 2) AS avg_focus,
      mode() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM ts.started_at)) AS best_hour
    FROM timer_sessions ts
    LEFT JOIN modules m ON m.id = ts.module_id
    WHERE ts.user_id = p_user_id
      AND ts.status = 'completed'
      AND ts.module_id IS NOT NULL
      AND ts.started_at >= now() - (p_days || ' days')::interval
    GROUP BY ts.module_id, m.name
    ORDER BY total_minutes DESC
  ) t;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Auto-detect missed blocks and create reschedule entries
CREATE OR REPLACE FUNCTION detect_missed_blocks(
  p_user_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  missed_count int := 0;
  block_rec RECORD;
BEGIN
  -- Find Layer 2 blocks that ended before now but have no matching timer sessions
  FOR block_rec IN
    SELECT sb.*
    FROM schedule_blocks sb
    WHERE sb.user_id = p_user_id
      AND sb.layer = 2
      AND sb.status = 'scheduled'
      AND tstz_date(sb.start_time) = p_date
      AND sb.end_time < now() - interval '15 minutes'  -- 15 min grace period
      AND NOT EXISTS (
        SELECT 1 FROM timer_sessions ts
        WHERE (ts.schedule_block_id = sb.id
               OR (ts.module_id = sb.module_id AND ts.module_id IS NOT NULL
                   AND ts.started_at >= sb.start_time - interval '30 minutes'
                   AND ts.started_at <= sb.end_time + interval '30 minutes'))
          AND ts.status IN ('completed', 'active', 'paused')
      )
  LOOP
    -- Mark block as skipped
    UPDATE schedule_blocks SET status = 'skipped' WHERE id = block_rec.id;

    -- Log the miss
    INSERT INTO reschedule_log (
      user_id, original_block_id, trigger,
      original_start, original_end,
      resolution, module_id, block_type,
      reason, auto_generated
    ) VALUES (
      p_user_id, block_rec.id, 'missed',
      block_rec.start_time, block_rec.end_time,
      'pending', block_rec.module_id, block_rec.block_type,
      'Block ended without any matching timer session', true
    );

    missed_count := missed_count + 1;
  END LOOP;

  RETURN missed_count;
END;
$$;


-- ── 5. Updated Trigger: Auto-update study_patterns after session completion ──

CREATE OR REPLACE FUNCTION update_study_patterns_on_session()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only process completed sessions
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Upsert study_patterns with incremented session count
    INSERT INTO study_patterns (user_id, total_sessions_analyzed, last_analyzed_at)
    VALUES (NEW.user_id, 1, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      total_sessions_analyzed = study_patterns.total_sessions_analyzed + 1,
      last_analyzed_at = now(),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_study_patterns
  AFTER INSERT OR UPDATE ON timer_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_study_patterns_on_session();


-- ── 6. Indexes for Performance ────────────────────────────────────────────────

-- Timer sessions: efficient pattern queries
CREATE INDEX IF NOT EXISTS idx_timer_sessions_user_completed
  ON timer_sessions(user_id, status, started_at DESC)
  WHERE status = 'completed';

-- Schedule blocks: efficient missed-block detection
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_user_layer_status
  ON schedule_blocks(user_id, layer, status, start_time)
  WHERE layer = 2;


-- ═══ MIGRATION 056: Module source tracking & soft-delete ═══

-- Source: where the module came from
ALTER TABLE modules ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
-- studiengang_id: links back to the institution programme template
ALTER TABLE modules ADD COLUMN IF NOT EXISTS studiengang_id UUID REFERENCES studiengaenge(id) ON DELETE SET NULL;
-- hidden_at: soft-delete timestamp (null = visible, set = hidden by student)
ALTER TABLE modules ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ DEFAULT NULL;
-- institution_modules_loaded: flag on profile so auto-import only runs once
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS institution_modules_loaded BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_modules_source ON modules(source);
CREATE INDEX IF NOT EXISTS idx_modules_hidden ON modules(hidden_at) WHERE hidden_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_modules_studiengang ON modules(studiengang_id) WHERE studiengang_id IS NOT NULL;

COMMENT ON COLUMN modules.source IS 'institution = imported from Studiengang template, manual = created by student';
COMMENT ON COLUMN modules.hidden_at IS 'Soft-delete: set when student hides an institution module, null = visible';
COMMENT ON COLUMN modules.studiengang_id IS 'Links to studiengaenge template this module was imported from';
COMMENT ON COLUMN profiles.institution_modules_loaded IS 'True after institution modules were auto-loaded for this student';


-- ═══ MIGRATION 057: Clean up old institution modules on program switch ═══

CREATE OR REPLACE FUNCTION auto_import_program_modules()
RETURNS TRIGGER AS $$
DECLARE
  template_mod RECORD;
BEGIN
  -- Only act when active_program_id changes
  IF (OLD.active_program_id IS DISTINCT FROM NEW.active_program_id) THEN

    -- ── Step 1: Remove old institution modules ──
    -- When switching programs, delete all modules that were auto-imported
    -- from the previous program (source = 'institution').
    -- Manual modules (source = 'manual' or NULL) are kept.
    IF OLD.active_program_id IS NOT NULL THEN
      DELETE FROM modules
      WHERE user_id = NEW.id
        AND source = 'institution'
        AND program_id = OLD.active_program_id;
    END IF;

    -- Also clean up institution modules with no program_id
    -- (legacy imports from studiengaenge that have source = 'institution')
    IF NEW.active_program_id IS NOT NULL AND OLD.active_program_id IS DISTINCT FROM NEW.active_program_id THEN
      DELETE FROM modules
      WHERE user_id = NEW.id
        AND source = 'institution'
        AND program_id IS NULL;
    END IF;

    -- ── Step 2: Import new template modules ──
    IF NEW.active_program_id IS NOT NULL THEN
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
            ects_equivalent, prerequisites_json, status, in_plan,
            source
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
            'planned', true,
            'institution'
          );
        END IF;
      END LOOP;

      -- Reset institution_modules_loaded so frontend knows to refresh
      UPDATE profiles SET institution_modules_loaded = true WHERE id = NEW.id;
    ELSE
      -- Program was cleared (set to NULL) — just clean up, mark as not loaded
      UPDATE profiles SET institution_modules_loaded = false WHERE id = NEW.id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══ MIGRATION 058: 4-Rollen-System (user_role + Verifizierung) ═══

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


-- ═══ MIGRATION 060: Email-Domain-Verification ═══

-- ─── 1. Dokument-URL-Spalten entfernen ────────────────────────────────────
ALTER TABLE profiles DROP COLUMN IF EXISTS student_id_url;
ALTER TABLE profiles DROP COLUMN IF EXISTS institution_proof_url;

-- ─── 2. Email-Domain-Verifizierung hinzufügen ────────────────────────────
-- Speichert die Domain die zur Verifizierung genutzt wurde (z.B. "zhaw.ch")
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verified_email_domain TEXT;
