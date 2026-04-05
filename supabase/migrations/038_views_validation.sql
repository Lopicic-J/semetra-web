-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 038: Views + Module Publish Validation
-- Adds operational views and publish-time validation with cycle detection
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Module Component Summary View
-- Shows each module with its component count and weight totals
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_module_component_summary AS
SELECT
  m.id AS module_id,
  m.module_code,
  m.name AS title,
  m.status AS module_status,
  m.grade_scale_id,
  m.pass_policy_id,
  m.credit_scheme_id,
  m.ects_equivalent,
  COUNT(ac.id) AS component_count,
  COUNT(ac.id) FILTER (WHERE ac.contributes_to_final = true) AS grading_component_count,
  COALESCE(
    SUM(ac.weight_percent) FILTER (WHERE ac.contributes_to_final = true),
    0
  ) AS grading_weight_sum,
  COUNT(ac.id) FILTER (WHERE ac.mandatory_to_pass = true) AS mandatory_component_count,
  BOOL_AND(ac.is_active) FILTER (WHERE ac.id IS NOT NULL) AS all_components_active
FROM modules m
LEFT JOIN assessment_components ac ON ac.module_id = m.id
GROUP BY m.id, m.module_code, m.name, m.status, m.grade_scale_id,
         m.pass_policy_id, m.credit_scheme_id, m.ects_equivalent;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Program Group Summary View
-- Shows program structure with requirement groups
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_program_group_summary AS
SELECT
  p.id AS program_id,
  p.name AS program_name,
  p.degree_level,
  p.required_total_credits,
  p.ects_total,
  prg.id AS group_id,
  prg.name AS group_name,
  prg.group_type,
  prg.rule_type,
  prg.min_credits_required,
  prg.min_modules_required,
  prg.max_modules_counted,
  prg.parent_group_id,
  prg.sort_order,
  -- Count modules in this group
  COUNT(DISTINCT m.id) AS module_count,
  COALESCE(SUM(m.ects_equivalent), 0) AS total_group_ects
FROM programs p
JOIN program_requirement_groups prg ON prg.program_id = p.id
LEFT JOIN modules m ON m.requirement_group_id = prg.id
WHERE p.is_active = true AND prg.is_active = true
GROUP BY p.id, p.name, p.degree_level, p.required_total_credits, p.ects_total,
         prg.id, prg.name, prg.group_type, prg.rule_type,
         prg.min_credits_required, prg.min_modules_required,
         prg.max_modules_counted, prg.parent_group_id, prg.sort_order
ORDER BY p.name, prg.sort_order;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Prerequisite Cycle Detection
-- Recursive CTE to detect circular dependencies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_prerequisite_cycle(p_module_id uuid, p_prereq_id uuid)
RETURNS boolean AS $$
-- Returns TRUE if adding prereq_id as prerequisite of module_id would create a cycle
WITH RECURSIVE chain AS (
  -- Start from the proposed prerequisite
  SELECT mp.prerequisite_module_id AS current_id, 1 AS depth
  FROM module_prerequisites mp
  WHERE mp.module_id = p_prereq_id
  UNION ALL
  -- Walk the dependency chain
  SELECT mp.prerequisite_module_id, c.depth + 1
  FROM chain c
  JOIN module_prerequisites mp ON mp.module_id = c.current_id
  WHERE c.depth < 50  -- safety limit
)
SELECT EXISTS (
  SELECT 1 FROM chain WHERE current_id = p_module_id
);
$$ LANGUAGE sql STABLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Module Publish Validation Function
-- Validates all rules before a module can transition from draft → active
-- Returns: JSON array of validation errors (empty = valid)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION validate_module_for_publish(p_module_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_errors jsonb := '[]'::jsonb;
  v_module record;
  v_weight_sum numeric;
  v_grading_count integer;
  v_has_cycle boolean;
  v_req_group record;
BEGIN
  -- Load module
  SELECT * INTO v_module FROM modules WHERE id = p_module_id;

  IF v_module IS NULL THEN
    RETURN jsonb_build_array(jsonb_build_object(
      'code', 'MODULE_NOT_FOUND',
      'message', 'Module does not exist'
    ));
  END IF;

  -- 1. Must have a grade scale
  IF v_module.grade_scale_id IS NULL THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code', 'NO_GRADE_SCALE',
      'message', 'Module must have a grade scale assigned'
    ));
  END IF;

  -- 2. Must have a pass policy
  IF v_module.pass_policy_id IS NULL THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code', 'NO_PASS_POLICY',
      'message', 'Module must have a pass policy assigned'
    ));
  END IF;

  -- 3. Must have a credit scheme
  IF v_module.credit_scheme_id IS NULL THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code', 'NO_CREDIT_SCHEME',
      'message', 'Module must have a credit scheme assigned'
    ));
  END IF;

  -- 4. Assessment weights must sum to 100 (for grading components)
  SELECT
    COALESCE(SUM(weight_percent) FILTER (WHERE contributes_to_final = true), 0),
    COUNT(*) FILTER (WHERE contributes_to_final = true)
  INTO v_weight_sum, v_grading_count
  FROM assessment_components
  WHERE module_id = p_module_id AND is_active = true;

  IF v_grading_count > 0 AND v_weight_sum <> 100 THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code', 'WEIGHT_SUM_INVALID',
      'message', format('Assessment component weights sum to %s, must be 100', v_weight_sum),
      'detail', jsonb_build_object('current_sum', v_weight_sum, 'expected', 100)
    ));
  END IF;

  -- 5. Requirement group must belong to same program
  IF v_module.requirement_group_id IS NOT NULL AND v_module.program_id IS NOT NULL THEN
    SELECT * INTO v_req_group
    FROM program_requirement_groups
    WHERE id = v_module.requirement_group_id;

    IF v_req_group IS NOT NULL AND v_req_group.program_id <> v_module.program_id THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'GROUP_PROGRAM_MISMATCH',
        'message', 'Requirement group does not belong to the module''s program'
      ));
    END IF;
  END IF;

  -- 6. No prerequisite cycles
  FOR v_req_group IN
    SELECT prerequisite_module_id FROM module_prerequisites WHERE module_id = p_module_id
  LOOP
    v_has_cycle := check_prerequisite_cycle(v_req_group.prerequisite_module_id, p_module_id);
    IF v_has_cycle THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'PREREQUISITE_CYCLE',
        'message', format('Circular prerequisite detected involving module %s', v_req_group.prerequisite_module_id)
      ));
      EXIT; -- one cycle error is enough
    END IF;
  END LOOP;

  -- 7. Credits must be positive
  IF COALESCE(v_module.ects_equivalent, 0) <= 0 THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code', 'NO_CREDITS',
      'message', 'Module must have positive credit value (ects_equivalent)'
    ));
  END IF;

  RETURN v_errors;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Publish Module Function
-- Validates and transitions module from draft/inactive → active
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION publish_module(p_module_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_errors jsonb;
BEGIN
  -- Run validation
  v_errors := validate_module_for_publish(p_module_id);

  -- If errors, return them (422 in API layer)
  IF jsonb_array_length(v_errors) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'errors', v_errors
    );
  END IF;

  -- Transition to active
  UPDATE modules SET status = 'active', updated_at = now()
  WHERE id = p_module_id;

  RETURN jsonb_build_object(
    'success', true,
    'module_id', p_module_id
  );
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Refresh all materialized views helper (extends 035)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_academic_views()
RETURNS void AS $$
BEGIN
  -- Only refresh if materialized views exist
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'transcript_view') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY transcript_view;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'student_program_progress_view') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY student_program_progress_view;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
