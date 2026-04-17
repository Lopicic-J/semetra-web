-- ══════════════════════════════════════════════════════════════════
-- Guided Learning Sessions, Reflections, Resources, Exam Prep Plans
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Session Reflections ─────────────────────────────────────
-- Captures what the student learned, found difficult, and needs to review.
-- Linked to timer sessions for context. Feeds into Decision Engine.

CREATE TABLE IF NOT EXISTS session_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES timer_sessions(id) ON DELETE SET NULL,
  module_id uuid REFERENCES modules(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,

  -- Reflection content
  learned text,           -- "Was habe ich gelernt?"
  difficult text,         -- "Was war schwierig?"
  next_steps text,        -- "Was muss ich nochmal machen?"

  -- Self-assessment
  understanding_rating smallint CHECK (understanding_rating BETWEEN 1 AND 5),  -- 1=nichts verstanden, 5=alles klar
  confidence_rating smallint CHECK (confidence_rating BETWEEN 1 AND 5),        -- 1=unsicher, 5=prüfungsbereit
  energy_after smallint CHECK (energy_after BETWEEN 1 AND 5),                  -- 1=erschöpft, 5=motiviert

  -- Session context
  session_duration_seconds int,
  session_type text,      -- pomodoro, deep_work, free, guided

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE session_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reflections" ON session_reflections FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_reflections_user_module ON session_reflections(user_id, module_id, created_at DESC);

-- ── 2. Topic Resources ─────────────────────────────────────────
-- Links, videos, documents, and references per topic.
-- Allows students to collect all learning materials in one place.

CREATE TABLE IF NOT EXISTS topic_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id) ON DELETE SET NULL,

  -- Resource content
  title text NOT NULL,
  url text,                -- External link (video, article, etc.)
  content text,            -- Inline content (formula, note)
  resource_type text NOT NULL DEFAULT 'link'
    CHECK (resource_type IN ('link', 'video', 'article', 'formula', 'cheatsheet', 'exercise', 'slide', 'note')),

  -- Metadata
  tags text[] DEFAULT '{}',
  is_recommended boolean NOT NULL DEFAULT false,   -- Flagged as helpful by user
  view_count int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE topic_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own resources" ON topic_resources FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_resources_topic ON topic_resources(topic_id, resource_type);

-- ── 3. Exam Prep Plans ─────────────────────────────────────────
-- Structured day-by-day preparation plan generated before exams.
-- Each day has specific activities based on Decision Engine analysis.

CREATE TABLE IF NOT EXISTS exam_prep_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id uuid REFERENCES events(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id) ON DELETE SET NULL,

  -- Plan metadata
  exam_date date NOT NULL,
  plan_start_date date NOT NULL,
  total_days smallint NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),

  -- Generated plan (JSONB array of daily tasks)
  -- Each day: { date, focus, activities: [{type, title, duration_min, topic?, completed}] }
  daily_plan jsonb NOT NULL DEFAULT '[]',

  -- Progress tracking
  days_completed smallint NOT NULL DEFAULT 0,
  activities_completed smallint NOT NULL DEFAULT 0,
  activities_total smallint NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, exam_id)  -- One active plan per exam
);

ALTER TABLE exam_prep_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prep plans" ON exam_prep_plans FOR ALL USING (auth.uid() = user_id);

-- ── 4. Guided Session Templates ────────────────────────────────
-- Defines the phase structure for guided learning sessions.
-- Allows customization per learner type (DNA-based).

CREATE TABLE IF NOT EXISTS guided_session_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = system default

  name text NOT NULL,
  description text,
  total_minutes smallint NOT NULL,

  -- Phases (JSONB array)
  -- Each phase: { name, type, duration_min, description, icon }
  -- Types: review, learn, practice, test, reflect, break
  phases jsonb NOT NULL DEFAULT '[]',

  -- Targeting
  learner_type text,      -- If set, suggested for this DNA learner type
  is_default boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guided_session_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own + system templates" ON guided_session_templates FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Users manage own templates" ON guided_session_templates FOR ALL
  USING (user_id = auth.uid());

-- ── Seed default guided session templates ──────────────────────

