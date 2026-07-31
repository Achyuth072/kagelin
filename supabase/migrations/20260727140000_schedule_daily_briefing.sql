-- =============================================================================
-- Adopt the daily-briefing schedule into version control
-- =============================================================================
-- Companion to 20260727130000_schedule_process_queue.sql, which defines the
-- shared public.invoke_edge_function helper. Adopts the dashboard job
-- ('system-daily-briefing', jobid 2, hourly) so its service_role key comes
-- from Vault instead of sitting inline in cron.job.command.
--
-- Hourly is preserved: daily-briefing picks out users whose local time is in
-- the 08:00 or 18:00 window (get_users_for_morning_briefing /
-- get_users_for_evening_plan in schema.sql), so it must run every hour to
-- catch each timezone.
--
-- Idempotent: re-runs cleanly.
-- =============================================================================

-- Drop any pre-existing job driving daily-briefing, under whatever name the
-- dashboard gave it, so adopting this schedule doesn't double-send briefings.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IS NOT NULL
  AND command ILIKE '%daily-briefing%';

SELECT cron.schedule(
  'system-daily-briefing',
  '0 * * * *',
  $$SELECT public.invoke_edge_function('daily-briefing')$$
);
