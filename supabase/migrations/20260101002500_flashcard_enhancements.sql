-- 025: Flashcard enhancements — card types, tags, stats tracking
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS card_type text NOT NULL DEFAULT 'basic';
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS choices jsonb;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS streak integer NOT NULL DEFAULT 0;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS total_reviews integer NOT NULL DEFAULT 0;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS correct_count integer NOT NULL DEFAULT 0;
