-- Module Intelligence — Extended module metadata for smarter recommendations

ALTER TABLE modules ADD COLUMN IF NOT EXISTS exam_format text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS textbook text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS lecture_rhythm text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS learning_recommendation text;
-- Note: module_type already exists with values like 'pflicht', 'wahlpflicht'
-- So we use 'learning_type' for the learning method classification.
ALTER TABLE modules ADD COLUMN IF NOT EXISTS learning_type text DEFAULT 'mixed'
  CHECK (learning_type IN ('theory', 'math', 'programming', 'language', 'project', 'mixed'));

COMMENT ON COLUMN modules.exam_format IS 'E.g. "60% MC, 40% offene Fragen"';
COMMENT ON COLUMN modules.textbook IS 'Recommended textbook title';
COMMENT ON COLUMN modules.lecture_rhythm IS 'E.g. "2x/Woche Mo+Mi 10:00-12:00"';
COMMENT ON COLUMN modules.learning_recommendation IS 'AI-generated or manual study method suggestion';
COMMENT ON COLUMN modules.learning_type IS 'Determines which learning methods the Decision Engine recommends';
