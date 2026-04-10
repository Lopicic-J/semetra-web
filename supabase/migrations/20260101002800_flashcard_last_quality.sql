-- Track the last rating quality (0-3) given to a flashcard
-- 0 = Nochmal (Fail), 1 = Schwer (Hard), 2 = Gut (Good), 3 = Perfekt (Perfect)
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS last_quality smallint DEFAULT NULL;
