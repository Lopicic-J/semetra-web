-- ═══════════════════════════════════════════════════════════════════════════════
-- 043: DACH Hochschul-Seed — Schweiz, Deutschland, Österreich
--
-- Comprehensive institutional data for the Academic Engine.
-- Covers all major Swiss universities & FHs, top German universities & FHs,
-- and major Austrian universities & FHs.
--
-- Each institution gets faculties + degree programs with ECTS/credit data.
-- Uses ON CONFLICT (id) DO NOTHING to be idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;


-- ══════════════════════════════════════════════════════════════════════════════
-- SCHWEIZ (CH) — Universitäten
-- ══════════════════════════════════════════════════════════════════════════════

-- Institution: ETH Zürich (ETHZ)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100001'::uuid,
       'ETH Zürich',
       'CH', 'university', 'de', 9, 'ETHZ',
       'https://ethz.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100002'::uuid, '00000000-0000-4000-a000-000000100001'::uuid, 'Allgemeine Fakultät', 'ETHZ-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100003'::uuid,
       '00000000-0000-4000-a000-000000100001'::uuid,
       '00000000-0000-4000-a000-000000100002'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'ETHZ-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100004'::uuid,
       '00000000-0000-4000-a000-000000100001'::uuid,
       '00000000-0000-4000-a000-000000100002'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'ETHZ-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100005'::uuid,
       '00000000-0000-4000-a000-000000100001'::uuid,
       '00000000-0000-4000-a000-000000100002'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'ETHZ-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100006'::uuid,
       '00000000-0000-4000-a000-000000100001'::uuid,
       '00000000-0000-4000-a000-000000100002'::uuid,
       'Elektrotechnik und Informationstechnologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'ETHZ-BSC-ELEKTROTECHNIK-UND-I'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100007'::uuid,
       '00000000-0000-4000-a000-000000100001'::uuid,
       '00000000-0000-4000-a000-000000100002'::uuid,
       'Mathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'ETHZ-BSC-MATHEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100008'::uuid,
       '00000000-0000-4000-a000-000000100001'::uuid,
       '00000000-0000-4000-a000-000000100002'::uuid,
       'Physik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'ETHZ-BSC-PHYSIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100009'::uuid,
       '00000000-0000-4000-a000-000000100001'::uuid,
       '00000000-0000-4000-a000-000000100002'::uuid,
       'Architektur', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'ETHZ-BSC-ARCHITEKTUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100010'::uuid,
       '00000000-0000-4000-a000-000000100001'::uuid,
       '00000000-0000-4000-a000-000000100002'::uuid,
       'Bauingenieurwissenschaften', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'ETHZ-BSC-BAUINGENIEURWISSENSC'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: EPF Lausanne (EPFL) (EPFL)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100011'::uuid,
       'EPF Lausanne (EPFL)',
       'CH', 'polytechnic', 'fr', 9, 'EPFL',
       'https://www.epfl.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100012'::uuid, '00000000-0000-4000-a000-000000100011'::uuid, 'Allgemeine Fakultät', 'EPFL-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100013'::uuid,
       '00000000-0000-4000-a000-000000100011'::uuid,
       '00000000-0000-4000-a000-000000100012'::uuid,
       'Informatique', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'EPFL-BSC-INFORMATIQUE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100014'::uuid,
       '00000000-0000-4000-a000-000000100011'::uuid,
       '00000000-0000-4000-a000-000000100012'::uuid,
       'Informatique', 'master', 120,
       cs.id, 120, 4,
       true, 'EPFL-MSC-INFORMATIQUE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100015'::uuid,
       '00000000-0000-4000-a000-000000100011'::uuid,
       '00000000-0000-4000-a000-000000100012'::uuid,
       'Génie mécanique', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'EPFL-BSC-GNIE-MCANIQUE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100016'::uuid,
       '00000000-0000-4000-a000-000000100011'::uuid,
       '00000000-0000-4000-a000-000000100012'::uuid,
       'Génie électrique et électronique', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'EPFL-BSC-GNIE-LECTRIQUE-ET-LE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100017'::uuid,
       '00000000-0000-4000-a000-000000100011'::uuid,
       '00000000-0000-4000-a000-000000100012'::uuid,
       'Mathématiques', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'EPFL-BSC-MATHMATIQUES'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100018'::uuid,
       '00000000-0000-4000-a000-000000100011'::uuid,
       '00000000-0000-4000-a000-000000100012'::uuid,
       'Microtechnique', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'EPFL-BSC-MICROTECHNIQUE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100019'::uuid,
       '00000000-0000-4000-a000-000000100011'::uuid,
       '00000000-0000-4000-a000-000000100012'::uuid,
       'Architecture', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'EPFL-BSC-ARCHITECTURE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Zürich (UZH)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100020'::uuid,
       'Universität Zürich',
       'CH', 'university', 'de', 9, 'UZH',
       'https://www.uzh.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100021'::uuid, '00000000-0000-4000-a000-000000100020'::uuid, 'Allgemeine Fakultät', 'UZH-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100022'::uuid,
       '00000000-0000-4000-a000-000000100020'::uuid,
       '00000000-0000-4000-a000-000000100021'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UZH-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100023'::uuid,
       '00000000-0000-4000-a000-000000100020'::uuid,
       '00000000-0000-4000-a000-000000100021'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'UZH-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100024'::uuid,
       '00000000-0000-4000-a000-000000100020'::uuid,
       '00000000-0000-4000-a000-000000100021'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UZH-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100025'::uuid,
       '00000000-0000-4000-a000-000000100020'::uuid,
       '00000000-0000-4000-a000-000000100021'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UZH-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100026'::uuid,
       '00000000-0000-4000-a000-000000100020'::uuid,
       '00000000-0000-4000-a000-000000100021'::uuid,
       'Rechtswissenschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UZH-BSC-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100027'::uuid,
       '00000000-0000-4000-a000-000000100020'::uuid,
       '00000000-0000-4000-a000-000000100021'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UZH-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100028'::uuid,
       '00000000-0000-4000-a000-000000100020'::uuid,
       '00000000-0000-4000-a000-000000100021'::uuid,
       'Medizin', 'bachelor', 180,
       cs.id, 180, 6,
       false, 'UZH-BSC-MEDIZIN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Bern (UNIBE)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100029'::uuid,
       'Universität Bern',
       'CH', 'university', 'de', 9, 'UNIBE',
       'https://www.unibe.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100030'::uuid, '00000000-0000-4000-a000-000000100029'::uuid, 'Allgemeine Fakultät', 'UNIBE-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100031'::uuid,
       '00000000-0000-4000-a000-000000100029'::uuid,
       '00000000-0000-4000-a000-000000100030'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIBE-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100032'::uuid,
       '00000000-0000-4000-a000-000000100029'::uuid,
       '00000000-0000-4000-a000-000000100030'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIBE-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100033'::uuid,
       '00000000-0000-4000-a000-000000100029'::uuid,
       '00000000-0000-4000-a000-000000100030'::uuid,
       'Rechtswissenschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIBE-BSC-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100034'::uuid,
       '00000000-0000-4000-a000-000000100029'::uuid,
       '00000000-0000-4000-a000-000000100030'::uuid,
       'Medizin', 'bachelor', 180,
       cs.id, 180, 6,
       false, 'UNIBE-BSC-MEDIZIN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100035'::uuid,
       '00000000-0000-4000-a000-000000100029'::uuid,
       '00000000-0000-4000-a000-000000100030'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIBE-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Basel (UNIBAS)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100036'::uuid,
       'Universität Basel',
       'CH', 'university', 'de', 9, 'UNIBAS',
       'https://www.unibas.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100037'::uuid, '00000000-0000-4000-a000-000000100036'::uuid, 'Allgemeine Fakultät', 'UNIBAS-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100038'::uuid,
       '00000000-0000-4000-a000-000000100036'::uuid,
       '00000000-0000-4000-a000-000000100037'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIBAS-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100039'::uuid,
       '00000000-0000-4000-a000-000000100036'::uuid,
       '00000000-0000-4000-a000-000000100037'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIBAS-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100040'::uuid,
       '00000000-0000-4000-a000-000000100036'::uuid,
       '00000000-0000-4000-a000-000000100037'::uuid,
       'Rechtswissenschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIBAS-BSC-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100041'::uuid,
       '00000000-0000-4000-a000-000000100036'::uuid,
       '00000000-0000-4000-a000-000000100037'::uuid,
       'Pharmazeutische Wissenschaften', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIBAS-BSC-PHARMAZEUTISCHE-WISS'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100042'::uuid,
       '00000000-0000-4000-a000-000000100036'::uuid,
       '00000000-0000-4000-a000-000000100037'::uuid,
       'Biologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIBAS-BSC-BIOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Lausanne (UNIL)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100043'::uuid,
       'Universität Lausanne',
       'CH', 'university', 'fr', 9, 'UNIL',
       'https://www.unil.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100044'::uuid, '00000000-0000-4000-a000-000000100043'::uuid, 'Allgemeine Fakultät', 'UNIL-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100045'::uuid,
       '00000000-0000-4000-a000-000000100043'::uuid,
       '00000000-0000-4000-a000-000000100044'::uuid,
       'Informatique', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIL-BSC-INFORMATIQUE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100046'::uuid,
       '00000000-0000-4000-a000-000000100043'::uuid,
       '00000000-0000-4000-a000-000000100044'::uuid,
       'Sciences économiques', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIL-BSC-SCIENCES-CONOMIQUES'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100047'::uuid,
       '00000000-0000-4000-a000-000000100043'::uuid,
       '00000000-0000-4000-a000-000000100044'::uuid,
       'Droit', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIL-BSC-DROIT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100048'::uuid,
       '00000000-0000-4000-a000-000000100043'::uuid,
       '00000000-0000-4000-a000-000000100044'::uuid,
       'Biologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIL-BSC-BIOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100049'::uuid,
       '00000000-0000-4000-a000-000000100043'::uuid,
       '00000000-0000-4000-a000-000000100044'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIL-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Université de Genève (UNIGE)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100050'::uuid,
       'Université de Genève',
       'CH', 'university', 'fr', 9, 'UNIGE',
       'https://www.unige.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100051'::uuid, '00000000-0000-4000-a000-000000100050'::uuid, 'Allgemeine Fakultät', 'UNIGE-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100052'::uuid,
       '00000000-0000-4000-a000-000000100050'::uuid,
       '00000000-0000-4000-a000-000000100051'::uuid,
       'Informatique', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIGE-BSC-INFORMATIQUE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100053'::uuid,
       '00000000-0000-4000-a000-000000100050'::uuid,
       '00000000-0000-4000-a000-000000100051'::uuid,
       'Sciences économiques', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIGE-BSC-SCIENCES-CONOMIQUES'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100054'::uuid,
       '00000000-0000-4000-a000-000000100050'::uuid,
       '00000000-0000-4000-a000-000000100051'::uuid,
       'Droit', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIGE-BSC-DROIT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100055'::uuid,
       '00000000-0000-4000-a000-000000100050'::uuid,
       '00000000-0000-4000-a000-000000100051'::uuid,
       'Relations internationales', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIGE-BSC-RELATIONS-INTERNATIO'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100056'::uuid,
       '00000000-0000-4000-a000-000000100050'::uuid,
       '00000000-0000-4000-a000-000000100051'::uuid,
       'Médecine', 'bachelor', 180,
       cs.id, 180, 6,
       false, 'UNIGE-BSC-MDECINE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität St. Gallen (HSG) (HSG)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100057'::uuid,
       'Universität St. Gallen (HSG)',
       'CH', 'university', 'de', 9, 'HSG',
       'https://www.unisg.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100058'::uuid, '00000000-0000-4000-a000-000000100057'::uuid, 'Allgemeine Fakultät', 'HSG-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100059'::uuid,
       '00000000-0000-4000-a000-000000100057'::uuid,
       '00000000-0000-4000-a000-000000100058'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSG-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100060'::uuid,
       '00000000-0000-4000-a000-000000100057'::uuid,
       '00000000-0000-4000-a000-000000100058'::uuid,
       'Volkswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSG-BSC-VOLKSWIRTSCHAFTSLEHR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100061'::uuid,
       '00000000-0000-4000-a000-000000100057'::uuid,
       '00000000-0000-4000-a000-000000100058'::uuid,
       'Rechtswissenschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSG-BSC-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100062'::uuid,
       '00000000-0000-4000-a000-000000100057'::uuid,
       '00000000-0000-4000-a000-000000100058'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSG-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100063'::uuid,
       '00000000-0000-4000-a000-000000100057'::uuid,
       '00000000-0000-4000-a000-000000100058'::uuid,
       'International Affairs', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSG-BSC-INTERNATIONAL-AFFAIR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Luzern (UNILU)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100064'::uuid,
       'Universität Luzern',
       'CH', 'university', 'de', 9, 'UNILU',
       'https://www.unilu.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100065'::uuid, '00000000-0000-4000-a000-000000100064'::uuid, 'Allgemeine Fakultät', 'UNILU-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100066'::uuid,
       '00000000-0000-4000-a000-000000100064'::uuid,
       '00000000-0000-4000-a000-000000100065'::uuid,
       'Rechtswissenschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNILU-BSC-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100067'::uuid,
       '00000000-0000-4000-a000-000000100064'::uuid,
       '00000000-0000-4000-a000-000000100065'::uuid,
       'Wirtschaftswissenschaften', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNILU-BSC-WIRTSCHAFTSWISSENSCH'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100068'::uuid,
       '00000000-0000-4000-a000-000000100064'::uuid,
       '00000000-0000-4000-a000-000000100065'::uuid,
       'Theologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNILU-BSC-THEOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100069'::uuid,
       '00000000-0000-4000-a000-000000100064'::uuid,
       '00000000-0000-4000-a000-000000100065'::uuid,
       'Gesundheitswissenschaften', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNILU-BSC-GESUNDHEITSWISSENSCH'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Freiburg (UNIFR)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100070'::uuid,
       'Universität Freiburg',
       'CH', 'university', 'de', 9, 'UNIFR',
       'https://www.unifr.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100071'::uuid, '00000000-0000-4000-a000-000000100070'::uuid, 'Allgemeine Fakultät', 'UNIFR-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100072'::uuid,
       '00000000-0000-4000-a000-000000100070'::uuid,
       '00000000-0000-4000-a000-000000100071'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIFR-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100073'::uuid,
       '00000000-0000-4000-a000-000000100070'::uuid,
       '00000000-0000-4000-a000-000000100071'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIFR-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100074'::uuid,
       '00000000-0000-4000-a000-000000100070'::uuid,
       '00000000-0000-4000-a000-000000100071'::uuid,
       'Rechtswissenschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIFR-BSC-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100075'::uuid,
       '00000000-0000-4000-a000-000000100070'::uuid,
       '00000000-0000-4000-a000-000000100071'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIFR-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Università della Svizzera italiana (USI)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100076'::uuid,
       'Università della Svizzera italiana',
       'CH', 'university', 'it', 9, 'USI',
       'https://www.usi.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100077'::uuid, '00000000-0000-4000-a000-000000100076'::uuid, 'Allgemeine Fakultät', 'USI-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100078'::uuid,
       '00000000-0000-4000-a000-000000100076'::uuid,
       '00000000-0000-4000-a000-000000100077'::uuid,
       'Informatica', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'USI-BSC-INFORMATICA'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100079'::uuid,
       '00000000-0000-4000-a000-000000100076'::uuid,
       '00000000-0000-4000-a000-000000100077'::uuid,
       'Economia', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'USI-BSC-ECONOMIA'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100080'::uuid,
       '00000000-0000-4000-a000-000000100076'::uuid,
       '00000000-0000-4000-a000-000000100077'::uuid,
       'Comunicazione', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'USI-BSC-COMUNICAZIONE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100081'::uuid,
       '00000000-0000-4000-a000-000000100076'::uuid,
       '00000000-0000-4000-a000-000000100077'::uuid,
       'Architettura', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'USI-BSC-ARCHITETTURA'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Université de Neuchâtel (UNINE)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100082'::uuid,
       'Université de Neuchâtel',
       'CH', 'university', 'fr', 9, 'UNINE',
       'https://www.unine.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100083'::uuid, '00000000-0000-4000-a000-000000100082'::uuid, 'Allgemeine Fakultät', 'UNINE-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100084'::uuid,
       '00000000-0000-4000-a000-000000100082'::uuid,
       '00000000-0000-4000-a000-000000100083'::uuid,
       'Informatique', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNINE-BSC-INFORMATIQUE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100085'::uuid,
       '00000000-0000-4000-a000-000000100082'::uuid,
       '00000000-0000-4000-a000-000000100083'::uuid,
       'Sciences économiques', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNINE-BSC-SCIENCES-CONOMIQUES'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100086'::uuid,
       '00000000-0000-4000-a000-000000100082'::uuid,
       '00000000-0000-4000-a000-000000100083'::uuid,
       'Droit', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNINE-BSC-DROIT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100087'::uuid,
       '00000000-0000-4000-a000-000000100082'::uuid,
       '00000000-0000-4000-a000-000000100083'::uuid,
       'Biologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNINE-BSC-BIOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- SCHWEIZ (CH) — Fachhochschulen
