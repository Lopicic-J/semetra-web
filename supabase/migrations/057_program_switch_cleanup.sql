-- Migration 057: Clean up old institution modules on program switch
-- When a student changes active_program_id, delete all institution-sourced
-- modules from the OLD program before importing modules from the NEW program.

CREATE OR REPLACE FUNCTION auto_import_program_modules()
RETURNS TRIGGER AS $$
DECLARE
  template_mod RECORD;
BEGIN
  -- Only act when active_program_id changes
  IF (OLD.active_program_id IS DISTINCT FROM NEW.active_program_id) THEN

    -- ── Step 1: Remove old institution modules ──
    -- When switching programs, delete all modules that were auto-imported
    -- from the previous program (source = 'institution').
    -- Manual modules (source = 'manual' or NULL) are kept.
    IF OLD.active_program_id IS NOT NULL THEN
      DELETE FROM modules
      WHERE user_id = NEW.id
        AND source = 'institution'
        AND program_id = OLD.active_program_id;
    END IF;

    -- Also clean up institution modules with no program_id
    -- (legacy imports from studiengaenge that have source = 'institution')
    IF NEW.active_program_id IS NOT NULL AND OLD.active_program_id IS DISTINCT FROM NEW.active_program_id THEN
      DELETE FROM modules
      WHERE user_id = NEW.id
        AND source = 'institution'
        AND program_id IS NULL;
    END IF;

    -- ── Step 2: Import new template modules ──
    IF NEW.active_program_id IS NOT NULL THEN
      FOR template_mod IN
        SELECT m.* FROM modules m
        WHERE m.program_id = NEW.active_program_id
          AND m.user_id IS NULL  -- template modules have no user_id
      LOOP
        -- Skip if student already has a module with same code in this program
        IF NOT EXISTS (
          SELECT 1 FROM modules
          WHERE user_id = NEW.id
            AND program_id = NEW.active_program_id
            AND module_code = template_mod.module_code
        ) THEN
          INSERT INTO modules (
            user_id, name, code, professor, ects, semester,
            day, time_start, time_end, room, color, notes,
            module_type, program_id, requirement_group_id,
            credit_scheme_id, grade_scale_id, pass_policy_id,
            retake_policy_id, rounding_policy_id,
            term_type, default_term_number, is_compulsory,
            language, delivery_mode, description, module_code,
            ects_equivalent, prerequisites_json, status, in_plan,
            source
          ) VALUES (
            NEW.id, template_mod.name, template_mod.code,
            template_mod.professor, template_mod.ects, template_mod.semester,
            template_mod.day, template_mod.time_start, template_mod.time_end,
            template_mod.room, COALESCE(template_mod.color, '#6366f1'),
            template_mod.notes, template_mod.module_type,
            NEW.active_program_id, template_mod.requirement_group_id,
            template_mod.credit_scheme_id, template_mod.grade_scale_id,
            template_mod.pass_policy_id, template_mod.retake_policy_id,
            template_mod.rounding_policy_id, template_mod.term_type,
            template_mod.default_term_number, template_mod.is_compulsory,
            template_mod.language, template_mod.delivery_mode,
            template_mod.description, template_mod.module_code,
            template_mod.ects_equivalent,
            COALESCE(template_mod.prerequisites_json, '{}'),
            'planned', true,
            'institution'
          );
        END IF;
      END LOOP;

      -- Reset institution_modules_loaded so frontend knows to refresh
      UPDATE profiles SET institution_modules_loaded = true WHERE id = NEW.id;
    ELSE
      -- Program was cleared (set to NULL) — just clean up, mark as not loaded
      UPDATE profiles SET institution_modules_loaded = false WHERE id = NEW.id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
