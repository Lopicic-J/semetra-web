-- ── Notiz-Rubriken (Kategorien) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS note_categories (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  color       text DEFAULT '#6d28d9',
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE note_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "note_categories_own" ON note_categories FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_note_categories_user ON note_categories(user_id);

-- Rubrik-Verknüpfung auf Notizen
ALTER TABLE notes ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES note_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category_id);
