-- ════════════════════════════════════════════════════════════════════════════════
-- BATCH 3: Auto Sync (Migrations 061-067)
-- ════════════════════════════════════════════════════════════════════════════════
-- Contents:
--   061: Stundenplan → Schedule Auto-Sync
--   062: Prüfungen/Events → Schedule Blocks Auto-Sync
--   063: Study Plan Items → Schedule Blocks Auto-Sync
--   064: Auto Daily Stats + Missed Block Detection
--   065: Tasks → Schedule Blocks Auto-Sync
--   066: Noten-Änderung → Intelligente Reaktion
--   067: Add last_seen_at column for online/offline status tracking
--
-- This batch enables automatic synchronization across all modules and decision engine integration.
-- ════════════════════════════════════════════════════════════════════════════════


-- ═══ MIGRATION 061: Stundenplan → Schedule Auto-Sync ═══

-- ─── 1. Stundenplan-ID Spalte in schedule_blocks ──────────────────────────
-- Erlaubt die Verknüpfung zwischen stundenplan-Einträgen und schedule_blocks
ALTER TABLE schedule_blocks ADD COLUMN IF NOT EXISTS
  stundenplan_id uuid REFERENCES stundenplan(id) ON DELETE CASCADE;

-- Source-Constraint erweitern für neuen Typ
ALTER TABLE schedule_blocks DROP CONSTRAINT IF EXISTS schedule_blocks_source_check;
ALTER TABLE schedule_blocks ADD CONSTRAINT schedule_blocks_source_check
  CHECK (source IN (
    'manual', 'auto_plan', 'stundenplan_import', 'stundenplan_sync',
    'calendar_sync', 'study_plan', 'decision_engine'
  ));

-- Index für schnelle Lookups
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_stundenplan
  ON schedule_blocks (stundenplan_id) WHERE stundenplan_id IS NOT NULL;


-- ─── 2. Hilfsfunktion: Tag-Abkürzung → Datum ─────────────────────────────
-- Berechnet das nächste Datum für einen Wochentag ab einem Referenz-Montag.
-- Wird vom Trigger verwendet um die start_time/end_time zu berechnen.
CREATE OR REPLACE FUNCTION stundenplan_day_to_date(
  p_day text,
  p_reference_monday date DEFAULT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::int + 6) % 7)
)
RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT p_reference_monday + CASE p_day
    WHEN 'Mo' THEN 0 WHEN 'Di' THEN 1 WHEN 'Mi' THEN 2
    WHEN 'Do' THEN 3 WHEN 'Fr' THEN 4 WHEN 'Sa' THEN 5
    WHEN 'So' THEN 6
    ELSE NULL
  END;
$$;