-- ══════════════════════════════════════════════════════════════════════════════

-- Institution: Fachhochschule Nordwestschweiz (FHNW) (FHNW)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100088'::uuid,
       'Fachhochschule Nordwestschweiz (FHNW)',
       'CH', 'university_of_applied_sciences', 'de', 9, 'FHNW',
       'https://www.fhnw.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100089'::uuid, '00000000-0000-4000-a000-000000100088'::uuid, 'Departement Technik & Informatik', 'FHNW-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100090'::uuid,
       '00000000-0000-4000-a000-000000100088'::uuid,
       '00000000-0000-4000-a000-000000100089'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHNW-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100091'::uuid,
       '00000000-0000-4000-a000-000000100088'::uuid,
       '00000000-0000-4000-a000-000000100089'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHNW-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100092'::uuid,
       '00000000-0000-4000-a000-000000100088'::uuid,
       '00000000-0000-4000-a000-000000100089'::uuid,
       'Betriebsökonomie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHNW-BSC-BETRIEBSKONOMIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100093'::uuid,
       '00000000-0000-4000-a000-000000100088'::uuid,
       '00000000-0000-4000-a000-000000100089'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHNW-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100094'::uuid,
       '00000000-0000-4000-a000-000000100088'::uuid,
       '00000000-0000-4000-a000-000000100089'::uuid,
       'Elektro- und Informationstechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHNW-BSC-ELEKTRO--UND-INFORMA'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100095'::uuid,
       '00000000-0000-4000-a000-000000100088'::uuid,
       '00000000-0000-4000-a000-000000100089'::uuid,
       'Data Science', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHNW-BSC-DATA-SCIENCE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Berner Fachhochschule (BFH) (BFH)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100096'::uuid,
       'Berner Fachhochschule (BFH)',
       'CH', 'university_of_applied_sciences', 'de', 9, 'BFH',
       'https://www.bfh.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100097'::uuid, '00000000-0000-4000-a000-000000100096'::uuid, 'Departement Technik & Informatik', 'BFH-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100098'::uuid,
       '00000000-0000-4000-a000-000000100096'::uuid,
       '00000000-0000-4000-a000-000000100097'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'BFH-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100099'::uuid,
       '00000000-0000-4000-a000-000000100096'::uuid,
       '00000000-0000-4000-a000-000000100097'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'BFH-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100100'::uuid,
       '00000000-0000-4000-a000-000000100096'::uuid,
       '00000000-0000-4000-a000-000000100097'::uuid,
       'Betriebsökonomie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'BFH-BSC-BETRIEBSKONOMIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100101'::uuid,
       '00000000-0000-4000-a000-000000100096'::uuid,
       '00000000-0000-4000-a000-000000100097'::uuid,
       'Medizininformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'BFH-BSC-MEDIZININFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100102'::uuid,
       '00000000-0000-4000-a000-000000100096'::uuid,
       '00000000-0000-4000-a000-000000100097'::uuid,
       'Maschinentechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'BFH-BSC-MASCHINENTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100103'::uuid,
       '00000000-0000-4000-a000-000000100096'::uuid,
       '00000000-0000-4000-a000-000000100097'::uuid,
       'Automobil- und Fahrzeugtechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'BFH-BSC-AUTOMOBIL--UND-FAHRZ'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Hochschule Luzern (HSLU) (HSLU)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100104'::uuid,
       'Hochschule Luzern (HSLU)',
       'CH', 'university_of_applied_sciences', 'de', 9, 'HSLU',
       'https://www.hslu.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100105'::uuid, '00000000-0000-4000-a000-000000100104'::uuid, 'Departement Technik & Informatik', 'HSLU-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100106'::uuid,
       '00000000-0000-4000-a000-000000100104'::uuid,
       '00000000-0000-4000-a000-000000100105'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSLU-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100107'::uuid,
       '00000000-0000-4000-a000-000000100104'::uuid,
       '00000000-0000-4000-a000-000000100105'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSLU-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100108'::uuid,
       '00000000-0000-4000-a000-000000100104'::uuid,
       '00000000-0000-4000-a000-000000100105'::uuid,
       'Betriebsökonomie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSLU-BSC-BETRIEBSKONOMIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100109'::uuid,
       '00000000-0000-4000-a000-000000100104'::uuid,
       '00000000-0000-4000-a000-000000100105'::uuid,
       'Digital Ideation', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSLU-BSC-DIGITAL-IDEATION'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100110'::uuid,
       '00000000-0000-4000-a000-000000100104'::uuid,
       '00000000-0000-4000-a000-000000100105'::uuid,
       'Artificial Intelligence & Machine Learning', 'master', 90,
       cs.id, 90, 3,
       true, 'HSLU-MSC-ARTIFICIAL-INTELLIGE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100111'::uuid,
       '00000000-0000-4000-a000-000000100104'::uuid,
       '00000000-0000-4000-a000-000000100105'::uuid,
       'Elektrotechnik und Informationstechnologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSLU-BSC-ELEKTROTECHNIK-UND-I'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Haute école spécialisée de Suisse occidentale (HES-SO) (HESSO)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100112'::uuid,
       'Haute école spécialisée de Suisse occidentale (HES-SO)',
       'CH', 'university_of_applied_sciences', 'fr', 9, 'HESSO',
       'https://www.hes-so.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100113'::uuid, '00000000-0000-4000-a000-000000100112'::uuid, 'Departement Technik & Informatik', 'HESSO-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100114'::uuid,
       '00000000-0000-4000-a000-000000100112'::uuid,
       '00000000-0000-4000-a000-000000100113'::uuid,
       'Informatique de gestion', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HESSO-BSC-INFORMATIQUE-DE-GEST'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100115'::uuid,
       '00000000-0000-4000-a000-000000100112'::uuid,
       '00000000-0000-4000-a000-000000100113'::uuid,
       'Ingénierie des technologies de l''information', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HESSO-BSC-INGNIERIE-DES-TECHNO'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100116'::uuid,
       '00000000-0000-4000-a000-000000100112'::uuid,
       '00000000-0000-4000-a000-000000100113'::uuid,
       'Économie d''entreprise', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HESSO-BSC-CONOMIE-DENTREPRISE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100117'::uuid,
       '00000000-0000-4000-a000-000000100112'::uuid,
       '00000000-0000-4000-a000-000000100113'::uuid,
       'Génie mécanique', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HESSO-BSC-GNIE-MCANIQUE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100118'::uuid,
       '00000000-0000-4000-a000-000000100112'::uuid,
       '00000000-0000-4000-a000-000000100113'::uuid,
       'Soins infirmiers', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HESSO-BSC-SOINS-INFIRMIERS'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Scuola universitaria professionale della Svizzera italiana (SUPSI) (SUPSI)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100119'::uuid,
       'Scuola universitaria professionale della Svizzera italiana (SUPSI)',
       'CH', 'university_of_applied_sciences', 'it', 9, 'SUPSI',
       'https://www.supsi.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100120'::uuid, '00000000-0000-4000-a000-000000100119'::uuid, 'Departement Technik & Informatik', 'SUPSI-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100121'::uuid,
       '00000000-0000-4000-a000-000000100119'::uuid,
       '00000000-0000-4000-a000-000000100120'::uuid,
       'Ingegneria informatica', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'SUPSI-BSC-INGEGNERIA-INFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100122'::uuid,
       '00000000-0000-4000-a000-000000100119'::uuid,
       '00000000-0000-4000-a000-000000100120'::uuid,
       'Economia aziendale', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'SUPSI-BSC-ECONOMIA-AZIENDALE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100123'::uuid,
       '00000000-0000-4000-a000-000000100119'::uuid,
       '00000000-0000-4000-a000-000000100120'::uuid,
       'Ingegneria meccanica', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'SUPSI-BSC-INGEGNERIA-MECCANICA'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100124'::uuid,
       '00000000-0000-4000-a000-000000100119'::uuid,
       '00000000-0000-4000-a000-000000100120'::uuid,
       'Ingegneria elettronica', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'SUPSI-BSC-INGEGNERIA-ELETTRONI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: OST – Ostschweizer Fachhochschule (OST)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100125'::uuid,
       'OST – Ostschweizer Fachhochschule',
       'CH', 'university_of_applied_sciences', 'de', 9, 'OST',
       'https://www.ost.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100126'::uuid, '00000000-0000-4000-a000-000000100125'::uuid, 'Departement Technik & Informatik', 'OST-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100127'::uuid,
       '00000000-0000-4000-a000-000000100125'::uuid,
       '00000000-0000-4000-a000-000000100126'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'OST-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100128'::uuid,
       '00000000-0000-4000-a000-000000100125'::uuid,
       '00000000-0000-4000-a000-000000100126'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'OST-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100129'::uuid,
       '00000000-0000-4000-a000-000000100125'::uuid,
       '00000000-0000-4000-a000-000000100126'::uuid,
       'Wirtschaftsingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'OST-BSC-WIRTSCHAFTSINGENIEUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100130'::uuid,
       '00000000-0000-4000-a000-000000100125'::uuid,
       '00000000-0000-4000-a000-000000100126'::uuid,
       'Maschinentechnik | Innovation', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'OST-BSC-MASCHINENTECHNIK--IN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100131'::uuid,
       '00000000-0000-4000-a000-000000100125'::uuid,
       '00000000-0000-4000-a000-000000100126'::uuid,
       'Elektrotechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'OST-BSC-ELEKTROTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Fernfachhochschule Schweiz (FFHS) (FFHS)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100132'::uuid,
       'Fernfachhochschule Schweiz (FFHS)',
       'CH', 'university_of_applied_sciences', 'de', 9, 'FFHS',
       'https://www.ffhs.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100133'::uuid, '00000000-0000-4000-a000-000000100132'::uuid, 'Departement Technik & Informatik', 'FFHS-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100134'::uuid,
       '00000000-0000-4000-a000-000000100132'::uuid,
       '00000000-0000-4000-a000-000000100133'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 9,
       true, 'FFHS-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100135'::uuid,
       '00000000-0000-4000-a000-000000100132'::uuid,
       '00000000-0000-4000-a000-000000100133'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 9,
       true, 'FFHS-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100136'::uuid,
       '00000000-0000-4000-a000-000000100132'::uuid,
       '00000000-0000-4000-a000-000000100133'::uuid,
       'Betriebsökonomie', 'bachelor', 180,
       cs.id, 180, 9,
       true, 'FFHS-BSC-BETRIEBSKONOMIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Fachhochschule Graubünden (FHGR) (FHGR)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100137'::uuid,
       'Fachhochschule Graubünden (FHGR)',
       'CH', 'university_of_applied_sciences', 'de', 9, 'FHGR',
       'https://www.fhgr.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100138'::uuid, '00000000-0000-4000-a000-000000100137'::uuid, 'Departement Technik & Informatik', 'FHGR-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100139'::uuid,
       '00000000-0000-4000-a000-000000100137'::uuid,
       '00000000-0000-4000-a000-000000100138'::uuid,
       'Computational and Data Science', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHGR-BSC-COMPUTATIONAL-AND-DA'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100140'::uuid,
       '00000000-0000-4000-a000-000000100137'::uuid,
       '00000000-0000-4000-a000-000000100138'::uuid,
       'Mobile Robotics', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHGR-BSC-MOBILE-ROBOTICS'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100141'::uuid,
       '00000000-0000-4000-a000-000000100137'::uuid,
       '00000000-0000-4000-a000-000000100138'::uuid,
       'Betriebsökonomie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHGR-BSC-BETRIEBSKONOMIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100142'::uuid,
       '00000000-0000-4000-a000-000000100137'::uuid,
       '00000000-0000-4000-a000-000000100138'::uuid,
       'Tourismus', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHGR-BSC-TOURISMUS'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Kalaidos Fachhochschule (KALAIDOS)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100143'::uuid,
       'Kalaidos Fachhochschule',
       'CH', 'university_of_applied_sciences', 'de', 9, 'KALAIDOS',
       'https://www.kalaidos-fh.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100144'::uuid, '00000000-0000-4000-a000-000000100143'::uuid, 'Departement Technik & Informatik', 'KALAIDOS-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100145'::uuid,
       '00000000-0000-4000-a000-000000100143'::uuid,
       '00000000-0000-4000-a000-000000100144'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'KALAIDOS-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100146'::uuid,
       '00000000-0000-4000-a000-000000100143'::uuid,
       '00000000-0000-4000-a000-000000100144'::uuid,
       'Betriebsökonomie', 'bachelor', 180,
       cs.id, 180, 8,
       true, 'KALAIDOS-BSC-BETRIEBSKONOMIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100147'::uuid,
       '00000000-0000-4000-a000-000000100143'::uuid,
       '00000000-0000-4000-a000-000000100144'::uuid,
       'Recht', 'bachelor', 180,
       cs.id, 180, 8,
       true, 'KALAIDOS-BSC-RECHT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Zürcher Hochschule der Künste (ZHdK) (ZHDK)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100148'::uuid,
       'Zürcher Hochschule der Künste (ZHdK)',
       'CH', 'university_of_applied_sciences', 'de', 9, 'ZHDK',
       'https://www.zhdk.ch',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'CH_1_6' AND rp.code = 'ROUND_025'
  AND pp.code = 'THRESHOLD_PLUS_MANDATORY' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100149'::uuid, '00000000-0000-4000-a000-000000100148'::uuid, 'Departement Technik & Informatik', 'ZHDK-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100150'::uuid,
       '00000000-0000-4000-a000-000000100148'::uuid,
       '00000000-0000-4000-a000-000000100149'::uuid,
       'Interaction Design', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'ZHDK-BSC-INTERACTION-DESIGN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100151'::uuid,
       '00000000-0000-4000-a000-000000100148'::uuid,
       '00000000-0000-4000-a000-000000100149'::uuid,
       'Industrial Design', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'ZHDK-BSC-INDUSTRIAL-DESIGN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100152'::uuid,
       '00000000-0000-4000-a000-000000100148'::uuid,
       '00000000-0000-4000-a000-000000100149'::uuid,
       'Visuelle Kommunikation', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'ZHDK-BSC-VISUELLE-KOMMUNIKATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100153'::uuid,
       '00000000-0000-4000-a000-000000100148'::uuid,
       '00000000-0000-4000-a000-000000100149'::uuid,
       'Film', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'ZHDK-BSC-FILM'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- DEUTSCHLAND (DE) — Universitäten
