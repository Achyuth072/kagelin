ALTER TABLE public.notification_queue
  DROP CONSTRAINT IF EXISTS notification_queue_type_check;
ALTER TABLE public.notification_queue
  ADD CONSTRAINT notification_queue_type_check
  CHECK (type IN ('timer_end', 'due_date', 'do_date', 'evening', 'briefing', 'habit_reminder'));

CREATE OR REPLACE FUNCTION public.enqueue_due_habit_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
  SELECT
    h.user_id,
    now(),
    'habit_reminder',
    jsonb_strip_nulls(jsonb_build_object(
      'title', 'Habit reminder',
      'body', 'You have a habit scheduled now.',
      'encrypted', public.encrypted_notification_body(
        CASE WHEN NULLIF(h.question, '') IS NOT NULL THEN '{}' ELSE 'Time for {}' END,
        COALESCE(NULLIF(h.question, ''), h.name)),
      'data', jsonb_build_object('url', '/habits', 'habitId', h.id)
    )),
    h.id
  FROM public.habits h
  JOIN public.profiles p ON p.id = h.user_id
  CROSS JOIN LATERAL (
    SELECT
      now() AT TIME ZONE p.timezone AS local_now,
      -- Guards against malformed text aborting the batch on cast.
      CASE WHEN h.reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        THEN h.reminder_time::time
      END AS remind_at
  ) t
  WHERE h.archived_at IS NULL
    AND (h.reminder_days >> EXTRACT(DOW FROM t.local_now)::int) & 1 = 1
    AND t.local_now::time - t.remind_at >= interval '0'
    AND t.local_now::time - t.remind_at < interval '10 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.habit_entries e
      WHERE e.habit_id = h.id AND e.date = t.local_now::date
    )
    AND (p.settings->'notifications'->>'habit_reminders')::boolean IS NOT FALSE
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_queue n
      WHERE n.reference_id = h.id
        AND n.type = 'habit_reminder'
        AND n.created_at > now() - interval '20 hours'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_due_habit_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_due_habit_reminders() TO service_role;

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IS NOT NULL
  AND command ILIKE '%enqueue_due_habit_reminders%';

SELECT cron.schedule(
  'enqueue-habit-reminders',
  '* * * * *',
  $$SELECT public.enqueue_due_habit_reminders()$$
);
