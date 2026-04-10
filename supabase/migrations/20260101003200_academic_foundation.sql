-- ═══════════════════════════════════════════════════════════════════════════════
-- 032: Academic Foundation — Maximum Edition
--
-- Introduces the full academic domain model:
--   A. Credit Systems (ECTS, CFU, CATS, LOCAL)
--   B. Grade Scales + Grade Bands
--   C. Pass Policies, Retake Policies, Rounding Policies
--   D. Country Systems (national defaults)
--   E. Institutions + Faculties
--   F. Programs + Requirement Groups
--   G. Modules + Assessment Components
--   H. Classification Schemes + GPA Schemes
--   I. Academic Terms
--   J. Enrollments + Attempts + Component Results
--   K. Credit Awards
--   L. Recognition / Transfer Credits
--
-- Design principles:
--   - Every policy is a separate, composable entity
--   - Institutions inherit from country defaults but can override
--   - Programs inherit from institution defaults but can override
--   - Local grades are NEVER destroyed — normalization is additive
--   - Credits are separate from grades
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── A. Credit Schemes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_schemes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code        text NOT NULL UNIQUE,        -- 'ECTS', 'CFU', 'CATS', 'LOCAL'
  name        text NOT NULL,
  units_per_full_time_year  numeric NOT NULL DEFAULT 60,
  conversion_to_ects        numeric NOT NULL DEFAULT 1.0,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

-- Seed credit schemes
INSERT INTO credit_schemes (code, name, units_per_full_time_year, conversion_to_ects, notes) VALUES
  ('ECTS', 'European Credit Transfer System', 60, 1.0, 'Standard across most of Europe'),
  ('CFU',  'Crediti Formativi Universitari', 60, 1.0, 'Italian equivalent of ECTS, 1:1 conversion'),
  ('CATS', 'Credit Accumulation and Transfer Scheme', 120, 0.5, 'UK system: 120 CATS ≈ 60 ECTS'),
  ('LOCAL','Local Credit System', 60, 1.0, 'Generic local credits, conversion configurable')
ON CONFLICT (code) DO NOTHING;

-- ─── B. Grade Scales ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grade_scales (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code            text NOT NULL UNIQUE,      -- 'CH_1_6', 'DE_1_5', 'IT_18_30_LODE', etc.
  name            text NOT NULL,
  country_code    text,                      -- nullable for generic scales
  type            text NOT NULL DEFAULT 'numeric',  -- numeric, percentage, classification, pass_fail, hybrid
  min_value       numeric NOT NULL,
  max_value       numeric NOT NULL,
  pass_value      numeric NOT NULL,
  step_size       numeric NOT NULL DEFAULT 1.0,
  decimal_places  integer NOT NULL DEFAULT 0,
  higher_is_better boolean NOT NULL DEFAULT true,
  supports_honours boolean NOT NULL DEFAULT false,
  special_labels  jsonb DEFAULT '{}',        -- e.g. {"30L": "30 e lode"} for Italy
  created_at      timestamptz DEFAULT now()
);

