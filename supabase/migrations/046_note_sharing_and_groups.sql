-- ============================================================
-- Migration 046: Note Sharing & Study Groups
-- ============================================================
-- Adds:
--   1. note_shares        — per-note sharing with permission levels
--   2. document_shares    — per-document sharing
--   3. study_groups       — collaborative study groups
--   4. study_group_members — group membership with roles
--   5. share_links        — public share tokens for anonymous access
--   6. Updated RLS on notes + documents to allow shared access
-- ============================================================

-- ── 1. note_shares ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS note_shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission  text NOT NULL DEFAULT 'viewer' CHECK (permission IN ('viewer','editor')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(note_id, shared_with)
);

ALTER TABLE note_shares ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='note_shares' AND policyname='note_shares_owner_all') THEN
    CREATE POLICY note_shares_owner_all ON note_shares FOR ALL
      USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='note_shares' AND policyname='note_shares_recipient_read') THEN
    CREATE POLICY note_shares_recipient_read ON note_shares FOR SELECT
      USING (auth.uid() = shared_with);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_note_shares_note ON note_shares(note_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_shared_with ON note_shares(shared_with);

-- ── 2. document_shares ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission  text NOT NULL DEFAULT 'viewer' CHECK (permission IN ('viewer','editor')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, shared_with)
);

ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='document_shares' AND policyname='doc_shares_owner_all') THEN
    CREATE POLICY doc_shares_owner_all ON document_shares FOR ALL
      USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='document_shares' AND policyname='doc_shares_recipient_read') THEN
    CREATE POLICY doc_shares_recipient_read ON document_shares FOR SELECT
      USING (auth.uid() = shared_with);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_doc_shares_document ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_shared_with ON document_shares(shared_with);

-- ── 3. study_groups (table only, policies after members table) ──
CREATE TABLE IF NOT EXISTS study_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  color       text NOT NULL DEFAULT '#6d28d9',
  invite_code text UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  max_members int NOT NULL DEFAULT 20,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;

-- ── 4. study_group_members (must exist before study_groups policies) ──
CREATE TABLE IF NOT EXISTS study_group_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE study_group_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_group_members_group ON study_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON study_group_members(user_id);

-- ── 3b. study_groups RLS policies (now that members table exists) ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_groups' AND policyname='groups_member_read') THEN
    CREATE POLICY groups_member_read ON study_groups FOR SELECT
      USING (
        auth.uid() = owner_id
        OR EXISTS (SELECT 1 FROM study_group_members WHERE group_id = study_groups.id AND user_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_groups' AND policyname='groups_owner_modify') THEN
    CREATE POLICY groups_owner_modify ON study_groups FOR ALL
      USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

-- ── 4b. study_group_members RLS policies ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_group_members' AND policyname='group_members_self_read') THEN
    CREATE POLICY group_members_self_read ON study_group_members FOR SELECT
      USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM study_group_members m2 WHERE m2.group_id = study_group_members.group_id AND m2.user_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_group_members' AND policyname='group_members_admin_manage') THEN
    CREATE POLICY group_members_admin_manage ON study_group_members FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM study_group_members m2
          WHERE m2.group_id = study_group_members.group_id
            AND m2.user_id = auth.uid()
            AND m2.role IN ('owner','admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM study_group_members m2
          WHERE m2.group_id = study_group_members.group_id
            AND m2.user_id = auth.uid()
            AND m2.role IN ('owner','admin')
        )
      );
  END IF;
END $$;

-- Owner auto-insert trigger: when group is created, add owner as member
CREATE OR REPLACE FUNCTION auto_add_group_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO study_group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_add_group_owner ON study_groups;
CREATE TRIGGER trg_auto_add_group_owner
  AFTER INSERT ON study_groups
  FOR EACH ROW EXECUTE FUNCTION auto_add_group_owner();

-- ── 5. share_links (public token-based sharing) ─────────────
CREATE TABLE IF NOT EXISTS share_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('note','document')),
  resource_id uuid NOT NULL,
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  permission  text NOT NULL DEFAULT 'viewer' CHECK (permission IN ('viewer','editor')),
  expires_at  timestamptz,
  view_count  int NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='share_links' AND policyname='share_links_owner_all') THEN
    CREATE POLICY share_links_owner_all ON share_links FOR ALL
      USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_share_links_resource ON share_links(resource_type, resource_id);

-- ── 6. Group note/document sharing ──────────────────────────
-- Notes and documents shared with a group
CREATE TABLE IF NOT EXISTS group_shares (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('note','document')),
  resource_id   uuid NOT NULL,
  shared_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, resource_type, resource_id)
);

ALTER TABLE group_shares ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_shares' AND policyname='group_shares_member_read') THEN
    CREATE POLICY group_shares_member_read ON group_shares FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM study_group_members WHERE group_id = group_shares.group_id AND user_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_shares' AND policyname='group_shares_sharer_manage') THEN
    CREATE POLICY group_shares_sharer_manage ON group_shares FOR ALL
      USING (auth.uid() = shared_by) WITH CHECK (auth.uid() = shared_by);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_group_shares_group ON group_shares(group_id);

-- ── 7. Extend RLS on notes to allow shared access ──────────
-- Add SELECT policy for shared notes (keeps existing owner policy intact)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='notes_shared_read') THEN
    CREATE POLICY notes_shared_read ON notes FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM note_shares WHERE note_id = notes.id AND shared_with = auth.uid())
        OR EXISTS (
          SELECT 1 FROM group_shares gs
          JOIN study_group_members sgm ON sgm.group_id = gs.group_id
          WHERE gs.resource_type = 'note' AND gs.resource_id = notes.id AND sgm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Add UPDATE policy for editors on shared notes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='notes_shared_edit') THEN
    CREATE POLICY notes_shared_edit ON notes FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM note_shares WHERE note_id = notes.id AND shared_with = auth.uid() AND permission = 'editor')
      );
  END IF;
END $$;

-- ── 8. Extend RLS on documents for shared access ───────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='documents' AND policyname='documents_shared_read') THEN
    CREATE POLICY documents_shared_read ON documents FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM document_shares WHERE document_id = documents.id AND shared_with = auth.uid())
        OR EXISTS (
          SELECT 1 FROM group_shares gs
          JOIN study_group_members sgm ON sgm.group_id = gs.group_id
          WHERE gs.resource_type = 'document' AND gs.resource_id = documents.id AND sgm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 9. Profile visibility for discovery ─────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'profile_visibility'
  ) THEN
    ALTER TABLE profiles ADD COLUMN profile_visibility text NOT NULL DEFAULT 'private'
      CHECK (profile_visibility IN ('public','private'));
  END IF;
END $$;

-- Public profile lookup function (safe — only public fields)
CREATE OR REPLACE FUNCTION lookup_public_profile(lookup_username text)
RETURNS TABLE(id uuid, username text, full_name text, avatar_url text, university text) AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.username, p.full_name, p.avatar_url, p.university
    FROM profiles p
    WHERE p.username = lookup_username
      AND p.profile_visibility = 'public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 10. updated_at trigger for study_groups ─────────────────
DROP TRIGGER IF EXISTS set_updated_at_study_groups ON study_groups;
CREATE TRIGGER set_updated_at_study_groups
  BEFORE UPDATE ON study_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
