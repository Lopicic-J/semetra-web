-- Add last_seen_at column for online/offline status tracking
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT NULL;

-- Allow users to update their own last_seen_at
CREATE POLICY "Users can update own last_seen_at"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Index for efficient active-user queries (only non-null values)
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at
  ON profiles (last_seen_at)
  WHERE last_seen_at IS NOT NULL;
