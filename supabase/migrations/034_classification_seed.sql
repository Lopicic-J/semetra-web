-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 034: Additional classification schemes + PASS_FAIL grade bands
-- Fills gaps identified in spec audit
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Additional classification schemes for countries that support them
-- Use gen_random_uuid() for IDs and ON CONFLICT (code) for idempotency
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO classification_schemes (code, name, country_code, scheme_type, rules_json) VALUES

-- Germany: Prädikate (similar to honours in thesis context)
('DE_PRAED', 'Deutsche Prädikate', 'DE', 'predicate', '[
  {"min": 1.0, "max": 1.5, "label": "mit Auszeichnung", "short": "1"},
  {"min": 1.6, "max": 2.5, "label": "gut", "short": "2"},
  {"min": 2.6, "max": 3.5, "label": "befriedigend", "short": "3"},
  {"min": 3.6, "max": 4.0, "label": "ausreichend", "short": "4"}
]'::jsonb),

-- Netherlands: Judicium
('NL_JUDICIUM', 'Nederlands Judicium', 'NL', 'predicate', '[
  {"min": 8.0, "max": 10.0, "label": "cum laude", "short": "CL"},
  {"min": 7.0, "max": 7.99, "label": "met genoegen", "short": "MG"},
  {"min": 5.5, "max": 6.99, "label": "voldoende", "short": "V"}
]'::jsonb),

-- France: Mentions
('FR_MENTION', 'Mentions françaises', 'FR', 'predicate', '[
  {"min": 16.0, "max": 20.0, "label": "très bien", "short": "TB"},
  {"min": 14.0, "max": 15.99, "label": "bien", "short": "B"},
  {"min": 12.0, "max": 13.99, "label": "assez bien", "short": "AB"},
  {"min": 10.0, "max": 11.99, "label": "passable", "short": "P"}
]'::jsonb),

-- Austria: Same system as Germany
('AT_PRAED', 'Österreichische Prädikate', 'AT', 'predicate', '[
  {"min": 1.0, "max": 1.5, "label": "mit Auszeichnung bestanden", "short": "1"},
  {"min": 1.6, "max": 2.5, "label": "gut bestanden", "short": "2"},
  {"min": 2.6, "max": 3.5, "label": "befriedigend bestanden", "short": "3"},
  {"min": 3.6, "max": 4.0, "label": "bestanden", "short": "4"}
]'::jsonb),

-- Poland: Honours
('PL_HONOURS', 'Polskie wyróżnienia', 'PL', 'predicate', '[
  {"min": 4.5, "max": 5.0, "label": "z wyróżnieniem", "short": "WYR"},
  {"min": 3.0, "max": 4.49, "label": "bez wyróżnienia", "short": "BW"}
]'::jsonb),

-- Belgium: similar to France
('BE_MENTION', 'Mentions belges', 'BE', 'predicate', '[
  {"min": 16.0, "max": 20.0, "label": "la plus grande distinction", "short": "PGD"},
  {"min": 14.0, "max": 15.99, "label": "grande distinction", "short": "GD"},
  {"min": 12.0, "max": 13.99, "label": "distinction", "short": "D"},
  {"min": 10.0, "max": 11.99, "label": "satisfaction", "short": "S"}
]'::jsonb),

-- Portugal: Honours
('PT_HONOURS', 'Classificação portuguesa', 'PT', 'predicate', '[
  {"min": 18.0, "max": 20.0, "label": "Excelente", "short": "E"},
  {"min": 16.0, "max": 17.99, "label": "Muito Bom", "short": "MB"},
  {"min": 14.0, "max": 15.99, "label": "Bom", "short": "B"},
  {"min": 10.0, "max": 13.99, "label": "Suficiente", "short": "S"}
]'::jsonb),

-- Czech Republic: Honours
('CZ_HONOURS', 'Česká klasifikace', 'CZ', 'predicate', '[
  {"min": 1.0, "max": 1.5, "label": "s vyznamenáním", "short": "VYZ"}
]'::jsonb)

ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASS_FAIL grade bands (for modules that use pass/fail grading)
-- Use subquery to resolve grade_scale UUID from code
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, 1, 1, 'Bestanden', 'P', true, null, 1
FROM grade_scales gs WHERE gs.code = 'PASS_FAIL'
ON CONFLICT DO NOTHING;

INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, 0, 0, 'Nicht bestanden', 'F', false, null, 2
FROM grade_scales gs WHERE gs.code = 'PASS_FAIL'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Update country_systems with classification scheme references
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE country_systems SET notes = 'Classification: DE_PRAED (mit Auszeichnung / gut / befriedigend / ausreichend)'
WHERE country_code = 'DE';

UPDATE country_systems SET notes = 'Classification: NL_JUDICIUM (cum laude / met genoegen / voldoende)'
WHERE country_code = 'NL';

UPDATE country_systems SET notes = 'Classification: FR_MENTION (très bien / bien / assez bien / passable)'
WHERE country_code = 'FR';

UPDATE country_systems SET notes = 'Classification: UK_HONOURS (First / 2:1 / 2:2 / Third)'
WHERE country_code = 'UK';

UPDATE country_systems SET notes = 'Classification: AT_PRAED (mit Auszeichnung / gut / befriedigend / bestanden)'
WHERE country_code = 'AT';
