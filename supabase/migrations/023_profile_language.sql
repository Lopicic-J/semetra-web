-- Add language preference to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'de';

-- Update existing users: derive language from country if set
UPDATE profiles SET language = CASE
  WHEN country IN ('CH', 'DE', 'AT') THEN 'de'
  WHEN country = 'FR' THEN 'fr'
  WHEN country = 'IT' THEN 'it'
  WHEN country = 'NL' THEN 'nl'
  WHEN country = 'ES' THEN 'es'
  WHEN country = 'UK' THEN 'en'
  ELSE 'de'
END
WHERE language IS NULL OR language = 'de';
