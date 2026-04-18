-- Add exam_id to session_reflections for exam-focused guided sessions
-- Allows tracking which exam a reflection was related to

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_reflections' AND column_name = 'exam_id'
  ) THEN
    ALTER TABLE session_reflections ADD COLUMN exam_id uuid REFERENCES events(id) ON DELETE SET NULL;
    CREATE INDEX idx_session_reflections_exam ON session_reflections(exam_id) WHERE exam_id IS NOT NULL;
  END IF;
END $$;
