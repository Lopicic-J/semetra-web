-- ── Exam Attachments: notes, links & file uploads per exam ──────────
-- Mirrors task_attachments but references events (event_type='exam')
CREATE TABLE IF NOT EXISTS exam_attachments (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  exam_id       uuid references events(id) on delete cascade not null,
  kind          text not null default 'link',        -- 'link' | 'file' | 'note'
  label         text not null default '',
  url           text not null default '',             -- URL or storage path (empty for notes)
  content       text default '',                     -- note text content
  file_type     text default '',                     -- pdf, docx, xlsx, etc.
  file_size     bigint default 0,                    -- bytes
  storage_path  text default null,                   -- Supabase storage path (for files)
  created_at    timestamptz default now()
);

-- RLS policies
ALTER TABLE exam_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exam attachments"
  ON exam_attachments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exam attachments"
  ON exam_attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exam attachments"
  ON exam_attachments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exam attachments"
  ON exam_attachments FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookup by exam
CREATE INDEX idx_exam_attachments_exam ON exam_attachments(exam_id);

-- ── Storage bucket for exam file uploads ────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-files', 'exam-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: only owner can upload/read/delete their files
CREATE POLICY "Users can upload exam files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exam-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own exam files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exam-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own exam files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'exam-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