-- Seed grade scales for all supported countries
INSERT INTO grade_scales (code, name, country_code, type, min_value, max_value, pass_value, step_size, decimal_places, higher_is_better, supports_honours, special_labels) VALUES
  ('CH_1_6',           'Schweiz 1–6',              'CH', 'numeric',      1,   6,    4.0,  0.25, 2, true,  false, '{}'),
  ('DE_1_5',           'Deutschland 1,0–5,0',      'DE', 'numeric',      1.0, 5.0,  4.0,  0.1,  1, false, false, '{}'),
  ('AT_1_5',           'Österreich 1–5',           'AT', 'numeric',      1,   5,    4,    1,    0, false, false, '{}'),
  ('FR_0_20',          'France 0–20',              'FR', 'numeric',      0,   20,   10.0, 0.5,  1, true,  false, '{}'),
  ('IT_18_30_LODE',    'Italia 18–30 e lode',      'IT', 'numeric',      18,  30,   18,   1,    0, true,  true,  '{"30L": "30 e lode"}'),
  ('NL_1_10',          'Nederland 1–10',           'NL', 'numeric',      1,   10,   5.5,  0.5,  1, true,  false, '{}'),
  ('ES_0_10',          'España 0–10',              'ES', 'numeric',      0,   10,   5.0,  0.5,  1, true,  true,  '{"MH": "matrícula de honor"}'),
  ('UK_PERCENTAGE',    'UK Percentage 0–100',      'UK', 'percentage',   0,   100,  40,   1,    0, true,  true,  '{}'),
  ('US_GPA',           'US GPA 0.0–4.0',          'US', 'numeric',      0.0, 4.0,  2.0,  0.1,  1, true,  true,  '{}'),
  ('SE_A_F',           'Sweden A–F',              'SE', 'classification', 1,   5,    3,    1,    0, true,  false, '{"5":"A","4":"B","3":"C","2":"D","1":"F"}'),
  ('PL_2_5',           'Poland 2–5',              'PL', 'numeric',      2,   5,    3.0,  0.5,  1, true,  false, '{}'),
  ('CZ_1_4',           'Czech 1–4',               'CZ', 'numeric',      1,   4,    3,    1,    0, false, false, '{}'),
  ('DK_M3_12',         'Denmark −3 to 12',        'DK', 'numeric',     -3,  12,    2,    1,    0, true,  false, '{"grades":[-3,0,2,4,7,10,12]}'),
  ('FI_0_5',           'Finland 0–5',             'FI', 'numeric',      0,   5,    1,    1,    0, true,  false, '{}'),
  ('PT_0_20',          'Portugal 0–20',           'PT', 'numeric',      0,   20,   10,   1,    0, true,  false, '{}'),
  ('BE_0_20',          'Belgium 0–20',            'BE', 'numeric',      0,   20,   10,   1,    0, true,  false, '{}'),
  ('NO_A_F',           'Norway A–F',              'NO', 'classification', 1,   5,    3,    1,    0, true,  false, '{"5":"A","4":"B","3":"C","2":"D","1":"F"}'),
  ('PASS_FAIL',        'Pass / Fail',             null, 'pass_fail',     0,   1,    1,    1,    0, true,  false, '{"1":"Pass","0":"Fail"}')
ON CONFLICT (code) DO NOTHING;

-- ─── Grade Bands (qualitative classification) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS grade_bands (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  grade_scale_id  uuid NOT NULL REFERENCES grade_scales(id) ON DELETE CASCADE,
  from_value      numeric NOT NULL,
  to_value        numeric NOT NULL,
  label           text NOT NULL,
  short_label     text,
  is_passing      boolean NOT NULL DEFAULT true,
  honour_level    text,           -- 'cum_laude', 'magna_cum_laude', 'distinction', etc.
  sort_order      integer NOT NULL DEFAULT 0
);

-- ─── C. Pass Policies ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pass_policies (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code              text NOT NULL UNIQUE,
  name              text NOT NULL,
  policy_type       text NOT NULL DEFAULT 'overall_threshold',
  -- Types: overall_threshold, all_mandatory_components, threshold_plus_component_minimums,
  --        pass_fail_only, compensation_model
  overall_pass_threshold     numeric,
  allow_compensation         boolean NOT NULL DEFAULT false,
  requires_all_mandatory     boolean NOT NULL DEFAULT false,
  partial_credit_allowed     boolean NOT NULL DEFAULT false,
  rules_json                 jsonb DEFAULT '{}',
  notes                      text,
  created_at                 timestamptz DEFAULT now()
);

-- Seed common pass policies
INSERT INTO pass_policies (code, name, policy_type, overall_pass_threshold, requires_all_mandatory, notes) VALUES
  ('SIMPLE_THRESHOLD',      'Simple Threshold',              'overall_threshold',                    null, false, 'Pass if final grade meets scale pass_value'),
  ('THRESHOLD_PLUS_MANDATORY', 'Threshold + Mandatory',      'threshold_plus_component_minimums',    null, true,  'Overall threshold + all mandatory components must pass'),
  ('ALL_COMPONENTS',        'All Components Must Pass',       'all_mandatory_components',             null, true,  'Every assessment component must be passed individually'),
  ('PASS_FAIL',             'Pass / Fail',                   'pass_fail_only',                       null, false, 'Binary pass/fail, no grade'),
  ('COMPENSATION',          'Compensation Model',            'compensation_model',                   null, false, 'Weak results can be compensated by strong results')
