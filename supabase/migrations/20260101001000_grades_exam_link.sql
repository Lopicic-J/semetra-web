-- ── Link grades to exams + optional ECTS per grade ──────────────────
-- Allows multiple exams per module, each graded separately
ALTER TABLE grades ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS ects_earned real DEFAULT NULL;

-- Make grade optional (student can enter grade, ECTS, or both)
-- grade already allows any number, we just allow NULL now
ALTER TABLE grades ALTER COLUMN grade DROP NOT NULL;

-- Index for fast lookup by exam
CREATE INDEX IF NOT EXISTS idx_grades_exam ON grades(exam_id);
