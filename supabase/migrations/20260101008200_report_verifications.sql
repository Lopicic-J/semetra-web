-- ══════════════════════════════════════════════════════════════════════════
-- Report Verifications — SHA-256 hash-based tamper-proof report verification
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.report_verifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id      TEXT NOT NULL UNIQUE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type    TEXT NOT NULL CHECK (report_type IN ('semester-report', 'module-certificate')),
  hash           TEXT NOT NULL,
  content_snapshot JSONB,
  generated_at   TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_count INT NOT NULL DEFAULT 0,
  last_verified_at TIMESTAMPTZ
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_report_verifications_report_id
  ON public.report_verifications(report_id);

CREATE INDEX IF NOT EXISTS idx_report_verifications_user_id
  ON public.report_verifications(user_id);

-- RLS
ALTER TABLE public.report_verifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own verifications
CREATE POLICY "Users can read own report verifications"
  ON public.report_verifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own verifications
CREATE POLICY "Users can insert own report verifications"
  ON public.report_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own verifications (for upsert)
CREATE POLICY "Users can update own report verifications"
  ON public.report_verifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can read all (for public verification endpoint)
-- Note: The service role bypasses RLS by default, so no additional policy needed.

COMMENT ON TABLE public.report_verifications IS 'SHA-256 hash verification for tamper-proof reports and certificates';
COMMENT ON COLUMN public.report_verifications.hash IS 'SHA-256 hash of canonical report content';
COMMENT ON COLUMN public.report_verifications.content_snapshot IS 'Snapshot of report data at generation time';
COMMENT ON COLUMN public.report_verifications.verified_count IS 'Number of times this report has been verified';
