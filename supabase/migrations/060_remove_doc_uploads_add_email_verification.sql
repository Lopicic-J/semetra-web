-- ═══════════════════════════════════════════════════════════════
-- Migration 060: Dokumenten-Upload entfernen, Email-Domain-Verifizierung
--
-- Aus datenschutzrechtlichen Gründen (Schweizer DSG / DSGVO):
-- - Keine Ausweisdokumente oder Identitätsnachweise speichern
-- - Stattdessen Email-Domain-basierte Verifizierung für Studenten
-- - Institutionen werden nur über persönlichen Kontakt eingerichtet
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Dokument-URL-Spalten entfernen ────────────────────────────────────
ALTER TABLE profiles DROP COLUMN IF EXISTS student_id_url;
ALTER TABLE profiles DROP COLUMN IF EXISTS institution_proof_url;

-- ─── 2. Email-Domain-Verifizierung hinzufügen ────────────────────────────
-- Speichert die Domain die zur Verifizierung genutzt wurde (z.B. "zhaw.ch")
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verified_email_domain TEXT;

-- ═══════════════════════════════════════════════════════════════
-- HINWEIS: Falls Storage-Buckets oder Policies aus Migration 059
-- existieren, müssen diese manuell über das Supabase Dashboard
-- entfernt werden (Storage → Bucket → Delete).
-- SQL-Zugriff auf storage.objects/storage.buckets ist geschützt.
-- ═══════════════════════════════════════════════════════════════
