-- Create storage buckets for file uploads
-- These buckets must exist for file upload features to work

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('mindmap-files', 'mindmap-files', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-files', 'task-files', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-files', 'exam-files', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage: users can only access their own files
CREATE POLICY "Users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('documents', 'mindmap-files', 'task-files', 'exam-files')
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can read own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('documents', 'mindmap-files', 'task-files', 'exam-files')
  );

CREATE POLICY "Users can delete own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('documents', 'mindmap-files', 'task-files', 'exam-files')
    AND auth.uid() IS NOT NULL
  );