-- ══════════════════════════════════════════════════════════════════════════════

-- Institution: Ludwig-Maximilians-Universität München (LMU)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100154'::uuid,
       'Ludwig-Maximilians-Universität München',
       'DE', 'university', 'de', 10, 'LMU',
       'https://www.lmu.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100155'::uuid, '00000000-0000-4000-a000-000000100154'::uuid, 'Allgemeine Fakultät', 'LMU-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100156'::uuid,
       '00000000-0000-4000-a000-000000100154'::uuid,
       '00000000-0000-4000-a000-000000100155'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'LMU-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100157'::uuid,
       '00000000-0000-4000-a000-000000100154'::uuid,
       '00000000-0000-4000-a000-000000100155'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'LMU-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100158'::uuid,
       '00000000-0000-4000-a000-000000100154'::uuid,
       '00000000-0000-4000-a000-000000100155'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'LMU-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100159'::uuid,
       '00000000-0000-4000-a000-000000100154'::uuid,
       '00000000-0000-4000-a000-000000100155'::uuid,
       'Rechtswissenschaft', 'diploma', 270,
       cs.id, 270, 9,
       true, 'LMU-DIP-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100160'::uuid,
       '00000000-0000-4000-a000-000000100154'::uuid,
       '00000000-0000-4000-a000-000000100155'::uuid,
       'Medizin', 'diploma', 360,
       cs.id, 360, 12,
       false, 'LMU-DIP-MEDIZIN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100161'::uuid,
       '00000000-0000-4000-a000-000000100154'::uuid,
       '00000000-0000-4000-a000-000000100155'::uuid,
       'Mathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'LMU-BSC-MATHEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100162'::uuid,
       '00000000-0000-4000-a000-000000100154'::uuid,
       '00000000-0000-4000-a000-000000100155'::uuid,
       'Physik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'LMU-BSC-PHYSIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Ruprecht-Karls-Universität Heidelberg (UHEI)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100163'::uuid,
       'Ruprecht-Karls-Universität Heidelberg',
       'DE', 'university', 'de', 10, 'UHEI',
       'https://www.uni-heidelberg.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100164'::uuid, '00000000-0000-4000-a000-000000100163'::uuid, 'Allgemeine Fakultät', 'UHEI-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100165'::uuid,
       '00000000-0000-4000-a000-000000100163'::uuid,
       '00000000-0000-4000-a000-000000100164'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UHEI-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100166'::uuid,
       '00000000-0000-4000-a000-000000100163'::uuid,
       '00000000-0000-4000-a000-000000100164'::uuid,
       'Mathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UHEI-BSC-MATHEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100167'::uuid,
       '00000000-0000-4000-a000-000000100163'::uuid,
       '00000000-0000-4000-a000-000000100164'::uuid,
       'Physik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UHEI-BSC-PHYSIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100168'::uuid,
       '00000000-0000-4000-a000-000000100163'::uuid,
       '00000000-0000-4000-a000-000000100164'::uuid,
       'Medizin', 'diploma', 360,
       cs.id, 360, 12,
       false, 'UHEI-DIP-MEDIZIN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100169'::uuid,
       '00000000-0000-4000-a000-000000100163'::uuid,
       '00000000-0000-4000-a000-000000100164'::uuid,
       'Rechtswissenschaft', 'diploma', 270,
       cs.id, 270, 9,
       true, 'UHEI-DIP-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100170'::uuid,
       '00000000-0000-4000-a000-000000100163'::uuid,
       '00000000-0000-4000-a000-000000100164'::uuid,
       'Biologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UHEI-BSC-BIOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Humboldt-Universität zu Berlin (HUB)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100171'::uuid,
       'Humboldt-Universität zu Berlin',
       'DE', 'university', 'de', 10, 'HUB',
       'https://www.hu-berlin.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100172'::uuid, '00000000-0000-4000-a000-000000100171'::uuid, 'Allgemeine Fakultät', 'HUB-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100173'::uuid,
       '00000000-0000-4000-a000-000000100171'::uuid,
       '00000000-0000-4000-a000-000000100172'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HUB-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100174'::uuid,
       '00000000-0000-4000-a000-000000100171'::uuid,
       '00000000-0000-4000-a000-000000100172'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'HUB-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100175'::uuid,
       '00000000-0000-4000-a000-000000100171'::uuid,
       '00000000-0000-4000-a000-000000100172'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HUB-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100176'::uuid,
       '00000000-0000-4000-a000-000000100171'::uuid,
       '00000000-0000-4000-a000-000000100172'::uuid,
       'Rechtswissenschaft', 'diploma', 270,
       cs.id, 270, 9,
       true, 'HUB-DIP-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100177'::uuid,
       '00000000-0000-4000-a000-000000100171'::uuid,
       '00000000-0000-4000-a000-000000100172'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HUB-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Freie Universität Berlin (FUB)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100178'::uuid,
       'Freie Universität Berlin',
       'DE', 'university', 'de', 10, 'FUB',
       'https://www.fu-berlin.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100179'::uuid, '00000000-0000-4000-a000-000000100178'::uuid, 'Allgemeine Fakultät', 'FUB-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100180'::uuid,
       '00000000-0000-4000-a000-000000100178'::uuid,
       '00000000-0000-4000-a000-000000100179'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FUB-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100181'::uuid,
       '00000000-0000-4000-a000-000000100178'::uuid,
       '00000000-0000-4000-a000-000000100179'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'FUB-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100182'::uuid,
       '00000000-0000-4000-a000-000000100178'::uuid,
       '00000000-0000-4000-a000-000000100179'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FUB-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100183'::uuid,
       '00000000-0000-4000-a000-000000100178'::uuid,
       '00000000-0000-4000-a000-000000100179'::uuid,
       'Mathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FUB-BSC-MATHEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100184'::uuid,
       '00000000-0000-4000-a000-000000100178'::uuid,
       '00000000-0000-4000-a000-000000100179'::uuid,
       'Bioinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FUB-BSC-BIOINFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Technische Universität Berlin (TUB)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100185'::uuid,
       'Technische Universität Berlin',
       'DE', 'university', 'de', 10, 'TUB',
       'https://www.tu-berlin.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100186'::uuid, '00000000-0000-4000-a000-000000100185'::uuid, 'Allgemeine Fakultät', 'TUB-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100187'::uuid,
       '00000000-0000-4000-a000-000000100185'::uuid,
       '00000000-0000-4000-a000-000000100186'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUB-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100188'::uuid,
       '00000000-0000-4000-a000-000000100185'::uuid,
       '00000000-0000-4000-a000-000000100186'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'TUB-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100189'::uuid,
       '00000000-0000-4000-a000-000000100185'::uuid,
       '00000000-0000-4000-a000-000000100186'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUB-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100190'::uuid,
       '00000000-0000-4000-a000-000000100185'::uuid,
       '00000000-0000-4000-a000-000000100186'::uuid,
       'Elektrotechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUB-BSC-ELEKTROTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100191'::uuid,
       '00000000-0000-4000-a000-000000100185'::uuid,
       '00000000-0000-4000-a000-000000100186'::uuid,
       'Wirtschaftsingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUB-BSC-WIRTSCHAFTSINGENIEUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100192'::uuid,
       '00000000-0000-4000-a000-000000100185'::uuid,
       '00000000-0000-4000-a000-000000100186'::uuid,
       'Bauingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUB-BSC-BAUINGENIEURWESEN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: RWTH Aachen (RWTH)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100193'::uuid,
       'RWTH Aachen',
       'DE', 'university', 'de', 10, 'RWTH',
       'https://www.rwth-aachen.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100194'::uuid, '00000000-0000-4000-a000-000000100193'::uuid, 'Allgemeine Fakultät', 'RWTH-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100195'::uuid,
       '00000000-0000-4000-a000-000000100193'::uuid,
       '00000000-0000-4000-a000-000000100194'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'RWTH-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100196'::uuid,
       '00000000-0000-4000-a000-000000100193'::uuid,
       '00000000-0000-4000-a000-000000100194'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'RWTH-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100197'::uuid,
       '00000000-0000-4000-a000-000000100193'::uuid,
       '00000000-0000-4000-a000-000000100194'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'RWTH-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100198'::uuid,
       '00000000-0000-4000-a000-000000100193'::uuid,
       '00000000-0000-4000-a000-000000100194'::uuid,
       'Elektrotechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'RWTH-BSC-ELEKTROTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100199'::uuid,
       '00000000-0000-4000-a000-000000100193'::uuid,
       '00000000-0000-4000-a000-000000100194'::uuid,
       'Wirtschaftsingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'RWTH-BSC-WIRTSCHAFTSINGENIEUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100200'::uuid,
       '00000000-0000-4000-a000-000000100193'::uuid,
       '00000000-0000-4000-a000-000000100194'::uuid,
       'Bauingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'RWTH-BSC-BAUINGENIEURWESEN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100201'::uuid,
       '00000000-0000-4000-a000-000000100193'::uuid,
       '00000000-0000-4000-a000-000000100194'::uuid,
       'Data Science', 'master', 120,
       cs.id, 120, 4,
       true, 'RWTH-MSC-DATA-SCIENCE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Albert-Ludwigs-Universität Freiburg (UNIFR_DE)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100202'::uuid,
       'Albert-Ludwigs-Universität Freiburg',
       'DE', 'university', 'de', 10, 'UNIFR_DE',
       'https://www.uni-freiburg.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100203'::uuid, '00000000-0000-4000-a000-000000100202'::uuid, 'Allgemeine Fakultät', 'UNIFR_DE-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100204'::uuid,
       '00000000-0000-4000-a000-000000100202'::uuid,
       '00000000-0000-4000-a000-000000100203'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIFR_DE-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100205'::uuid,
       '00000000-0000-4000-a000-000000100202'::uuid,
       '00000000-0000-4000-a000-000000100203'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIFR_DE-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100206'::uuid,
       '00000000-0000-4000-a000-000000100202'::uuid,
       '00000000-0000-4000-a000-000000100203'::uuid,
       'Rechtswissenschaft', 'diploma', 270,
       cs.id, 270, 9,
       true, 'UNIFR_DE-DIP-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100207'::uuid,
       '00000000-0000-4000-a000-000000100202'::uuid,
       '00000000-0000-4000-a000-000000100203'::uuid,
       'Biologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIFR_DE-BSC-BIOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100208'::uuid,
       '00000000-0000-4000-a000-000000100202'::uuid,
       '00000000-0000-4000-a000-000000100203'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIFR_DE-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Eberhard Karls Universität Tübingen (UNITUE)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100209'::uuid,
       'Eberhard Karls Universität Tübingen',
       'DE', 'university', 'de', 10, 'UNITUE',
       'https://www.uni-tuebingen.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100210'::uuid, '00000000-0000-4000-a000-000000100209'::uuid, 'Allgemeine Fakultät', 'UNITUE-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100211'::uuid,
       '00000000-0000-4000-a000-000000100209'::uuid,
       '00000000-0000-4000-a000-000000100210'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNITUE-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100212'::uuid,
       '00000000-0000-4000-a000-000000100209'::uuid,
       '00000000-0000-4000-a000-000000100210'::uuid,
       'Medizin', 'diploma', 360,
       cs.id, 360, 12,
       false, 'UNITUE-DIP-MEDIZIN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100213'::uuid,
       '00000000-0000-4000-a000-000000100209'::uuid,
       '00000000-0000-4000-a000-000000100210'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNITUE-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100214'::uuid,
       '00000000-0000-4000-a000-000000100209'::uuid,
       '00000000-0000-4000-a000-000000100210'::uuid,
       'Mathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNITUE-BSC-MATHEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100215'::uuid,
       '00000000-0000-4000-a000-000000100209'::uuid,
       '00000000-0000-4000-a000-000000100210'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNITUE-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Georg-August-Universität Göttingen (UGOE)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100216'::uuid,
       'Georg-August-Universität Göttingen',
       'DE', 'university', 'de', 10, 'UGOE',
       'https://www.uni-goettingen.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100217'::uuid, '00000000-0000-4000-a000-000000100216'::uuid, 'Allgemeine Fakultät', 'UGOE-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100218'::uuid,
       '00000000-0000-4000-a000-000000100216'::uuid,
       '00000000-0000-4000-a000-000000100217'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UGOE-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100219'::uuid,
       '00000000-0000-4000-a000-000000100216'::uuid,
       '00000000-0000-4000-a000-000000100217'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UGOE-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100220'::uuid,
       '00000000-0000-4000-a000-000000100216'::uuid,
       '00000000-0000-4000-a000-000000100217'::uuid,
       'Rechtswissenschaft', 'diploma', 270,
       cs.id, 270, 9,
       true, 'UGOE-DIP-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100221'::uuid,
       '00000000-0000-4000-a000-000000100216'::uuid,
       '00000000-0000-4000-a000-000000100217'::uuid,
       'Mathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UGOE-BSC-MATHEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100222'::uuid,
       '00000000-0000-4000-a000-000000100216'::uuid,
       '00000000-0000-4000-a000-000000100217'::uuid,
       'Biologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UGOE-BSC-BIOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Karlsruher Institut für Technologie (KIT) (KIT)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100223'::uuid,
       'Karlsruher Institut für Technologie (KIT)',
       'DE', 'university', 'de', 10, 'KIT',
       'https://www.kit.edu',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100224'::uuid, '00000000-0000-4000-a000-000000100223'::uuid, 'Allgemeine Fakultät', 'KIT-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100225'::uuid,
       '00000000-0000-4000-a000-000000100223'::uuid,
       '00000000-0000-4000-a000-000000100224'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'KIT-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100226'::uuid,
       '00000000-0000-4000-a000-000000100223'::uuid,
       '00000000-0000-4000-a000-000000100224'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'KIT-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100227'::uuid,
       '00000000-0000-4000-a000-000000100223'::uuid,
       '00000000-0000-4000-a000-000000100224'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'KIT-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100228'::uuid,
       '00000000-0000-4000-a000-000000100223'::uuid,
       '00000000-0000-4000-a000-000000100224'::uuid,
       'Elektrotechnik und Informationstechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'KIT-BSC-ELEKTROTECHNIK-UND-I'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100229'::uuid,
       '00000000-0000-4000-a000-000000100223'::uuid,
       '00000000-0000-4000-a000-000000100224'::uuid,
       'Wirtschaftsingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'KIT-BSC-WIRTSCHAFTSINGENIEUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100230'::uuid,
       '00000000-0000-4000-a000-000000100223'::uuid,
       '00000000-0000-4000-a000-000000100224'::uuid,
       'Mathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'KIT-BSC-MATHEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100231'::uuid,
       '00000000-0000-4000-a000-000000100223'::uuid,
       '00000000-0000-4000-a000-000000100224'::uuid,
       'Physik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'KIT-BSC-PHYSIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Technische Universität Dresden (TUDD)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100232'::uuid,
       'Technische Universität Dresden',
       'DE', 'university', 'de', 10, 'TUDD',
       'https://www.tu-dresden.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100233'::uuid, '00000000-0000-4000-a000-000000100232'::uuid, 'Allgemeine Fakultät', 'TUDD-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100234'::uuid,
       '00000000-0000-4000-a000-000000100232'::uuid,
       '00000000-0000-4000-a000-000000100233'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUDD-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100235'::uuid,
       '00000000-0000-4000-a000-000000100232'::uuid,
       '00000000-0000-4000-a000-000000100233'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUDD-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100236'::uuid,
       '00000000-0000-4000-a000-000000100232'::uuid,
       '00000000-0000-4000-a000-000000100233'::uuid,
       'Elektrotechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUDD-BSC-ELEKTROTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100237'::uuid,
       '00000000-0000-4000-a000-000000100232'::uuid,
       '00000000-0000-4000-a000-000000100233'::uuid,
       'Wirtschaftsingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUDD-BSC-WIRTSCHAFTSINGENIEUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100238'::uuid,
       '00000000-0000-4000-a000-000000100232'::uuid,
       '00000000-0000-4000-a000-000000100233'::uuid,
       'Mathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUDD-BSC-MATHEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Hamburg (UHAM)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100239'::uuid,
       'Universität Hamburg',
       'DE', 'university', 'de', 10, 'UHAM',
       'https://www.uni-hamburg.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100240'::uuid, '00000000-0000-4000-a000-000000100239'::uuid, 'Allgemeine Fakultät', 'UHAM-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100241'::uuid,
       '00000000-0000-4000-a000-000000100239'::uuid,
       '00000000-0000-4000-a000-000000100240'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UHAM-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100242'::uuid,
       '00000000-0000-4000-a000-000000100239'::uuid,
       '00000000-0000-4000-a000-000000100240'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UHAM-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100243'::uuid,
       '00000000-0000-4000-a000-000000100239'::uuid,
       '00000000-0000-4000-a000-000000100240'::uuid,
       'Rechtswissenschaft', 'diploma', 270,
       cs.id, 270, 9,
       true, 'UHAM-DIP-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100244'::uuid,
       '00000000-0000-4000-a000-000000100239'::uuid,
       '00000000-0000-4000-a000-000000100240'::uuid,
       'Medizin', 'diploma', 360,
       cs.id, 360, 12,
       false, 'UHAM-DIP-MEDIZIN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100245'::uuid,
       '00000000-0000-4000-a000-000000100239'::uuid,
       '00000000-0000-4000-a000-000000100240'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UHAM-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität zu Köln (UKOE)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100246'::uuid,
       'Universität zu Köln',
       'DE', 'university', 'de', 10, 'UKOE',
       'https://www.uni-koeln.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100247'::uuid, '00000000-0000-4000-a000-000000100246'::uuid, 'Allgemeine Fakultät', 'UKOE-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100248'::uuid,
       '00000000-0000-4000-a000-000000100246'::uuid,
       '00000000-0000-4000-a000-000000100247'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UKOE-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100249'::uuid,
       '00000000-0000-4000-a000-000000100246'::uuid,
       '00000000-0000-4000-a000-000000100247'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UKOE-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100250'::uuid,
       '00000000-0000-4000-a000-000000100246'::uuid,
       '00000000-0000-4000-a000-000000100247'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UKOE-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100251'::uuid,
       '00000000-0000-4000-a000-000000100246'::uuid,
       '00000000-0000-4000-a000-000000100247'::uuid,
       'Rechtswissenschaft', 'diploma', 270,
       cs.id, 270, 9,
       true, 'UKOE-DIP-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100252'::uuid,
       '00000000-0000-4000-a000-000000100246'::uuid,
       '00000000-0000-4000-a000-000000100247'::uuid,
       'Medizin', 'diploma', 360,
       cs.id, 360, 12,
       false, 'UKOE-DIP-MEDIZIN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Rheinische Friedrich-Wilhelms-Universität Bonn (UBONN)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100253'::uuid,
       'Rheinische Friedrich-Wilhelms-Universität Bonn',
       'DE', 'university', 'de', 10, 'UBONN',
       'https://www.uni-bonn.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100254'::uuid, '00000000-0000-4000-a000-000000100253'::uuid, 'Allgemeine Fakultät', 'UBONN-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100255'::uuid,
       '00000000-0000-4000-a000-000000100253'::uuid,
       '00000000-0000-4000-a000-000000100254'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UBONN-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100256'::uuid,
       '00000000-0000-4000-a000-000000100253'::uuid,
       '00000000-0000-4000-a000-000000100254'::uuid,
       'Mathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UBONN-BSC-MATHEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100257'::uuid,
       '00000000-0000-4000-a000-000000100253'::uuid,
       '00000000-0000-4000-a000-000000100254'::uuid,
       'Physik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UBONN-BSC-PHYSIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100258'::uuid,
       '00000000-0000-4000-a000-000000100253'::uuid,
       '00000000-0000-4000-a000-000000100254'::uuid,
       'Rechtswissenschaft', 'diploma', 270,
       cs.id, 270, 9,
       true, 'UBONN-DIP-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100259'::uuid,
       '00000000-0000-4000-a000-000000100253'::uuid,
       '00000000-0000-4000-a000-000000100254'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UBONN-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Stuttgart (USTGT)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100260'::uuid,
       'Universität Stuttgart',
       'DE', 'university', 'de', 10, 'USTGT',
       'https://www.uni-stuttgart.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100261'::uuid, '00000000-0000-4000-a000-000000100260'::uuid, 'Allgemeine Fakultät', 'USTGT-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100262'::uuid,
       '00000000-0000-4000-a000-000000100260'::uuid,
       '00000000-0000-4000-a000-000000100261'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'USTGT-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100263'::uuid,
       '00000000-0000-4000-a000-000000100260'::uuid,
       '00000000-0000-4000-a000-000000100261'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'USTGT-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100264'::uuid,
       '00000000-0000-4000-a000-000000100260'::uuid,
       '00000000-0000-4000-a000-000000100261'::uuid,
       'Elektrotechnik und Informationstechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'USTGT-BSC-ELEKTROTECHNIK-UND-I'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100265'::uuid,
       '00000000-0000-4000-a000-000000100260'::uuid,
       '00000000-0000-4000-a000-000000100261'::uuid,
       'Luft- und Raumfahrttechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'USTGT-BSC-LUFT--UND-RAUMFAHRTT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100266'::uuid,
       '00000000-0000-4000-a000-000000100260'::uuid,
       '00000000-0000-4000-a000-000000100261'::uuid,
       'Wirtschaftsingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'USTGT-BSC-WIRTSCHAFTSINGENIEUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Westfälische Wilhelms-Universität Münster (UMSRT)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100267'::uuid,
       'Westfälische Wilhelms-Universität Münster',
       'DE', 'university', 'de', 10, 'UMSRT',
       'https://www.uni-muenster.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100268'::uuid, '00000000-0000-4000-a000-000000100267'::uuid, 'Allgemeine Fakultät', 'UMSRT-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100269'::uuid,
       '00000000-0000-4000-a000-000000100267'::uuid,
       '00000000-0000-4000-a000-000000100268'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UMSRT-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100270'::uuid,
       '00000000-0000-4000-a000-000000100267'::uuid,
       '00000000-0000-4000-a000-000000100268'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UMSRT-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100271'::uuid,
       '00000000-0000-4000-a000-000000100267'::uuid,
       '00000000-0000-4000-a000-000000100268'::uuid,
       'Rechtswissenschaft', 'diploma', 270,
       cs.id, 270, 9,
       true, 'UMSRT-DIP-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100272'::uuid,
       '00000000-0000-4000-a000-000000100267'::uuid,
       '00000000-0000-4000-a000-000000100268'::uuid,
       'Mathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UMSRT-BSC-MATHEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100273'::uuid,
       '00000000-0000-4000-a000-000000100267'::uuid,
       '00000000-0000-4000-a000-000000100268'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UMSRT-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Goethe-Universität Frankfurt (GUF)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100274'::uuid,
       'Goethe-Universität Frankfurt',
       'DE', 'university', 'de', 10, 'GUF',
       'https://www.uni-frankfurt.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100275'::uuid, '00000000-0000-4000-a000-000000100274'::uuid, 'Allgemeine Fakultät', 'GUF-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100276'::uuid,
       '00000000-0000-4000-a000-000000100274'::uuid,
       '00000000-0000-4000-a000-000000100275'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'GUF-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100277'::uuid,
       '00000000-0000-4000-a000-000000100274'::uuid,
       '00000000-0000-4000-a000-000000100275'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'GUF-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100278'::uuid,
       '00000000-0000-4000-a000-000000100274'::uuid,
       '00000000-0000-4000-a000-000000100275'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'GUF-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100279'::uuid,
       '00000000-0000-4000-a000-000000100274'::uuid,
       '00000000-0000-4000-a000-000000100275'::uuid,
       'Rechtswissenschaft', 'diploma', 270,
       cs.id, 270, 9,
       true, 'GUF-DIP-RECHTSWISSENSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100280'::uuid,
       '00000000-0000-4000-a000-000000100274'::uuid,
       '00000000-0000-4000-a000-000000100275'::uuid,
       'Medizin', 'diploma', 360,
       cs.id, 360, 12,
       false, 'GUF-DIP-MEDIZIN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Technische Universität Darmstadt (TUDA)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100281'::uuid,
       'Technische Universität Darmstadt',
       'DE', 'university', 'de', 10, 'TUDA',
       'https://www.tu-darmstadt.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100282'::uuid, '00000000-0000-4000-a000-000000100281'::uuid, 'Allgemeine Fakultät', 'TUDA-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100283'::uuid,
       '00000000-0000-4000-a000-000000100281'::uuid,
       '00000000-0000-4000-a000-000000100282'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUDA-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100284'::uuid,
       '00000000-0000-4000-a000-000000100281'::uuid,
       '00000000-0000-4000-a000-000000100282'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'TUDA-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100285'::uuid,
       '00000000-0000-4000-a000-000000100281'::uuid,
       '00000000-0000-4000-a000-000000100282'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUDA-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100286'::uuid,
       '00000000-0000-4000-a000-000000100281'::uuid,
       '00000000-0000-4000-a000-000000100282'::uuid,
       'Elektrotechnik und Informationstechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUDA-BSC-ELEKTROTECHNIK-UND-I'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100287'::uuid,
       '00000000-0000-4000-a000-000000100281'::uuid,
       '00000000-0000-4000-a000-000000100282'::uuid,
       'Wirtschaftsingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUDA-BSC-WIRTSCHAFTSINGENIEUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Mannheim (UNIMA)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100288'::uuid,
       'Universität Mannheim',
       'DE', 'university', 'de', 10, 'UNIMA',
       'https://www.uni-mannheim.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100289'::uuid, '00000000-0000-4000-a000-000000100288'::uuid, 'Allgemeine Fakultät', 'UNIMA-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100290'::uuid,
       '00000000-0000-4000-a000-000000100288'::uuid,
       '00000000-0000-4000-a000-000000100289'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIMA-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100291'::uuid,
       '00000000-0000-4000-a000-000000100288'::uuid,
       '00000000-0000-4000-a000-000000100289'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIMA-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100292'::uuid,
       '00000000-0000-4000-a000-000000100288'::uuid,
       '00000000-0000-4000-a000-000000100289'::uuid,
       'Volkswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIMA-BSC-VOLKSWIRTSCHAFTSLEHR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100293'::uuid,
       '00000000-0000-4000-a000-000000100288'::uuid,
       '00000000-0000-4000-a000-000000100289'::uuid,
       'Wirtschaftsmathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIMA-BSC-WIRTSCHAFTSMATHEMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100294'::uuid,
       '00000000-0000-4000-a000-000000100288'::uuid,
       '00000000-0000-4000-a000-000000100289'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIMA-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Friedrich-Alexander-Universität Erlangen-Nürnberg (FAU)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100295'::uuid,
       'Friedrich-Alexander-Universität Erlangen-Nürnberg',
       'DE', 'university', 'de', 10, 'FAU',
       'https://www.fau.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100296'::uuid, '00000000-0000-4000-a000-000000100295'::uuid, 'Allgemeine Fakultät', 'FAU-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100297'::uuid,
       '00000000-0000-4000-a000-000000100295'::uuid,
       '00000000-0000-4000-a000-000000100296'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FAU-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100298'::uuid,
       '00000000-0000-4000-a000-000000100295'::uuid,
       '00000000-0000-4000-a000-000000100296'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'FAU-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100299'::uuid,
       '00000000-0000-4000-a000-000000100295'::uuid,
       '00000000-0000-4000-a000-000000100296'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FAU-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100300'::uuid,
       '00000000-0000-4000-a000-000000100295'::uuid,
       '00000000-0000-4000-a000-000000100296'::uuid,
       'Elektrotechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FAU-BSC-ELEKTROTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100301'::uuid,
       '00000000-0000-4000-a000-000000100295'::uuid,
       '00000000-0000-4000-a000-000000100296'::uuid,
       'Medizin', 'diploma', 360,
       cs.id, 360, 12,
       false, 'FAU-DIP-MEDIZIN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100302'::uuid,
       '00000000-0000-4000-a000-000000100295'::uuid,
       '00000000-0000-4000-a000-000000100296'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FAU-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- DEUTSCHLAND (DE) — Fachhochschulen
