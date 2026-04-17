-- ══════════════════════════════════════════════════════════════════
-- Learning Hub (cached AI content) + Exam Relevance System
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Learning Hub Cache ──────────────────────────────────────
-- Stores AI-generated learning content per module.
-- Generated once, cached for reuse. Can be regenerated on demand.

CREATE TABLE IF NOT EXISTS learning_hub_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,

  -- AI-generated content (JSONB for flexibility)
  overview jsonb,           -- { summary, prerequisites, learningGoals, realWorldUse }
  topic_guide jsonb,        -- [{ title, explanation, relevance, difficulty, order }]
  concept_cards jsonb,      -- [{ title, definition, example, application, difficulty }]
  quick_start jsonb,        -- { topThree: [...], recommendedOrder: [...], tips: [...] }

  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, module_id)
);

ALTER TABLE learning_hub_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own learning hub" ON learning_hub_cache FOR ALL USING (auth.uid() = user_id);

-- ── 2. Exam Relevance on Topics ────────────────────────────────
-- Students can mark topics as exam-relevant. Decision Engine uses this.

ALTER TABLE topics ADD COLUMN IF NOT EXISTS is_exam_relevant boolean NOT NULL DEFAULT false;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS exam_relevance_note text;

-- ── 3. Exam Notes on Modules ──────────────────────────────────
-- Dozent-specific notes: "Kapitel 3-7", "MC + offene Fragen", etc.

ALTER TABLE modules ADD COLUMN IF NOT EXISTS exam_notes text;

COMMENT ON TABLE learning_hub_cache IS 'AI-generated learning content per module — overview, concept cards, topic guide. Cached for reuse.';
COMMENT ON COLUMN topics.is_exam_relevant IS 'Student-curated: true if this topic is relevant for the upcoming exam';
COMMENT ON COLUMN topics.exam_relevance_note IS 'Optional note: "Kapitel 5", "nicht in Prüfung", "Schwerpunkt"';
COMMENT ON COLUMN modules.exam_notes IS 'Dozent-specific exam info: format, allowed tools, chapters, etc.';
