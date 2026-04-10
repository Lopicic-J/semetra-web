-- ============================================================================
-- Migration 074: Smart Schedule v2 — Intelligent Scheduling Engine
-- ============================================================================

-- Pre-requisite: Drop function with changed return type
DROP FUNCTION IF EXISTS check_all_missed_blocks();

-- ============================================================================
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
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 0. FIX: auto_detect_missed_blocks() — broken column references from 064
-- ═══════════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. FIX: Missing FK on study_plan_item_id (from migration 063)
-- ═══════════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Extend user_schedule_preferences
-- ═══════════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Ensure stundenplan_id column + index
-- ═══════════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. sync_stundenplan_to_schedule() — Smart upsert (replaces old import)
-- ═══════════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. auto_fill_free_slots() — Gap detection + priority-based fill
-- ═══════════════════════════════════════════════════════════════════════════
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
  -- For each gap ≥ min_study_block_minutes: create a study block
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. auto_rescue_missed_blocks() — Detect + auto-reschedule missed blocks
-- ═══════════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. compute_exam_study_plan() — Backward-scheduling from exam dates
-- ═══════════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. check_all_missed_blocks() — Enhanced version (replaces 064)
-- ═══════════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. DATA FIXES
-- ═══════════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════════
-- RESULT
-- ═══════════════════════════════════════════════════════════════════════════
-- Fixed:
--   ✓ auto_detect_missed_blocks() — correct reschedule_log column names
--   ✓ Missing FK on study_plan_item_id
-- New Preferences:
--   ✓ available_from/until — student learning availability window
--   ✓ auto_sync_stundenplan, auto_fill_gaps — automation toggles
--   ✓ exam_prep_start_days_before, exam_prep_min_hours, exam_prep_daily_max
-- New Functions:
--   ✓ sync_stundenplan_to_schedule()  — smart upsert with conflict detection
--   ✓ auto_fill_free_slots()         — gap detection + priority-based fill
--   ✓ auto_rescue_missed_blocks()    — detect + auto-reschedule
--   ✓ compute_exam_study_plan()      — backward-scheduling from exams
--   ✓ check_all_missed_blocks()      — enhanced with auto-rescue chain
