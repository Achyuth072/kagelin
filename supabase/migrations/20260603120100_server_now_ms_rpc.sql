-- =============================================================================
-- server_now_ms() — server clock probe for the deadline timer
-- =============================================================================
-- Returns the current server time as epoch milliseconds. The client probes this
-- once per connect (and on visibility/resubscribe) and applies an RTT-corrected
-- offset so serverNow() agrees with the database even when the device clock is
-- wrong or has jumped after sleep. clock_timestamp() (not now()) is used so the
-- value reflects real wall time rather than the transaction start.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.server_now_ms()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
$$;

GRANT EXECUTE ON FUNCTION public.server_now_ms() TO authenticated;
