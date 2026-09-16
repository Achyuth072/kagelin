-- Redact pre-encryption notification payloads containing plaintext task titles.
UPDATE public.notification_queue
SET payload = jsonb_build_object(
  'title', COALESCE(payload->>'title', 'Kagelin'),
  'body', CASE type
    WHEN 'due_date' THEN 'You have a task due now.'
    WHEN 'do_date' THEN 'You have a task scheduled now.'
    ELSE 'Your timer is complete.'
  END,
  'data', COALESCE(payload->'data', '{}'::jsonb)
)
WHERE type IN ('due_date', 'do_date', 'timer_end')
  AND NOT (payload ? 'encrypted')
  -- Preserve existing content-free bodies.
  AND payload->>'body' NOT IN (
    'You have a task due now.',
    'You have a task scheduled now.',
    'Your focus session is complete. Take a break!',
    'Your break is over. Time to focus!',
    'Your timer is complete.'
  );

-- Prune terminal notifications to prevent indefinite payload retention.
CREATE OR REPLACE FUNCTION public.prune_terminal_notification_queue()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.notification_queue
  WHERE status IN ('sent', 'failed', 'cancelled')
    AND scheduled_at < now() - interval '7 days';
$$;

REVOKE EXECUTE ON FUNCTION public.prune_terminal_notification_queue() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prune_terminal_notification_queue() FROM anon, authenticated;

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'notification-queue-prune-terminal';

-- 00:45 UTC, after the telemetry jobs.
SELECT cron.schedule(
  'notification-queue-prune-terminal',
  '45 0 * * *',
  $$SELECT public.prune_terminal_notification_queue()$$
);
