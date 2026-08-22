-- =============================================================================
-- pg_cron logs every job run to cron.job_run_details and never prunes it
-- itself (see pg_cron's own docs) — schedule a daily cleanup so it doesn't
-- grow unbounded alongside the telemetry retention jobs added above.
-- =============================================================================

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'cron-prune-job-run-details';

SELECT cron.schedule(
  'cron-prune-job-run-details',
  '30 0 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);
