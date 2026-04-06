-- ═══════════════════════════════════════════════════════════════
-- Migration 064: Auto Daily Stats + Missed Block Detection
--
-- 1. Daily Stats werden automatisch aktualisiert wenn eine
--    Timer-Session abgeschlossen wird
-- 2. Verpasste Blöcke werden automatisch erkannt wenn
--    ein Block-Zeitfenster abgelaufen ist
-- ═══════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════
-- ERGEBNIS:
-- - Daily Stats werden automatisch aktualisiert bei Session-Completion
-- - Verpasste Blöcke werden bei Updates automatisch erkannt
-- - check_all_missed_blocks() kann periodisch aufgerufen werden
-- ═══════════════════════════════════════════════════════════════
