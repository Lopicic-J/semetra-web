-- ============================================================
-- 004_sync_support.sql
-- Add updated_at timestamps to all tables for sync support
-- Add license_codes table for legacy key-based activation
-- Run in Supabase SQL Editor after 003_profiles_stripe.sql
-- ============================================================

-- ── Add updated_at to all syncable tables ─────────────────────────────────

-- modules already has created_at, add updated_at
ALTER TABLE modules ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- tasks already has updated_at

-- events
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- time_logs
ALTER TABLE time_logs ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- topics already has updated_at from 002

-- grades
ALTER TABLE grades ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- stundenplan
ALTER TABLE stundenplan ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- module_scraped_data
ALTER TABLE module_scraped_data ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();


-- ── Auto-update triggers for updated_at ───────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all sync tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['modules', 'tasks', 'events', 'time_logs', 'topics', 'grades', 'stundenplan', 'module_scraped_data']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
      tbl
    );
  END LOOP;
END $$;


-- ── license_codes table (for legacy SOAPP key activation) ─────────────────

CREATE TABLE IF NOT EXISTS license_codes (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        text NOT NULL UNIQUE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used        boolean DEFAULT false,
  used_at     timestamptz,
  machine_id  text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE license_codes ENABLE ROW LEVEL SECURITY;

-- Service role can manage all codes (for webhook)
CREATE POLICY "Service role manages codes"
  ON license_codes FOR ALL
  USING (auth.role() = 'service_role');

-- Users can view their own activated codes
CREATE POLICY "Users view own codes"
  ON license_codes FOR SELECT
  USING (auth.uid() = user_id);


-- ── Add realtime support for sync ────────────────────────────────────────

DO $$
BEGIN
  -- Add tables to realtime (ignore errors if already added)
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE time_logs; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE topics; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE grades; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stundenplan; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;


-- ── Profiles: add desktop sync fields ────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_desktop_sync timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS desktop_machine_id text;


-- ── Helper function: check sync eligibility ──────────────────────────────

CREATE OR REPLACE FUNCTION public.can_sync(user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT
      plan = 'pro' AND (
        stripe_subscription_status IN ('active', 'trialing') OR
        plan_expires_at > now()
      )
    FROM profiles WHERE id = user_id),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
