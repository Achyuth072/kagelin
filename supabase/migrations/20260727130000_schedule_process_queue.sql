-- =============================================================================
-- Declare the edge-function schedules
-- =============================================================================
-- Adopts the process-queue cron schedule into version control, replacing a
-- hand-made dashboard job. Unschedules ANY existing job invoking
-- process-queue first, whatever the dashboard named it.
--
-- Two improvements over the dashboard job it replaces:
--   * every minute rather than every five, so a timer_end row can't sit
--     undelivered for minutes at a time.
--   * credentials from Vault rather than inline in cron.job.command, where
--     `select command from cron.job` would reveal the service_role key.
--
-- daily-briefing is adopted separately in 20260727140000, reusing the helper
-- defined here.
--
-- Credentials come from Vault, never from this file. Set them once per project:
--     select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--     select vault.create_secret('<service-role-key>', 'service_role_key');
--
-- Idempotent: re-runs cleanly.
-- =============================================================================

-- One helper for every scheduled edge function, so the auth header, timeout,
-- and vault secret names live in one place rather than N per-function copies.
CREATE OR REPLACE FUNCTION public.invoke_edge_function(p_function TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'project_url';

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  -- Raise rather than silently no-op: surfaces in cron.job_run_details.return_message.
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE EXCEPTION
      'invoke_edge_function(%): vault secrets project_url and/or service_role_key are not set',
      p_function;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_edge_function(TEXT) FROM PUBLIC;

-- Drop any pre-existing job driving process-queue, under whatever name the
-- dashboard gave it, so adopting this schedule doesn't double up.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IS NOT NULL
  AND command ILIKE '%process-queue%';

-- process-queue self-polls for ~50s per invocation, so a 1-minute schedule
-- gives roughly continuous coverage. Overlapping runs are safe now that
-- claim_due_notifications takes rows with FOR UPDATE SKIP LOCKED.
SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *',
  $$SELECT public.invoke_edge_function('process-queue')$$
);
