-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 036: Schema Hardening — Columns
-- Adds: is_active, updated_at, metadata jsonb to all reference tables
-- Adds: missing columns on institutions, programs, faculties
-- Adds: updated_at triggers for all modified tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add is_active, updated_at, metadata to ALL reference tables
-- ─────────────────────────────────────────────────────────────────────────────

-- credit_schemes
ALTER TABLE credit_schemes ADD COLUMN IF NOT EXISTS is_active   boolean NOT NULL DEFAULT true;
ALTER TABLE credit_schemes ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();
ALTER TABLE credit_schemes ADD COLUMN IF NOT EXISTS metadata    jsonb NOT NULL DEFAULT '{}'::jsonb;

-- grade_scales
ALTER TABLE grade_scales ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE grade_scales ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();
ALTER TABLE grade_scales ADD COLUMN IF NOT EXISTS metadata     jsonb NOT NULL DEFAULT '{}'::jsonb;

-- grade_bands
ALTER TABLE grade_bands ADD COLUMN IF NOT EXISTS metadata      jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE grade_bands ADD COLUMN IF NOT EXISTS created_at    timestamptz NOT NULL DEFAULT now();
ALTER TABLE grade_bands ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();

-- pass_policies
ALTER TABLE pass_policies ADD COLUMN IF NOT EXISTS is_active   boolean NOT NULL DEFAULT true;
ALTER TABLE pass_policies ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();
ALTER TABLE pass_policies ADD COLUMN IF NOT EXISTS metadata    jsonb NOT NULL DEFAULT '{}'::jsonb;

-- retake_policies
ALTER TABLE retake_policies ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;
ALTER TABLE retake_policies ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE retake_policies ADD COLUMN IF NOT EXISTS metadata   jsonb NOT NULL DEFAULT '{}'::jsonb;

-- rounding_policies
ALTER TABLE rounding_policies ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;
ALTER TABLE rounding_policies ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE rounding_policies ADD COLUMN IF NOT EXISTS metadata   jsonb NOT NULL DEFAULT '{}'::jsonb;

-- country_systems
ALTER TABLE country_systems ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;
ALTER TABLE country_systems ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE country_systems ADD COLUMN IF NOT EXISTS metadata   jsonb NOT NULL DEFAULT '{}'::jsonb;

-- institutions
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS metadata     jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS code         varchar(50);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS timezone     text;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS default_classification_scheme_id uuid REFERENCES classification_schemes(id);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS default_gpa_scheme_id uuid REFERENCES gpa_schemes(id);

-- faculties
ALTER TABLE faculties ADD COLUMN IF NOT EXISTS is_active       boolean NOT NULL DEFAULT true;
ALTER TABLE faculties ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();
ALTER TABLE faculties ADD COLUMN IF NOT EXISTS metadata        jsonb NOT NULL DEFAULT '{}'::jsonb;

-- programs
ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_active        boolean NOT NULL DEFAULT true;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();
ALTER TABLE programs ADD COLUMN IF NOT EXISTS metadata         jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS code             varchar(50);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS ects_total       numeric(10,2);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS status           varchar(20) NOT NULL DEFAULT 'active';

-- program_requirement_groups
ALTER TABLE program_requirement_groups ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;
ALTER TABLE program_requirement_groups ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE program_requirement_groups ADD COLUMN IF NOT EXISTS metadata   jsonb NOT NULL DEFAULT '{}'::jsonb;

-- assessment_components
ALTER TABLE assessment_components ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;
ALTER TABLE assessment_components ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE assessment_components ADD COLUMN IF NOT EXISTS metadata   jsonb NOT NULL DEFAULT '{}'::jsonb;

-- classification_schemes
ALTER TABLE classification_schemes ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;
ALTER TABLE classification_schemes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE classification_schemes ADD COLUMN IF NOT EXISTS metadata   jsonb NOT NULL DEFAULT '{}'::jsonb;

-- gpa_schemes
ALTER TABLE gpa_schemes ADD COLUMN IF NOT EXISTS is_active     boolean NOT NULL DEFAULT true;
ALTER TABLE gpa_schemes ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();
ALTER TABLE gpa_schemes ADD COLUMN IF NOT EXISTS metadata      jsonb NOT NULL DEFAULT '{}'::jsonb;

-- academic_terms
ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS metadata   jsonb NOT NULL DEFAULT '{}'::jsonb;

-- attempts
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

-- component_results
ALTER TABLE component_results ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- credit_awards
ALTER TABLE credit_awards ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- recognitions
ALTER TABLE recognitions ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

-- module_prerequisites
ALTER TABLE module_prerequisites ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- program_completion_policies
ALTER TABLE program_completion_policies ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;
ALTER TABLE program_completion_policies ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE program_completion_policies ADD COLUMN IF NOT EXISTS metadata   jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Add code + name for reusability (spec wants policies reusable, not 1:1 with program)
ALTER TABLE program_completion_policies ADD COLUMN IF NOT EXISTS code       varchar(50);
ALTER TABLE program_completion_policies ADD COLUMN IF NOT EXISTS name       text;
ALTER TABLE program_completion_policies ADD COLUMN IF NOT EXISTS requires_thesis      boolean NOT NULL DEFAULT false;
ALTER TABLE program_completion_policies ADD COLUMN IF NOT EXISTS requires_internship  boolean NOT NULL DEFAULT false;
ALTER TABLE program_completion_policies ADD COLUMN IF NOT EXISTS requires_final_exam  boolean NOT NULL DEFAULT false;
ALTER TABLE program_completion_policies ADD COLUMN IF NOT EXISTS minimum_final_average numeric(10,4);

-- Modules: add status field for publish workflow
ALTER TABLE modules ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'draft';
-- draft → active → archived

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Updated_at triggers for ALL tables with updated_at
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure the trigger function exists (might already from 035)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Macro to create triggers safely
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'credit_schemes', 'grade_scales', 'grade_bands', 'pass_policies',
    'retake_policies', 'rounding_policies', 'country_systems', 'institutions',
    'faculties', 'programs', 'program_requirement_groups', 'assessment_components',
    'classification_schemes', 'gpa_schemes', 'academic_terms', 'attempts',
    'component_results', 'credit_awards', 'recognitions', 'module_prerequisites',
    'program_completion_policies'
  ] LOOP
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
        tbl, tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Faculties: unique constraints
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uq_faculties_institution_name
  ON faculties(institution_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_faculties_institution_code
  ON faculties(institution_id, code) WHERE code IS NOT NULL;

-- Institutions: unique code
CREATE UNIQUE INDEX IF NOT EXISTS uq_institutions_code
  ON institutions(code) WHERE code IS NOT NULL;

-- Programs: unique code per institution
CREATE UNIQUE INDEX IF NOT EXISTS uq_programs_institution_code
  ON programs(institution_id, code) WHERE code IS NOT NULL;