-- ══════════════════════════════════════════════════════════════════════════════

-- Institution: Technische Hochschule Köln (THK)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100303'::uuid,
       'Technische Hochschule Köln',
       'DE', 'university_of_applied_sciences', 'de', 10, 'THK',
       'https://www.th-koeln.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100304'::uuid, '00000000-0000-4000-a000-000000100303'::uuid, 'Fachbereich Informatik & Technik', 'THK-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100305'::uuid,
       '00000000-0000-4000-a000-000000100303'::uuid,
       '00000000-0000-4000-a000-000000100304'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'THK-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100306'::uuid,
       '00000000-0000-4000-a000-000000100303'::uuid,
       '00000000-0000-4000-a000-000000100304'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'THK-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100307'::uuid,
       '00000000-0000-4000-a000-000000100303'::uuid,
       '00000000-0000-4000-a000-000000100304'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'THK-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100308'::uuid,
       '00000000-0000-4000-a000-000000100303'::uuid,
       '00000000-0000-4000-a000-000000100304'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'THK-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100309'::uuid,
       '00000000-0000-4000-a000-000000100303'::uuid,
       '00000000-0000-4000-a000-000000100304'::uuid,
       'Elektrotechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'THK-BSC-ELEKTROTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: HAW Hamburg (HAWH)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100310'::uuid,
       'HAW Hamburg',
       'DE', 'university_of_applied_sciences', 'de', 10, 'HAWH',
       'https://www.haw-hamburg.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100311'::uuid, '00000000-0000-4000-a000-000000100310'::uuid, 'Fachbereich Informatik & Technik', 'HAWH-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100312'::uuid,
       '00000000-0000-4000-a000-000000100310'::uuid,
       '00000000-0000-4000-a000-000000100311'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HAWH-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100313'::uuid,
       '00000000-0000-4000-a000-000000100310'::uuid,
       '00000000-0000-4000-a000-000000100311'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 7,
       true, 'HAWH-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100314'::uuid,
       '00000000-0000-4000-a000-000000100310'::uuid,
       '00000000-0000-4000-a000-000000100311'::uuid,
       'Maschinenbau', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HAWH-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100315'::uuid,
       '00000000-0000-4000-a000-000000100310'::uuid,
       '00000000-0000-4000-a000-000000100311'::uuid,
       'Elektrotechnik und Informationstechnik', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HAWH-BSC-ELEKTROTECHNIK-UND-I'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: FH Aachen (FHAC)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100316'::uuid,
       'FH Aachen',
       'DE', 'university_of_applied_sciences', 'de', 10, 'FHAC',
       'https://www.fh-aachen.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100317'::uuid, '00000000-0000-4000-a000-000000100316'::uuid, 'Fachbereich Informatik & Technik', 'FHAC-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100318'::uuid,
       '00000000-0000-4000-a000-000000100316'::uuid,
       '00000000-0000-4000-a000-000000100317'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHAC-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100319'::uuid,
       '00000000-0000-4000-a000-000000100316'::uuid,
       '00000000-0000-4000-a000-000000100317'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHAC-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100320'::uuid,
       '00000000-0000-4000-a000-000000100316'::uuid,
       '00000000-0000-4000-a000-000000100317'::uuid,
       'Elektrotechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHAC-BSC-ELEKTROTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100321'::uuid,
       '00000000-0000-4000-a000-000000100316'::uuid,
       '00000000-0000-4000-a000-000000100317'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHAC-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Hochschule München (HM)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100322'::uuid,
       'Hochschule München',
       'DE', 'university_of_applied_sciences', 'de', 10, 'HM',
       'https://www.hm.edu',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100323'::uuid, '00000000-0000-4000-a000-000000100322'::uuid, 'Fachbereich Informatik & Technik', 'HM-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100324'::uuid,
       '00000000-0000-4000-a000-000000100322'::uuid,
       '00000000-0000-4000-a000-000000100323'::uuid,
       'Informatik und Design', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HM-BSC-INFORMATIK-UND-DESIG'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100325'::uuid,
       '00000000-0000-4000-a000-000000100322'::uuid,
       '00000000-0000-4000-a000-000000100323'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HM-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100326'::uuid,
       '00000000-0000-4000-a000-000000100322'::uuid,
       '00000000-0000-4000-a000-000000100323'::uuid,
       'Maschinenbau', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HM-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100327'::uuid,
       '00000000-0000-4000-a000-000000100322'::uuid,
       '00000000-0000-4000-a000-000000100323'::uuid,
       'Betriebswirtschaft', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HM-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100328'::uuid,
       '00000000-0000-4000-a000-000000100322'::uuid,
       '00000000-0000-4000-a000-000000100323'::uuid,
       'Data Science & Scientific Computing', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HM-BSC-DATA-SCIENCE---SCIEN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Hochschule Karlsruhe (HSKA)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100329'::uuid,
       'Hochschule Karlsruhe',
       'DE', 'university_of_applied_sciences', 'de', 10, 'HSKA',
       'https://www.h-ka.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100330'::uuid, '00000000-0000-4000-a000-000000100329'::uuid, 'Fachbereich Informatik & Technik', 'HSKA-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100331'::uuid,
       '00000000-0000-4000-a000-000000100329'::uuid,
       '00000000-0000-4000-a000-000000100330'::uuid,
       'Informatik', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HSKA-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100332'::uuid,
       '00000000-0000-4000-a000-000000100329'::uuid,
       '00000000-0000-4000-a000-000000100330'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HSKA-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100333'::uuid,
       '00000000-0000-4000-a000-000000100329'::uuid,
       '00000000-0000-4000-a000-000000100330'::uuid,
       'Maschinenbau', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HSKA-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100334'::uuid,
       '00000000-0000-4000-a000-000000100329'::uuid,
       '00000000-0000-4000-a000-000000100330'::uuid,
       'Elektro- und Informationstechnik', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HSKA-BSC-ELEKTRO--UND-INFORMA'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: HTW Berlin (HTWB)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100335'::uuid,
       'HTW Berlin',
       'DE', 'university_of_applied_sciences', 'de', 10, 'HTWB',
       'https://www.htw-berlin.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100336'::uuid, '00000000-0000-4000-a000-000000100335'::uuid, 'Fachbereich Informatik & Technik', 'HTWB-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100337'::uuid,
       '00000000-0000-4000-a000-000000100335'::uuid,
       '00000000-0000-4000-a000-000000100336'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HTWB-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100338'::uuid,
       '00000000-0000-4000-a000-000000100335'::uuid,
       '00000000-0000-4000-a000-000000100336'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HTWB-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100339'::uuid,
       '00000000-0000-4000-a000-000000100335'::uuid,
       '00000000-0000-4000-a000-000000100336'::uuid,
       'Wirtschaftsingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HTWB-BSC-WIRTSCHAFTSINGENIEUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100340'::uuid,
       '00000000-0000-4000-a000-000000100335'::uuid,
       '00000000-0000-4000-a000-000000100336'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HTWB-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Hochschule Darmstadt (HDA)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100341'::uuid,
       'Hochschule Darmstadt',
       'DE', 'university_of_applied_sciences', 'de', 10, 'HDA',
       'https://www.h-da.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100342'::uuid, '00000000-0000-4000-a000-000000100341'::uuid, 'Fachbereich Informatik & Technik', 'HDA-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100343'::uuid,
       '00000000-0000-4000-a000-000000100341'::uuid,
       '00000000-0000-4000-a000-000000100342'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HDA-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100344'::uuid,
       '00000000-0000-4000-a000-000000100341'::uuid,
       '00000000-0000-4000-a000-000000100342'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HDA-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100345'::uuid,
       '00000000-0000-4000-a000-000000100341'::uuid,
       '00000000-0000-4000-a000-000000100342'::uuid,
       'Maschinenbau', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HDA-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100346'::uuid,
       '00000000-0000-4000-a000-000000100341'::uuid,
       '00000000-0000-4000-a000-000000100342'::uuid,
       'Elektrotechnik und Informationstechnik', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HDA-BSC-ELEKTROTECHNIK-UND-I'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Fachhochschule Dortmund (FHDO)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100347'::uuid,
       'Fachhochschule Dortmund',
       'DE', 'university_of_applied_sciences', 'de', 10, 'FHDO',
       'https://www.fh-dortmund.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100348'::uuid, '00000000-0000-4000-a000-000000100347'::uuid, 'Fachbereich Informatik & Technik', 'FHDO-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100349'::uuid,
       '00000000-0000-4000-a000-000000100347'::uuid,
       '00000000-0000-4000-a000-000000100348'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHDO-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100350'::uuid,
       '00000000-0000-4000-a000-000000100347'::uuid,
       '00000000-0000-4000-a000-000000100348'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 7,
       true, 'FHDO-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100351'::uuid,
       '00000000-0000-4000-a000-000000100347'::uuid,
       '00000000-0000-4000-a000-000000100348'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHDO-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100352'::uuid,
       '00000000-0000-4000-a000-000000100347'::uuid,
       '00000000-0000-4000-a000-000000100348'::uuid,
       'Elektrotechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHDO-BSC-ELEKTROTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Hochschule RheinMain (HSRM)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100353'::uuid,
       'Hochschule RheinMain',
       'DE', 'university_of_applied_sciences', 'de', 10, 'HSRM',
       'https://www.hs-rm.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100354'::uuid, '00000000-0000-4000-a000-000000100353'::uuid, 'Fachbereich Informatik & Technik', 'HSRM-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100355'::uuid,
       '00000000-0000-4000-a000-000000100353'::uuid,
       '00000000-0000-4000-a000-000000100354'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSRM-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100356'::uuid,
       '00000000-0000-4000-a000-000000100353'::uuid,
       '00000000-0000-4000-a000-000000100354'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSRM-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100357'::uuid,
       '00000000-0000-4000-a000-000000100353'::uuid,
       '00000000-0000-4000-a000-000000100354'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSRM-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100358'::uuid,
       '00000000-0000-4000-a000-000000100353'::uuid,
       '00000000-0000-4000-a000-000000100354'::uuid,
       'Media Management', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'HSRM-BSC-MEDIA-MANAGEMENT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Hochschule Esslingen (HSE)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100359'::uuid,
       'Hochschule Esslingen',
       'DE', 'university_of_applied_sciences', 'de', 10, 'HSE',
       'https://www.hs-esslingen.de',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'DE_1_5' AND rp.code = 'ROUND_01'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100360'::uuid, '00000000-0000-4000-a000-000000100359'::uuid, 'Fachbereich Informatik & Technik', 'HSE-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100361'::uuid,
       '00000000-0000-4000-a000-000000100359'::uuid,
       '00000000-0000-4000-a000-000000100360'::uuid,
       'Softwaretechnik und Medieninformatik', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HSE-BSC-SOFTWARETECHNIK-UND-'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100362'::uuid,
       '00000000-0000-4000-a000-000000100359'::uuid,
       '00000000-0000-4000-a000-000000100360'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HSE-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100363'::uuid,
       '00000000-0000-4000-a000-000000100359'::uuid,
       '00000000-0000-4000-a000-000000100360'::uuid,
       'Maschinenbau', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HSE-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100364'::uuid,
       '00000000-0000-4000-a000-000000100359'::uuid,
       '00000000-0000-4000-a000-000000100360'::uuid,
       'Fahrzeugtechnik', 'bachelor', 210,
       cs.id, 210, 7,
       true, 'HSE-BSC-FAHRZEUGTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- ÖSTERREICH (AT) — Universitäten
