-- =============================================================================
-- Tighten the processing-row reclaim window
-- =============================================================================
-- timer_end's TTL just dropped from 300s to 60s (_shared/push-delivery.ts).
-- The 5-minute reclaim window in claim_due_notifications was already wider
-- than that old TTL, so a crashed timer_end row got marked expired right as
-- it became reclaimable instead of getting a real retry. 30 seconds stays
-- under the new 60s TTL, so a reclaimed row still has budget to be resent.
-- =============================================================================

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
    AND claimed_at < now() - interval '30 seconds'
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
       OR (c.status = 'processing' AND c.claimed_at < now() - interval '30 seconds')
    ORDER BY c.scheduled_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING q.*;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_due_notifications(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_notifications(INT) TO service_role;
