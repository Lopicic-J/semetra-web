-- ═══════════════════════════════════════════════════════════════════════════════
-- 045: Study Plans — Persistent daily study plans with progress tracking
--
-- Creates:
--   1. study_plans — User's generated study plans (per exam or general)
--   2. study_plan_items — Individual daily tasks within a plan
--   3. RLS policies for ownership
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. STUDY PLANS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS study_plans (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  exam_id         uuid REFERENCES events(id) ON DELETE SET NULL,  -- optional link to exam
  module_id       uuid REFERENCES modules(id) ON DELETE SET NULL,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  total_items     integer NOT NULL DEFAULT 0,
  completed_items integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'active',  -- 'active' | 'completed' | 'archived'
  strategy        text DEFAULT 'balanced',          -- 'balanced' | 'intensive' | 'spaced'
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_plans_user ON study_plans (user_id, status, start_date);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. STUDY PLAN ITEMS (daily tasks)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS study_plan_items (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id         uuid NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  scheduled_date  date NOT NULL,
  topic_id        uuid REFERENCES topics(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  duration_minutes integer NOT NULL DEFAULT 30,
  item_type       text NOT NULL DEFAULT 'review',  -- 'review' | 'practice' | 'flashcards' | 'summary' | 'mock_exam' | 'break'
  priority        text NOT NULL DEFAULT 'medium',   -- 'high' | 'medium' | 'low'
  completed       boolean NOT NULL DEFAULT false,
  completed_at    timestamptz,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_plan_items_plan ON study_plan_items (plan_id, scheduled_date, sort_order);
CREATE INDEX IF NOT EXISTS idx_study_plan_items_date ON study_plan_items (scheduled_date, completed);

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. RLS POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plan_items ENABLE ROW LEVEL SECURITY;

-- study_plans: user owns their plans
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'study_plans_select_own') THEN
    CREATE POLICY study_plans_select_own ON study_plans FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'study_plans_insert_own') THEN
    CREATE POLICY study_plans_insert_own ON study_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'study_plans_update_own') THEN
    CREATE POLICY study_plans_update_own ON study_plans FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'study_plans_delete_own') THEN
    CREATE POLICY study_plans_delete_own ON study_plans FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- study_plan_items: via plan ownership
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'study_plan_items_select_own') THEN
    CREATE POLICY study_plan_items_select_own ON study_plan_items FOR SELECT
      USING (EXISTS (SELECT 1 FROM study_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'study_plan_items_insert_own') THEN
    CREATE POLICY study_plan_items_insert_own ON study_plan_items FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM study_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'study_plan_items_update_own') THEN
    CREATE POLICY study_plan_items_update_own ON study_plan_items FOR UPDATE
      USING (EXISTS (SELECT 1 FROM study_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'study_plan_items_delete_own') THEN
    CREATE POLICY study_plan_items_delete_own ON study_plan_items FOR DELETE
      USING (EXISTS (SELECT 1 FROM study_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));
  END IF;
END $$;

COMMIT;
