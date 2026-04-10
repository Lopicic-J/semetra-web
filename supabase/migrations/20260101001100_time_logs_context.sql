-- ── Extend time_logs with exam, topic, and task context ─────────────
-- Allows tracking what specifically the student was studying for
ALTER TABLE time_logs ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE time_logs ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE SET NULL;
ALTER TABLE time_logs ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_time_logs_exam ON time_logs(exam_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_topic ON time_logs(topic_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_task ON time_logs(task_id);
