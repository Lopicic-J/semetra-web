-- Seed: Mark migrations 001-046 as already applied
-- Run this ONCE after renaming, BEFORE running supabase db push

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text NOT NULL PRIMARY KEY,
  statements text[],
  name text
);

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101000100', '20260101000100_initial') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101000200', '20260101000200_extend_schema') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101000300', '20260101000300_profiles_stripe') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101000400', '20260101000400_sync_support') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101000500', '20260101000500_all_fh_programs') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101000700', '20260101000700_task_attachments') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101000800', '20260101000800_exam_attachments') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101000900', '20260101000900_topics_exam_link') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101001000', '20260101001000_grades_exam_link') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101001100', '20260101001100_time_logs_context') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101001200', '20260101001200_study_period') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101001300', '20260101001300_mindmaps') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101001400', '20260101001400_brainstorming') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101001500', '20260101001500_notes') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101001600', '20260101001600_documents') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101001700', '20260101001700_math') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101001800', '20260101001800_flashcards') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101001900', '20260101001900_note_categories') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101002000', '20260101002000_lifetime_plan') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101002100', '20260101002100_country_grading') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101002200', '20260101002200_international_universities') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101002300', '20260101002300_profile_language') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101002400', '20260101002400_brainstorm_enhancements') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101002500', '20260101002500_flashcard_enhancements') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101002600', '20260101002600_mindmap_node_image') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101002700', '20260101002700_storage_buckets') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101002800', '20260101002800_flashcard_last_quality') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101002900', '20260101002900_mindmap_node_text_color') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101003000', '20260101003000_profile_study_fields') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101003100', '20260101003100_username') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101003200', '20260101003200_academic_foundation') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101003300', '20260101003300_grade_bands_seed') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101003400', '20260101003400_classification_seed') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101003500', '20260101003500_production_hardening') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101003600', '20260101003600_schema_hardening_columns') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101003700', '20260101003700_check_constraints_indexes') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101003800', '20260101003800_views_validation') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101003900', '20260101003900_demo_seed_data') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101004000', '20260101004000_builder_write_policies') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101004100', '20260101004100_profile_program_link') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101004200', '20260101004200_enrollment_attempt_policies') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101004300', '20260101004300_dach_university_seed') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101004400', '20260101004400_ai_usage_and_chat_history') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101004500', '20260101004500_study_plans') ON CONFLICT DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260101004600', '20260101004600_note_sharing_and_groups') ON CONFLICT DO NOTHING;