-- ══════════════════════════════════════════════════════════════════════════════

-- Institution: Universität Wien (UNIVIE)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100365'::uuid,
       'Universität Wien',
       'AT', 'university', 'de', 10, 'UNIVIE',
       'https://www.univie.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100366'::uuid, '00000000-0000-4000-a000-000000100365'::uuid, 'Allgemeine Fakultät', 'UNIVIE-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100367'::uuid,
       '00000000-0000-4000-a000-000000100365'::uuid,
       '00000000-0000-4000-a000-000000100366'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIVIE-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100368'::uuid,
       '00000000-0000-4000-a000-000000100365'::uuid,
       '00000000-0000-4000-a000-000000100366'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'UNIVIE-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100369'::uuid,
       '00000000-0000-4000-a000-000000100365'::uuid,
       '00000000-0000-4000-a000-000000100366'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIVIE-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100370'::uuid,
       '00000000-0000-4000-a000-000000100365'::uuid,
       '00000000-0000-4000-a000-000000100366'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIVIE-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100371'::uuid,
       '00000000-0000-4000-a000-000000100365'::uuid,
       '00000000-0000-4000-a000-000000100366'::uuid,
       'Rechtswissenschaften', 'diploma', 240,
       cs.id, 240, 8,
       true, 'UNIVIE-DIP-RECHTSWISSENSCHAFTEN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100372'::uuid,
       '00000000-0000-4000-a000-000000100365'::uuid,
       '00000000-0000-4000-a000-000000100366'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIVIE-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Technische Universität Wien (TUWIEN)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100373'::uuid,
       'Technische Universität Wien',
       'AT', 'university', 'de', 10, 'TUWIEN',
       'https://www.tuwien.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100374'::uuid, '00000000-0000-4000-a000-000000100373'::uuid, 'Allgemeine Fakultät', 'TUWIEN-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100375'::uuid,
       '00000000-0000-4000-a000-000000100373'::uuid,
       '00000000-0000-4000-a000-000000100374'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUWIEN-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100376'::uuid,
       '00000000-0000-4000-a000-000000100373'::uuid,
       '00000000-0000-4000-a000-000000100374'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'TUWIEN-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100377'::uuid,
       '00000000-0000-4000-a000-000000100373'::uuid,
       '00000000-0000-4000-a000-000000100374'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUWIEN-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100378'::uuid,
       '00000000-0000-4000-a000-000000100373'::uuid,
       '00000000-0000-4000-a000-000000100374'::uuid,
       'Technische Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUWIEN-BSC-TECHNISCHE-INFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100379'::uuid,
       '00000000-0000-4000-a000-000000100373'::uuid,
       '00000000-0000-4000-a000-000000100374'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUWIEN-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100380'::uuid,
       '00000000-0000-4000-a000-000000100373'::uuid,
       '00000000-0000-4000-a000-000000100374'::uuid,
       'Elektrotechnik und Informationstechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUWIEN-BSC-ELEKTROTECHNIK-UND-I'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100381'::uuid,
       '00000000-0000-4000-a000-000000100373'::uuid,
       '00000000-0000-4000-a000-000000100374'::uuid,
       'Architektur', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUWIEN-BSC-ARCHITEKTUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Wirtschaftsuniversität Wien (WU)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100382'::uuid,
       'Wirtschaftsuniversität Wien',
       'AT', 'university', 'de', 10, 'WU',
       'https://www.wu.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100383'::uuid, '00000000-0000-4000-a000-000000100382'::uuid, 'Allgemeine Fakultät', 'WU-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100384'::uuid,
       '00000000-0000-4000-a000-000000100382'::uuid,
       '00000000-0000-4000-a000-000000100383'::uuid,
       'Wirtschafts- und Sozialwissenschaften', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'WU-BSC-WIRTSCHAFTS--UND-SOZ'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100385'::uuid,
       '00000000-0000-4000-a000-000000100382'::uuid,
       '00000000-0000-4000-a000-000000100383'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'WU-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100386'::uuid,
       '00000000-0000-4000-a000-000000100382'::uuid,
       '00000000-0000-4000-a000-000000100383'::uuid,
       'Wirtschaftsrecht', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'WU-BSC-WIRTSCHAFTSRECHT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Graz (UNIGRAZ)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100387'::uuid,
       'Universität Graz',
       'AT', 'university', 'de', 10, 'UNIGRAZ',
       'https://www.uni-graz.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100388'::uuid, '00000000-0000-4000-a000-000000100387'::uuid, 'Allgemeine Fakultät', 'UNIGRAZ-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100389'::uuid,
       '00000000-0000-4000-a000-000000100387'::uuid,
       '00000000-0000-4000-a000-000000100388'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIGRAZ-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100390'::uuid,
       '00000000-0000-4000-a000-000000100387'::uuid,
       '00000000-0000-4000-a000-000000100388'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIGRAZ-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100391'::uuid,
       '00000000-0000-4000-a000-000000100387'::uuid,
       '00000000-0000-4000-a000-000000100388'::uuid,
       'Rechtswissenschaften', 'diploma', 240,
       cs.id, 240, 8,
       true, 'UNIGRAZ-DIP-RECHTSWISSENSCHAFTEN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100392'::uuid,
       '00000000-0000-4000-a000-000000100387'::uuid,
       '00000000-0000-4000-a000-000000100388'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIGRAZ-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100393'::uuid,
       '00000000-0000-4000-a000-000000100387'::uuid,
       '00000000-0000-4000-a000-000000100388'::uuid,
       'Mathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIGRAZ-BSC-MATHEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Technische Universität Graz (TUGRAZ)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100394'::uuid,
       'Technische Universität Graz',
       'AT', 'university', 'de', 10, 'TUGRAZ',
       'https://www.tugraz.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100395'::uuid, '00000000-0000-4000-a000-000000100394'::uuid, 'Allgemeine Fakultät', 'TUGRAZ-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100396'::uuid,
       '00000000-0000-4000-a000-000000100394'::uuid,
       '00000000-0000-4000-a000-000000100395'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUGRAZ-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100397'::uuid,
       '00000000-0000-4000-a000-000000100394'::uuid,
       '00000000-0000-4000-a000-000000100395'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'TUGRAZ-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100398'::uuid,
       '00000000-0000-4000-a000-000000100394'::uuid,
       '00000000-0000-4000-a000-000000100395'::uuid,
       'Maschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUGRAZ-BSC-MASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100399'::uuid,
       '00000000-0000-4000-a000-000000100394'::uuid,
       '00000000-0000-4000-a000-000000100395'::uuid,
       'Elektrotechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUGRAZ-BSC-ELEKTROTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100400'::uuid,
       '00000000-0000-4000-a000-000000100394'::uuid,
       '00000000-0000-4000-a000-000000100395'::uuid,
       'Bauingenieurwissenschaften', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUGRAZ-BSC-BAUINGENIEURWISSENSC'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100401'::uuid,
       '00000000-0000-4000-a000-000000100394'::uuid,
       '00000000-0000-4000-a000-000000100395'::uuid,
       'Telematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'TUGRAZ-BSC-TELEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Innsbruck (UIBK)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100402'::uuid,
       'Universität Innsbruck',
       'AT', 'university', 'de', 10, 'UIBK',
       'https://www.uibk.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100403'::uuid, '00000000-0000-4000-a000-000000100402'::uuid, 'Allgemeine Fakultät', 'UIBK-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100404'::uuid,
       '00000000-0000-4000-a000-000000100402'::uuid,
       '00000000-0000-4000-a000-000000100403'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UIBK-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100405'::uuid,
       '00000000-0000-4000-a000-000000100402'::uuid,
       '00000000-0000-4000-a000-000000100403'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UIBK-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100406'::uuid,
       '00000000-0000-4000-a000-000000100402'::uuid,
       '00000000-0000-4000-a000-000000100403'::uuid,
       'Rechtswissenschaften', 'diploma', 240,
       cs.id, 240, 8,
       true, 'UIBK-DIP-RECHTSWISSENSCHAFTEN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100407'::uuid,
       '00000000-0000-4000-a000-000000100402'::uuid,
       '00000000-0000-4000-a000-000000100403'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UIBK-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100408'::uuid,
       '00000000-0000-4000-a000-000000100402'::uuid,
       '00000000-0000-4000-a000-000000100403'::uuid,
       'Mathematik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UIBK-BSC-MATHEMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Salzburg (PLUS)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100409'::uuid,
       'Universität Salzburg',
       'AT', 'university', 'de', 10, 'PLUS',
       'https://www.plus.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100410'::uuid, '00000000-0000-4000-a000-000000100409'::uuid, 'Allgemeine Fakultät', 'PLUS-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100411'::uuid,
       '00000000-0000-4000-a000-000000100409'::uuid,
       '00000000-0000-4000-a000-000000100410'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'PLUS-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100412'::uuid,
       '00000000-0000-4000-a000-000000100409'::uuid,
       '00000000-0000-4000-a000-000000100410'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'PLUS-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100413'::uuid,
       '00000000-0000-4000-a000-000000100409'::uuid,
       '00000000-0000-4000-a000-000000100410'::uuid,
       'Rechtswissenschaften', 'diploma', 240,
       cs.id, 240, 8,
       true, 'PLUS-DIP-RECHTSWISSENSCHAFTEN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100414'::uuid,
       '00000000-0000-4000-a000-000000100409'::uuid,
       '00000000-0000-4000-a000-000000100410'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'PLUS-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Johannes Kepler Universität Linz (JKU)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100415'::uuid,
       'Johannes Kepler Universität Linz',
       'AT', 'university', 'de', 10, 'JKU',
       'https://www.jku.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100416'::uuid, '00000000-0000-4000-a000-000000100415'::uuid, 'Allgemeine Fakultät', 'JKU-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100417'::uuid,
       '00000000-0000-4000-a000-000000100415'::uuid,
       '00000000-0000-4000-a000-000000100416'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'JKU-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100418'::uuid,
       '00000000-0000-4000-a000-000000100415'::uuid,
       '00000000-0000-4000-a000-000000100416'::uuid,
       'Informatik', 'master', 120,
       cs.id, 120, 4,
       true, 'JKU-MSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100419'::uuid,
       '00000000-0000-4000-a000-000000100415'::uuid,
       '00000000-0000-4000-a000-000000100416'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'JKU-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100420'::uuid,
       '00000000-0000-4000-a000-000000100415'::uuid,
       '00000000-0000-4000-a000-000000100416'::uuid,
       'Artificial Intelligence', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'JKU-BSC-ARTIFICIAL-INTELLIGE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100421'::uuid,
       '00000000-0000-4000-a000-000000100415'::uuid,
       '00000000-0000-4000-a000-000000100416'::uuid,
       'Mechatronik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'JKU-BSC-MECHATRONIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100422'::uuid,
       '00000000-0000-4000-a000-000000100415'::uuid,
       '00000000-0000-4000-a000-000000100416'::uuid,
       'Betriebswirtschaftslehre', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'JKU-BSC-BETRIEBSWIRTSCHAFTSL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100423'::uuid,
       '00000000-0000-4000-a000-000000100415'::uuid,
       '00000000-0000-4000-a000-000000100416'::uuid,
       'Rechtswissenschaften', 'diploma', 240,
       cs.id, 240, 8,
       true, 'JKU-DIP-RECHTSWISSENSCHAFTEN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Medizinische Universität Wien (MEDUNIWIEN)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100424'::uuid,
       'Medizinische Universität Wien',
       'AT', 'university', 'de', 10, 'MEDUNIWIEN',
       'https://www.meduniwien.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100425'::uuid, '00000000-0000-4000-a000-000000100424'::uuid, 'Allgemeine Fakultät', 'MEDUNIWIEN-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100426'::uuid,
       '00000000-0000-4000-a000-000000100424'::uuid,
       '00000000-0000-4000-a000-000000100425'::uuid,
       'Humanmedizin', 'diploma', 360,
       cs.id, 360, 12,
       false, 'MEDUNIWIEN-DIP-HUMANMEDIZIN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100427'::uuid,
       '00000000-0000-4000-a000-000000100424'::uuid,
       '00000000-0000-4000-a000-000000100425'::uuid,
       'Zahnmedizin', 'diploma', 360,
       cs.id, 360, 12,
       false, 'MEDUNIWIEN-DIP-ZAHNMEDIZIN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität für Bodenkultur Wien (BOKU)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100428'::uuid,
       'Universität für Bodenkultur Wien',
       'AT', 'university', 'de', 10, 'BOKU',
       'https://www.boku.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100429'::uuid, '00000000-0000-4000-a000-000000100428'::uuid, 'Allgemeine Fakultät', 'BOKU-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100430'::uuid,
       '00000000-0000-4000-a000-000000100428'::uuid,
       '00000000-0000-4000-a000-000000100429'::uuid,
       'Umwelt- und Bioressourcenmanagement', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'BOKU-BSC-UMWELT--UND-BIORESSO'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100431'::uuid,
       '00000000-0000-4000-a000-000000100428'::uuid,
       '00000000-0000-4000-a000-000000100429'::uuid,
       'Lebensmittel- und Biotechnologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'BOKU-BSC-LEBENSMITTEL--UND-BI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100432'::uuid,
       '00000000-0000-4000-a000-000000100428'::uuid,
       '00000000-0000-4000-a000-000000100429'::uuid,
       'Landschaftsplanung und Landschaftsarchitektur', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'BOKU-BSC-LANDSCHAFTSPLANUNG-U'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100433'::uuid,
       '00000000-0000-4000-a000-000000100428'::uuid,
       '00000000-0000-4000-a000-000000100429'::uuid,
       'Forstwirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'BOKU-BSC-FORSTWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Montanuniversität Leoben (UNILEOBEN)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100434'::uuid,
       'Montanuniversität Leoben',
       'AT', 'university', 'de', 10, 'UNILEOBEN',
       'https://www.unileoben.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100435'::uuid, '00000000-0000-4000-a000-000000100434'::uuid, 'Allgemeine Fakultät', 'UNILEOBEN-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100436'::uuid,
       '00000000-0000-4000-a000-000000100434'::uuid,
       '00000000-0000-4000-a000-000000100435'::uuid,
       'Montanmaschinenbau', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNILEOBEN-BSC-MONTANMASCHINENBAU'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100437'::uuid,
       '00000000-0000-4000-a000-000000100434'::uuid,
       '00000000-0000-4000-a000-000000100435'::uuid,
       'Werkstoffwissenschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNILEOBEN-BSC-WERKSTOFFWISSENSCHAF'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100438'::uuid,
       '00000000-0000-4000-a000-000000100434'::uuid,
       '00000000-0000-4000-a000-000000100435'::uuid,
       'Industrielle Energietechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNILEOBEN-BSC-INDUSTRIELLE-ENERGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: Universität Klagenfurt (UNIKLU)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100439'::uuid,
       'Universität Klagenfurt',
       'AT', 'university', 'de', 10, 'UNIKLU',
       'https://www.aau.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100440'::uuid, '00000000-0000-4000-a000-000000100439'::uuid, 'Allgemeine Fakultät', 'UNIKLU-FAC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100441'::uuid,
       '00000000-0000-4000-a000-000000100439'::uuid,
       '00000000-0000-4000-a000-000000100440'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIKLU-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100442'::uuid,
       '00000000-0000-4000-a000-000000100439'::uuid,
       '00000000-0000-4000-a000-000000100440'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIKLU-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100443'::uuid,
       '00000000-0000-4000-a000-000000100439'::uuid,
       '00000000-0000-4000-a000-000000100440'::uuid,
       'Psychologie', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIKLU-BSC-PSYCHOLOGIE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100444'::uuid,
       '00000000-0000-4000-a000-000000100439'::uuid,
       '00000000-0000-4000-a000-000000100440'::uuid,
       'Informationsmanagement', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'UNIKLU-BSC-INFORMATIONSMANAGEME'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- ÖSTERREICH (AT) — Fachhochschulen
