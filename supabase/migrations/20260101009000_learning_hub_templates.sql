-- Learning Hub Templates: Pre-configured content for institution modules
-- Templates are keyed by module_code so all students with the same module
-- get identical, curated content without AI generation.

CREATE TABLE IF NOT EXISTS learning_hub_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL UNIQUE,
  module_name text,
  overview jsonb,
  topic_guide jsonb,
  concept_cards jsonb,
  quick_start jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Allow authenticated users to read templates
ALTER TABLE learning_hub_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read templates"
  ON learning_hub_templates FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/institutions can create/update templates
CREATE POLICY "Admins can manage templates"
  ON learning_hub_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'institution')
    )
  );

CREATE INDEX idx_learning_hub_templates_code ON learning_hub_templates(module_code);
