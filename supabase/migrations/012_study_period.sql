-- ── Optional study period in user profile ────────────────────────────
-- Allows students to track how long their degree program lasts
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS study_start date DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS study_end date DEFAULT NULL;
