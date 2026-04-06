-- ============================================================
-- Migration 053: Plugin Purchases & Monetization
-- ============================================================
-- Pricing model:
--   - Institution-affiliated Pro users → all plugins FREE
--   - External (non-institution) users → CHF 1.90 per plugin
--   - Free users → no access to premium plugins
-- ============================================================

-- ── 1. Extend plugins table with pricing ────────────────────
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'free'
  CHECK (pricing_type IN ('free', 'premium'));
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS price_chf numeric(5,2) DEFAULT 0;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS requires_pro boolean NOT NULL DEFAULT false;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS legal_disclaimer text;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS third_party_name text;         -- e.g. 'Google', 'Notion', 'Moodle'
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS third_party_terms_url text;    -- link to 3rd party TOS
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS data_processing_note text;     -- DSG/GDPR note
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'coming_soon'
  CHECK (status IN ('active', 'coming_soon', 'beta', 'deprecated'));

-- ── 2. Plugin purchases tracking ────────────────────────────
CREATE TABLE IF NOT EXISTS plugin_purchases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id       text NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  amount_chf      numeric(5,2) NOT NULL DEFAULT 1.90,
  currency        text NOT NULL DEFAULT 'CHF',
  status          text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  granted_via     text NOT NULL DEFAULT 'purchase'
    CHECK (granted_via IN ('purchase', 'institution', 'promo', 'admin')),
  institution_id  uuid,                                   -- if granted via institution
  purchased_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, plugin_id)                              -- one purchase per user per plugin
);

ALTER TABLE plugin_purchases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='plugin_purchases' AND policyname='purchases_own') THEN
    CREATE POLICY purchases_own ON plugin_purchases FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plugin_purchases_user ON plugin_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_purchases_plugin ON plugin_purchases(plugin_id);

-- ── 3. Helper: Check if user can access a plugin ────────────
CREATE OR REPLACE FUNCTION can_access_plugin(p_user_id uuid, p_plugin_id text)
RETURNS boolean AS $$
DECLARE
  v_plugin plugins%ROWTYPE;
  v_profile RECORD;
  v_purchased boolean;
BEGIN
  -- Get plugin
  SELECT * INTO v_plugin FROM plugins WHERE id = p_plugin_id AND active = true;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Free plugins are always accessible
  IF v_plugin.pricing_type = 'free' THEN RETURN true; END IF;

  -- Get user profile
  SELECT plan, institution_id INTO v_profile FROM profiles WHERE id = p_user_id;

  -- Must be Pro for premium plugins
  IF v_profile.plan != 'pro' THEN RETURN false; END IF;

  -- Institution users get all plugins free
  IF v_profile.institution_id IS NOT NULL THEN RETURN true; END IF;

  -- Check if purchased
  SELECT EXISTS (
    SELECT 1 FROM plugin_purchases
    WHERE user_id = p_user_id AND plugin_id = p_plugin_id AND status = 'completed'
  ) INTO v_purchased;

  RETURN v_purchased;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Auto-grant institution plugins ───────────────────────