-- ══════════════════════════════════════════════════════════════════════════════

-- Institution: FH Campus Wien (FHCW)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100445'::uuid,
       'FH Campus Wien',
       'AT', 'university_of_applied_sciences', 'de', 10, 'FHCW',
       'https://www.fh-campuswien.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100446'::uuid, '00000000-0000-4000-a000-000000100445'::uuid, 'Fachbereich Informatik & Technik', 'FHCW-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100447'::uuid,
       '00000000-0000-4000-a000-000000100445'::uuid,
       '00000000-0000-4000-a000-000000100446'::uuid,
       'Informatik – Software Design', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHCW-BSC-INFORMATIK--SOFTWARE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100448'::uuid,
       '00000000-0000-4000-a000-000000100445'::uuid,
       '00000000-0000-4000-a000-000000100446'::uuid,
       'Gesundheits- und Krankenpflege', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHCW-BSC-GESUNDHEITS--UND-KRA'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100449'::uuid,
       '00000000-0000-4000-a000-000000100445'::uuid,
       '00000000-0000-4000-a000-000000100446'::uuid,
       'Public Management', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHCW-BSC-PUBLIC-MANAGEMENT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100450'::uuid,
       '00000000-0000-4000-a000-000000100445'::uuid,
       '00000000-0000-4000-a000-000000100446'::uuid,
       'Soziale Arbeit', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHCW-BSC-SOZIALE-ARBEIT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: FH Technikum Wien (FHTW)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100451'::uuid,
       'FH Technikum Wien',
       'AT', 'university_of_applied_sciences', 'de', 10, 'FHTW',
       'https://www.technikum-wien.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100452'::uuid, '00000000-0000-4000-a000-000000100451'::uuid, 'Fachbereich Informatik & Technik', 'FHTW-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100453'::uuid,
       '00000000-0000-4000-a000-000000100451'::uuid,
       '00000000-0000-4000-a000-000000100452'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHTW-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100454'::uuid,
       '00000000-0000-4000-a000-000000100451'::uuid,
       '00000000-0000-4000-a000-000000100452'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHTW-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100455'::uuid,
       '00000000-0000-4000-a000-000000100451'::uuid,
       '00000000-0000-4000-a000-000000100452'::uuid,
       'Mechatronik/Robotik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHTW-BSC-MECHATRONIK-ROBOTIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100456'::uuid,
       '00000000-0000-4000-a000-000000100451'::uuid,
       '00000000-0000-4000-a000-000000100452'::uuid,
       'Elektronik und Wirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHTW-BSC-ELEKTRONIK-UND-WIRTS'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100457'::uuid,
       '00000000-0000-4000-a000-000000100451'::uuid,
       '00000000-0000-4000-a000-000000100452'::uuid,
       'Data Science & Intelligent Analytics', 'master', 120,
       cs.id, 120, 4,
       true, 'FHTW-MSC-DATA-SCIENCE---INTEL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: FH Salzburg (FHSALZ)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100458'::uuid,
       'FH Salzburg',
       'AT', 'university_of_applied_sciences', 'de', 10, 'FHSALZ',
       'https://www.fh-salzburg.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100459'::uuid, '00000000-0000-4000-a000-000000100458'::uuid, 'Fachbereich Informatik & Technik', 'FHSALZ-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100460'::uuid,
       '00000000-0000-4000-a000-000000100458'::uuid,
       '00000000-0000-4000-a000-000000100459'::uuid,
       'Informationstechnik & System-Management', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHSALZ-BSC-INFORMATIONSTECHNIK-'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100461'::uuid,
       '00000000-0000-4000-a000-000000100458'::uuid,
       '00000000-0000-4000-a000-000000100459'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHSALZ-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100462'::uuid,
       '00000000-0000-4000-a000-000000100458'::uuid,
       '00000000-0000-4000-a000-000000100459'::uuid,
       'MultiMediaTechnology', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHSALZ-BSC-MULTIMEDIATECHNOLOGY'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100463'::uuid,
       '00000000-0000-4000-a000-000000100458'::uuid,
       '00000000-0000-4000-a000-000000100459'::uuid,
       'Design & Produktmanagement', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHSALZ-BSC-DESIGN---PRODUKTMANA'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: MCI Management Center Innsbruck (MCI)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100464'::uuid,
       'MCI Management Center Innsbruck',
       'AT', 'university_of_applied_sciences', 'de', 10, 'MCI',
       'https://www.mci.edu',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100465'::uuid, '00000000-0000-4000-a000-000000100464'::uuid, 'Fachbereich Informatik & Technik', 'MCI-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100466'::uuid,
       '00000000-0000-4000-a000-000000100464'::uuid,
       '00000000-0000-4000-a000-000000100465'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'MCI-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100467'::uuid,
       '00000000-0000-4000-a000-000000100464'::uuid,
       '00000000-0000-4000-a000-000000100465'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'MCI-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100468'::uuid,
       '00000000-0000-4000-a000-000000100464'::uuid,
       '00000000-0000-4000-a000-000000100465'::uuid,
       'Mechatronik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'MCI-BSC-MECHATRONIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100469'::uuid,
       '00000000-0000-4000-a000-000000100464'::uuid,
       '00000000-0000-4000-a000-000000100465'::uuid,
       'Lebensmitteltechnologie & Ernährung', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'MCI-BSC-LEBENSMITTELTECHNOLO'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: FH Oberösterreich (FHOOE)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100470'::uuid,
       'FH Oberösterreich',
       'AT', 'university_of_applied_sciences', 'de', 10, 'FHOOE',
       'https://www.fh-ooe.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100471'::uuid, '00000000-0000-4000-a000-000000100470'::uuid, 'Fachbereich Informatik & Technik', 'FHOOE-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100472'::uuid,
       '00000000-0000-4000-a000-000000100470'::uuid,
       '00000000-0000-4000-a000-000000100471'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHOOE-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100473'::uuid,
       '00000000-0000-4000-a000-000000100470'::uuid,
       '00000000-0000-4000-a000-000000100471'::uuid,
       'Software Engineering', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHOOE-BSC-SOFTWARE-ENGINEERING'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100474'::uuid,
       '00000000-0000-4000-a000-000000100470'::uuid,
       '00000000-0000-4000-a000-000000100471'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHOOE-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100475'::uuid,
       '00000000-0000-4000-a000-000000100470'::uuid,
       '00000000-0000-4000-a000-000000100471'::uuid,
       'Mechatronik/Wirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHOOE-BSC-MECHATRONIK-WIRTSCHA'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: FH St. Pölten (FHSTP)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100476'::uuid,
       'FH St. Pölten',
       'AT', 'university_of_applied_sciences', 'de', 10, 'FHSTP',
       'https://www.fhstp.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100477'::uuid, '00000000-0000-4000-a000-000000100476'::uuid, 'Fachbereich Informatik & Technik', 'FHSTP-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100478'::uuid,
       '00000000-0000-4000-a000-000000100476'::uuid,
       '00000000-0000-4000-a000-000000100477'::uuid,
       'Informatik und Security', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHSTP-BSC-INFORMATIK-UND-SECUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100479'::uuid,
       '00000000-0000-4000-a000-000000100476'::uuid,
       '00000000-0000-4000-a000-000000100477'::uuid,
       'Data Science and Business Analytics', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHSTP-BSC-DATA-SCIENCE-AND-BUS'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100480'::uuid,
       '00000000-0000-4000-a000-000000100476'::uuid,
       '00000000-0000-4000-a000-000000100477'::uuid,
       'Medientechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHSTP-BSC-MEDIENTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100481'::uuid,
       '00000000-0000-4000-a000-000000100476'::uuid,
       '00000000-0000-4000-a000-000000100477'::uuid,
       'Digital Healthcare', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHSTP-BSC-DIGITAL-HEALTHCARE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: FH Joanneum (FHJ)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100482'::uuid,
       'FH Joanneum',
       'AT', 'university_of_applied_sciences', 'de', 10, 'FHJ',
       'https://www.fh-joanneum.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100483'::uuid, '00000000-0000-4000-a000-000000100482'::uuid, 'Fachbereich Informatik & Technik', 'FHJ-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100484'::uuid,
       '00000000-0000-4000-a000-000000100482'::uuid,
       '00000000-0000-4000-a000-000000100483'::uuid,
       'Informatik und Informationsmanagement', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHJ-BSC-INFORMATIK-UND-INFOR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100485'::uuid,
       '00000000-0000-4000-a000-000000100482'::uuid,
       '00000000-0000-4000-a000-000000100483'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHJ-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100486'::uuid,
       '00000000-0000-4000-a000-000000100482'::uuid,
       '00000000-0000-4000-a000-000000100483'::uuid,
       'Bauingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHJ-BSC-BAUINGENIEURWESEN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100487'::uuid,
       '00000000-0000-4000-a000-000000100482'::uuid,
       '00000000-0000-4000-a000-000000100483'::uuid,
       'Fahrzeugtechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHJ-BSC-FAHRZEUGTECHNIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: FH Vorarlberg (FHV)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100488'::uuid,
       'FH Vorarlberg',
       'AT', 'university_of_applied_sciences', 'de', 10, 'FHV',
       'https://www.fhv.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100489'::uuid, '00000000-0000-4000-a000-000000100488'::uuid, 'Fachbereich Informatik & Technik', 'FHV-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100490'::uuid,
       '00000000-0000-4000-a000-000000100488'::uuid,
       '00000000-0000-4000-a000-000000100489'::uuid,
       'Informatik – Software and Information Engineering', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHV-BSC-INFORMATIK--SOFTWARE'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100491'::uuid,
       '00000000-0000-4000-a000-000000100488'::uuid,
       '00000000-0000-4000-a000-000000100489'::uuid,
       'Wirtschaftsingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHV-BSC-WIRTSCHAFTSINGENIEUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100492'::uuid,
       '00000000-0000-4000-a000-000000100488'::uuid,
       '00000000-0000-4000-a000-000000100489'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHV-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: FH Wiener Neustadt (FHWN)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100493'::uuid,
       'FH Wiener Neustadt',
       'AT', 'university_of_applied_sciences', 'de', 10, 'FHWN',
       'https://www.fhwn.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100494'::uuid, '00000000-0000-4000-a000-000000100493'::uuid, 'Fachbereich Informatik & Technik', 'FHWN-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100495'::uuid,
       '00000000-0000-4000-a000-000000100493'::uuid,
       '00000000-0000-4000-a000-000000100494'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHWN-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100496'::uuid,
       '00000000-0000-4000-a000-000000100493'::uuid,
       '00000000-0000-4000-a000-000000100494'::uuid,
       'Mechatronik/Mikrosystemtechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHWN-BSC-MECHATRONIK-MIKROSYS'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100497'::uuid,
       '00000000-0000-4000-a000-000000100493'::uuid,
       '00000000-0000-4000-a000-000000100494'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHWN-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: FH Kärnten (FHK)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100498'::uuid,
       'FH Kärnten',
       'AT', 'university_of_applied_sciences', 'de', 10, 'FHK',
       'https://www.fh-kaernten.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100499'::uuid, '00000000-0000-4000-a000-000000100498'::uuid, 'Fachbereich Informatik & Technik', 'FHK-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100500'::uuid,
       '00000000-0000-4000-a000-000000100498'::uuid,
       '00000000-0000-4000-a000-000000100499'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHK-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100501'::uuid,
       '00000000-0000-4000-a000-000000100498'::uuid,
       '00000000-0000-4000-a000-000000100499'::uuid,
       'Wirtschaftsingenieurwesen', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHK-BSC-WIRTSCHAFTSINGENIEUR'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100502'::uuid,
       '00000000-0000-4000-a000-000000100498'::uuid,
       '00000000-0000-4000-a000-000000100499'::uuid,
       'Gesundheits- und Pflegemanagement', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHK-BSC-GESUNDHEITS--UND-PFL'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: FH Burgenland (FHBGLD)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100503'::uuid,
       'FH Burgenland',
       'AT', 'university_of_applied_sciences', 'de', 10, 'FHBGLD',
       'https://www.fh-burgenland.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100504'::uuid, '00000000-0000-4000-a000-000000100503'::uuid, 'Fachbereich Informatik & Technik', 'FHBGLD-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100505'::uuid,
       '00000000-0000-4000-a000-000000100503'::uuid,
       '00000000-0000-4000-a000-000000100504'::uuid,
       'Informatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHBGLD-BSC-INFORMATIK'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100506'::uuid,
       '00000000-0000-4000-a000-000000100503'::uuid,
       '00000000-0000-4000-a000-000000100504'::uuid,
       'Energie- und Umweltmanagement', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHBGLD-BSC-ENERGIE--UND-UMWELTM'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100507'::uuid,
       '00000000-0000-4000-a000-000000100503'::uuid,
       '00000000-0000-4000-a000-000000100504'::uuid,
       'Gesundheitsmanagement und Gesundheitsförderung', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHBGLD-BSC-GESUNDHEITSMANAGEMEN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: FH des BFI Wien (FHBFI)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100508'::uuid,
       'FH des BFI Wien',
       'AT', 'university_of_applied_sciences', 'de', 10, 'FHBFI',
       'https://www.fh-vie.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100509'::uuid, '00000000-0000-4000-a000-000000100508'::uuid, 'Fachbereich Informatik & Technik', 'FHBFI-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100510'::uuid,
       '00000000-0000-4000-a000-000000100508'::uuid,
       '00000000-0000-4000-a000-000000100509'::uuid,
       'Projektmanagement und IT', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHBFI-BSC-PROJEKTMANAGEMENT-UN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100511'::uuid,
       '00000000-0000-4000-a000-000000100508'::uuid,
       '00000000-0000-4000-a000-000000100509'::uuid,
       'Bank- und Finanzwirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHBFI-BSC-BANK--UND-FINANZWIRT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100512'::uuid,
       '00000000-0000-4000-a000-000000100508'::uuid,
       '00000000-0000-4000-a000-000000100509'::uuid,
       'Logistik und Transportmanagement', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHBFI-BSC-LOGISTIK-UND-TRANSPO'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: IMC FH Krems (IMCFHK)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100513'::uuid,
       'IMC FH Krems',
       'AT', 'university_of_applied_sciences', 'de', 10, 'IMCFHK',
       'https://www.imc.ac.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100514'::uuid, '00000000-0000-4000-a000-000000100513'::uuid, 'Fachbereich Informatik & Technik', 'IMCFHK-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100515'::uuid,
       '00000000-0000-4000-a000-000000100513'::uuid,
       '00000000-0000-4000-a000-000000100514'::uuid,
       'Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'IMCFHK-BSC-WIRTSCHAFTSINFORMATI'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100516'::uuid,
       '00000000-0000-4000-a000-000000100513'::uuid,
       '00000000-0000-4000-a000-000000100514'::uuid,
       'Betriebswirtschaft', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'IMCFHK-BSC-BETRIEBSWIRTSCHAFT'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100517'::uuid,
       '00000000-0000-4000-a000-000000100513'::uuid,
       '00000000-0000-4000-a000-000000100514'::uuid,
       'Gesundheitsmanagement', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'IMCFHK-BSC-GESUNDHEITSMANAGEMEN'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