ON CONFLICT (code) DO NOTHING;

-- ─── Retake Policies ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retake_policies (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code                    text NOT NULL UNIQUE,
  name                    text NOT NULL,
  max_attempts            integer NOT NULL DEFAULT 3,
  retake_if_passed        boolean NOT NULL DEFAULT false,
  grade_replacement       text NOT NULL DEFAULT 'best_attempt',
  -- best_attempt, latest_attempt, average_attempts, first_pass_only
  resit_allowed           boolean NOT NULL DEFAULT true,
  resit_same_term         boolean NOT NULL DEFAULT false,
  cooldown_days           integer DEFAULT 0,
  notes                   text,
  created_at              timestamptz DEFAULT now()
);

INSERT INTO retake_policies (code, name, max_attempts, retake_if_passed, grade_replacement) VALUES
  ('DEFAULT_3_BEST',       'Max 3 attempts, best counts',      3, false, 'best_attempt'),
  ('DEFAULT_3_LATEST',     'Max 3 attempts, latest counts',    3, false, 'latest_attempt'),
  ('DEFAULT_2_BEST',       'Max 2 attempts, best counts',      2, false, 'best_attempt'),
  ('UNLIMITED_BEST',       'Unlimited attempts, best counts',  99, false, 'best_attempt'),
  ('NO_RETAKE',            'No retake allowed',                1, false, 'best_attempt'),
  ('IMPROVE_ALLOWED',      'Retake even if passed, best',      3, true,  'best_attempt')
ON CONFLICT (code) DO NOTHING;

-- ─── Rounding Policies ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rounding_policies (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  round_to    numeric NOT NULL DEFAULT 0.5,  -- 1.0, 0.5, 0.25, 0.1, 0.01
  method      text NOT NULL DEFAULT 'normal', -- normal, floor, ceil, bankers
  apply_to    text NOT NULL DEFAULT 'final_grade', -- component, final_grade, transcript_only
  created_at  timestamptz DEFAULT now()
);

INSERT INTO rounding_policies (code, name, round_to, method, apply_to) VALUES
  ('ROUND_025',   'Round to 0.25',       0.25,  'normal', 'final_grade'),
  ('ROUND_05',    'Round to 0.5',        0.5,   'normal', 'final_grade'),
  ('ROUND_01',    'Round to 0.1',        0.1,   'normal', 'final_grade'),
  ('ROUND_1',     'Round to whole',      1.0,   'normal', 'final_grade'),
  ('FLOOR_05',    'Floor to 0.5',        0.5,   'floor',  'final_grade'),
  ('NO_ROUND',    'No rounding (0.01)',   0.01,  'normal', 'final_grade'),
  ('TRANSCRIPT_05','Transcript round 0.5', 0.5,  'normal', 'transcript_only')
ON CONFLICT (code) DO NOTHING;

-- ─── D. Country Systems (national defaults) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS country_systems (
  country_code              text PRIMARY KEY,
  name                      text NOT NULL,
  flag                      text,
  default_credit_scheme_id  uuid REFERENCES credit_schemes(id),
  default_grade_scale_id    uuid REFERENCES grade_scales(id),
  default_rounding_policy_id uuid REFERENCES rounding_policies(id),
  default_pass_policy_id    uuid REFERENCES pass_policies(id),
  default_retake_policy_id  uuid REFERENCES retake_policies(id),
  default_calendar_type     text DEFAULT 'semester', -- semester, trimester, quarter, block
  uses_honours              boolean DEFAULT false,
  notes                     text,
  created_at                timestamptz DEFAULT now()
);

