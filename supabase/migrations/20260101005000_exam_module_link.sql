-- ============================================================
-- Migration 050: Exam-Module Link
-- ============================================================
-- Adds module_id to events table to directly link exams to modules.
-- Previously, exam-module relationships had to be inferred via
-- topics, grades, or title matching — unreliable and slow.
--
-- This is a critical requirement for the Decision Engine which
-- needs fast, direct exam-module lookups.
-- ============================================================

-- 1. Add module_id column to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE SET NULL;

-- 2. Create index for fast module-based exam queries
CREATE INDEX IF NOT EXISTS idx_events_module_id ON events(module_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_module_type ON events(module_id, event_type) WHERE event_type = 'exam';

-- 3. Backfill: Link existing exams to modules via grades
UPDATE events e
SET module_id = g.module_id
FROM grades g
WHERE g.exam_id = e.id
  AND g.module_id IS NOT NULL
  AND e.module_id IS NULL
  AND e.event_type = 'exam';

-- 4. Backfill: Link remaining exams via topics
UPDATE events e
SET module_id = t.module_id
FROM topics t
WHERE t.exam_id = e.id
  AND t.module_id IS NOT NULL
  AND e.module_id IS NULL
  AND e.event_type = 'exam';

-- 5. Backfill: Link remaining exams via module.exam_date matching
UPDATE events e
SET module_id = m.id
FROM modules m
WHERE m.exam_date IS NOT NULL
  AND m.user_id = e.user_id
  AND DATE(m.exam_date) = DATE(e.start_dt)
  AND e.module_id IS NULL
  AND e.event_type = 'exam';

-- 6. Enable RLS (events should already have RLS, but ensure policy covers new column)
-- No new policy needed — existing user_id-based policies already cover this.

-- 7. Add composite index for Decision Engine queries
CREATE INDEX IF NOT EXISTS idx_events_user_exam_module
  ON events(user_id, event_type, module_id)
  WHERE event_type = 'exam';
