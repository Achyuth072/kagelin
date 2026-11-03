-- =============================================================================
-- pg_net logs every HTTP request/response into net._http_response and never
-- prunes it automatically. Because invoke_edge_function('process-queue') runs
-- every minute via pg_cron, this table accumulates high volume and causes
-- severe table bloat on Supabase free tier storage.
-- Schedule a daily maintenance job at 03:00 UTC to prune responses older than 1 hour.
-- =============================================================================

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'prune-pgnet-responses';

SELECT cron.schedule(
  'prune-pgnet-responses',
  '0 3 * * *',
  $$DELETE FROM net._http_response WHERE created < now() - interval '1 hour'$$
);
