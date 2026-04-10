-- ═══════════════════════════════════════════════════════════════════════════════
-- 033: Grade Bands Seed Data
-- Qualitative labels for all grade scales
-- ═══════════════════════════════════════════════════════════════════════════════

-- Switzerland CH 1–6
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (5.5, 6.0,  'Sehr gut',       'A',  true,  'summa_cum_laude', 1),
  (5.0, 5.49, 'Gut',            'B',  true,  'magna_cum_laude', 2),
  (4.5, 4.99, 'Befriedigend',   'C',  true,  'cum_laude',       3),
  (4.0, 4.49, 'Genügend',       'D',  true,  null,              4),
  (1.0, 3.99, 'Ungenügend',     'F',  false, null,              5)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'CH_1_6'
ON CONFLICT DO NOTHING;

-- Germany DE 1.0–5.0 (lower is better)
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (1.0, 1.5, 'Sehr gut',        '1',  true,  'summa_cum_laude', 1),
  (1.6, 2.5, 'Gut',             '2',  true,  'magna_cum_laude', 2),
  (2.6, 3.5, 'Befriedigend',    '3',  true,  'cum_laude',       3),
  (3.6, 4.0, 'Ausreichend',     '4',  true,  null,              4),
  (4.1, 5.0, 'Nicht bestanden', '5',  false, null,              5)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'DE_1_5'
ON CONFLICT DO NOTHING;

-- Austria AT 1–5 (lower is better)
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (1, 1, 'Sehr gut',       '1', true,  null, 1),
  (2, 2, 'Gut',            '2', true,  null, 2),
  (3, 3, 'Befriedigend',   '3', true,  null, 3),
  (4, 4, 'Genügend',       '4', true,  null, 4),
  (5, 5, 'Nicht genügend', '5', false, null, 5)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'AT_1_5'
ON CONFLICT DO NOTHING;

-- France FR 0–20
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (16.0, 20.0,  'Très bien',  'TB', true,  'distinction',  1),
  (14.0, 15.99, 'Bien',       'B',  true,  'merit',        2),
  (12.0, 13.99, 'Assez bien', 'AB', true,  null,           3),
  (10.0, 11.99, 'Passable',   'P',  true,  null,           4),
  (0.0,  9.99,  'Insuffisant','I',  false, null,           5)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'FR_0_20'
ON CONFLICT DO NOTHING;

-- Italy IT 18–30
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (30, 30, '30 e lode / Ottimo', '30L', true,  'lode',   1),
  (28, 29, 'Ottimo',             'A',   true,  null,     2),
  (25, 27, 'Buono',              'B',   true,  null,     3),
  (22, 24, 'Discreto',           'C',   true,  null,     4),
  (18, 21, 'Sufficiente',        'D',   true,  null,     5)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'IT_18_30_LODE'
ON CONFLICT DO NOTHING;

-- Netherlands NL 1–10
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (8.0, 10.0, 'Uitstekend',    'A',  true,  'cum_laude', 1),
  (7.0, 7.99, 'Goed',          'B',  true,  null,        2),
  (6.0, 6.99, 'Voldoende',     'C',  true,  null,        3),
  (5.5, 5.99, 'Net voldoende', 'D',  true,  null,        4),
  (1.0, 5.49, 'Onvoldoende',   'F',  false, null,        5)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'NL_1_10'
ON CONFLICT DO NOTHING;

-- Spain ES 0–10
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (9.0, 10.0, 'Sobresaliente',      'SB', true,  'matricula_de_honor', 1),
  (7.0, 8.99, 'Notable',            'NT', true,  null,                 2),
  (5.0, 6.99, 'Aprobado',           'AP', true,  null,                 3),
  (0.0, 4.99, 'Suspenso',           'SS', false, null,                 4)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'ES_0_10'
ON CONFLICT DO NOTHING;

-- UK Percentage 0–100
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (70, 100, 'First Class Honours',        '1st',   true,  'first',  1),
  (60, 69,  'Upper Second Class Honours', '2:1',   true,  null,     2),
  (50, 59,  'Lower Second Class Honours', '2:2',   true,  null,     3),
  (40, 49,  'Third Class Honours',        '3rd',   true,  null,     4),
  (0,  39,  'Fail',                       'Fail',  false, null,     5)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'UK_PERCENTAGE'
ON CONFLICT DO NOTHING;

-- US GPA 0.0–4.0
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (3.7, 4.0, 'A / Excellent',   'A',  true,  'summa_cum_laude', 1),
  (3.3, 3.69,'A- / Very Good',  'A-', true,  'magna_cum_laude', 2),
  (3.0, 3.29,'B+ / Good',       'B+', true,  'cum_laude',       3),
  (2.7, 2.99,'B / Above Avg',   'B',  true,  null,              4),
  (2.0, 2.69,'C / Average',     'C',  true,  null,              5),
  (0.0, 1.99,'D/F / Below Avg', 'F',  false, null,              6)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'US_GPA'
