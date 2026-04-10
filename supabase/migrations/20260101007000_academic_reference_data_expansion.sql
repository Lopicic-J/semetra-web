-- 070: Expand academic reference data
-- 1. Add institution_id to reference tables (allows custom institution entries)
-- 2. Add JP, KR, BR country data
-- 3. Refine existing country defaults based on research
-- 4. Add more retake/rounding policy variants

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Add institution_id to reference tables for custom entries
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE grade_scales      ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE pass_policies     ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE retake_policies   ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE rounding_policies ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE;

-- Add description columns for better UX
ALTER TABLE pass_policies     ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE retake_policies   ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE rounding_policies ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE grade_scales      ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN grade_scales.institution_id      IS 'NULL = global/system entry, set = institution-specific custom entry';
COMMENT ON COLUMN pass_policies.institution_id     IS 'NULL = global/system entry, set = institution-specific custom entry';
COMMENT ON COLUMN retake_policies.institution_id   IS 'NULL = global/system entry, set = institution-specific custom entry';
COMMENT ON COLUMN rounding_policies.institution_id IS 'NULL = global/system entry, set = institution-specific custom entry';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Add missing grade scales (JP, KR, BR)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO grade_scales (code, name, country_code, type, min_value, max_value, pass_value, step_size, decimal_places, higher_is_better, supports_honours, special_labels, description) VALUES
  ('JP_0_100',  'Japan 0–100 (S/A/B/C/F)',     'JP', 'numeric',    0,   100,  60,   1,   0, true,  false, '{"90":"S","80":"A","70":"B","60":"C","0":"F"}',
   'Japanische Notenskala: S(90+), A(80-89), B(70-79), C(60-69), F(<60)'),
  ('KR_0_4_5',  'South Korea GPA 0.0–4.5',     'KR', 'numeric',    0.0, 4.5,  1.0,  0.5, 1, true,  false, '{"4.5":"A+","4.0":"A","3.5":"B+","3.0":"B","2.5":"C+","2.0":"C","1.5":"D+","1.0":"D","0":"F"}',
   'Koreanische GPA-Skala mit A+ bis F'),
  ('BR_0_10',   'Brazil 0–10',                 'BR', 'numeric',    0,   10,   5.0,  0.5, 1, true,  false, '{}',
   'Brasilianische Skala: 0-10, Bestehen ab 5.0 (Bachelor) bzw. 6.0 (Master)')
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Add country systems for JP, KR, BR
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO country_systems (country_code, name, flag, default_credit_scheme_id, default_grade_scale_id, default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id, default_calendar_type, uses_honours) VALUES
  ('JP', '日本 (Japan)',         '🇯🇵',
    (SELECT id FROM credit_schemes WHERE code='LOCAL'),
    (SELECT id FROM grade_scales WHERE code='JP_0_100'),
    (SELECT id FROM rounding_policies WHERE code='ROUND_1'),
    (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'),
    (SELECT id FROM retake_policies WHERE code='DEFAULT_2_BEST'),
    'semester', false),
  ('KR', '대한민국 (South Korea)', '🇰🇷',
    (SELECT id FROM credit_schemes WHERE code='LOCAL'),
    (SELECT id FROM grade_scales WHERE code='KR_0_4_5'),
    (SELECT id FROM rounding_policies WHERE code='ROUND_01'),
    (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'),
    (SELECT id FROM retake_policies WHERE code='IMPROVE_ALLOWED'),
    'semester', false),
  ('BR', 'Brasil',               '🇧🇷',
    (SELECT id FROM credit_schemes WHERE code='LOCAL'),
    (SELECT id FROM grade_scales WHERE code='BR_0_10'),
    (SELECT id FROM rounding_policies WHERE code='ROUND_05'),
    (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'),
    (SELECT id FROM retake_policies WHERE code='DEFAULT_2_BEST'),
    'semester', false)
ON CONFLICT (country_code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Refine existing country defaults based on research
-- ═══════════════════════════════════════════════════════════════════════════════

-- Switzerland: typical is 1-2 retakes (use DEFAULT_2_BEST instead of 3)
UPDATE country_systems SET default_retake_policy_id = (SELECT id FROM retake_policies WHERE code='DEFAULT_2_BEST')
WHERE country_code = 'CH';

-- Austria: 3 retakes allowed
UPDATE country_systems SET default_retake_policy_id = (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST')
WHERE country_code = 'AT';

-- Italy: unlimited retakes, can even retake if passed
UPDATE country_systems SET default_retake_policy_id = (SELECT id FROM retake_policies WHERE code='IMPROVE_ALLOWED')
WHERE country_code = 'IT';

-- Spain: unlimited retakes, latest counts
INSERT INTO retake_policies (code, name, max_attempts, retake_if_passed, grade_replacement, description) VALUES
  ('UNLIMITED_LATEST', 'Unlimited attempts, latest counts', 99, false, 'latest_attempt', 'Unbegrenzte Versuche, letzter Versuch zählt')
ON CONFLICT (code) DO NOTHING;
UPDATE country_systems SET default_retake_policy_id = (SELECT id FROM retake_policies WHERE code='UNLIMITED_LATEST')
WHERE country_code = 'ES';

-- Netherlands: compensation model for pass policy
UPDATE country_systems SET default_pass_policy_id = (SELECT id FROM pass_policies WHERE code='THRESHOLD_PLUS_MANDATORY')
WHERE country_code = 'NL';

-- UK: 40% pass for undergrad
UPDATE country_systems SET uses_honours = true WHERE country_code = 'UK';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Add descriptions to existing policies for better UX
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE pass_policies SET description = 'Bestanden wenn Endnote ≥ Bestehensgrenze der Notenskala' WHERE code = 'SIMPLE_THRESHOLD' AND description IS NULL;
UPDATE pass_policies SET description = 'Endnote ≥ Grenze UND alle Pflichtkomponenten bestanden' WHERE code = 'THRESHOLD_PLUS_MANDATORY' AND description IS NULL;
UPDATE pass_policies SET description = 'Jede einzelne Bewertungskomponente muss bestanden sein' WHERE code = 'ALL_COMPONENTS' AND description IS NULL;
UPDATE pass_policies SET description = 'Nur Bestanden/Nicht bestanden, keine Note' WHERE code = 'PASS_FAIL' AND description IS NULL;
UPDATE pass_policies SET description = 'Schwache Ergebnisse können durch starke kompensiert werden' WHERE code = 'COMPENSATION' AND description IS NULL;

UPDATE retake_policies SET description = 'Max. 3 Versuche, bester zählt' WHERE code = 'DEFAULT_3_BEST' AND description IS NULL;
UPDATE retake_policies SET description = 'Max. 3 Versuche, letzter zählt' WHERE code = 'DEFAULT_3_LATEST' AND description IS NULL;
UPDATE retake_policies SET description = 'Max. 2 Versuche, bester zählt' WHERE code = 'DEFAULT_2_BEST' AND description IS NULL;
UPDATE retake_policies SET description = 'Unbegrenzte Versuche, bester zählt' WHERE code = 'UNLIMITED_BEST' AND description IS NULL;
UPDATE retake_policies SET description = 'Keine Wiederholung erlaubt' WHERE code = 'NO_RETAKE' AND description IS NULL;
UPDATE retake_policies SET description = 'Auch bei Bestehen wiederholbar, bester zählt' WHERE code = 'IMPROVE_ALLOWED' AND description IS NULL;
UPDATE retake_policies SET description = 'Unbegrenzte Versuche, letzter zählt' WHERE code = 'UNLIMITED_LATEST' AND description IS NULL;

UPDATE rounding_policies SET description = 'Auf 0.25 runden (z.B. 4.63 → 4.75)' WHERE code = 'ROUND_025' AND description IS NULL;
UPDATE rounding_policies SET description = 'Auf 0.5 runden (z.B. 4.63 → 4.5)' WHERE code = 'ROUND_05' AND description IS NULL;
UPDATE rounding_policies SET description = 'Auf 0.1 runden (z.B. 4.63 → 4.6)' WHERE code = 'ROUND_01' AND description IS NULL;
UPDATE rounding_policies SET description = 'Auf ganze Zahl runden (z.B. 4.6 → 5)' WHERE code = 'ROUND_1' AND description IS NULL;
UPDATE rounding_policies SET description = 'Abrunden auf 0.5 (z.B. 4.74 → 4.5)' WHERE code = 'FLOOR_05' AND description IS NULL;
UPDATE rounding_policies SET description = 'Keine Rundung (2 Dezimalstellen)' WHERE code = 'NO_ROUND' AND description IS NULL;
UPDATE rounding_policies SET description = 'Auf 0.5 runden, nur auf Zeugnis' WHERE code = 'TRANSCRIPT_05' AND description IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Add grade scale descriptions
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE grade_scales SET description = '1 (tiefste) bis 6 (beste), Bestehen ab 4.0. Schrittweite 0.25 oder 0.5.' WHERE code = 'CH_1_6' AND description IS NULL;
UPDATE grade_scales SET description = '1.0 (beste) bis 5.0 (nicht bestanden), Bestehen bis 4.0. Schritte: 0.3.' WHERE code = 'DE_1_5' AND description IS NULL;
UPDATE grade_scales SET description = '1 (Sehr gut) bis 5 (Nicht genügend), Bestehen bis 4 (Genügend).' WHERE code = 'AT_1_5' AND description IS NULL;
UPDATE grade_scales SET description = '0 bis 20, Bestehen ab 10. Mention: 12=AB, 14=B, 16=TB.' WHERE code = 'FR_0_20' AND description IS NULL;
UPDATE grade_scales SET description = '18 bis 30 e lode, Bestehen ab 18. 30L = Auszeichnung.' WHERE code = 'IT_18_30_LODE' AND description IS NULL;
UPDATE grade_scales SET description = '1 bis 10, Bestehen ab 5.5 (6.0 gerundet). Dezimalschritte.' WHERE code = 'NL_1_10' AND description IS NULL;
UPDATE grade_scales SET description = '0 bis 10, Bestehen ab 5.0. Matrícula de Honor ab 9.0.' WHERE code = 'ES_0_10' AND description IS NULL;
UPDATE grade_scales SET description = '0–100%, Bestehen ab 40% (UG) / 50% (PG). First=70%+.' WHERE code = 'UK_PERCENTAGE' AND description IS NULL;
UPDATE grade_scales SET description = 'GPA 0.0–4.0. A=4.0, B=3.0, C=2.0, D=1.0, F=0.' WHERE code = 'US_GPA' AND description IS NULL;
UPDATE grade_scales SET description = 'A–F (ECTS-Skala). Bestehen ab E.' WHERE code = 'SE_A_F' AND description IS NULL;
UPDATE grade_scales SET description = '2 bis 5, Bestehen ab 3.0. Halbe Schritte (3.5, 4.5).' WHERE code = 'PL_2_5' AND description IS NULL;
UPDATE grade_scales SET description = '1 (výborně) bis 4 (dostatečně), Nicht bestanden = 4+.' WHERE code = 'CZ_1_4' AND description IS NULL;
UPDATE grade_scales SET description = '7-Stufen: -3, 00, 02, 4, 7, 10, 12. Bestehen ab 02.' WHERE code = 'DK_M3_12' AND description IS NULL;
UPDATE grade_scales SET description = '0 bis 5, Bestehen ab 1. 50% = Note 1.' WHERE code = 'FI_0_5' AND description IS NULL;
UPDATE grade_scales SET description = '0 bis 20, Bestehen ab 10.' WHERE code = 'PT_0_20' AND description IS NULL;
UPDATE grade_scales SET description = '0 bis 20, Bestehen ab 10. Wie Frankreich.' WHERE code = 'BE_0_20' AND description IS NULL;
UPDATE grade_scales SET description = 'A–F (ECTS-Skala). Bestehen ab E.' WHERE code = 'NO_A_F' AND description IS NULL;
