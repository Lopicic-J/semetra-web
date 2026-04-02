-- ── Link topics to exams for exam-specific knowledge tracking ────────
-- Allows students to track knowledge per exam, not just per module
ALTER TABLE topics ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES events(id) ON DELETE SET NULL;

-- Index for fast lookup by exam
CREATE INDEX IF NOT EXISTS idx_topics_exam ON topics(exam_id);

-- When an exam date has passed, auto-mark related topics as "understood"
-- This is a function that can be called periodically or on-demand
CREATE OR REPLACE FUNCTION complete_exam_topics()
RETURNS void AS $$
BEGIN
  UPDATE topics
  SET status = 'understood'
  WHERE exam_id IN (
    SELECT id FROM events
    WHERE event_type = 'exam'
      AND start_dt < now()
  )
  AND status != 'understood';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
