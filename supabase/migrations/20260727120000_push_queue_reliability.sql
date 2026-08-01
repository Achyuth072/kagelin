-- =============================================================================
-- Scheduled-push reliability
-- =============================================================================
-- Fixes four independent defects that each lose notifications:
--   1. handle_task_notification_sync cancelled every pending row sharing a
--      task's id, including timer_end rows (owned by the timer, not the
--      task). Fixed at both ends: the type filter below, and
--      app/api/timer/start no longer writes a task id into reference_id.
--   2. No way to claim a row, so overlapping process-queue runs double-sent.
--   3. No retry — a transient 5xx marked the row 'failed' permanently.
--   4. A crashed run left rows unreachable forever; 'processing' rows are now
--      reclaimable after 5 minutes.
--
-- Steps 1-3 are idempotent. Step 4 is a ONE-SHOT data fix, time-relative —
-- do not replay this migration against a working queue.
-- =============================================================================

-- 1. Scope task-triggered cancellation to task-derived notification types -----
CREATE OR REPLACE FUNCTION handle_task_notification_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  payload_title TEXT;
  payload_body TEXT;
  user_settings JSONB;
BEGIN
  -- Cancel only the notifications this trigger itself creates. timer_end rows
  -- share reference_id with the task but are owned by the focus timer.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.notification_queue
    SET status = 'cancelled'
    WHERE reference_id = OLD.id
      AND status = 'pending'
      AND type IN ('due_date', 'do_date');
  END IF;

  IF (TG_OP IN ('INSERT', 'UPDATE')) AND (NEW.is_completed = FALSE) THEN
    SELECT settings INTO user_settings FROM profiles WHERE id = NEW.user_id;

    IF (user_settings->'notifications'->>'due_date_alerts')::boolean IS NOT FALSE
       AND NEW.due_date IS NOT NULL AND NEW.due_date > now() THEN
      payload_title := 'Task Due Soon';
      payload_body := 'Your task "' || NEW.content || '" is due now.';

      INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
      VALUES (NEW.user_id, NEW.due_date, 'due_date',
              jsonb_build_object(
                'title', payload_title,
                'body', payload_body,
                'data', jsonb_build_object('url', '/today', 'taskId', NEW.id)
              ),
              NEW.id);
    END IF;

    IF (user_settings->'notifications'->>'do_date_alerts')::boolean IS NOT FALSE
       AND NEW.do_date IS NOT NULL AND NEW.do_date > now() THEN
      payload_title := 'Time to focus';
      payload_body := 'Scheduled: ' || NEW.content;

      INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
      VALUES (NEW.user_id, NEW.do_date, 'do_date',
              jsonb_build_object(
                'title', payload_title,
                'body', payload_body,
                'data', jsonb_build_object('url', '/today', 'taskId', NEW.id)
              ),
              NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Queue bookkeeping columns ------------------------------------------------
-- next_attempt_at holds the backoff time for a retry, so scheduled_at stays
-- immutable and keeps meaning "when this was meant to fire" — which is what
-- the sender's staleness check measures against.
ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

-- 'processing' = claimed by a sender run, not yet resolved.
ALTER TABLE public.notification_queue
  DROP CONSTRAINT IF EXISTS notification_queue_status_check;
ALTER TABLE public.notification_queue
  ADD CONSTRAINT notification_queue_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'));

-- Indexed on the claim's actual predicate, COALESCE(next_attempt_at,
-- scheduled_at) — a plain (status, scheduled_at) index can't serve it. The
-- stale-'processing' branch is left unindexed: it matches a handful of rows at
-- most. This subsumes notification_queue_processing_idx, dropped so the hot
-- table doesn't carry two overlapping indexes.
CREATE INDEX IF NOT EXISTS notification_queue_claim_idx
  ON public.notification_queue (COALESCE(next_attempt_at, scheduled_at))
  WHERE status = 'pending';
DROP INDEX IF EXISTS public.notification_queue_processing_idx;

-- 3. Atomic claim -------------------------------------------------------------
-- SKIP LOCKED lets concurrent sender runs take disjoint batches instead of
-- racing for the same rows. Rows stuck in 'processing' (sender crashed
-- mid-flight) become claimable again after 5 minutes.
CREATE OR REPLACE FUNCTION public.claim_due_notifications(p_limit INT DEFAULT 50)
RETURNS SETOF public.notification_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- A row reclaimed this many times is abandoned rather than reclaimed
  -- forever. 3 mirrors MAX_RETRIES in _shared/push-delivery.ts.
  UPDATE public.notification_queue
  SET status = 'failed',
      error_message = 'abandoned after repeated incomplete delivery attempts'
  WHERE status = 'processing'
    AND claimed_at < now() - interval '5 minutes'
    AND retry_count >= 3;

  RETURN QUERY
  UPDATE public.notification_queue q
  SET status = 'processing',
      claimed_at = now(),
      -- SET expressions see the pre-UPDATE row, so this reads the old status.
      retry_count = CASE
        WHEN q.status = 'processing' THEN q.retry_count + 1
        ELSE q.retry_count
      END
  WHERE q.id IN (
    SELECT c.id
    FROM public.notification_queue c
    WHERE (c.status = 'pending'
           AND COALESCE(c.next_attempt_at, c.scheduled_at) <= now())
       OR (c.status = 'processing' AND c.claimed_at < now() - interval '5 minutes')
    ORDER BY c.scheduled_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING q.*;
END;
$$;

-- Called only by the process-queue edge function as service_role.
REVOKE EXECUTE ON FUNCTION public.claim_due_notifications(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_notifications(INT) TO service_role;

-- 4. Retire the undeliverable backlog ----------------------------------------
-- Restoring the sender would otherwise fire every past-due row at once. The
-- 5-minute grace is wider than a healthy claim cycle, so this is a no-op on a
-- working queue. The sender also enforces isExpired going forward.
UPDATE public.notification_queue
SET status = 'failed',
    error_message = 'expired before delivery (pre-Phase-63 pipeline)'
WHERE status = 'pending'
  AND scheduled_at < now() - interval '5 minutes';
