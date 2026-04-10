-- ═══════════════════════════════════════════════════════════════
-- Migration 062: Prüfungen/Events → Schedule Blocks Auto-Sync
--
-- Wenn eine Prüfung (event_type='exam') erstellt oder geändert wird:
--   1. Erstellt automatisch einen "exam" Block am Prüfungstag (Layer 1)
--   2. Erstellt einen "exam_prep" Block 3 Tage vorher (Layer 2, Vorschlag)
-- Wenn eine Prüfung gelöscht wird → verknüpfte Blöcke werden entfernt
-- ═══════════════════════════════════════════════════════════════

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
