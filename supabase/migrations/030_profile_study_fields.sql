-- ============================================================
-- 030_profile_study_fields.sql
-- Add university, study program, semester, and avatar fields
-- ============================================================

-- New profile fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS university      text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS study_program   text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS semester        integer;

-- Storage bucket for avatar images
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for avatars bucket
CREATE POLICY "Users can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Avatars are publicly readable" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'avatars'
  );

CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
  );
