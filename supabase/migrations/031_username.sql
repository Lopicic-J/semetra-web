-- ═══════════════════════════════════════════════════════════════
-- 031: Username support
-- Adds unique username to profiles + RPC for username→email lookup
-- ═══════════════════════════════════════════════════════════════

-- Add username column (unique, lowercase)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;

-- Unique index (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON profiles (lower(username))
  WHERE username IS NOT NULL;

-- Constraint: only lowercase letters, numbers, underscores, hyphens; 3–30 chars
ALTER TABLE profiles ADD CONSTRAINT username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_-]{3,30}$');

-- RPC: resolve username to email for login (no auth required)
-- Returns only the email, nothing else — safe for login flow
CREATE OR REPLACE FUNCTION public.get_email_by_username(lookup_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_email text;
BEGIN
  SELECT au.email INTO found_email
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE lower(p.username) = lower(lookup_username);

  RETURN found_email;
END;
$$;

-- Allow anonymous + authenticated calls
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;
