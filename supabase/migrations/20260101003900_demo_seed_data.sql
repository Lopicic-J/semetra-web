-- ═══════════════════════════════════════════════════════════════════════════════
-- 039: Comprehensive Demo Seed Data — 7 Countries Academic Systems
--
-- Realistic institutional structures with programs, modules, and assessment
-- components covering Switzerland, Germany, Netherlands, Italy, Spain, France, UK
--
-- Uses deterministic UUIDs for cross-referencing between inserts.
-- UUID format: 00000000-0000-4000-a000-XXXXXXXXXXXX (valid v4 UUIDs)
--
-- Modules require user_id (NOT NULL). Module/term/assessment seeding is
-- wrapped in a DO block that only runs if at least one auth.users row exists.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. SWITZERLAND (CH) — ZHAW Winterthur
-- ══════════════════════════════════════════════════════════════════════════════

-- Institution
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000010001'::uuid,
       'Zürcher Hochschule für Angewandte Wissenschaften',
       'CH', 'university_of_applied_sciences', 'de', 9, 'ZHAW',
       'https://www.zhaw.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

-- Faculty
INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000010002'::uuid,
        '00000000-0000-4000-a000-000000010001'::uuid,
        'School of Engineering', 'SOE')
ON CONFLICT (id) DO NOTHING;

-- Program: BSc Informatik (6 Semester, 180 ECTS)
INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000010003'::uuid,
       '00000000-0000-4000-a000-000000010001'::uuid,
       '00000000-0000-4000-a000-000000010002'::uuid,
       'BSc Informatik', 'bachelor', 180,
       cs.id, 180, 6, true, 'BSC-INF'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Requirement Groups
INSERT INTO program_requirement_groups (id, program_id, name, group_type, min_credits_required, sort_order, rule_type) VALUES
  ('00000000-0000-4000-a000-000000010010'::uuid, '00000000-0000-4000-a000-000000010003'::uuid, 'Grundstudium', 'compulsory', 60, 1, 'all_of'),
  ('00000000-0000-4000-a000-000000010011'::uuid, '00000000-0000-4000-a000-000000010003'::uuid, 'Vertiefung', 'specialisation', 60, 2, 'all_of'),
  ('00000000-0000-4000-a000-000000010012'::uuid, '00000000-0000-4000-a000-000000010003'::uuid, 'Wahlpflicht', 'elective_free', 36, 3, 'choose_credits'),
  ('00000000-0000-4000-a000-000000010013'::uuid, '00000000-0000-4000-a000-000000010003'::uuid, 'Bachelorarbeit', 'thesis', 24, 4, 'all_of')
ON CONFLICT (id) DO NOTHING;

-- Completion Policy
INSERT INTO program_completion_policies (id, program_id, min_total_credits, min_gpa, max_duration_terms,
                                         thesis_min_grade, requires_thesis, code, name)
VALUES ('00000000-0000-4000-a000-000000010020'::uuid,
        '00000000-0000-4000-a000-000000010003'::uuid,
        180, 4.0, 12, 4.0, true, 'CH-BSC-STD', 'Standard BSc Completion CH')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. GERMANY (DE) — TU München
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000020001'::uuid,
       'Technische Universität München', 'DE', 'university', 'de', 10, 'TUM',
       'https://www.tum.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000020002'::uuid,
        '00000000-0000-4000-a000-000000020001'::uuid,
        'Fakultät für Informatik', 'IN')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000020003'::uuid,
       '00000000-0000-4000-a000-000000020001'::uuid,
       '00000000-0000-4000-a000-000000020002'::uuid,
       'BSc Informatik', 'bachelor', 180,
       cs.id, 180, 6, true, 'BSC-INF-TUM'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO program_requirement_groups (id, program_id, name, group_type, min_credits_required, sort_order, rule_type) VALUES
  ('00000000-0000-4000-a000-000000020010'::uuid, '00000000-0000-4000-a000-000000020003'::uuid, 'Pflichtmodule', 'compulsory', 90, 1, 'all_of'),
  ('00000000-0000-4000-a000-000000020011'::uuid, '00000000-0000-4000-a000-000000020003'::uuid, 'Wahlpflicht', 'elective_required', 60, 2, 'choose_credits'),
  ('00000000-0000-4000-a000-000000020012'::uuid, '00000000-0000-4000-a000-000000020003'::uuid, 'Bachelorarbeit', 'thesis', 30, 3, 'all_of')
