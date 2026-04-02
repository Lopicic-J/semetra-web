-- ── Mind Maps ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mindmaps (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL DEFAULT 'Neue Mind Map',
  module_id   uuid REFERENCES modules(id) ON DELETE SET NULL,
  exam_id     uuid REFERENCES events(id) ON DELETE SET NULL,
  task_id     uuid REFERENCES tasks(id) ON DELETE SET NULL,
  layout_mode text NOT NULL DEFAULT 'tree',  -- 'tree' | 'free'
  color       text DEFAULT '#6d28d9',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE mindmaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mindmaps_own" ON mindmaps FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Mind Map Nodes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mindmap_nodes (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mindmap_id  uuid REFERENCES mindmaps(id) ON DELETE CASCADE NOT NULL,
  parent_id   uuid REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT '',
  notes       text DEFAULT '',
  color       text DEFAULT '#6d28d9',
  icon        text DEFAULT '',              -- emoji or lucide icon name
  pos_x       real DEFAULT 0,              -- free-mode position
  pos_y       real DEFAULT 0,
  collapsed   boolean DEFAULT false,
  sort_order  integer DEFAULT 0,
  -- Attachments inline (links/urls)
  links       jsonb DEFAULT '[]',           -- [{label, url}]
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE mindmap_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mindmap_nodes_own" ON mindmap_nodes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_mindmap_nodes_map ON mindmap_nodes(mindmap_id);
CREATE INDEX idx_mindmap_nodes_parent ON mindmap_nodes(parent_id);
