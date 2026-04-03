-- Add country field to profiles for grading system selection
-- Valid: CH, DE, AT, FR, IT, NL, ES, UK (default: null → treated as CH)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country text DEFAULT null;
