-- ═══════════════════════════════════════════════════════════════════
-- Migration 080: Notification Center
-- Phase 4 — Performance System
-- Persistent notifications, daily nudges, weekly briefing triggers
-- ═══════════════════════════════════════════════════════════════════

-- ── notifications table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Automation reference
  type          text NOT NULL CHECK (type IN (
    'exam_warning', 'grade_alert', 'study_nudge', 'streak_celebration',
    'task_reminder', 'knowledge_review', 'milestone_reached', 'risk_escalation',
    'daily_nudge', 'weekly_briefing', 'system'
  )),
  priority      text NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  dedupe_key    text,                         -- Prevent duplicates

  -- Content
  title         text NOT NULL,
  message       text NOT NULL,
  module_id     uuid REFERENCES modules(id) ON DELETE SET NULL,
  module_name   text,
  module_color  text,

  -- Action
  action_label  text,
  action_href   text,

  -- State
  is_read       boolean NOT NULL DEFAULT false,
  is_dismissed  boolean NOT NULL DEFAULT false,
  read_at       timestamptz,
  dismissed_at  timestamptz,

  -- Metadata for nudges
  metadata      jsonb DEFAULT '{}',           -- Extra data (study minutes, exam days, etc.)

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate notifications
  UNIQUE(user_id, dedupe_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read, is_dismissed, created_at DESC)
  WHERE is_dismissed = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users insert own notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_notification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = now();
  END IF;
  IF NEW.is_dismissed = true AND OLD.is_dismissed = false THEN
    NEW.dismissed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_timestamp_trigger
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();

-- ── daily_nudge_log: Track when nudges were sent ────────────────
CREATE TABLE IF NOT EXISTS daily_nudge_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nudge_date  date NOT NULL,
  nudge_data  jsonb NOT NULL DEFAULT '{}',   -- Full nudge payload for debugging
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, nudge_date)
);

ALTER TABLE daily_nudge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own nudge log"
  ON daily_nudge_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own nudge log"
  ON daily_nudge_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── Helper: Cleanup old notifications (keep 90 days) ───────────
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE created_at < now() - interval '90 days'
    AND is_dismissed = true;

  DELETE FROM notifications
  WHERE created_at < now() - interval '180 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Helper: Get unread notification count ──────────────────────
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM notifications
    WHERE user_id = p_user_id
      AND is_read = false
      AND is_dismissed = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
