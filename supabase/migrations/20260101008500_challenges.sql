-- Challenges — Module-based study competitions
-- Weekly challenges where students compete on study metrics

CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  module_id uuid REFERENCES modules(id) ON DELETE SET NULL,

  -- Challenge type & metric
  challenge_type text NOT NULL DEFAULT 'study_time'
    CHECK (challenge_type IN ('study_time', 'streak', 'tasks_completed', 'flashcards_reviewed', 'topics_mastered')),
  target_value int, -- Optional target (e.g., 600 minutes)

  -- Timing
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),

  -- Settings
  max_participants smallint DEFAULT 20,
  is_public boolean NOT NULL DEFAULT false,
  invite_code text UNIQUE DEFAULT substr(md5(random()::text), 1, 8),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Progress tracking
  current_value int NOT NULL DEFAULT 0,
  rank smallint,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(challenge_id, user_id)
);

-- RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

-- Challenges: visible if public, or if user is participant/creator
CREATE POLICY "challenges_select" ON challenges FOR SELECT USING (
  is_public = true
  OR creator_id = auth.uid()
  OR id IN (SELECT challenge_id FROM challenge_participants WHERE user_id = auth.uid())
);
CREATE POLICY "challenges_insert" ON challenges FOR INSERT WITH CHECK (creator_id = auth.uid());
CREATE POLICY "challenges_update" ON challenges FOR UPDATE USING (creator_id = auth.uid());
CREATE POLICY "challenges_delete" ON challenges FOR DELETE USING (creator_id = auth.uid());

-- Participants: users can see all participants of challenges they can see
CREATE POLICY "participants_select" ON challenge_participants FOR SELECT USING (
  challenge_id IN (SELECT id FROM challenges WHERE is_public = true OR creator_id = auth.uid())
  OR user_id = auth.uid()
);
CREATE POLICY "participants_insert" ON challenge_participants FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "participants_update" ON challenge_participants FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "participants_delete" ON challenge_participants FOR DELETE USING (user_id = auth.uid());

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_challenge_participants_ranking
  ON challenge_participants(challenge_id, current_value DESC);
