-- ═══════════════════════════════════════════════════════════════
-- Migration 066: Noten-Änderung → Intelligente Reaktion
--
-- Wenn eine Note eingetragen/geändert wird:
--   1. Markiert das zugehörige Prüfungs-Block als completed
--   2. Aktualisiert study_patterns für den User
--   3. Setzt einen "refresh needed" Flag für Decision Engine
-- ═══════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════
-- ERGEBNIS:
-- - Noten-Änderungen markieren Prüfungsblöcke als erledigt
-- - Decision Engine wird zum Refresh aufgefordert
-- - Frontend kann per RPC check_decision_refresh_needed() prüfen
-- ═══════════════════════════════════════════════════════════════
