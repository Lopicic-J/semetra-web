-- ── Notizen ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL DEFAULT 'Neue Notiz',
  content     text NOT NULL DEFAULT '',
  module_id   uuid REFERENCES modules(id) ON DELETE SET NULL,
  exam_id     uuid REFERENCES events(id) ON DELETE SET NULL,
  task_id     uuid REFERENCES tasks(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'draft',
  color       text DEFAULT '#6d28d9',
  pinned      boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_own" ON notes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_module ON notes(module_id);

-- ── Checklisten-Items innerhalb einer Notiz ─────────────────────────
CREATE TABLE IF NOT EXISTS note_checklist_items (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  note_id     uuid REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  content     text NOT NULL DEFAULT '',
  checked     boolean DEFAULT false,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE note_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "note_checklist_own" ON note_checklist_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_note_checklist_note ON note_checklist_items(note_id);