ON CONFLICT (id) DO NOTHING;

INSERT INTO program_completion_policies (id, program_id, min_total_credits, min_gpa, max_duration_terms,
                                         thesis_min_grade, requires_thesis, code, name)
VALUES ('00000000-0000-4000-a000-000000020020'::uuid,
        '00000000-0000-4000-a000-000000020003'::uuid,
        180, null, 14, 4.0, true, 'DE-BSC-STD', 'Standard BSc Completion DE')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. NETHERLANDS (NL) — TU Delft
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000030001'::uuid,
       'Technische Universiteit Delft', 'NL', 'university', 'nl', 9, 'TUD',
       'https://www.tudelft.nl',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'NL_1_10' AND rp.code = 'ROUND_05'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000030002'::uuid,
        '00000000-0000-4000-a000-000000030001'::uuid,
        'Electrical Engineering, Mathematics and Computer Science', 'EEMCS')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000030003'::uuid,
       '00000000-0000-4000-a000-000000030001'::uuid,
       '00000000-0000-4000-a000-000000030002'::uuid,
       'BSc Computer Science and Engineering', 'bachelor', 180,
       cs.id, 180, 6, true, 'BSC-CSE-TUD'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO program_requirement_groups (id, program_id, name, group_type, min_credits_required, sort_order, rule_type) VALUES
  ('00000000-0000-4000-a000-000000030010'::uuid, '00000000-0000-4000-a000-000000030003'::uuid, 'Core Courses', 'compulsory', 100, 1, 'all_of'),
  ('00000000-0000-4000-a000-000000030011'::uuid, '00000000-0000-4000-a000-000000030003'::uuid, 'Electives', 'elective_required', 50, 2, 'choose_credits'),
  ('00000000-0000-4000-a000-000000030012'::uuid, '00000000-0000-4000-a000-000000030003'::uuid, 'Thesis', 'thesis', 30, 3, 'all_of')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. ITALY (IT) — Politecnico di Milano
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000040001'::uuid,
       'Politecnico di Milano', 'IT', 'polytechnic', 'it', 9, 'POLIMI',
       'https://www.polimi.it',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'CFU' AND gs.code = 'IT_18_30_LODE' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'UNLIMITED_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000040002'::uuid,
        '00000000-0000-4000-a000-000000040001'::uuid,
        'Dipartimento di Elettronica, Informazione e Bioingegneria', 'DEIB')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000040003'::uuid,
       '00000000-0000-4000-a000-000000040001'::uuid,
       '00000000-0000-4000-a000-000000040002'::uuid,
       'Laurea Ingegneria Informatica', 'bachelor', 180,
       cs.id, 180, 6, true, 'LT-INF-POLIMI'
FROM credit_schemes cs WHERE cs.code = 'CFU'
ON CONFLICT (id) DO NOTHING;

