-- =============================================================================
-- TIMER REALTIME DELIVERY FIX (TIMER-01)
-- =============================================================================
-- The realtime channel subscribes to UPDATEs on user_timer_state filtered by
-- `user_id` — which is NOT the primary key (`id` is). By default Postgres only
-- writes primary-key columns to the WAL for updates, so Realtime cannot see
-- `user_id` to match the filter and silently drops the events. Setting REPLICA
-- IDENTITY FULL makes the full row available in the WAL so the filter (and the
-- RLS SELECT policy) can be evaluated and the UPDATE delivered to the other
-- device. Required for cross-device live sync and owner-transfer.
-- =============================================================================

ALTER TABLE public.user_timer_state REPLICA IDENTITY FULL;

-- Per-account focus settings (duration, auto-start, sessions-before-long-break)
-- so every device agrees on durations, progress, and session labels.
ALTER TABLE public.user_timer_state
  ADD COLUMN IF NOT EXISTS settings JSONB;
