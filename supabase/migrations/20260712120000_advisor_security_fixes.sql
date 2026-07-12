-- =============================================================================
-- Supabase Security Advisor fixes (kagelin-prod advisor pass, 2026-07-12)
-- =============================================================================
-- Clears the SQL-fixable Security Advisor WARN findings from
-- .planning/supabase-warnings-suggestions.json:
--
--   1. function_search_path_mutable (0011) — pin search_path on all seven
--      public functions so a role-mutable path can't be used to shadow an
--      unqualified object reference. pg_catalog is always searched implicitly,
--      so builtin functions/types/operators still resolve under an empty path.
--
--   2. anon/authenticated_security_definer_function_executable (0028/0029) —
--      the three SECURITY DEFINER functions were callable by anon/authenticated
--      over /rest/v1/rpc/* purely through the default PUBLIC execute grant.
--      Revoke PUBLIC and re-grant only the caller that legitimately needs it.
--
-- Deliberately NOT handled here (manual dashboard steps — see
-- .planning/audit-grilling-decisions-20260702.md):
--   - extension_in_public (pg_net): relocating pg_net risks the dashboard cron
--     that drives the daily-briefing edge function; done by hand with a test.
--   - auth_leaked_password_protection: Auth dashboard toggle, no SQL.
--
-- Idempotent: ALTER FUNCTION / CREATE OR REPLACE / REVOKE / GRANT re-run cleanly.
-- =============================================================================

-- 1. search_path pinning ------------------------------------------------------
-- Bodies that are already fully schema-qualified or use only builtins: empty
-- search_path is the strict best practice and safe.
ALTER FUNCTION public.server_now_ms()       SET search_path = '';
ALTER FUNCTION public.reorder_habits(jsonb) SET search_path = '';
ALTER FUNCTION public.update_updated_at()   SET search_path = '';
ALTER FUNCTION public.handle_new_user()     SET search_path = '';

-- handle_task_notification_sync references public.profiles unqualified; pin to
-- a fixed `public` path rather than rewrite a large trigger body on prod. It is
-- SECURITY INVOKER, so this only forces resolution to the real table.
ALTER FUNCTION public.handle_task_notification_sync() SET search_path = public;

-- 2. Briefing helpers: rewrite fully-qualified with empty search_path. These are
--    SECURITY DEFINER, so search_path hardening matters most here.
CREATE OR REPLACE FUNCTION public.get_users_for_morning_briefing()
RETURNS TABLE (id UUID, timezone TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.timezone
  FROM public.profiles p
  WHERE
    -- Is it 8 AM in their timezone?
    (now() AT TIME ZONE p.timezone)::time >= '08:00:00'
    AND (now() AT TIME ZONE p.timezone)::time < '09:00:00'
    -- Haven't received a briefing in the last 20 hours
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_queue n
      WHERE n.user_id = p.id
      AND n.type = 'briefing'
      AND n.created_at > now() - interval '20 hours'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_users_for_evening_plan()
RETURNS TABLE (id UUID, timezone TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.timezone
  FROM public.profiles p
  WHERE
    -- Is it 6 PM in their timezone? (18:00)
    (now() AT TIME ZONE p.timezone)::time >= '18:00:00'
    AND (now() AT TIME ZONE p.timezone)::time < '19:00:00'
    -- Haven't received an evening plan in the last 20 hours
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_queue n
      WHERE n.user_id = p.id
      AND n.type = 'evening'
      AND n.created_at > now() - interval '20 hours'
    );
END;
$$;

-- 3. EXECUTE lockdown ---------------------------------------------------------
-- Drop the implicit PUBLIC grant that exposed these on /rest/v1/rpc/*.
REVOKE EXECUTE ON FUNCTION public.get_users_for_morning_briefing() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_users_for_evening_plan()     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                FROM PUBLIC;

-- The briefing helpers are invoked only by the daily-briefing edge function,
-- which authenticates as service_role. handle_new_user needs no grant at all:
-- it runs as an AFTER INSERT trigger on auth.users, and trigger firing does not
-- check EXECUTE on the trigger function.
GRANT EXECUTE ON FUNCTION public.get_users_for_morning_briefing() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_users_for_evening_plan()     TO service_role;
