-- 068: Add max_retakes column to modules table
-- Tracks how many times a student can retake a module (when is_repeatable = true)

ALTER TABLE modules ADD COLUMN IF NOT EXISTS max_retakes integer DEFAULT NULL;

COMMENT ON COLUMN modules.max_retakes IS 'Maximum number of retake attempts allowed (NULL = unlimited, only relevant when is_repeatable = true)';
