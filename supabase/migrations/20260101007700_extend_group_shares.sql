-- ── Extend group_shares to support module, exam, flashcard_deck sharing ──

-- Drop and recreate the CHECK constraint to allow more resource types
ALTER TABLE group_shares DROP CONSTRAINT IF EXISTS group_shares_resource_type_check;
ALTER TABLE group_shares ADD CONSTRAINT group_shares_resource_type_check
  CHECK (resource_type IN ('note', 'document', 'module', 'exam', 'flashcard_deck'));

-- Add optional metadata column for display purposes (resource name, color, etc.)
ALTER TABLE group_shares ADD COLUMN IF NOT EXISTS resource_name text;
ALTER TABLE group_shares ADD COLUMN IF NOT EXISTS resource_meta jsonb DEFAULT '{}';
