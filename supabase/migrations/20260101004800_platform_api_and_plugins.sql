-- ============================================================
-- Migration 048: Platform API Keys & Plugin System
-- ============================================================

-- ── 1. api_keys — Developer API access ──────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  key_hash    text NOT NULL,                         -- SHA-256 hash of the key (never store plaintext)
  key_prefix  text NOT NULL,                         -- First 8 chars for identification: "sk_xxxx..."
  scopes      text[] NOT NULL DEFAULT '{"read"}',    -- e.g. read, write, modules, grades, notes
  rate_limit  int NOT NULL DEFAULT 100,              -- requests per minute
  last_used   timestamptz,
  expires_at  timestamptz,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_keys' AND policyname='api_keys_own') THEN
    CREATE POLICY api_keys_own ON api_keys FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- ── 2. api_usage_log — Rate limiting & analytics ────────────
CREATE TABLE IF NOT EXISTS api_usage_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id  uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  method      text NOT NULL,
  status_code int NOT NULL,
  response_ms int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_usage_log' AND policyname='api_log_own') THEN
    CREATE POLICY api_log_own ON api_usage_log FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM api_keys WHERE id = api_usage_log.api_key_id AND user_id = auth.uid())
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_log_key_time ON api_usage_log(api_key_id, created_at DESC);

-- Auto-cleanup: partition by month (optional, comment out if not needed)
-- CREATE INDEX IF NOT EXISTS idx_api_log_created ON api_usage_log(created_at);

-- ── 3. plugins — Installable extensions ─────────────────────
CREATE TABLE IF NOT EXISTS plugins (
  id          text PRIMARY KEY,                      -- e.g. "moodle-sync", "notion-import"
  name        text NOT NULL,
  description text,
  author      text NOT NULL,
  version     text NOT NULL DEFAULT '1.0.0',
  icon_url    text,
  homepage    text,
  category    text NOT NULL DEFAULT 'integration' CHECK (category IN (
    'integration','productivity','analytics','social','theme','other'
  )),
  config_schema jsonb,                               -- JSON Schema for plugin settings
  permissions text[] NOT NULL DEFAULT '{}',           -- Required scopes
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 4. user_plugins — Plugin installations per user ─────────
CREATE TABLE IF NOT EXISTS user_plugins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id   text NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  enabled     boolean NOT NULL DEFAULT true,
  config      jsonb NOT NULL DEFAULT '{}',           -- User-specific plugin settings
  installed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, plugin_id)
);

ALTER TABLE user_plugins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_plugins' AND policyname='user_plugins_own') THEN
    CREATE POLICY user_plugins_own ON user_plugins FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_plugins_user ON user_plugins(user_id);

-- ── 5. webhooks — Event-driven integrations ─────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url         text NOT NULL,
  secret      text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events      text[] NOT NULL DEFAULT '{}',          -- e.g. grade.created, task.completed
  active      boolean NOT NULL DEFAULT true,
  last_triggered timestamptz,
  failure_count int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='webhooks' AND policyname='webhooks_own') THEN
    CREATE POLICY webhooks_own ON webhooks FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 6. Seed initial plugin catalog ──────────────────────────
INSERT INTO plugins (id, name, description, author, version, category, permissions) VALUES
  ('moodle-sync',    'Moodle Sync',        'Synchronisiere Module und Noten mit Moodle LMS.',         'Semetra',  '1.0.0', 'integration',  '{"read","write","modules","grades"}'),
  ('ilias-sync',     'ILIAS Sync',         'Verbinde dein ILIAS-Konto mit Semetra.',                  'Semetra',  '1.0.0', 'integration',  '{"read","write","modules"}'),
  ('canvas-sync',    'Canvas LMS Sync',    'Import von Kursen und Aufgaben aus Canvas.',               'Semetra',  '1.0.0', 'integration',  '{"read","write","modules","tasks"}'),
  ('notion-import',  'Notion Import',      'Importiere Notizen und Dokumente aus Notion.',             'Semetra',  '1.0.0', 'productivity', '{"read","write","notes"}'),
  ('calendar-sync',  'Google Calendar',    'Bidirektionale Synchronisation mit Google Calendar.',      'Semetra',  '1.0.0', 'integration',  '{"read","write","calendar"}'),
  ('pomodoro-plus',  'Pomodoro Plus',      'Erweiterte Pomodoro-Technik mit anpassbaren Intervallen.', 'Semetra',  '1.0.0', 'productivity', '{"read","time_logs"}'),
  ('grade-export',   'Notenexport',        'Exportiere Noten als CSV, PDF oder Excel.',                'Semetra',  '1.0.0', 'analytics',    '{"read","grades"}'),
  ('study-buddy',    'Study Buddy',        'Finde Lernpartner an deiner Hochschule.',                  'Semetra',  '1.0.0', 'social',       '{"read","profile"}')
ON CONFLICT (id) DO NOTHING;

-- ── 7. updated_at trigger for plugins ───────────────────────
DROP TRIGGER IF EXISTS set_updated_at_plugins ON plugins;
CREATE TRIGGER set_updated_at_plugins
  BEFORE UPDATE ON plugins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 8. Rate limit check function ────────────────────────────
CREATE OR REPLACE FUNCTION check_api_rate_limit(p_key_prefix text)
RETURNS TABLE(allowed boolean, remaining int, key_id uuid, owner_id uuid) AS $$
DECLARE
  v_key api_keys%ROWTYPE;
  v_count int;
BEGIN
  -- Find key
  SELECT * INTO v_key FROM api_keys
  WHERE key_prefix = p_key_prefix AND active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- Check expiry
  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    RETURN QUERY SELECT false, 0, v_key.id, v_key.user_id;
    RETURN;
  END IF;

  -- Count requests in last minute
  SELECT COUNT(*) INTO v_count FROM api_usage_log
  WHERE api_key_id = v_key.id AND created_at > now() - interval '1 minute';

  IF v_count >= v_key.rate_limit THEN
    RETURN QUERY SELECT false, 0, v_key.id, v_key.user_id;
    RETURN;
  END IF;

  -- Update last_used
  UPDATE api_keys SET last_used = now() WHERE id = v_key.id;

  RETURN QUERY SELECT true, (v_key.rate_limit - v_count - 1), v_key.id, v_key.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
