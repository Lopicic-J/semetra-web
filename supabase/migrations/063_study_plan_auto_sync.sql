-- ═══════════════════════════════════════════════════════════════
-- Migration 063: Study Plan Items → Schedule Blocks Auto-Sync
--
-- Wenn ein Study-Plan-Item erstellt/aktualisiert wird:
--   - Erstellt automatisch einen schedule_block (Layer 2)
--   - Nutzt das scheduled_date + geschätzte Dauer
-- Wenn ein Item als erledigt markiert wird → Block completed
-- Wenn ein Item gelöscht wird → Block entfernt
-- ═══════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════
-- ERGEBNIS: Study-Plan-Items werden automatisch als Layer-2-Blöcke
-- im Schedule angelegt. Änderungen und Completion propagieren.
-- ═══════════════════════════════════════════════════════════════
