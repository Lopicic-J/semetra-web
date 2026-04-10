-- Semetra Web — Flashcards (Karteikarten) table
-- Run this in the Supabase SQL Editor

-- ── flashcards: Karteikarten mit Spaced Repetition ──────────────────────────
CREATE TABLE IF NOT EXISTS flashcards (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  module_id         uuid REFERENCES modules(id) ON DELETE SET NULL,
  exam_id           uuid REFERENCES events(id) ON DELETE SET NULL,
  knowledge_id      uuid,
  deck_name         text NOT NULL DEFAULT 'Standard',
  front             text NOT NULL,
  back              text NOT NULL,
  source            text NOT NULL DEFAULT 'user',        -- 'user' | 'ai'
  source_document   text,                                 -- filename for AI-generated cards
  ease_factor       numeric NOT NULL DEFAULT 2.5,
  interval_days     integer NOT NULL DEFAULT 0,
  repetitions       integer NOT NULL DEFAULT 0,
  next_review       timestamptz,
  last_reviewed     timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Row-level security
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flashcards_own" ON flashcards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_flashcards_user ON flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_module ON flashcards(module_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON flashcards(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON flashcards(user_id, deck_name);
