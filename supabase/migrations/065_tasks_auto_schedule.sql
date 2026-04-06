-- ═══════════════════════════════════════════════════════════════
-- Migration 065: Tasks → Schedule Blocks Auto-Sync
--
-- Wenn ein Task mit due_date erstellt/aktualisiert wird:
--   - Erstellt einen schedule_block (Layer 2, study/deep_work)
--   - Nutzt due_date als Zeitpunkt, geschätzte Dauer als Blockgrösse
-- Wenn ein Task erledigt wird → Block completed
-- Wenn ein Task gelöscht wird → Block entfernt
-- ═══════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════
-- ERGEBNIS: Tasks mit due_date werden automatisch als Layer-2
-- Blöcke eingeplant. Erledigte Tasks → Blöcke completed.
-- ═══════════════════════════════════════════════════════════════
