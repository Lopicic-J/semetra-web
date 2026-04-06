-- ═══════════════════════════════════════════════════════════════
-- ⚠️  DEPRECATED — NICHT AUSFÜHREN!
--
-- Diese Migration wurde durch Migration 060 ersetzt.
-- Grund: Aus datenschutzrechtlichen Gründen (Schweizer DSG / DSGVO)
-- werden keine Ausweisdokumente mehr gespeichert.
-- Stattdessen: Email-Domain-Verifizierung (siehe 060).
--
-- Falls bereits ausgeführt: Migration 060 räumt die Buckets auf.
-- ═══════════════════════════════════════════════════════════════
-- Migration 059: Storage Buckets für Verifizierungs-Dokumente (DEPRECATED)
-- ═══════════════════════════════════════════════════════════════

-- Bucket für Studentenausweise
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-id-docs',
  'student-id-docs',
  false,
  5242880, -- 5 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket für Institutionsnachweise
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'institution-proof-docs',
  'institution-proof-docs',
  false,
  5242880, -- 5 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS Policies für student-id-docs ─────────────────────────────────────

-- User kann eigene Dokumente hochladen
CREATE POLICY "Users can upload own student ID"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-id-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- User kann eigene Dokumente lesen
CREATE POLICY "Users can read own student ID"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'student-id-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_admin()
    )
  );

-- User kann eigene Dokumente überschreiben
CREATE POLICY "Users can update own student ID"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'student-id-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin kann alle Dokumente lesen (für Verifizierung)
CREATE POLICY "Admins can read all student IDs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'student-id-docs'
    AND is_admin()
  );

-- ─── RLS Policies für institution-proof-docs ──────────────────────────────

CREATE POLICY "Users can upload own institution proof"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'institution-proof-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own institution proof"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'institution-proof-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_admin()
    )
  );

CREATE POLICY "Users can update own institution proof"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'institution-proof-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can read all institution proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'institution-proof-docs'
    AND is_admin()
  );

-- ═══════════════════════════════════════════════════════════════
-- WICHTIG: Diese Migration muss auf Supabase manuell ausgeführt werden!
-- ═══════════════════════════════════════════════════════════════