INSERT INTO program_requirement_groups (id, program_id, name, group_type, min_credits_required, sort_order, rule_type) VALUES
  ('00000000-0000-4000-a000-000000040010'::uuid, '00000000-0000-4000-a000-000000040003'::uuid, 'Insegnamenti Obbligatori', 'compulsory', 120, 1, 'all_of'),
  ('00000000-0000-4000-a000-000000040011'::uuid, '00000000-0000-4000-a000-000000040003'::uuid, 'Insegnamenti a Scelta', 'elective_required', 30, 2, 'choose_credits'),
  ('00000000-0000-4000-a000-000000040012'::uuid, '00000000-0000-4000-a000-000000040003'::uuid, 'Prova Finale', 'thesis', 30, 3, 'all_of')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. SPAIN (ES) — UPM Madrid
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000050001'::uuid,
       'Universidad Politécnica de Madrid', 'ES', 'polytechnic', 'es', 9, 'UPM',
       'https://www.upm.es',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'ES_0_10' AND rp.code = 'ROUND_05'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_LATEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000050002'::uuid,
        '00000000-0000-4000-a000-000000050001'::uuid,
        'Escuela Técnica Superior de Ingenieros Informáticos', 'ETSI-INF')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000050003'::uuid,
       '00000000-0000-4000-a000-000000050001'::uuid,
       '00000000-0000-4000-a000-000000050002'::uuid,
       'Grado en Ingeniería Informática', 'bachelor', 240,
       cs.id, 240, 8, true, 'GII-UPM'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO program_requirement_groups (id, program_id, name, group_type, min_credits_required, sort_order, rule_type) VALUES
  ('00000000-0000-4000-a000-000000050010'::uuid, '00000000-0000-4000-a000-000000050003'::uuid, 'Formación Básica', 'compulsory', 60, 1, 'all_of'),
  ('00000000-0000-4000-a000-000000050011'::uuid, '00000000-0000-4000-a000-000000050003'::uuid, 'Obligatorias', 'compulsory', 120, 2, 'all_of'),
  ('00000000-0000-4000-a000-000000050012'::uuid, '00000000-0000-4000-a000-000000050003'::uuid, 'Optativas', 'elective_required', 48, 3, 'choose_credits'),
  ('00000000-0000-4000-a000-000000050013'::uuid, '00000000-0000-4000-a000-000000050003'::uuid, 'Trabajo Fin de Grado', 'thesis', 12, 4, 'all_of')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. FRANCE (FR) — Sorbonne Université
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000060001'::uuid,
       'Sorbonne Université', 'FR', 'university', 'fr', 9, 'SU',
       'https://www.sorbonne-universite.fr',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'FR_0_20' AND rp.code = 'ROUND_05'
  AND pp.code = 'COMPENSATION' AND ret.code = 'DEFAULT_2_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000060002'::uuid,
        '00000000-0000-4000-a000-000000060001'::uuid,
        'Faculté des Sciences et Ingénierie', 'FSI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000060003'::uuid,
       '00000000-0000-4000-a000-000000060001'::uuid,
       '00000000-0000-4000-a000-000000060002'::uuid,
       'Licence Informatique', 'bachelor', 180,
       cs.id, 180, 6, false, 'LIC-INF-SU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO program_requirement_groups (id, program_id, name, group_type, min_credits_required, sort_order, rule_type) VALUES
  ('00000000-0000-4000-a000-000000060010'::uuid, '00000000-0000-4000-a000-000000060003'::uuid, 'Unités Fondamentales', 'compulsory', 120, 1, 'all_of'),
  ('00000000-0000-4000-a000-000000060011'::uuid, '00000000-0000-4000-a000-000000060003'::uuid, 'Unités de Découverte', 'elective_required', 30, 2, 'choose_credits'),
  ('00000000-0000-4000-a000-000000060012'::uuid, '00000000-0000-4000-a000-000000060003'::uuid, 'Unités Libres', 'elective_free', 30, 3, 'choose_credits')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. UNITED KINGDOM (UK) — University of Edinburgh
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000070001'::uuid,
       'University of Edinburgh', 'UK', 'university', 'en', 9, 'UEDIN',
       'https://www.ed.ac.uk',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'CATS' AND gs.code = 'UK_PERCENTAGE' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000070002'::uuid,
        '00000000-0000-4000-a000-000000070001'::uuid,
        'School of Informatics', 'INF')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code,
                      classification_scheme_id)
SELECT '00000000-0000-4000-a000-000000070003'::uuid,
       '00000000-0000-4000-a000-000000070001'::uuid,
       '00000000-0000-4000-a000-000000070002'::uuid,
       'BSc Computer Science', 'bachelor', 360,
       cs.id, 180, 8, true, 'BSC-CS-UEDIN',
       cls.id
FROM credit_schemes cs, classification_schemes cls
WHERE cs.code = 'CATS' AND cls.code = 'UK_HONOURS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO program_requirement_groups (id, program_id, name, group_type, min_credits_required, sort_order, rule_type) VALUES
  ('00000000-0000-4000-a000-000000070010'::uuid, '00000000-0000-4000-a000-000000070003'::uuid, 'Year 1 Core', 'compulsory', 120, 1, 'all_of'),
  ('00000000-0000-4000-a000-000000070011'::uuid, '00000000-0000-4000-a000-000000070003'::uuid, 'Year 2 Core', 'compulsory', 100, 2, 'all_of'),
  ('00000000-0000-4000-a000-000000070012'::uuid, '00000000-0000-4000-a000-000000070003'::uuid, 'Honours Options', 'elective_required', 80, 3, 'choose_credits'),
  ('00000000-0000-4000-a000-000000070013'::uuid, '00000000-0000-4000-a000-000000070003'::uuid, 'Dissertation', 'thesis', 60, 4, 'all_of')
ON CONFLICT (id) DO NOTHING;

INSERT INTO program_completion_policies (id, program_id, min_total_credits, min_gpa, max_duration_terms,
                                         thesis_min_grade, requires_thesis, code, name)
