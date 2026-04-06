-- 056: Module source tracking & soft-delete for institution modules
-- Adds fields to distinguish institution-imported vs manually-created modules
-- and support soft-delete so institution modules can be hidden & restored.

-- Source: where the module came from
ALTER TABLE modules ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
-- studiengang_id: links back to the institution programme template
ALTER TABLE modules ADD COLUMN IF NOT EXISTS studiengang_id UUID REFERENCES studiengaenge(id) ON DELETE SET NULL;
-- hidden_at: soft-delete timestamp (null = visible, set = hidden by student)
ALTER TABLE modules ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ DEFAULT NULL;
-- institution_modules_loaded: flag on profile so auto-import only runs once
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS institution_modules_loaded BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_modules_source ON modules(source);
CREATE INDEX IF NOT EXISTS idx_modules_hidden ON modules(hidden_at) WHERE hidden_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_modules_studiengang ON modules(studiengang_id) WHERE studiengang_id IS NOT NULL;

COMMENT ON COLUMN modules.source IS 'institution = imported from Studiengang template, manual = created by student';
COMMENT ON COLUMN modules.hidden_at IS 'Soft-delete: set when student hides an institution module, null = visible';
COMMENT ON COLUMN modules.studiengang_id IS 'Links to studiengaenge template this module was imported from';
COMMENT ON COLUMN profiles.institution_modules_loaded IS 'True after institution modules were auto-loaded for this student';
