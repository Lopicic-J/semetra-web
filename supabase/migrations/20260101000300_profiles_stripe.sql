-- ============================================================
-- 003_profiles_stripe.sql
-- User profiles with plan + Stripe billing fields
-- Run in Supabase SQL Editor
-- ============================================================

-- Profiles table (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id                          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email                       text,
  full_name                   text,
  avatar_url                  text,
  plan                        text NOT NULL DEFAULT 'free',  -- 'free' | 'pro'
  stripe_customer_id          text UNIQUE,
  stripe_subscription_id      text UNIQUE,
  stripe_subscription_status  text,  -- 'active' | 'canceled' | 'past_due' | 'trialing'
  stripe_price_id             text,
  plan_expires_at             timestamptz,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own profile"   ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

CREATE POLICY "Users view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role (webhooks) can update plan fields
CREATE POLICY "Service role full access"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile when user registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    'free'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: check if user is pro
CREATE OR REPLACE FUNCTION public.is_pro(user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT plan = 'pro' AND (
      stripe_subscription_status = 'active' OR
      stripe_subscription_status = 'trialing' OR
      plan_expires_at > now()
    )
    FROM profiles WHERE id = user_id),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