INSERT INTO guided_session_templates (name, description, total_minutes, is_default, phases) VALUES
(
  'Ausgewogen (45 Min)',
  'Perfekte Balance aus Wiederholung, neuem Stoff, Übung und Reflexion',
  45,
  true,
  '[
    {"name": "Aufwärmen", "type": "review", "duration_min": 5, "description": "3 Flashcards vom letzten Mal wiederholen", "icon": "Brain"},
    {"name": "Neuer Stoff", "type": "learn", "duration_min": 15, "description": "Neue Inhalte lesen oder durcharbeiten", "icon": "BookOpen"},
    {"name": "Üben", "type": "practice", "duration_min": 15, "description": "2-3 Übungsaufgaben zum Thema lösen", "icon": "Target"},
    {"name": "Selbsttest", "type": "test", "duration_min": 5, "description": "Erkläre das Gelernte in eigenen Worten", "icon": "MessageCircle"},
    {"name": "Reflexion", "type": "reflect", "duration_min": 5, "description": "Was habe ich gelernt? Was war schwierig?", "icon": "PenLine"}
  ]'::jsonb
),
(
  'Intensiv (90 Min)',
  'Für lange Deep-Work Sessions mit zwei Lernblöcken und Pause',
  90,
  false,
  '[
    {"name": "Aufwärmen", "type": "review", "duration_min": 5, "description": "5 Flashcards wiederholen", "icon": "Brain"},
    {"name": "Block 1: Theorie", "type": "learn", "duration_min": 25, "description": "Neue Konzepte durcharbeiten", "icon": "BookOpen"},
    {"name": "Übung 1", "type": "practice", "duration_min": 15, "description": "Aufgaben zur Theorie lösen", "icon": "Target"},
    {"name": "Pause", "type": "break", "duration_min": 5, "description": "Aufstehen, strecken, Wasser trinken", "icon": "Coffee"},
    {"name": "Block 2: Vertiefung", "type": "learn", "duration_min": 20, "description": "Schwierige Stellen vertiefen", "icon": "BookOpen"},
    {"name": "Übung 2", "type": "practice", "duration_min": 10, "description": "Anwendungsaufgaben", "icon": "Target"},
    {"name": "Selbsttest", "type": "test", "duration_min": 5, "description": "Mock-Frage beantworten", "icon": "MessageCircle"},
    {"name": "Reflexion", "type": "reflect", "duration_min": 5, "description": "Session zusammenfassen", "icon": "PenLine"}
  ]'::jsonb
),
(
  'Quick Focus (25 Min)',
  'Kurze Pomodoro-Session mit Fokus auf eine Sache',
  25,
  false,
  '[
    {"name": "Aufwärmen", "type": "review", "duration_min": 3, "description": "2 Flashcards wiederholen", "icon": "Brain"},
    {"name": "Fokus-Block", "type": "learn", "duration_min": 15, "description": "Ein Thema intensiv bearbeiten", "icon": "BookOpen"},
    {"name": "Quick-Test", "type": "test", "duration_min": 3, "description": "Kernaussage in einem Satz", "icon": "MessageCircle"},
    {"name": "Reflexion", "type": "reflect", "duration_min": 4, "description": "Was nehme ich mit?", "icon": "PenLine"}
  ]'::jsonb
),
(
  'Prüfungsvorbereitung (60 Min)',
  'Fokus auf Praxis und Selbsttest — ideal vor Prüfungen',
  60,
  false,
  '[
    {"name": "Flashcard-Sprint", "type": "review", "duration_min": 10, "description": "Alle fälligen Karten durchgehen", "icon": "Brain"},
    {"name": "Schwächen-Fokus", "type": "learn", "duration_min": 10, "description": "Schwächste Topics nochmal durchlesen", "icon": "AlertTriangle"},
    {"name": "Mock-Prüfung", "type": "practice", "duration_min": 25, "description": "Prüfungssimulation durcharbeiten", "icon": "GraduationCap"},
    {"name": "Fehler-Analyse", "type": "learn", "duration_min": 10, "description": "Falsche Antworten verstehen", "icon": "Search"},
    {"name": "Reflexion", "type": "reflect", "duration_min": 5, "description": "Bereitschaft einschätzen", "icon": "PenLine"}
  ]'::jsonb
);

COMMENT ON TABLE session_reflections IS 'Post-session reflections capturing what was learned, difficulties, and next steps. Feeds into Decision Engine for better recommendations.';
COMMENT ON TABLE topic_resources IS 'Learning resources per topic: links, videos, formulas, cheatsheets. Central hub for all study materials.';
COMMENT ON TABLE exam_prep_plans IS 'Structured day-by-day exam preparation plans with progress tracking.';
COMMENT ON TABLE guided_session_templates IS 'Templates for guided learning sessions with phase structure (review → learn → practice → test → reflect).';
