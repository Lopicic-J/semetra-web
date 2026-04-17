-- Adaptive Decision Engine Weight Profiles
-- Stores per-user learned weights based on correlation analysis
-- between risk factors and actual grade outcomes.

CREATE TABLE IF NOT EXISTS decision_weight_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Learned weights (normalized to sum = 100)
  exam_proximity_weight smallint NOT NULL DEFAULT 35,
  grade_risk_weight smallint NOT NULL DEFAULT 25,
  task_urgency_weight smallint NOT NULL DEFAULT 15,
  activity_gap_weight smallint NOT NULL DEFAULT 10,
  knowledge_gap_weight smallint NOT NULL DEFAULT 15,

  -- Analysis metadata
  modules_analyzed smallint NOT NULL DEFAULT 0,
  confidence numeric(4,2) NOT NULL DEFAULT 0, -- 0-1, higher = more data
  semester_label text, -- e.g. "HS2026"

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id) -- One active profile per user
);

ALTER TABLE decision_weight_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own weight profiles"
  ON decision_weight_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own weight profiles"
  ON decision_weight_profiles FOR ALL
  USING (auth.uid() = user_id);

COMMENT ON TABLE decision_weight_profiles IS
  'Per-user adaptive weights for Decision Engine priority scoring. '
  'Updated via correlation analysis between factor scores and grade outcomes.';
