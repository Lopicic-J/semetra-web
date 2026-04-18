-- ══════════════════════════════════════════════════════════════════════════
-- Analytics Events — Lightweight, privacy-friendly event tracking
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name   TEXT NOT NULL,
  event_data   JSONB NOT NULL DEFAULT '{}',
  page_url     TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_name
  ON public.analytics_events(event_name);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created
  ON public.analytics_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user
  ON public.analytics_events(user_id)
  WHERE user_id IS NOT NULL;

-- Composite index for funnel queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
  ON public.analytics_events(event_name, created_at DESC);

-- RLS: service role writes, users read own
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own events (for potential future self-analytics)
CREATE POLICY "Users can read own analytics"
  ON public.analytics_events FOR SELECT
  USING (auth.uid() = user_id);

-- Service role inserts (bypasses RLS)
-- No INSERT policy needed — service role key is used in the API

COMMENT ON TABLE public.analytics_events IS 'Privacy-friendly event tracking for feature usage and funnel analysis';
