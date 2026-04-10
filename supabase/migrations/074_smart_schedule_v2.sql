-- ============================================================================
-- Migration 074: Smart Schedule v2
-- - Add available_from, available_until to user_schedule_preferences
-- - Add auto_sync_stundenplan, auto_fill_gaps flags
-- - Update import_stundenplan_to_schedule → sync_stundenplan_to_schedule
-- - Ensure stundenplan_id is populated on schedule_blocks
-- ============================================================================

-- ── 1. Extend user_schedule_preferences ─────────────────────────────────────

-- Available learning window (student may work 8-15h and only study 15-23h)
ALTER TABLE user_schedule_preferences
  ADD COLUMN IF NOT EXISTS available_from time DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS available_until time DEFAULT '23:00';

-- Automation flags
ALTER TABLE user_schedule_preferences
  ADD COLUMN IF NOT EXISTS auto_sync_stundenplan boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_fill_gaps boolean DEFAULT false;

-- ── 2. Ensure stundenplan_id column exists on schedule_blocks ───────────────

-- This column may already exist from migration 054, but ensure it's there
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_blocks' AND column_name = 'stundenplan_id'
  ) THEN
    ALTER TABLE schedule_blocks ADD COLUMN stundenplan_id uuid REFERENCES stundenplan(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for fast lookup by stundenplan_id
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_stundenplan_id
  ON schedule_blocks(stundenplan_id) WHERE stundenplan_id IS NOT NULL;

-- ── 3. New sync function (replaces old import) ─────────────────────────────

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
  v_active_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Get Monday of current week
  v_week_start := v_today - (EXTRACT(DOW FROM v_today)::integer - 1);
  IF EXTRACT(DOW FROM v_today) = 0 THEN
    v_week_start := v_today - 6;
  END IF;

  -- Upsert each stundenplan entry → schedule_block
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

    v_start_ts := (v_week_start + v_day_offset + v_entry.time_start::time)::timestamptz;
    v_end_ts   := (v_week_start + v_day_offset + v_entry.time_end::time)::timestamptz;

    -- Check if block already exists for this stundenplan entry
    SELECT * INTO v_existing
    FROM schedule_blocks
    WHERE stundenplan_id = v_entry.id
      AND user_id = p_user_id
      AND layer = 1
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      -- UPDATE existing block if times changed
      IF v_existing.start_time != v_start_ts OR v_existing.end_time != v_end_ts
         OR v_existing.title != v_entry.title THEN
        UPDATE schedule_blocks SET
          start_time = v_start_ts,
          end_time = v_end_ts,
          title = v_entry.title,
          color = v_entry.color,
          module_id = v_entry.module_id,
          source = 'stundenplan_sync',
          updated_at = now()
        WHERE id = v_existing.id;
        v_updated := v_updated + 1;
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

  -- Delete orphaned schedule_blocks (stundenplan entry was deleted)
  DELETE FROM schedule_blocks
  WHERE user_id = p_user_id
    AND layer = 1
    AND source IN ('stundenplan_sync', 'stundenplan_import')
    AND stundenplan_id IS NOT NULL
    AND NOT (stundenplan_id = ANY(v_active_ids));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'created', v_created,
    'updated', v_updated,
    'deleted', v_deleted
  );
END;
$$;

-- ── 4. Migrate old stundenplan_import blocks to have stundenplan_id ─────────

-- Try to match existing imported blocks to their stundenplan entries by title + module
UPDATE schedule_blocks sb
SET stundenplan_id = sp.id,
    source = 'stundenplan_sync'
FROM stundenplan sp
WHERE sb.source = 'stundenplan_import'
  AND sb.layer = 1
  AND sb.stundenplan_id IS NULL
  AND sb.user_id = sp.user_id
  AND sb.title = sp.title
  AND (sb.module_id = sp.module_id OR (sb.module_id IS NULL AND sp.module_id IS NULL));

-- ── 5. Default: set available_from/until from wake/sleep if already configured

UPDATE user_schedule_preferences
SET available_from = wake_time,
    available_until = sleep_time
WHERE available_from = '07:00' AND wake_time != '07:00';