-- ─── 3. Sync-Trigger-Funktion ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_stundenplan_to_schedule()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_monday date;
  v_block_date date;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  -- Referenz-Montag berechnen (aktuelle Woche)
  v_monday := CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::int + 6) % 7);

  -- ═══ DELETE ═══
  IF TG_OP = 'DELETE' THEN
    DELETE FROM schedule_blocks
      WHERE stundenplan_id = OLD.id;
    RETURN OLD;
  END IF;

  -- ═══ INSERT / UPDATE ═══
  -- Datum + Zeiten berechnen
  v_block_date := stundenplan_day_to_date(NEW.day, v_monday);

  IF v_block_date IS NULL THEN
    -- Ungültiger Tag → überspringen
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM schedule_blocks WHERE stundenplan_id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  v_start := (v_block_date + NEW.time_start::time)::timestamptz;
  v_end   := (v_block_date + NEW.time_end::time)::timestamptz;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO schedule_blocks (
      user_id, stundenplan_id, block_type, layer, title, color,
      module_id, start_time, end_time, recurrence, source, is_locked
    ) VALUES (
      NEW.user_id,
      NEW.id,
      'lecture',
      1,
      NEW.title,
      COALESCE(NEW.color, '#6d28d9'),
      NEW.module_id,
      v_start,
      v_end,
      'weekly',
      'stundenplan_sync',
      true  -- Fixe Termine nicht auto-verschiebbar
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Existierenden Block aktualisieren
    UPDATE schedule_blocks SET
      title      = NEW.title,
      color      = COALESCE(NEW.color, '#6d28d9'),
      module_id  = NEW.module_id,
      start_time = v_start,
      end_time   = v_end,
      updated_at = now()
    WHERE stundenplan_id = NEW.id;

    -- Falls kein Block existiert (z.B. nach manuellem Löschen), neu erstellen
    IF NOT FOUND THEN
      INSERT INTO schedule_blocks (
        user_id, stundenplan_id, block_type, layer, title, color,
        module_id, start_time, end_time, recurrence, source, is_locked
      ) VALUES (
        NEW.user_id, NEW.id, 'lecture', 1, NEW.title,
        COALESCE(NEW.color, '#6d28d9'), NEW.module_id,
        v_start, v_end, 'weekly', 'stundenplan_sync', true
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ─── 4. Trigger auf stundenplan-Tabelle ───────────────────────────────────
DROP TRIGGER IF EXISTS trg_stundenplan_sync ON stundenplan;

CREATE TRIGGER trg_stundenplan_sync
  AFTER INSERT OR UPDATE OR DELETE ON stundenplan
  FOR EACH ROW
  EXECUTE FUNCTION sync_stundenplan_to_schedule();


-- ─── 5. Bestehende Stundenplan-Einträge initial synchronisieren ───────────
-- Alle existierenden Einträge die noch keinen schedule_block haben
DO $$
DECLARE
  v_entry record;
  v_monday date;
  v_block_date date;
  v_start timestamptz;
  v_end timestamptz;
  v_count int := 0;
BEGIN
  v_monday := CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::int + 6) % 7);

  FOR v_entry IN
    SELECT s.* FROM stundenplan s
    LEFT JOIN schedule_blocks sb ON sb.stundenplan_id = s.id
    WHERE sb.id IS NULL
  LOOP
    v_block_date := v_monday + CASE v_entry.day
      WHEN 'Mo' THEN 0 WHEN 'Di' THEN 1 WHEN 'Mi' THEN 2
      WHEN 'Do' THEN 3 WHEN 'Fr' THEN 4 WHEN 'Sa' THEN 5
      ELSE NULL
    END;

    IF v_block_date IS NOT NULL THEN
      v_start := (v_block_date + v_entry.time_start::time)::timestamptz;
      v_end   := (v_block_date + v_entry.time_end::time)::timestamptz;

      INSERT INTO schedule_blocks (
        user_id, stundenplan_id, block_type, layer, title, color,
        module_id, start_time, end_time, recurrence, source, is_locked
      ) VALUES (
        v_entry.user_id, v_entry.id, 'lecture', 1, v_entry.title,
        COALESCE(v_entry.color, '#6d28d9'), v_entry.module_id,
        v_start, v_end, 'weekly', 'stundenplan_sync', true
      )
      ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Initial sync: % Stundenplan-Einträge synchronisiert', v_count;
END;
$$;


-- ═══ MIGRATION 062: Prüfungen/Events → Schedule Blocks Auto-Sync ═══

-- ─── 1. Event-ID Spalte in schedule_blocks (falls nicht vorhanden) ────────
-- exam_id existiert bereits (Migration 054), hier nur sicherstellen
-- dass auch event_id nutzbar ist für generische Events
ALTER TABLE schedule_blocks ADD COLUMN IF NOT EXISTS
  event_id uuid REFERENCES events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_event
  ON schedule_blocks (event_id) WHERE event_id IS NOT NULL;


-- ─── 2. Trigger-Funktion: Events → Schedule Blocks ───────────────────────
CREATE OR REPLACE FUNCTION sync_exam_to_schedule()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exam_start timestamptz;
  v_exam_end timestamptz;
  v_prep_date date;
  v_prep_start timestamptz;
  v_prep_end timestamptz;
