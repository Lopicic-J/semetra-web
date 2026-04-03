-- 020: Add plan_type column for distinguishing subscription vs lifetime
-- plan_type: 'subscription' | 'lifetime' | null (null = free/legacy)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS plan_type text DEFAULT null;

-- Backfill: existing Pro users with active subscriptions → 'subscription'
UPDATE profiles
SET plan_type = 'subscription'
WHERE plan = 'pro'
  AND stripe_subscription_id IS NOT NULL
  AND plan_type IS NULL;

-- Backfill: existing Pro users with no subscription (one-time purchase) → 'lifetime'
UPDATE profiles
SET plan_type = 'lifetime'
WHERE plan = 'pro'
  AND stripe_subscription_id IS NULL
  AND plan_type IS NULL;

COMMENT ON COLUMN profiles.plan_type IS 'subscription = recurring Stripe, lifetime = one-time purchase, null = free';
