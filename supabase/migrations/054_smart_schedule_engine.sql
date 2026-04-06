-- ============================================================================
-- Migration 054: Smart Schedule Engine — Unified Time Layer
--
-- Creates the foundation for the 3-layer scheduling system:
--   Layer 1: Fixed Events (lectures, exams, deadlines)
--   Layer 2: Planned Blocks (study sessions, review, preparation)
--   Layer 3: Actual Sessions (timer data with start/end/duration)
--
-- Also: user preferences, plan-vs-reality tracking
-- ============================================================================

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