BEGIN
  -- ═══ DELETE ═══
  IF TG_OP = 'DELETE' THEN
    -- Cascade handles this via event_id FK, but explicit cleanup for exam_id
    DELETE FROM schedule_blocks
      WHERE exam_id = OLD.id AND source = 'calendar_sync';
    RETURN OLD;
  END IF;

  -- Nur für Prüfungen
  IF NEW.event_type != 'exam' THEN
    RETURN NEW;
  END IF;

  -- Prüfungszeitraum berechnen
  -- start_dt enthält Datum + Uhrzeit der Prüfung
  v_exam_start := NEW.start_dt;
  v_exam_end := COALESCE(NEW.end_dt, v_exam_start + INTERVAL '2 hours');

  -- ═══ INSERT ═══
  IF TG_OP = 'INSERT' THEN
    -- 1. Prüfungsblock erstellen (Layer 1 = fix)
    INSERT INTO schedule_blocks (
      user_id, exam_id, event_id, block_type, layer, title, color,
      module_id, start_time, end_time, source, is_locked, priority
    ) VALUES (
      NEW.user_id,
      NEW.id,
      NEW.id,
      'exam',
      1,
      COALESCE(NEW.title, 'Prüfung'),
      '#dc2626',  -- Rot für Prüfungen
      NEW.module_id,
      v_exam_start,
      v_exam_end,
      'calendar_sync',
      true,
      'critical'
    )
    ON CONFLICT DO NOTHING;

    -- 2. Vorbereitungsblock 3 Tage vorher (Layer 2 = geplant)
    v_prep_date := (v_exam_start::date - INTERVAL '3 days')::date;
    v_prep_start := (v_prep_date + TIME '14:00')::timestamptz;
    v_prep_end := (v_prep_date + TIME '16:00')::timestamptz;

    INSERT INTO schedule_blocks (
      user_id, exam_id, event_id, block_type, layer, title, color,
      module_id, start_time, end_time, source, priority, description
    ) VALUES (
      NEW.user_id,
      NEW.id,
      NEW.id,
      'exam_prep',
      2,
      'Vorbereitung: ' || COALESCE(NEW.title, 'Prüfung'),
      '#ea580c',  -- Orange für Vorbereitung
      NEW.module_id,
      v_prep_start,
      v_prep_end,
      'calendar_sync',
      'high',
      'Automatisch erstellt — 3 Tage vor Prüfung'
    )
    ON CONFLICT DO NOTHING;

  -- ═══ UPDATE ═══
  ELSIF TG_OP = 'UPDATE' THEN
    -- Prüfungsblock aktualisieren
    UPDATE schedule_blocks SET
      title      = COALESCE(NEW.title, 'Prüfung'),
      module_id  = NEW.module_id,
      start_time = v_exam_start,
      end_time   = v_exam_end,
      updated_at = now()
    WHERE exam_id = NEW.id AND block_type = 'exam' AND source = 'calendar_sync';

    -- Vorbereitungsblock aktualisieren
    v_prep_date := (v_exam_start::date - INTERVAL '3 days')::date;
    v_prep_start := (v_prep_date + TIME '14:00')::timestamptz;
    v_prep_end := (v_prep_date + TIME '16:00')::timestamptz;

    UPDATE schedule_blocks SET
      title      = 'Vorbereitung: ' || COALESCE(NEW.title, 'Prüfung'),
      module_id  = NEW.module_id,
      start_time = v_prep_start,
      end_time   = v_prep_end,
      updated_at = now()
    WHERE exam_id = NEW.id AND block_type = 'exam_prep' AND source = 'calendar_sync';

    -- Falls nach Update kein Block existiert → neu erstellen
    IF NOT FOUND THEN
      INSERT INTO schedule_blocks (
        user_id, exam_id, event_id, block_type, layer, title, color,
        module_id, start_time, end_time, source, priority, description
      ) VALUES (
        NEW.user_id, NEW.id, NEW.id, 'exam_prep', 2,
        'Vorbereitung: ' || COALESCE(NEW.title, 'Prüfung'),
        '#ea580c', NEW.module_id, v_prep_start, v_prep_end,
        'calendar_sync', 'high',
        'Automatisch erstellt — 3 Tage vor Prüfung'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ─── 3. Trigger auf events-Tabelle ───────────────────────────────────────
DROP TRIGGER IF EXISTS trg_exam_to_schedule ON events;

CREATE TRIGGER trg_exam_to_schedule
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION sync_exam_to_schedule();


-- ─── 4. Bestehende Prüfungen initial synchronisieren ─────────────────────
DO $$
DECLARE
  v_event record;
  v_exam_start timestamptz;
  v_exam_end timestamptz;
  v_prep_date date;
  v_count int := 0;
BEGIN
  FOR v_event IN
    SELECT e.* FROM events e
    WHERE e.event_type = 'exam'
      AND NOT EXISTS (
        SELECT 1 FROM schedule_blocks sb
        WHERE sb.exam_id = e.id AND sb.block_type = 'exam' AND sb.source = 'calendar_sync'
      )
  LOOP
    v_exam_start := v_event.start_dt;
    v_exam_end := COALESCE(v_event.end_dt, v_exam_start + INTERVAL '2 hours');
    v_prep_date := (v_exam_start::date - INTERVAL '3 days')::date;

    -- Prüfungsblock
    INSERT INTO schedule_blocks (
      user_id, exam_id, event_id, block_type, layer, title, color,
      module_id, start_time, end_time, source, is_locked, priority
    ) VALUES (
      v_event.user_id, v_event.id, v_event.id, 'exam', 1,
      COALESCE(v_event.title, 'Prüfung'), '#dc2626', v_event.module_id,
      v_exam_start, v_exam_end, 'calendar_sync', true, 'critical'
    )
    ON CONFLICT DO NOTHING;

    -- Vorbereitungsblock
    INSERT INTO schedule_blocks (
      user_id, exam_id, event_id, block_type, layer, title, color,
      module_id, start_time, end_time, source, priority, description
    ) VALUES (
      v_event.user_id, v_event.id, v_event.id, 'exam_prep', 2,
      'Vorbereitung: ' || COALESCE(v_event.title, 'Prüfung'), '#ea580c',
      v_event.module_id,
      (v_prep_date + TIME '14:00')::timestamptz,
      (v_prep_date + TIME '16:00')::timestamptz,
      'calendar_sync', 'high',
      'Automatisch erstellt — 3 Tage vor Prüfung'
    )
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Initial exam sync: % Prüfungen synchronisiert', v_count;
END;
$$;


-- ═══ MIGRATION 063: Study Plan Items → Schedule Blocks Auto-Sync ═══

-- ─── 1. study_plan_item_id Spalte in schedule_blocks ──────────────────────
ALTER TABLE schedule_blocks ADD COLUMN IF NOT EXISTS
  study_plan_item_id uuid;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_study_plan_item
  ON schedule_blocks (study_plan_item_id) WHERE study_plan_item_id IS NOT NULL;


-- ─── 2. Trigger-Funktion ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_study_plan_item_to_schedule()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan record;
  v_start timestamptz;
  v_end timestamptz;
  v_duration interval;
  v_block_type text;
BEGIN
  -- ═══ DELETE ═══
  IF TG_OP = 'DELETE' THEN
    DELETE FROM schedule_blocks
      WHERE study_plan_item_id = OLD.id AND source = 'study_plan';
    RETURN OLD;
  END IF;

  -- Plan-Kontext laden (für user_id und module_id)
  SELECT * INTO v_plan FROM study_plans WHERE id = NEW.study_plan_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Kein scheduled_date → keinen Block erstellen
  IF NEW.scheduled_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Dauer berechnen (Standard: 60 Minuten)
  v_duration := COALESCE(NEW.estimated_minutes, 60) * INTERVAL '1 minute';

  -- Start-/Endzeit: Standard 09:00 am geplanten Tag
  v_start := (NEW.scheduled_date + TIME '09:00')::timestamptz;
  v_end := v_start + v_duration;

  -- Block-Typ basierend auf Item-Typ
  v_block_type := CASE NEW.item_type
    WHEN 'review' THEN 'review'
    WHEN 'flashcards' THEN 'flashcards'
    WHEN 'exam_prep' THEN 'exam_prep'
    WHEN 'deep_work' THEN 'deep_work'
    ELSE 'study'
  END;

  -- ═══ INSERT ═══
  IF TG_OP = 'INSERT' THEN
    INSERT INTO schedule_blocks (
      user_id, study_plan_id, study_plan_item_id, block_type, layer,
      title, module_id, topic_id, exam_id,
      start_time, end_time, estimated_minutes,
      source, priority, description
    ) VALUES (
      v_plan.user_id,
      NEW.study_plan_id,
      NEW.id,
      v_block_type,
      2,
      COALESCE(NEW.title, 'Lerneinheit'),
      v_plan.module_id,
      NEW.topic_id,
      v_plan.exam_id,
      v_start,
      v_end,
      COALESCE(NEW.estimated_minutes, 60),
      'study_plan',
      COALESCE(NEW.priority, 'medium'),
      NEW.description
    )
    ON CONFLICT DO NOTHING;

  -- ═══ UPDATE ═══
  ELSIF TG_OP = 'UPDATE' THEN
    -- Wenn als erledigt markiert → Block auf completed setzen
    IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
      UPDATE schedule_blocks SET
        status = 'completed',
        completion_percent = 100,
        updated_at = now()
      WHERE study_plan_item_id = NEW.id AND source = 'study_plan';
      RETURN NEW;
    END IF;

    -- Sonst normal aktualisieren
    UPDATE schedule_blocks SET
      title             = COALESCE(NEW.title, 'Lerneinheit'),
      block_type        = v_block_type,
      topic_id          = NEW.topic_id,
      start_time        = v_start,
      end_time          = v_end,
      estimated_minutes = COALESCE(NEW.estimated_minutes, 60),
      priority          = COALESCE(NEW.priority, 'medium'),
      description       = NEW.description,
      updated_at        = now()
    WHERE study_plan_item_id = NEW.id AND source = 'study_plan';

    -- Falls nach Update kein Block existiert → neu erstellen
    IF NOT FOUND THEN
      INSERT INTO schedule_blocks (
        user_id, study_plan_id, study_plan_item_id, block_type, layer,
        title, module_id, topic_id, exam_id,
        start_time, end_time, estimated_minutes,
        source, priority, description
      ) VALUES (
        v_plan.user_id, NEW.study_plan_id, NEW.id, v_block_type, 2,
        COALESCE(NEW.title, 'Lerneinheit'), v_plan.module_id, NEW.topic_id,
        v_plan.exam_id, v_start, v_end,
        COALESCE(NEW.estimated_minutes, 60), 'study_plan',
        COALESCE(NEW.priority, 'medium'), NEW.description
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ─── 3. Trigger auf study_plan_items-Tabelle ─────────────────────────────
DROP TRIGGER IF EXISTS trg_study_plan_item_to_schedule ON study_plan_items;

CREATE TRIGGER trg_study_plan_item_to_schedule
  AFTER INSERT OR UPDATE OR DELETE ON study_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_study_plan_item_to_schedule();


-- ═══ MIGRATION 064: Auto Daily Stats + Missed Block Detection ═══

-- ─── 1. Auto Daily Stats nach Timer-Completion ───────────────────────────
-- Erweitert den bestehenden trg_timer_session_completed Trigger
-- (oder fügt einen neuen hinzu falls update_daily_schedule_stats existiert)

CREATE OR REPLACE FUNCTION auto_update_daily_stats_on_session()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session_date date;
BEGIN
  -- Nur bei abgeschlossenen Sessions
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Datum der Session
  v_session_date := (NEW.started_at AT TIME ZONE 'UTC')::date;

  -- Daily Stats aktualisieren (falls Funktion existiert)
  BEGIN
    PERFORM update_daily_schedule_stats(NEW.user_id, v_session_date);
  EXCEPTION WHEN undefined_function THEN
    -- Funktion existiert nicht → überspringen
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_daily_stats ON timer_sessions;

CREATE TRIGGER trg_auto_daily_stats
  AFTER UPDATE ON timer_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION auto_update_daily_stats_on_session();


-- ─── 2. Auto Missed Block Detection ──────────────────────────────────────
-- Erkennt automatisch verpasste Blöcke und markiert sie

CREATE OR REPLACE FUNCTION auto_detect_missed_blocks()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Wenn ein Block auf 'scheduled' steht und seine end_time vorbei ist
  -- → auf 'skipped' setzen (sofern nicht innerhalb der letzten 30 Min)
  IF NEW.status = 'scheduled' AND OLD.status = 'scheduled'
     AND NEW.end_time < (now() - INTERVAL '30 minutes') THEN

    -- Prüfen ob eine Timer-Session für diesen Block existiert
    IF NOT EXISTS (
      SELECT 1 FROM timer_sessions
      WHERE schedule_block_id = NEW.id AND status = 'completed'
    ) THEN
      -- Block als verpasst markieren
      NEW.status := 'skipped';
      NEW.updated_at := now();

      -- In reschedule_log eintragen (falls Tabelle existiert)
      BEGIN
        INSERT INTO reschedule_log (
          user_id, schedule_block_id, action, reason, created_at
        ) VALUES (
          NEW.user_id, NEW.id, 'auto_missed',
          'Automatisch als verpasst erkannt (Zeitfenster abgelaufen)',
          now()
        );
      EXCEPTION WHEN undefined_table THEN
        NULL; -- reschedule_log existiert nicht → überspringen
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Dieser Trigger feuert bei jedem Update auf schedule_blocks
-- (z.B. wenn der Frontend-Client die Blöcke neu lädt)
DROP TRIGGER IF EXISTS trg_auto_missed_blocks ON schedule_blocks;

CREATE TRIGGER trg_auto_missed_blocks
  BEFORE UPDATE ON schedule_blocks
  FOR EACH ROW
  WHEN (OLD.status = 'scheduled')
  EXECUTE FUNCTION auto_detect_missed_blocks();


-- ─── 3. Periodische Missed-Block-Erkennung per Funktion ──────────────────
-- Kann via Cron oder API aufgerufen werden für alle User
CREATE OR REPLACE FUNCTION check_all_missed_blocks()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Alle überfälligen geplanten Blöcke die keine Session haben
  UPDATE schedule_blocks sb SET
    status = 'skipped',
    updated_at = now()
  WHERE sb.status = 'scheduled'
    AND sb.end_time < (now() - INTERVAL '30 minutes')
    AND sb.layer = 2  -- Nur geplante Lernblöcke (nicht fixe Termine)
    AND NOT EXISTS (
      SELECT 1 FROM timer_sessions ts
      WHERE ts.schedule_block_id = sb.id AND ts.status = 'completed'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ═══ MIGRATION 065: Tasks → Schedule Blocks Auto-Sync ═══

-- ─── 1. task_id existiert bereits in schedule_blocks (Migration 054) ──────

-- ─── 2. Trigger-Funktion ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_task_to_schedule()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_duration interval;
BEGIN
  -- ═══ DELETE ═══
  IF TG_OP = 'DELETE' THEN
    DELETE FROM schedule_blocks
      WHERE task_id = OLD.id AND source = 'manual' AND block_type IN ('study', 'deep_work');
    RETURN OLD;
  END IF;

  -- Kein due_date → keinen Block erstellen/aktualisieren
  IF NEW.due_date IS NULL THEN
    -- Falls vorher ein Block existierte, entfernen
    IF TG_OP = 'UPDATE' AND OLD.due_date IS NOT NULL THEN
      DELETE FROM schedule_blocks
        WHERE task_id = NEW.id AND source = 'auto_plan';
    END IF;
    RETURN NEW;
  END IF;

  -- Dauer: geschätzte Minuten oder Standard 45 Min
  v_duration := COALESCE(NEW.estimate_minutes, 45) * INTERVAL '1 minute';

  -- Zeitfenster: 1 Tag vor due_date, Standard 10:00
  v_start := ((NEW.due_date::date - INTERVAL '1 day') + TIME '10:00')::timestamptz;
  v_end := v_start + v_duration;

  -- ═══ INSERT ═══
  IF TG_OP = 'INSERT' THEN
    INSERT INTO schedule_blocks (
      user_id, task_id, block_type, layer, title, module_id,
      start_time, end_time, estimated_minutes,
      source, priority, description
    ) VALUES (
      NEW.user_id,
      NEW.id,
      CASE WHEN COALESCE(NEW.priority, 'medium') IN ('high', 'critical') THEN 'deep_work' ELSE 'study' END,
      2,
      'Task: ' || COALESCE(NEW.title, 'Aufgabe'),
      NEW.module_id,
      v_start,
      v_end,
      COALESCE(NEW.estimate_minutes, 45),
      'auto_plan',
      COALESCE(NEW.priority, 'medium'),
      NEW.description
    )
    ON CONFLICT DO NOTHING;

  -- ═══ UPDATE ═══
  ELSIF TG_OP = 'UPDATE' THEN
    -- Task erledigt → Block completed
    IF NEW.status = 'done' AND OLD.status != 'done' THEN
      UPDATE schedule_blocks SET
        status = 'completed',
        completion_percent = 100,
        updated_at = now()
      WHERE task_id = NEW.id AND source = 'auto_plan';
      RETURN NEW;
    END IF;

    -- Normal aktualisieren
    UPDATE schedule_blocks SET
      title             = 'Task: ' || COALESCE(NEW.title, 'Aufgabe'),
      module_id         = NEW.module_id,
      start_time        = v_start,
      end_time          = v_end,
      estimated_minutes = COALESCE(NEW.estimate_minutes, 45),
      priority          = COALESCE(NEW.priority, 'medium'),
      description       = NEW.description,
      updated_at        = now()
    WHERE task_id = NEW.id AND source = 'auto_plan';

    -- Falls kein Block existiert → neu erstellen
    IF NOT FOUND AND NEW.status != 'done' THEN
      INSERT INTO schedule_blocks (
        user_id, task_id, block_type, layer, title, module_id,
        start_time, end_time, estimated_minutes,
        source, priority, description
      ) VALUES (
        NEW.user_id, NEW.id,
        CASE WHEN COALESCE(NEW.priority, 'medium') IN ('high', 'critical') THEN 'deep_work' ELSE 'study' END,
        2, 'Task: ' || COALESCE(NEW.title, 'Aufgabe'), NEW.module_id,
        v_start, v_end, COALESCE(NEW.estimate_minutes, 45),
        'auto_plan', COALESCE(NEW.priority, 'medium'), NEW.description
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ─── 3. Trigger auf tasks-Tabelle ────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_task_to_schedule ON tasks;

CREATE TRIGGER trg_task_to_schedule
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION sync_task_to_schedule();


-- ═══ MIGRATION 066: Noten-Änderung → Intelligente Reaktion ═══

-- ─── 1. Decision Engine Refresh Flag ──────────────────────────────────────
-- Einfache Tabelle die trackt welche User ein Decision-Refresh brauchen
CREATE TABLE IF NOT EXISTS decision_refresh_queue (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'grade_change',
  queued_at timestamptz NOT NULL DEFAULT now()
);


-- ─── 2. Trigger-Funktion: Noten → System-Reaktion ────────────────────────
CREATE OR REPLACE FUNCTION on_grade_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Prüfungsblock als completed markieren (falls verknüpft)
  IF NEW.exam_id IS NOT NULL THEN
    UPDATE schedule_blocks SET
      status = 'completed',
      completion_percent = 100,
      updated_at = now()
    WHERE exam_id = NEW.exam_id
      AND block_type IN ('exam', 'exam_prep')
      AND user_id = NEW.user_id;
  END IF;

  -- 2. Decision Engine Refresh einreihen
  INSERT INTO decision_refresh_queue (user_id, reason, queued_at)
  VALUES (
    NEW.user_id,
    'grade_change:' || COALESCE(NEW.module_id::text, 'unknown'),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    reason = EXCLUDED.reason,
    queued_at = EXCLUDED.queued_at;

  -- 3. Study-Pattern-Counter erhöhen (falls vorhanden)
  BEGIN
    UPDATE study_patterns SET
      total_sessions_analyzed = total_sessions_analyzed + 1,
      last_analyzed_at = now()
    WHERE user_id = NEW.user_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;


-- ─── 3. Trigger auf grades-Tabelle ───────────────────────────────────────
DROP TRIGGER IF EXISTS trg_grade_change ON grades;

CREATE TRIGGER trg_grade_change
  AFTER INSERT OR UPDATE ON grades
  FOR EACH ROW
  EXECUTE FUNCTION on_grade_change();


-- ─── 4. Hilfsfunktion: Decision Refresh prüfen ──────────────────────────
-- Wird vom Frontend (/api/decision) aufgerufen um zu prüfen
-- ob ein Refresh nötig ist
CREATE OR REPLACE FUNCTION check_decision_refresh_needed(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM decision_refresh_queue WHERE user_id = p_user_id
  ) INTO v_exists;

  -- Queue-Eintrag entfernen nach Prüfung
  IF v_exists THEN
    DELETE FROM decision_refresh_queue WHERE user_id = p_user_id;
  END IF;

  RETURN v_exists;
END;
$$;


-- ═══ MIGRATION 067: Add last_seen_at column ═══

-- Add last_seen_at column for online/offline status tracking
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT NULL;

-- Allow users to update their own last_seen_at
CREATE POLICY "Users can update own last_seen_at"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Index for efficient active-user queries (only non-null values)
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at
  ON profiles (last_seen_at)
  WHERE last_seen_at IS NOT NULL;