-- When a user sets their institution_id, auto-grant all premium plugins
CREATE OR REPLACE FUNCTION auto_grant_institution_plugins()
RETURNS trigger AS $$
BEGIN
  IF NEW.institution_id IS NOT NULL AND
     (OLD.institution_id IS NULL OR OLD.institution_id != NEW.institution_id) AND
     NEW.plan = 'pro' THEN

    INSERT INTO plugin_purchases (user_id, plugin_id, amount_chf, status, granted_via, institution_id)
    SELECT NEW.id, p.id, 0, 'completed', 'institution', NEW.institution_id
    FROM plugins p
    WHERE p.pricing_type = 'premium' AND p.active = true
    ON CONFLICT (user_id, plugin_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_grant_institution_plugins ON profiles;
CREATE TRIGGER trg_auto_grant_institution_plugins
  AFTER UPDATE OF institution_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION auto_grant_institution_plugins();

-- ── 5. Update existing plugins with pricing & legal info ────
UPDATE plugins SET
  pricing_type = 'premium',
  price_chf = 1.90,
  requires_pro = true,
  status = 'coming_soon',
  third_party_name = 'Google',
  third_party_terms_url = 'https://developers.google.com/terms',
  data_processing_note = 'Semetra greift via OAuth auf deinen Google Calendar zu. Deine Daten werden ausschliesslich lokal und in deinem Semetra-Konto gespeichert. Semetra gibt keine Daten an Dritte weiter.',
  legal_disclaimer = 'Dieses Plugin nutzt die öffentliche Google Calendar API. Semetra ist kein offizieller Google-Partner. Google und Google Calendar sind Marken der Google LLC.'
WHERE id = 'calendar-sync';

UPDATE plugins SET
  pricing_type = 'premium',
  price_chf = 1.90,
  requires_pro = true,
  status = 'coming_soon',
  third_party_name = 'Notion',
  third_party_terms_url = 'https://www.notion.so/Terms-and-Privacy-28ffee083dc3473e9c2da6ec011b58ac',
  data_processing_note = 'Semetra greift via Notion-API auf deine Workspaces zu. Importierte Inhalte werden nur in deinem Semetra-Konto gespeichert.',
  legal_disclaimer = 'Dieses Plugin nutzt die öffentliche Notion API. Semetra ist kein offizieller Notion-Partner. Notion ist eine Marke der Notion Labs, Inc.'
WHERE id = 'notion-import';

UPDATE plugins SET
  pricing_type = 'premium',
  price_chf = 1.90,
  requires_pro = true,
  status = 'coming_soon',
  third_party_name = 'Moodle',
  third_party_terms_url = 'https://moodle.org/mod/page/view.php?id=8835',
  data_processing_note = 'Semetra verbindet sich mit der Moodle-Instanz deiner Hochschule via REST-API. Dein Moodle-Token wird verschlüsselt gespeichert und nie an Dritte weitergegeben.',
  legal_disclaimer = 'Dieses Plugin nutzt die öffentliche Moodle REST-API. Moodle ist Open-Source-Software (GPL). Semetra ist kein offizieller Moodle-Partner.'
WHERE id = 'moodle-sync';

UPDATE plugins SET
  pricing_type = 'premium',
  price_chf = 1.90,
  requires_pro = true,
  status = 'coming_soon',
  third_party_name = 'ILIAS',
  third_party_terms_url = 'https://www.ilias.de/docu/',
  data_processing_note = 'Semetra verbindet sich mit deiner ILIAS-Instanz via REST-API. Dein Token wird verschlüsselt gespeichert.',
  legal_disclaimer = 'Dieses Plugin nutzt die öffentliche ILIAS REST-API. ILIAS ist Open-Source-Software (GPL). Semetra ist kein offizieller ILIAS-Partner.'
WHERE id = 'ilias-sync';

UPDATE plugins SET
  pricing_type = 'premium',
  price_chf = 1.90,
  requires_pro = true,
  status = 'coming_soon',
  third_party_name = 'Canvas (Instructure)',
  third_party_terms_url = 'https://www.instructure.com/policies/acceptable-use',
  data_processing_note = 'Semetra greift via Canvas REST-API auf deine Kurse zu. Importierte Daten werden nur in deinem Semetra-Konto gespeichert.',
  legal_disclaimer = 'Dieses Plugin nutzt die öffentliche Canvas LMS API. Canvas ist eine Marke der Instructure, Inc. Semetra ist kein offizieller Instructure-Partner.'
WHERE id = 'canvas-sync';

-- Free plugins (no purchase needed)
UPDATE plugins SET
  pricing_type = 'free',
  price_chf = 0,
  requires_pro = false,
  status = 'active'
WHERE id IN ('grade-export', 'pomodoro-plus');

UPDATE plugins SET
  pricing_type = 'free',
  price_chf = 0,
  requires_pro = true,
  status = 'coming_soon',
  data_processing_note = 'Study Buddy verwendet anonymisierte Profildaten. Dein vollständiger Name wird nur mit deiner Zustimmung angezeigt.'
WHERE id = 'study-buddy';

-- ── 6. Plugin Terms of Service acceptance tracking ──────────
CREATE TABLE IF NOT EXISTS plugin_tos_acceptance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id   text NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  tos_version text NOT NULL DEFAULT '1.0',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address  text,
  UNIQUE(user_id, plugin_id, tos_version)
);

ALTER TABLE plugin_tos_acceptance ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='plugin_tos_acceptance' AND policyname='tos_own') THEN
    CREATE POLICY tos_own ON plugin_tos_acceptance FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
