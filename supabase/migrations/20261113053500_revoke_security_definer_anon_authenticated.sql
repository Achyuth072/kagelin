-- =============================================================================
-- Revoke anon and authenticated execute on internal SECURITY DEFINER functions
-- =============================================================================
-- Supabase grants execute on schema public functions to anon and authenticated
-- by default. Revoking only FROM PUBLIC leaves those grants intact, exposing the
-- functions on /rest/v1/rpc/* (advisor findings 0028/0029).
-- =============================================================================

-- Called only by the process-queue edge function as service_role.
REVOKE EXECUTE ON FUNCTION public.claim_due_notifications(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_notifications(INT) TO service_role;

-- Called by pg_cron as the postgres owner; the allowlist prevents arbitrary
-- function invocation or path traversal.
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
  IF p_function IS NULL OR p_function NOT IN ('process-queue', 'daily-briefing') THEN
    RAISE EXCEPTION 'invoke_edge_function: unauthorized function name "%"', p_function;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.invoke_edge_function(TEXT) FROM PUBLIC, anon, authenticated;

-- Called only by the daily-briefing edge function as service_role.
REVOKE EXECUTE ON FUNCTION public.get_users_for_morning_briefing() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_users_for_evening_plan()     FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_for_morning_briefing() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_users_for_evening_plan()     TO service_role;

-- Triggers: fired by the trigger mechanism, which does not check runtime EXECUTE.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_email_confirmed() FROM PUBLIC, anon, authenticated;

-- Called from SECURITY INVOKER notification triggers, which run as authenticated.
REVOKE EXECUTE ON FUNCTION public.encrypted_notification_body(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encrypted_notification_body(TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.at_timezone_or_null(TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.at_timezone_or_null(TIMESTAMPTZ, TEXT) TO authenticated;

-- Called by the client as authenticated; anon must not execute.
REVOKE EXECUTE ON FUNCTION public.has_password() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_password() TO authenticated;

-- Secure-by-default for future functions. The PUBLIC revoke must be global: a
-- per-schema revoke cannot remove the global default, leaving new functions
-- executable through PUBLIC. The per-schema revoke clears Supabase's explicit
-- anon and authenticated grants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
