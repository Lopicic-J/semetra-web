-- ============================================================
-- Migration 051: Fix RLS infinite recursion on study_group_members
-- ============================================================
-- Problem: Policies on study_group_members reference the same table,
-- causing "infinite recursion detected in policy" errors.
--
-- Solution: Create SECURITY DEFINER helper functions that bypass RLS
-- when checking membership, then rewrite policies to use them.
-- ============================================================

-- ── 1. Helper function: check if user is a member of a group ──
CREATE OR REPLACE FUNCTION is_group_member(gid uuid, uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM study_group_members
    WHERE group_id = gid AND user_id = uid
  );
$$;

-- ── 2. Helper function: check if user is owner or admin of a group ──
CREATE OR REPLACE FUNCTION is_group_admin(gid uuid, uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM study_group_members
    WHERE group_id = gid AND user_id = uid AND role IN ('owner', 'admin')
  );
$$;

-- ── 3. Drop the problematic self-referencing policies ──
DROP POLICY IF EXISTS group_members_self_read ON study_group_members;
DROP POLICY IF EXISTS group_members_admin_manage ON study_group_members;

-- ── 4. Recreate policies using the SECURITY DEFINER functions ──

-- Members can see all members in their groups
CREATE POLICY group_members_self_read ON study_group_members
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_group_member(group_id)
  );

-- Owners and admins can manage members
CREATE POLICY group_members_admin_manage ON study_group_members
  FOR ALL
  USING (is_group_admin(group_id))
  WITH CHECK (is_group_admin(group_id));

-- ── 5. Also fix study_groups read policy (references study_group_members) ──
DROP POLICY IF EXISTS groups_member_read ON study_groups;

CREATE POLICY groups_member_read ON study_groups
  FOR SELECT
  USING (
    auth.uid() = owner_id
    OR is_group_member(id)
  );

-- ── 6. Fix group_messages policies (they reference study_group_members too) ──
DROP POLICY IF EXISTS "Members can read group messages" ON group_messages;
DROP POLICY IF EXISTS "Members can send group messages" ON group_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON group_messages;

CREATE POLICY "Members can read group messages" ON group_messages
  FOR SELECT
  USING (is_group_member(group_id));

CREATE POLICY "Members can send group messages" ON group_messages
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND is_group_member(group_id)
  );

CREATE POLICY "Users can delete own messages" ON group_messages
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR is_group_admin(group_id)
  );

-- ── 7. Fix group_shares policies (they reference study_group_members too) ──
DROP POLICY IF EXISTS group_shares_member_read ON group_shares;

CREATE POLICY group_shares_member_read ON group_shares
  FOR SELECT
  USING (is_group_member(group_id));

-- ── 8. Allow any authenticated user to INSERT into study_group_members ──
-- (needed for joining groups via invite code — the join API runs as the user)
-- The join route already validates the invite code server-side.
CREATE POLICY group_members_self_insert ON study_group_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
