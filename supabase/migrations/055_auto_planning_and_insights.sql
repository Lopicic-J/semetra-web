-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 055: Auto-Planning, Study Patterns & Weekly Review
-- Phase 7 of the Unified Time System
--
-- Adds:
--   1. study_patterns        – Learned user behavior (optimal times, durations)
--   2. weekly_reviews         – Generated weekly review snapshots
--   3. reschedule_log         – History of auto/manual reschedules
--   4. Helper functions for pattern analysis
-- ══════════════════════════════════════════════════════════════════════════════

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
