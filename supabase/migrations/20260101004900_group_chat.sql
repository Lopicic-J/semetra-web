-- Group Messages for real-time chat
CREATE TABLE IF NOT EXISTS group_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  reply_to uuid REFERENCES group_messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_group_messages_group ON group_messages(group_id, created_at DESC);
CREATE INDEX idx_group_messages_user ON group_messages(user_id);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- Members can read messages in their groups
DO $$ BEGIN
CREATE POLICY "Members can read group messages" ON group_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM study_group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Members can insert messages
DO $$ BEGIN
CREATE POLICY "Members can send group messages" ON group_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM study_group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users can update their own messages
DO $$ BEGIN
CREATE POLICY "Users can edit own messages" ON group_messages
  FOR UPDATE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users can delete their own messages, admins can delete any
DO $$ BEGIN
CREATE POLICY "Users can delete own messages" ON group_messages
  FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM study_group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
