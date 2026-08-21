-- =============================================================================
-- Telemetry events, daily rollups, and retention pruning
-- =============================================================================

-- 1. Raw Telemetry Event Buffer (30-day TTL)
CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast time-window and event aggregations
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at
  ON public.telemetry_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_name_created
  ON public.telemetry_events (event_name, created_at DESC);

-- Enable RLS: No public read access; insert only via service role (API route)
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telemetry_events FROM anon, authenticated;

-- 2. Permanent Daily Aggregates
CREATE TABLE IF NOT EXISTS public.telemetry_daily_aggregates (
  date DATE PRIMARY KEY,
  active_devices INT NOT NULL DEFAULT 0,
  pwa_devices INT NOT NULL DEFAULT 0,
  browser_devices INT NOT NULL DEFAULT 0,
  pwa_installs INT NOT NULL DEFAULT 0,
  tasks_created INT NOT NULL DEFAULT 0,
  tasks_completed INT NOT NULL DEFAULT 0,
  timer_sessions_completed INT NOT NULL DEFAULT 0,
  timer_sessions_abandoned INT NOT NULL DEFAULT 0,
  focus_minutes_total INT NOT NULL DEFAULT 0,
  habits_logged INT NOT NULL DEFAULT 0,
  signups_completed INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telemetry_daily_aggregates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telemetry_daily_aggregates FROM anon, authenticated;

-- 3. Automated Retention Cleanup Function (Purges raw events > 30 days)
CREATE OR REPLACE FUNCTION public.prune_stale_telemetry_events()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.telemetry_events
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prune_stale_telemetry_events() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prune_stale_telemetry_events() FROM anon, authenticated;
