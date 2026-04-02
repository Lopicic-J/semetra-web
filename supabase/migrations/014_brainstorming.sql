-- ── Brainstorming Sessions & Ideas ──────────────────────────────────
CREATE TABLE IF NOT EXISTS brainstorm_sessions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL DEFAULT 'Brainstorming',
  module_id   uuid REFERENCES modules(id) ON DELETE SET NULL,
  exam_id     uuid REFERENCES events(id) ON DELETE SET NULL,
  task_id     uuid REFERENCES tasks(id) ON DELETE SET NULL,
  technique   text NOT NULL DEFAULT 'freeform',
  color       text DEFAULT '#6d28d9',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE brainstorm_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brainstorm_sessions_own" ON brainstorm_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS brainstorm_ideas (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id  uuid REFERENCES brainstorm_sessions(id) ON DELETE CASCADE NOT NULL,
  content     text NOT NULL DEFAULT '',
  category    text DEFAULT '',
  color       text DEFAULT '#6d28d9',
  pos_x       real DEFAULT 0,
  pos_y       real DEFAULT 0,
  votes       integer DEFAULT 0,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE brainstorm_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brainstorm_ideas_own" ON brainstorm_ideas FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_brainstorm_ideas_session ON brainstorm_ideas(session_id);