-- Seed country systems with references (done after all reference tables exist)
-- We use subqueries to resolve UUIDs from codes
INSERT INTO country_systems (country_code, name, flag, default_credit_scheme_id, default_grade_scale_id, default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id, default_calendar_type, uses_honours) VALUES
  ('CH', 'Schweiz',           '🇨🇭', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='CH_1_6'),        (SELECT id FROM rounding_policies WHERE code='ROUND_025'), (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', false),
  ('DE', 'Deutschland',       '🇩🇪', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='DE_1_5'),        (SELECT id FROM rounding_policies WHERE code='ROUND_01'),  (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', false),
  ('AT', 'Österreich',        '🇦🇹', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='AT_1_5'),        (SELECT id FROM rounding_policies WHERE code='ROUND_1'),   (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', false),
  ('FR', 'France',            '🇫🇷', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='FR_0_20'),       (SELECT id FROM rounding_policies WHERE code='ROUND_05'),  (SELECT id FROM pass_policies WHERE code='COMPENSATION'),     (SELECT id FROM retake_policies WHERE code='DEFAULT_2_BEST'), 'semester', false),
  ('IT', 'Italia',            '🇮🇹', (SELECT id FROM credit_schemes WHERE code='CFU'),  (SELECT id FROM grade_scales WHERE code='IT_18_30_LODE'), (SELECT id FROM rounding_policies WHERE code='ROUND_1'),   (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='UNLIMITED_BEST'), 'semester', true),
  ('NL', 'Nederland',         '🇳🇱', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='NL_1_10'),       (SELECT id FROM rounding_policies WHERE code='ROUND_05'),  (SELECT id FROM pass_policies WHERE code='THRESHOLD_PLUS_MANDATORY'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', false),
  ('ES', 'España',            '🇪🇸', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='ES_0_10'),       (SELECT id FROM rounding_policies WHERE code='ROUND_05'),  (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_LATEST'), 'semester', true),
  ('UK', 'United Kingdom',    '🇬🇧', (SELECT id FROM credit_schemes WHERE code='CATS'), (SELECT id FROM grade_scales WHERE code='UK_PERCENTAGE'), (SELECT id FROM rounding_policies WHERE code='ROUND_1'),   (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', true),
  ('US', 'United States',     '🇺🇸', (SELECT id FROM credit_schemes WHERE code='LOCAL'),(SELECT id FROM grade_scales WHERE code='US_GPA'),        (SELECT id FROM rounding_policies WHERE code='ROUND_01'),  (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', true),
  ('SE', 'Sverige',           '🇸🇪', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='SE_A_F'),        (SELECT id FROM rounding_policies WHERE code='ROUND_1'),   (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', false),
  ('PL', 'Polska',            '🇵🇱', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='PL_2_5'),        (SELECT id FROM rounding_policies WHERE code='ROUND_05'),  (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', false),
  ('CZ', 'Česko',             '🇨🇿', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='CZ_1_4'),        (SELECT id FROM rounding_policies WHERE code='ROUND_1'),   (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', false),
  ('DK', 'Danmark',           '🇩🇰', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='DK_M3_12'),      (SELECT id FROM rounding_policies WHERE code='ROUND_1'),   (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', false),
  ('FI', 'Suomi',             '🇫🇮', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='FI_0_5'),        (SELECT id FROM rounding_policies WHERE code='ROUND_1'),   (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', false),
  ('PT', 'Portugal',          '🇵🇹', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='PT_0_20'),       (SELECT id FROM rounding_policies WHERE code='ROUND_1'),   (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', false),
  ('BE', 'Belgique / België', '🇧🇪', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='BE_0_20'),       (SELECT id FROM rounding_policies WHERE code='ROUND_1'),   (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', false),
  ('NO', 'Norge',             '🇳🇴', (SELECT id FROM credit_schemes WHERE code='ECTS'), (SELECT id FROM grade_scales WHERE code='NO_A_F'),        (SELECT id FROM rounding_policies WHERE code='ROUND_1'),   (SELECT id FROM pass_policies WHERE code='SIMPLE_THRESHOLD'), (SELECT id FROM retake_policies WHERE code='DEFAULT_3_BEST'), 'semester', false)
ON CONFLICT (country_code) DO NOTHING;

-- ─── E. Institutions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institutions (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                      text NOT NULL,
  country_code              text NOT NULL REFERENCES country_systems(country_code),
  institution_type          text NOT NULL DEFAULT 'university',
  -- university, university_of_applied_sciences, college, polytechnic
  official_language         text,
  academic_year_start_month integer DEFAULT 9,  -- September
  default_credit_scheme_id  uuid REFERENCES credit_schemes(id),
  default_grade_scale_id    uuid REFERENCES grade_scales(id),
  default_rounding_policy_id uuid REFERENCES rounding_policies(id),
  default_pass_policy_id    uuid REFERENCES pass_policies(id),
  default_retake_policy_id  uuid REFERENCES retake_policies(id),
  website                   text,
  recognition_rules         jsonb DEFAULT '{}',
  created_at                timestamptz DEFAULT now()
);

-- ─── Faculties / Departments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faculties (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            text NOT NULL,
  code            text,
  created_at      timestamptz DEFAULT now()
);

-- ─── H. Classification Schemes ───────────────────────────────────────────────
-- MOVED HERE: Must exist before programs table references them via FK
CREATE TABLE IF NOT EXISTS classification_schemes (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code            text NOT NULL UNIQUE,
  name            text NOT NULL,
  country_code    text,
  scheme_type     text NOT NULL DEFAULT 'honours',
  -- honours, distinction, merit, custom
  rules_json      jsonb NOT NULL DEFAULT '[]',
  created_at      timestamptz DEFAULT now()
);

INSERT INTO classification_schemes (code, name, country_code, scheme_type, rules_json) VALUES
  ('UK_HONOURS', 'UK Honours Classification', 'UK', 'honours',
    '[{"min":70,"label":"First Class Honours","short":"First"},{"min":60,"label":"Upper Second Class Honours","short":"2:1"},{"min":50,"label":"Lower Second Class Honours","short":"2:2"},{"min":40,"label":"Third Class Honours","short":"Third"}]'::jsonb),
  ('IT_LODE', 'Italian Distinction', 'IT', 'distinction',
    '[{"min":30,"label":"30 e lode","requires_unanimous":true},{"min":28,"label":"ottimo"},{"min":25,"label":"buono"},{"min":22,"label":"discreto"},{"min":18,"label":"sufficiente"}]'::jsonb),
  ('ES_HONOR', 'Spanish Matrícula de Honor', 'ES', 'distinction',
    '[{"min":9,"label":"Matrícula de Honor"},{"min":9,"label":"Sobresaliente"},{"min":7,"label":"Notable"},{"min":5,"label":"Aprobado"}]'::jsonb),
  ('CH_PRAED', 'Swiss Distinction', 'CH', 'distinction',
    '[{"min":5.5,"label":"summa cum laude"},{"min":5.0,"label":"magna cum laude"},{"min":4.5,"label":"cum laude"}]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ─── GPA / Average Schemes ──────────────────────────────────────────────────
-- MOVED HERE: Must exist before programs table references them via FK
CREATE TABLE IF NOT EXISTS gpa_schemes (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code                  text NOT NULL UNIQUE,
  name                  text NOT NULL,
  calculation_type      text NOT NULL DEFAULT 'weighted_by_credits',
  includes_failed       boolean NOT NULL DEFAULT false,
  includes_repeats      boolean NOT NULL DEFAULT false,
  drop_lowest_allowed   boolean NOT NULL DEFAULT false,
  calculation_scope     text NOT NULL DEFAULT 'all_modules',
  created_at            timestamptz DEFAULT now()
);

INSERT INTO gpa_schemes (code, name, calculation_type, includes_failed, calculation_scope) VALUES
  ('ECTS_WEIGHTED',       'ECTS-weighted average',            'weighted_by_credits', false, 'all_modules'),
  ('ECTS_WEIGHTED_ALL',   'ECTS-weighted incl. failed',       'weighted_by_credits', true,  'all_modules'),
  ('SIMPLE_AVERAGE',      'Simple average (no weighting)',     'simple_average',      false, 'all_modules'),
  ('UK_STAGE_WEIGHTED',   'UK weighted by stage',             'custom',              false, 'degree_relevant_only'),
  ('BEST_N_CREDITS',      'Best N credits average',           'custom',              false, 'degree_relevant_only')
ON CONFLICT (code) DO NOTHING;

-- ─── F. Programs (Studiengänge) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id              uuid REFERENCES institutions(id),
  faculty_id                  uuid REFERENCES faculties(id),
  name                        text NOT NULL,
  degree_level                text NOT NULL DEFAULT 'bachelor',
  -- short_cycle, bachelor, master, phd, diploma
  required_total_credits      numeric NOT NULL DEFAULT 180,
  credit_scheme_id            uuid REFERENCES credit_schemes(id),
  ects_equivalent_total       numeric,
  duration_standard_terms     integer DEFAULT 6,
  classification_scheme_id    uuid REFERENCES classification_schemes(id),
  gpa_scheme_id               uuid REFERENCES gpa_schemes(id),
  completion_rules            jsonb DEFAULT '{}',
  thesis_required             boolean DEFAULT false,
  internship_required         boolean DEFAULT false,
  final_exam_required         boolean DEFAULT false,
  created_at                  timestamptz DEFAULT now()
);

-- ─── Program Requirement Groups ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_requirement_groups (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id          uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name                text NOT NULL,
  group_type          text NOT NULL DEFAULT 'compulsory',
  -- compulsory, elective_required, elective_free, specialisation, minor, thesis, internship
  min_credits_required numeric,
  min_modules_required integer,
  max_modules_counted  integer,
  rule_type            text NOT NULL DEFAULT 'all_of',
  -- any_of, all_of, choose_n, choose_credits
  parent_group_id     uuid REFERENCES program_requirement_groups(id),
  sort_order          integer DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);

-- ─── G. Academic Modules / Courses ───────────────────────────────────────────
-- This extends the existing modules table with academic metadata
ALTER TABLE modules ADD COLUMN IF NOT EXISTS module_code           text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS description           text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS credit_scheme_id      uuid REFERENCES credit_schemes(id);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS ects_equivalent       numeric;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS grade_scale_id        uuid REFERENCES grade_scales(id);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS pass_policy_id        uuid REFERENCES pass_policies(id);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS retake_policy_id      uuid REFERENCES retake_policies(id);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS rounding_policy_id    uuid REFERENCES rounding_policies(id);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS program_id            uuid REFERENCES programs(id);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS requirement_group_id  uuid REFERENCES program_requirement_groups(id);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS term_type             text;  -- semester, trimester, block
ALTER TABLE modules ADD COLUMN IF NOT EXISTS default_term_number   integer;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_compulsory         boolean DEFAULT true;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_repeatable         boolean DEFAULT true;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS attendance_required   boolean DEFAULT false;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS language              text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS delivery_mode         text DEFAULT 'onsite'; -- onsite, online, hybrid
ALTER TABLE modules ADD COLUMN IF NOT EXISTS prerequisites_json    jsonb DEFAULT '[]';

-- ─── Assessment Components ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessment_components (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id               uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  component_type          text NOT NULL DEFAULT 'written_exam',
  -- written_exam, oral_exam, project, lab, homework, presentation,
  -- participation, thesis, pass_fail_requirement
  weight_percent          numeric NOT NULL DEFAULT 100,
  grade_scale_id          uuid REFERENCES grade_scales(id),
  pass_policy_id          uuid REFERENCES pass_policies(id),
  min_pass_required       boolean NOT NULL DEFAULT false,
  contributes_to_final    boolean NOT NULL DEFAULT true,
  mandatory_to_pass       boolean NOT NULL DEFAULT false,
  sequence_order          integer NOT NULL DEFAULT 1,
  created_at              timestamptz DEFAULT now()
);

-- (classification_schemes and gpa_schemes already created above, before programs)

-- ─── I. Academic Terms ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_terms (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id      uuid REFERENCES institutions(id),
  academic_year_label text NOT NULL,        -- "2025/2026"
  term_type           text NOT NULL DEFAULT 'semester', -- semester, trimester, quarter, yearly, block
  term_number         integer NOT NULL,     -- 1=HS, 2=FS for semester
  term_label          text,                 -- "Herbstsemester 2025"
  start_date          date,
  end_date            date,
  teaching_end_date   date,
  exam_start_date     date,
  exam_end_date       date,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(user_id, academic_year_label, term_number)
);

-- ─── J. Enrollments ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrollments (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id           uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  program_id          uuid REFERENCES programs(id),
  academic_year       text,
  term_id             uuid REFERENCES academic_terms(id),
  status              text NOT NULL DEFAULT 'planned',
  -- planned, enrolled, ongoing, passed, failed, withdrawn, recognised
  attempts_used       integer NOT NULL DEFAULT 0,
  current_final_grade numeric,
  current_grade_label text,
  current_passed      boolean,
  credits_awarded     numeric DEFAULT 0,
  -- Normalization fields (never destroy local grades)
  local_grade_value          numeric,
  local_grade_label          text,
  normalized_score_0_100     numeric,
  normalization_method       text,
  conversion_confidence      numeric,  -- 0.0 to 1.0
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_module ON enrollments(module_id);

-- ─── Attempts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attempts (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id       uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  attempt_number      integer NOT NULL DEFAULT 1,
  date_started        date,
  date_completed      date,
  status              text NOT NULL DEFAULT 'in_progress',
  -- in_progress, submitted, graded, passed, failed, void, withdrawn
  final_grade_value   numeric,
  final_grade_label   text,
  passed              boolean,
  credits_awarded     numeric DEFAULT 0,
  counts_toward_record boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz DEFAULT now()
);

-- ─── Component Results ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS component_results (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id          uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  component_id        uuid NOT NULL REFERENCES assessment_components(id) ON DELETE CASCADE,
  raw_score           numeric,
  grade_value         numeric,
  grade_label         text,
  passed              boolean,
  weight_applied      numeric,
  grader_notes        text,
  created_at          timestamptz DEFAULT now()
);

-- ─── K. Credit Awards ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_awards (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id               uuid REFERENCES modules(id),
  attempt_id              uuid REFERENCES attempts(id),
  credits_awarded_value   numeric NOT NULL,
  credit_scheme_id        uuid REFERENCES credit_schemes(id),
  ects_equivalent         numeric,
  award_reason            text NOT NULL DEFAULT 'passed_module',
  -- passed_module, transfer, recognition, exemption, prior_learning
  awarded_at              timestamptz DEFAULT now(),
  notes                   text,
  created_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_awards_user ON credit_awards(user_id);

-- ─── L. Recognition / Transfer Credits ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS recognitions (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_institution        text NOT NULL,
  source_module_name        text NOT NULL,
  source_credit_value       numeric,
  source_credit_scheme      text,             -- 'ECTS', 'CFU', 'CATS', etc.
  source_grade_value        numeric,
  source_grade_scale        text,             -- reference to grade_scales.code
  recognized_as_module_id   uuid REFERENCES modules(id),
  recognized_ects           numeric,
  recognized_grade_value    numeric,          -- nullable: sometimes only credits transfer
  recognition_status        text NOT NULL DEFAULT 'pending',
  -- pending, accepted, partial, rejected
  evidence_document_ref     text,
  decision_notes            text,
  decided_at                timestamptz,
  created_at                timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recognitions_user ON recognitions(user_id);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
-- Reference tables (credit_schemes, grade_scales, etc.) are readable by all authenticated users
-- User-specific tables (enrollments, attempts, etc.) are restricted to owner

ALTER TABLE credit_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE retake_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounding_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_requirement_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gpa_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE recognitions ENABLE ROW LEVEL SECURITY;

-- Read-only for all authenticated users (reference data)
DO $$ BEGIN
CREATE POLICY "Authenticated read credit_schemes" ON credit_schemes FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read grade_scales" ON grade_scales FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read grade_bands" ON grade_bands FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read pass_policies" ON pass_policies FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read retake_policies" ON retake_policies FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read rounding_policies" ON rounding_policies FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read country_systems" ON country_systems FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read institutions" ON institutions FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read faculties" ON faculties FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read programs" ON programs FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read program_requirement_groups" ON program_requirement_groups FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read assessment_components" ON assessment_components FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read classification_schemes" ON classification_schemes FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Authenticated read gpa_schemes" ON gpa_schemes FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- User-owned data: full CRUD for owner
DO $$ BEGIN
CREATE POLICY "Users own academic_terms" ON academic_terms FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Users own enrollments" ON enrollments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Users own attempts" ON attempts FOR ALL USING (enrollment_id IN (SELECT id FROM enrollments WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Users own component_results" ON component_results FOR ALL USING (attempt_id IN (SELECT id FROM attempts WHERE enrollment_id IN (SELECT id FROM enrollments WHERE user_id = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Users own credit_awards" ON credit_awards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Users own recognitions" ON recognitions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Helper function: resolve effective policy for a module ──────────────────
-- Cascading lookup: module → program → institution → country
CREATE OR REPLACE FUNCTION resolve_grade_scale(p_module_id uuid)
RETURNS uuid AS $$
DECLARE
  v_scale_id uuid;
  v_program_id uuid;
  v_institution_id uuid;
  v_country text;
BEGIN
  -- 1. Module-level override
  SELECT grade_scale_id INTO v_scale_id FROM modules WHERE id = p_module_id;
  IF v_scale_id IS NOT NULL THEN RETURN v_scale_id; END IF;

  -- 2. Program-level (via module.program_id → programs.institution_id → institutions.default_grade_scale_id)
  SELECT m.program_id INTO v_program_id FROM modules m WHERE m.id = p_module_id;

  -- 3. Institution-level
  IF v_program_id IS NOT NULL THEN
    SELECT p.institution_id INTO v_institution_id FROM programs p WHERE p.id = v_program_id;
  END IF;
  IF v_institution_id IS NOT NULL THEN
    SELECT default_grade_scale_id INTO v_scale_id FROM institutions WHERE id = v_institution_id;
    IF v_scale_id IS NOT NULL THEN RETURN v_scale_id; END IF;
  END IF;

  -- 4. Country-level (via user's profile country)
  IF v_institution_id IS NOT NULL THEN
    SELECT country_code INTO v_country FROM institutions WHERE id = v_institution_id;
  END IF;
  IF v_country IS NOT NULL THEN
    SELECT default_grade_scale_id INTO v_scale_id FROM country_systems WHERE country_code = v_country;
    IF v_scale_id IS NOT NULL THEN RETURN v_scale_id; END IF;
  END IF;

  -- Fallback: CH
  SELECT default_grade_scale_id INTO v_scale_id FROM country_systems WHERE country_code = 'CH';
  RETURN v_scale_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Similar resolver for pass_policy, retake_policy, rounding_policy
CREATE OR REPLACE FUNCTION resolve_pass_policy(p_module_id uuid)
RETURNS uuid AS $$
DECLARE v_id uuid; v_prog uuid; v_inst uuid; v_country text;
BEGIN
  SELECT pass_policy_id INTO v_id FROM modules WHERE id = p_module_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT program_id INTO v_prog FROM modules WHERE id = p_module_id;
  IF v_prog IS NOT NULL THEN
    SELECT institution_id INTO v_inst FROM programs WHERE id = v_prog;
  END IF;
  IF v_inst IS NOT NULL THEN
    SELECT default_pass_policy_id INTO v_id FROM institutions WHERE id = v_inst;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
    SELECT country_code INTO v_country FROM institutions WHERE id = v_inst;
  END IF;
  IF v_country IS NOT NULL THEN
    SELECT default_pass_policy_id INTO v_id FROM country_systems WHERE country_code = v_country;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  SELECT default_pass_policy_id INTO v_id FROM country_systems WHERE country_code = 'CH';
  RETURN v_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION resolve_grade_scale(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_pass_policy(uuid) TO authenticated;
