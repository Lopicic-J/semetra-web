-- Push Notification Subscriptions
-- Stores Web Push API subscription endpoints per user/device

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Web Push API subscription data
  endpoint text NOT NULL,
  p256dh text NOT NULL,     -- Public key
  auth_key text NOT NULL,   -- Auth secret

  -- Preferences
  exam_warnings boolean NOT NULL DEFAULT true,
  streak_reminders boolean NOT NULL DEFAULT true,
  daily_nudge boolean NOT NULL DEFAULT true,
  task_reminders boolean NOT NULL DEFAULT false,

  -- Metadata
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);
