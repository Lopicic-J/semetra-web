-- ═══════════════════════════════════════════════════════════════════════════════
-- 044: AI Usage Tracking, Profile Columns & Chat History
--
-- Creates:
--   1. plan_tier + ai_credits columns on profiles (referenced by code, missing in DB)
--   2. ai_usage table for server-side weighted credit tracking
--   3. check_and_increment_ai() RPC for atomic metering
--   4. chat_conversations + chat_messages tables for persistent history
--   5. RLS policies for all new tables
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. PROFILE COLUMNS (plan_tier, ai_credits)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT 'basic';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_credits integer DEFAULT 0;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. AI USAGE TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_usage (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month          text NOT NULL,            -- '2026-04'
  used           integer NOT NULL DEFAULT 0,
  addon_credits  integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE (user_id, month)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month ON ai_usage (user_id, month);

-- RLS
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ai_usage_select_own') THEN
    CREATE POLICY ai_usage_select_own ON ai_usage FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ai_usage_insert_own') THEN
    CREATE POLICY ai_usage_insert_own ON ai_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ai_usage_update_own') THEN
    CREATE POLICY ai_usage_update_own ON ai_usage FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Service role bypass for RPC
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ai_usage_service_all') THEN
    CREATE POLICY ai_usage_service_all ON ai_usage FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. ATOMIC AI USAGE CHECK + INCREMENT (RPC)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_and_increment_ai(
  p_user_id     uuid,
  p_month       text,
  p_monthly_pool integer,
  p_weight      integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_used          integer;
  v_addon         integer;
  v_remaining     integer;
  v_allowed       boolean;
  v_source        text;
BEGIN
  -- Upsert: create row if not exists
  INSERT INTO ai_usage (user_id, month, used, addon_credits)
  VALUES (p_user_id, p_month, 0, 0)
  ON CONFLICT (user_id, month) DO NOTHING;

  -- Lock the row for atomic update
  SELECT used, addon_credits INTO v_used, v_addon
  FROM ai_usage
  WHERE user_id = p_user_id AND month = p_month
  FOR UPDATE;

  -- Check pool first
  IF v_used + p_weight <= p_monthly_pool THEN
    v_allowed := true;
    v_source := 'pool';
    v_used := v_used + p_weight;

    UPDATE ai_usage SET used = v_used, updated_at = now()
    WHERE user_id = p_user_id AND month = p_month;

  -- Check add-on credits
  ELSIF v_addon >= p_weight THEN
    v_allowed := true;
    v_source := 'addon';
    v_addon := v_addon - p_weight;
    v_used := v_used + p_weight;

    UPDATE ai_usage
    SET used = v_used, addon_credits = v_addon, updated_at = now()
    WHERE user_id = p_user_id AND month = p_month;

  ELSE
    v_allowed := false;
    v_source := 'none';
  END IF;

  v_remaining := GREATEST(0, (p_monthly_pool - v_used)) + v_addon;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'used', v_used,
    'remaining', v_remaining,
    'source', v_source,
    'monthly_pool', p_monthly_pool,
    'addon_credits', v_addon
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. CHAT CONVERSATIONS & MESSAGES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_conversations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Neues Gespräch',
  mode        text NOT NULL DEFAULT 'chat',  -- 'chat' | 'explain' | 'quiz' | 'summarize' | 'study_plan' | 'module_advice'
  context     jsonb DEFAULT '{}',            -- module, exam, topic references
  message_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL,  -- 'user' | 'assistant' | 'system'
  content         text NOT NULL,
  tokens_used     integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages (conversation_id, created_at ASC);

-- RLS for chat_conversations
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_conv_select_own') THEN
    CREATE POLICY chat_conv_select_own ON chat_conversations FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_conv_insert_own') THEN
    CREATE POLICY chat_conv_insert_own ON chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_conv_update_own') THEN
    CREATE POLICY chat_conv_update_own ON chat_conversations FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_conv_delete_own') THEN
    CREATE POLICY chat_conv_delete_own ON chat_conversations FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- RLS for chat_messages (via conversation ownership)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_msg_select_own') THEN
    CREATE POLICY chat_msg_select_own ON chat_messages FOR SELECT
      USING (EXISTS (SELECT 1 FROM chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_msg_insert_own') THEN
    CREATE POLICY chat_msg_insert_own ON chat_messages FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_msg_delete_own') THEN
    CREATE POLICY chat_msg_delete_own ON chat_messages FOR DELETE
      USING (EXISTS (SELECT 1 FROM chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
  END IF;
END $$;

-- Service role bypass for server-side operations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_conv_service_all') THEN
    CREATE POLICY chat_conv_service_all ON chat_conversations FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_msg_service_all') THEN
    CREATE POLICY chat_msg_service_all ON chat_messages FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

COMMIT;
