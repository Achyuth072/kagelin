-- =============================================================================
-- Telemetry daily rollup + wiring up the (previously unscheduled) pruning job
-- =============================================================================
-- telemetry_daily_aggregates had no writer — the admin dashboard's cumulative
-- KPIs (Tasks Completed, Timer Completion Rate, Habit check-ins, Focus Hours)
-- read it and rendered empty in prod. This adds the nightly rollup and
-- schedules it, plus schedules prune_stale_telemetry_events(), which existed
-- but was never wired to cron.

CREATE OR REPLACE FUNCTION public.aggregate_daily_telemetry(
  target_date DATE DEFAULT (CURRENT_DATE - INTERVAL '1 day')::DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  day_start TIMESTAMPTZ := (target_date::text || ' 00:00:00+00')::timestamptz;
  day_end TIMESTAMPTZ := day_start + INTERVAL '1 day';
BEGIN
  -- Bounds are explicit UTC timestamptz literals (not a `created_at::date`
  -- cast) so the query can use idx_telemetry_events_created_at as a range
  -- scan and stays correct regardless of the session timezone.
  INSERT INTO public.telemetry_daily_aggregates (
    date, active_devices, pwa_devices, browser_devices, pwa_installs,
    tasks_created, tasks_completed, timer_sessions_completed,
    timer_sessions_abandoned, focus_minutes_total, habits_logged,
    signups_completed, updated_at
  )
  SELECT
    target_date,
    COUNT(DISTINCT device_id),
    COUNT(DISTINCT device_id) FILTER (
      WHERE event_name = 'app_opened' AND properties->>'display_mode' = 'standalone'
    ),
    COUNT(DISTINCT device_id) FILTER (
      WHERE event_name = 'app_opened' AND properties->>'display_mode' = 'browser'
    ),
    COUNT(*) FILTER (WHERE event_name = 'pwa_installed'),
    COUNT(*) FILTER (WHERE event_name = 'task_action' AND properties->>'action' = 'created'),
    COUNT(*) FILTER (WHERE event_name = 'task_action' AND properties->>'action' = 'completed'),
    COUNT(*) FILTER (WHERE event_name = 'focus_session' AND properties->>'status' = 'completed'),
    COUNT(*) FILTER (WHERE event_name = 'focus_session' AND properties->>'status' = 'abandoned'),
    COALESCE(
      SUM((properties->>'duration_minutes')::numeric) FILTER (
        WHERE event_name = 'focus_session' AND properties->>'status' = 'completed'
      ),
      0
    )::int,
    COUNT(*) FILTER (WHERE event_name = 'habit_logged'),
    COUNT(*) FILTER (WHERE event_name = 'signup_completed'),
    now()
  FROM public.telemetry_events
  WHERE created_at >= day_start AND created_at < day_end
  ON CONFLICT (date) DO UPDATE SET
    active_devices = EXCLUDED.active_devices,
    pwa_devices = EXCLUDED.pwa_devices,
    browser_devices = EXCLUDED.browser_devices,
    pwa_installs = EXCLUDED.pwa_installs,
    tasks_created = EXCLUDED.tasks_created,
    tasks_completed = EXCLUDED.tasks_completed,
    timer_sessions_completed = EXCLUDED.timer_sessions_completed,
    timer_sessions_abandoned = EXCLUDED.timer_sessions_abandoned,
    focus_minutes_total = EXCLUDED.focus_minutes_total,
    habits_logged = EXCLUDED.habits_logged,
    signups_completed = EXCLUDED.signups_completed,
    updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.aggregate_daily_telemetry(DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aggregate_daily_telemetry(DATE) FROM anon, authenticated;

-- Unschedule first so a re-run of this file doesn't error on a duplicate jobname.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('telemetry-daily-rollup', 'telemetry-prune-stale-events');

-- 00:05 UTC: roll up yesterday's raw events into the permanent daily row.
SELECT cron.schedule(
  'telemetry-daily-rollup',
  '5 0 * * *',
  $$SELECT public.aggregate_daily_telemetry()$$
);

-- 00:15 UTC: prune raw events past the 30-day TTL, after the rollup has read them.
SELECT cron.schedule(
  'telemetry-prune-stale-events',
  '15 0 * * *',
  $$SELECT public.prune_stale_telemetry_events()$$
);
