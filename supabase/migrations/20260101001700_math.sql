-- 017 – Mathe-Raum: Berechnungsverlauf & Formel-Sammlung
-- Run in Supabase SQL Editor

-- Berechnungsverlauf (History)
CREATE TABLE IF NOT EXISTS math_history (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tool        text NOT NULL DEFAULT 'calculator',   -- calculator | equations | matrices | plotter | statistics | units | formulas
  expression  text NOT NULL DEFAULT '',
  result      text NOT NULL DEFAULT '',
  label       text DEFAULT NULL,
  module_id   uuid REFERENCES modules(id) ON DELETE SET NULL,
  exam_id     uuid REFERENCES events(id) ON DELETE SET NULL,
  pinned      boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE math_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "math_history_own" ON math_history FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_math_history_user ON math_history(user_id);
CREATE INDEX idx_math_history_module ON math_history(module_id);

-- Formel-Sammlung (eigene gespeicherte Formeln)
CREATE TABLE IF NOT EXISTS math_formulas (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL DEFAULT '',
  formula     text NOT NULL DEFAULT '',
  category    text NOT NULL DEFAULT 'allgemein', -- analysis, lineare_algebra, statistik, physik, etc.
  description text DEFAULT '',
  module_id   uuid REFERENCES modules(id) ON DELETE SET NULL,
  tags        text[] DEFAULT '{}',
  pinned      boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE math_formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "math_formulas_own" ON math_formulas FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_math_formulas_user ON math_formulas(user_id);
CREATE INDEX idx_math_formulas_category ON math_formulas(category);