VALUES ('00000000-0000-4000-a000-000000070020'::uuid,
        '00000000-0000-4000-a000-000000070003'::uuid,
        360, 40, 10, 40, true, 'UK-BSC-STD', 'Standard BSc Completion UK')
ON CONFLICT (id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- 8. USER-DEPENDENT DATA: Modules, Assessment Components, Terms, Prerequisites
--
-- These tables have user_id NOT NULL constraints (from the original modules table).
-- Only insert if at least one user exists in auth.users.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user_id uuid;
  v_cs_ects uuid;
  v_cs_cfu uuid;
  v_cs_cats uuid;
BEGIN
  -- Get first available user (demo context)
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE '039: No auth.users found — skipping module/term seed data. Register a user first, then re-run.';
    RETURN;
  END IF;

  -- Cache credit scheme IDs
  SELECT id INTO v_cs_ects FROM credit_schemes WHERE code = 'ECTS';
  SELECT id INTO v_cs_cfu FROM credit_schemes WHERE code = 'CFU';
  SELECT id INTO v_cs_cats FROM credit_schemes WHERE code = 'CATS';

  -- ── CH Modules ──
  INSERT INTO modules (id, user_id, name, module_code, program_id, requirement_group_id,
                       description, credit_scheme_id, ects_equivalent, is_compulsory, language)
  VALUES
    ('00000000-0000-4000-a000-000000011001'::uuid, v_user_id, 'Programmieren 1', 'INF1001',
     '00000000-0000-4000-a000-000000010003'::uuid, '00000000-0000-4000-a000-000000010010'::uuid,
     'Fundamentals of programming with Java', v_cs_ects, 6, true, 'de'),
    ('00000000-0000-4000-a000-000000011002'::uuid, v_user_id, 'Mathematik 1', 'MAT1001',
     '00000000-0000-4000-a000-000000010003'::uuid, '00000000-0000-4000-a000-000000010010'::uuid,
     'Calculus and linear algebra fundamentals', v_cs_ects, 6, true, 'de'),
    ('00000000-0000-4000-a000-000000011003'::uuid, v_user_id, 'Datenbanken', 'INF2001',
     '00000000-0000-4000-a000-000000010003'::uuid, '00000000-0000-4000-a000-000000010011'::uuid,
     'Database design and SQL', v_cs_ects, 6, true, 'de'),
    ('00000000-0000-4000-a000-000000011004'::uuid, v_user_id, 'Web Engineering', 'INF2002',
     '00000000-0000-4000-a000-000000010003'::uuid, '00000000-0000-4000-a000-000000010011'::uuid,
     'Web application development', v_cs_ects, 6, true, 'de'),
    ('00000000-0000-4000-a000-000000011005'::uuid, v_user_id, 'Software Engineering', 'INF3001',
     '00000000-0000-4000-a000-000000010003'::uuid, '00000000-0000-4000-a000-000000010011'::uuid,
     'Software design patterns', v_cs_ects, 6, true, 'de'),
    ('00000000-0000-4000-a000-000000011006'::uuid, v_user_id, 'Bachelorarbeit', 'THB6000',
     '00000000-0000-4000-a000-000000010003'::uuid, '00000000-0000-4000-a000-000000010013'::uuid,
     'Independent research and thesis', v_cs_ects, 24, true, 'de')
  ON CONFLICT (id) DO NOTHING;

  -- ── CH Assessment Components ──
  INSERT INTO assessment_components (id, module_id, name, component_type, weight_percent,
                                     mandatory_to_pass, min_pass_required, contributes_to_final, sequence_order)
  VALUES
    -- Programmieren 1: Exam 60% + Project 40%
    ('00000000-0000-4000-a000-000000011101'::uuid, '00000000-0000-4000-a000-000000011001'::uuid,
     'Schriftliche Prüfung', 'written_exam', 60, true, true, true, 1),
    ('00000000-0000-4000-a000-000000011102'::uuid, '00000000-0000-4000-a000-000000011001'::uuid,
     'Projektarbeit', 'project', 40, false, false, true, 2),
    -- Mathematik 1: Exam 100%
    ('00000000-0000-4000-a000-000000011103'::uuid, '00000000-0000-4000-a000-000000011002'::uuid,
     'Schriftliche Prüfung', 'written_exam', 100, true, true, true, 1),
    -- Datenbanken: Exam 70% + Lab 30%
    ('00000000-0000-4000-a000-000000011104'::uuid, '00000000-0000-4000-a000-000000011003'::uuid,
     'Schriftliche Prüfung', 'written_exam', 70, true, true, true, 1),
    ('00000000-0000-4000-a000-000000011105'::uuid, '00000000-0000-4000-a000-000000011003'::uuid,
     'Laborarbeit', 'lab', 30, true, true, true, 2),
    -- Bachelorarbeit: Thesis 80% + Presentation 20%
    ('00000000-0000-4000-a000-000000011106'::uuid, '00000000-0000-4000-a000-000000011006'::uuid,
     'Schriftliche Arbeit', 'thesis', 80, true, true, true, 1),
    ('00000000-0000-4000-a000-000000011107'::uuid, '00000000-0000-4000-a000-000000011006'::uuid,
     'Mündliche Verteidigung', 'oral_exam', 20, true, true, true, 2)
  ON CONFLICT (id) DO NOTHING;

  -- ── CH Prerequisites ──
  INSERT INTO module_prerequisites (module_id, prerequisite_module_id, prerequisite_type, notes)
  VALUES
    -- Datenbanken requires Programmieren 1
    ('00000000-0000-4000-a000-000000011003'::uuid, '00000000-0000-4000-a000-000000011001'::uuid, 'required', 'Programming basics needed'),
    -- Web Engineering requires Datenbanken
    ('00000000-0000-4000-a000-000000011004'::uuid, '00000000-0000-4000-a000-000000011003'::uuid, 'required', 'DB knowledge needed'),
    -- Software Engineering recommends Web Engineering
    ('00000000-0000-4000-a000-000000011005'::uuid, '00000000-0000-4000-a000-000000011004'::uuid, 'recommended', 'Web dev experience helpful')
  ON CONFLICT (module_id, prerequisite_module_id) DO NOTHING;

  -- ── DE Modules ──
  INSERT INTO modules (id, user_id, name, module_code, program_id, requirement_group_id,
                       description, credit_scheme_id, ects_equivalent, is_compulsory, language)
  VALUES
    ('00000000-0000-4000-a000-000000021001'::uuid, v_user_id, 'Einführung in die Informatik', 'IN0001',
     '00000000-0000-4000-a000-000000020003'::uuid, '00000000-0000-4000-a000-000000020010'::uuid,
     'Introduction to computer science', v_cs_ects, 8, true, 'de'),
    ('00000000-0000-4000-a000-000000021002'::uuid, v_user_id, 'Diskrete Strukturen', 'MA0901',
     '00000000-0000-4000-a000-000000020003'::uuid, '00000000-0000-4000-a000-000000020010'::uuid,
     'Discrete mathematics for CS', v_cs_ects, 8, true, 'de'),
    ('00000000-0000-4000-a000-000000021003'::uuid, v_user_id, 'Algorithmen und Datenstrukturen', 'IN0007',
     '00000000-0000-4000-a000-000000020003'::uuid, '00000000-0000-4000-a000-000000020010'::uuid,
     'Algorithms and data structures', v_cs_ects, 6, true, 'de'),
    ('00000000-0000-4000-a000-000000021004'::uuid, v_user_id, 'Bachelorarbeit', 'IN0999',
     '00000000-0000-4000-a000-000000020003'::uuid, '00000000-0000-4000-a000-000000020012'::uuid,
     'Bachelor thesis project', v_cs_ects, 12, true, 'de')
  ON CONFLICT (id) DO NOTHING;

  -- ── DE Assessment Components ──
  INSERT INTO assessment_components (id, module_id, name, component_type, weight_percent,
                                     mandatory_to_pass, min_pass_required, contributes_to_final, sequence_order)
  VALUES
    ('00000000-0000-4000-a000-000000021101'::uuid, '00000000-0000-4000-a000-000000021001'::uuid,
     'Klausur', 'written_exam', 100, true, true, true, 1),
    ('00000000-0000-4000-a000-000000021102'::uuid, '00000000-0000-4000-a000-000000021002'::uuid,
     'Klausur', 'written_exam', 100, true, true, true, 1),
    ('00000000-0000-4000-a000-000000021103'::uuid, '00000000-0000-4000-a000-000000021003'::uuid,
     'Klausur', 'written_exam', 70, true, true, true, 1),
    ('00000000-0000-4000-a000-000000021104'::uuid, '00000000-0000-4000-a000-000000021003'::uuid,
     'Übungsblätter', 'homework', 30, false, false, true, 2),
    ('00000000-0000-4000-a000-000000021105'::uuid, '00000000-0000-4000-a000-000000021004'::uuid,
     'Schriftliche Arbeit', 'thesis', 70, true, true, true, 1),
    ('00000000-0000-4000-a000-000000021106'::uuid, '00000000-0000-4000-a000-000000021004'::uuid,
     'Vortrag', 'presentation', 30, true, true, true, 2)
  ON CONFLICT (id) DO NOTHING;

  -- ── UK Modules ──
  INSERT INTO modules (id, user_id, name, module_code, program_id, requirement_group_id,
                       description, credit_scheme_id, ects_equivalent, is_compulsory, language)
  VALUES
    ('00000000-0000-4000-a000-000000071001'::uuid, v_user_id, 'Introduction to Computation', 'INF1A',
     '00000000-0000-4000-a000-000000070003'::uuid, '00000000-0000-4000-a000-000000070010'::uuid,
     'Fundamental computing concepts', v_cs_cats, 20, true, 'en'),
    ('00000000-0000-4000-a000-000000071002'::uuid, v_user_id, 'Object-Oriented Programming', 'INF1B',
     '00000000-0000-4000-a000-000000070003'::uuid, '00000000-0000-4000-a000-000000070010'::uuid,
     'OOP with Java', v_cs_cats, 20, true, 'en'),
    ('00000000-0000-4000-a000-000000071003'::uuid, v_user_id, 'Algorithms and Data Structures', 'INF2B',
     '00000000-0000-4000-a000-000000070003'::uuid, '00000000-0000-4000-a000-000000070011'::uuid,
     'Advanced algorithms', v_cs_cats, 20, true, 'en'),
    ('00000000-0000-4000-a000-000000071004'::uuid, v_user_id, 'Honours Project', 'INF4P',
     '00000000-0000-4000-a000-000000070003'::uuid, '00000000-0000-4000-a000-000000070013'::uuid,
     'Independent research dissertation', v_cs_cats, 40, true, 'en')
  ON CONFLICT (id) DO NOTHING;

  -- ── UK Assessment Components ──
  INSERT INTO assessment_components (id, module_id, name, component_type, weight_percent,
                                     mandatory_to_pass, min_pass_required, contributes_to_final, sequence_order)
  VALUES
    ('00000000-0000-4000-a000-000000071101'::uuid, '00000000-0000-4000-a000-000000071001'::uuid,
     'Written Examination', 'written_exam', 60, true, true, true, 1),
    ('00000000-0000-4000-a000-000000071102'::uuid, '00000000-0000-4000-a000-000000071001'::uuid,
     'Coursework', 'homework', 40, false, false, true, 2),
    ('00000000-0000-4000-a000-000000071103'::uuid, '00000000-0000-4000-a000-000000071002'::uuid,
     'Examination', 'written_exam', 50, true, true, true, 1),
    ('00000000-0000-4000-a000-000000071104'::uuid, '00000000-0000-4000-a000-000000071002'::uuid,
     'Practical Assignment', 'project', 50, true, true, true, 2),
    ('00000000-0000-4000-a000-000000071105'::uuid, '00000000-0000-4000-a000-000000071004'::uuid,
     'Dissertation', 'thesis', 80, true, true, true, 1),
    ('00000000-0000-4000-a000-000000071106'::uuid, '00000000-0000-4000-a000-000000071004'::uuid,
     'Oral Presentation', 'oral_exam', 20, true, true, true, 2)
  ON CONFLICT (id) DO NOTHING;

  -- ── Academic Terms (CH example) ──
  INSERT INTO academic_terms (id, user_id, institution_id, academic_year_label, term_type,
                              term_number, term_label, start_date, end_date)
  VALUES
    ('00000000-0000-4000-a000-000000019001'::uuid, v_user_id,
     '00000000-0000-4000-a000-000000010001'::uuid,
     '2025/2026', 'semester', 1, 'Herbstsemester 2025', '2025-09-15', '2026-01-31'),
    ('00000000-0000-4000-a000-000000019002'::uuid, v_user_id,
     '00000000-0000-4000-a000-000000010001'::uuid,
     '2025/2026', 'semester', 2, 'Frühlingssemester 2026', '2026-02-16', '2026-06-30')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '039: Demo seed data inserted successfully for user %', v_user_id;
END $$;
