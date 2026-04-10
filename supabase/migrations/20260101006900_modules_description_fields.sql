-- 069: Split module description into 4 structured text blocks
-- description (already exists) = Modulbeschreibung
-- learning_objectives = Lernziele
-- module_contents = Inhalte
-- remarks = Bemerkungen

ALTER TABLE modules ADD COLUMN IF NOT EXISTS learning_objectives text DEFAULT NULL;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS module_contents     text DEFAULT NULL;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS remarks             text DEFAULT NULL;

COMMENT ON COLUMN modules.learning_objectives IS 'Lernziele: was Studierende nach Abschluss können';
COMMENT ON COLUMN modules.module_contents     IS 'Inhalte: Themen, Kapitel, Schwerpunkte';
COMMENT ON COLUMN modules.remarks             IS 'Bemerkungen: zusätzliche Hinweise, Literatur etc.';