-- Institution: FH Campus 02 (FHC02)
INSERT INTO institutions (id, name, country_code, institution_type, official_language,
                          academic_year_start_month, code, website,
                          default_credit_scheme_id, default_grade_scale_id,
                          default_rounding_policy_id, default_pass_policy_id, default_retake_policy_id)
SELECT '00000000-0000-4000-a000-000000100518'::uuid,
       'FH Campus 02',
       'AT', 'university_of_applied_sciences', 'de', 10, 'FHC02',
       'https://www.campus02.at',
       cs.id, gs.id, rp.id, pp.id, ret.id
FROM credit_schemes cs, grade_scales gs, rounding_policies rp, pass_policies pp, retake_policies ret
WHERE cs.code = 'ECTS' AND gs.code = 'AT_1_5' AND rp.code = 'ROUND_1'
  AND pp.code = 'SIMPLE_THRESHOLD' AND ret.code = 'DEFAULT_3_BEST'
ON CONFLICT (id) DO NOTHING;

INSERT INTO faculties (id, institution_id, name, code)
VALUES ('00000000-0000-4000-a000-000000100519'::uuid, '00000000-0000-4000-a000-000000100518'::uuid, 'Fachbereich Informatik & Technik', 'FHC02-TI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100520'::uuid,
       '00000000-0000-4000-a000-000000100518'::uuid,
       '00000000-0000-4000-a000-000000100519'::uuid,
       'Informationstechnologien & Wirtschaftsinformatik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHC02-BSC-INFORMATIONSTECHNOLO'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100521'::uuid,
       '00000000-0000-4000-a000-000000100518'::uuid,
       '00000000-0000-4000-a000-000000100519'::uuid,
       'Rechnungswesen & Controlling', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHC02-BSC-RECHNUNGSWESEN---CON'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, institution_id, faculty_id, name, degree_level, required_total_credits,
                      credit_scheme_id, ects_equivalent_total, duration_standard_terms,
                      thesis_required, code)
SELECT '00000000-0000-4000-a000-000000100522'::uuid,
       '00000000-0000-4000-a000-000000100518'::uuid,
       '00000000-0000-4000-a000-000000100519'::uuid,
       'Automatisierungstechnik', 'bachelor', 180,
       cs.id, 180, 6,
       true, 'FHC02-BSC-AUTOMATISIERUNGSTECH'
FROM credit_schemes cs WHERE cs.code = 'ECTS'
ON CONFLICT (id) DO NOTHING;


COMMIT;