ON CONFLICT DO NOTHING;

-- Poland PL 2–5
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (5.0, 5.0, 'Bardzo dobry',     '5',   true,  null, 1),
  (4.5, 4.5, 'Dobry plus',       '4+',  true,  null, 2),
  (4.0, 4.0, 'Dobry',            '4',   true,  null, 3),
  (3.5, 3.5, 'Dostateczny plus', '3+',  true,  null, 4),
  (3.0, 3.0, 'Dostateczny',      '3',   true,  null, 5),
  (2.0, 2.0, 'Niedostateczny',   '2',   false, null, 6)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'PL_2_5'
ON CONFLICT DO NOTHING;

-- Czech CZ 1–4 (lower is better)
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (1, 1, 'Výborně',      'A', true,  null, 1),
  (2, 2, 'Velmi dobře',  'B', true,  null, 2),
  (3, 3, 'Dobře',        'C', true,  null, 3),
  (4, 4, 'Nevyhověl/a',  'F', false, null, 4)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'CZ_1_4'
ON CONFLICT DO NOTHING;

-- Denmark DK -3 to 12
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (12, 12,  'Fremragende',        '12', true,  null, 1),
  (10, 10,  'Fortrinlig',         '10', true,  null, 2),
  (7,  7,   'God',                '7',  true,  null, 3),
  (4,  4,   'Jævn',               '4',  true,  null, 4),
  (2,  2,   'Tilstrækkelig',      '02', true,  null, 5),
  (0,  0,   'Utilstrækkelig',     '00', false, null, 6),
  (-3, -3,  'Uacceptabel',        '-3', false, null, 7)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'DK_M3_12'
ON CONFLICT DO NOTHING;

-- Finland FI 0–5
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (5, 5, 'Erinomainen',    '5', true,  null, 1),
  (4, 4, 'Kiitettävä',     '4', true,  null, 2),
  (3, 3, 'Hyvä',           '3', true,  null, 3),
  (2, 2, 'Tyydyttävä',     '2', true,  null, 4),
  (1, 1, 'Välttävä',       '1', true,  null, 5),
  (0, 0, 'Hylätty',        '0', false, null, 6)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'FI_0_5'
ON CONFLICT DO NOTHING;

-- Portugal PT 0–20
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (18, 20,  'Excelente',    'A',  true,  'distinction', 1),
  (16, 17,  'Muito Bom',    'B',  true,  null,          2),
  (14, 15,  'Bom',          'C',  true,  null,          3),
  (10, 13,  'Suficiente',   'D',  true,  null,          4),
  (0,  9,   'Insuficiente', 'F',  false, null,          5)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'PT_0_20'
ON CONFLICT DO NOTHING;

-- Belgium BE 0–20
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (16, 20,  'La plus grande distinction', 'A',  true,  'greatest_distinction', 1),
  (14, 15,  'Grande distinction',         'B',  true,  'great_distinction',    2),
  (12, 13,  'Distinction',                'C',  true,  'distinction',          3),
  (10, 11,  'Satisfaisant',               'D',  true,  null,                   4),
  (0,  9,   'Échec',                      'F',  false, null,                   5)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'BE_0_20'
ON CONFLICT DO NOTHING;

-- Norway NO A–F
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (5, 5, 'Fremragende',       'A', true,  null, 1),
  (4, 4, 'Meget god',         'B', true,  null, 2),
  (3, 3, 'God',               'C', true,  null, 3),
  (2, 2, 'Nokså god',         'D', true,  null, 4),
  (1, 1, 'Tilstrekkelig',     'E', true,  null, 5)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'NO_A_F'
ON CONFLICT DO NOTHING;

-- Sweden SE A–F
INSERT INTO grade_bands (grade_scale_id, from_value, to_value, label, short_label, is_passing, honour_level, sort_order)
SELECT gs.id, v.f, v.t, v.label, v.short, v.passing, v.honour, v.ord
FROM grade_scales gs, (VALUES
  (5, 5, 'Utmärkt',         'A', true,  null, 1),
  (4, 4, 'Mycket bra',      'B', true,  null, 2),
  (3, 3, 'Bra',             'C', true,  null, 3),
  (2, 2, 'Tillräcklig',     'D', true,  null, 4),
  (1, 1, 'Underkänd',       'F', false, null, 5)
) AS v(f, t, label, short, passing, honour, ord)
WHERE gs.code = 'SE_A_F'
ON CONFLICT DO NOTHING;
