-- =============================================================================
-- TIMER DEADLINE MODEL (TIMER-01)
-- =============================================================================
-- Move the cross-device focus timer onto an absolute deadline:
--   ends_at            — server-epoch deadline while running (null when paused/idle)
--   source_device_id   — device that last explicitly wrote the running state
--                        (ownership / echo marker; replaces the racy 500ms window)
--   completed_sessions — synced so every device mirrors the cycle counter
--
-- No row backfill: the apply path tolerates the deploy boundary
-- (is_running && ends_at IS NULL ⇒ trust remaining_seconds, never complete);
-- the owning device's next write populates ends_at.
-- =============================================================================

ALTER TABLE public.user_timer_state
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_device_id TEXT,
  ADD COLUMN IF NOT EXISTS completed_sessions INT NOT NULL DEFAULT 0;
