-- ═══════════════════════════════════════════════════════════════
-- Migration 061: Stundenplan → Schedule Auto-Sync
--
-- Automatische Synchronisation: Jede Änderung am Stundenplan
-- (INSERT/UPDATE/DELETE) wird sofort in schedule_blocks gespiegelt.
-- Kein manueller Import mehr nötig.
-- ═══════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════
-- ERGEBNIS: Ab jetzt wird jede Stundenplan-Änderung automatisch
-- in schedule_blocks gespiegelt. Kein manueller Import nötig.
--
-- Bestehende schedule_blocks mit source='stundenplan_import'
-- bleiben erhalten (doppelte Einträge möglich, aber harmlos
-- da sie per recurrence expandiert werden).
-- ═══════════════════════════════════════════════════════════════
