-- Add sync_state column for offline-first CRUD queue (Phase 55)
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS sync_state TEXT
  CONSTRAINT calendar_events_sync_state_check
    CHECK (sync_state IN ('pending_create', 'pending_update', 'pending_delete'));

-- Sparse index for the push query (WHERE sync_state IS NOT NULL)
CREATE INDEX IF NOT EXISTS calendar_events_sync_state_idx
  ON public.calendar_events (sync_state)
  WHERE sync_state IS NOT NULL;

-- Backfill remote_id / etag columns from metadata for events written by the old orchestrator
UPDATE public.calendar_events
SET
  remote_id = metadata->>'remote_id',
  etag      = metadata->>'etag'
WHERE
  remote_id IS NULL
  AND metadata ? 'remote_id';

-- Backfill sync queue: pre-existing un-pushed events in bidirectional calendars
-- become pending_create so the new orchestrator will push them on next sync
UPDATE public.calendar_events
SET sync_state = 'pending_create'
WHERE
  sync_state IS NULL
  AND remote_id IS NULL
  AND remote_calendar_id IN (
    SELECT id FROM public.external_calendars WHERE sync_direction = 'bidirectional'
  );
