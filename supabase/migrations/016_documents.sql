-- ── Dokumente / Links Verzeichnis ───────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title         text NOT NULL DEFAULT '',
  kind          text NOT NULL DEFAULT 'link',
  url           text NOT NULL DEFAULT '',
  file_type     text DEFAULT NULL,
  file_size     integer DEFAULT 0,
  storage_path  text DEFAULT NULL,
  module_id     uuid REFERENCES modules(id) ON DELETE SET NULL,
  exam_id       uuid REFERENCES events(id) ON DELETE SET NULL,
  task_id       uuid REFERENCES tasks(id) ON DELETE SET NULL,
  tags          text[] DEFAULT '{}',
  color         text DEFAULT '#6d28d9',
  pinned        boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_own" ON documents FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_module ON documents(module_id);
