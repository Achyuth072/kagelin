-- Inline CHECK constraint was generated anonymously; resolve by definition.
DO $$
DECLARE
  check_name text;
BEGIN
  SELECT conname INTO check_name
  FROM pg_constraint
  WHERE conrelid = 'public.notification_queue'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%''timer_end''%';
  IF check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notification_queue DROP CONSTRAINT %I', check_name);
  END IF;
END;
$$;
ALTER TABLE public.notification_queue
  ADD CONSTRAINT notification_queue_type_check
  CHECK (type IN ('timer_end', 'due_date', 'do_date', 'evening', 'briefing', 'habit_reminder'));

-- An unrecognised profile timezone must skip that user, not abort the per-minute batch.
CREATE OR REPLACE FUNCTION public.at_timezone_or_null(ts TIMESTAMPTZ, tz TEXT)
RETURNS TIMESTAMP
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN ts AT TIME ZONE tz;
EXCEPTION WHEN invalid_parameter_value THEN
  RETURN NULL;
END;
$$;

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
      s.local_now,
      -- Reminders due just before midnight belong to yesterday when evaluated past 00:00.
      CASE WHEN s.remind_at > s.local_now::time
        THEN s.local_now::date - 1
        ELSE s.local_now::date
      END + s.remind_at AS remind_ts
    FROM (
      SELECT
        public.at_timezone_or_null(now(), p.timezone) AS local_now,
        -- Guards against malformed text aborting the batch on cast.
        CASE WHEN h.reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          THEN h.reminder_time::time
        END AS remind_at
    ) s
  ) t
  WHERE h.archived_at IS NULL
    AND (h.reminder_days >> EXTRACT(DOW FROM t.remind_ts)::int) & 1 = 1
    AND t.local_now - t.remind_ts < interval '10 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.habit_entries e
      WHERE e.habit_id = h.id AND e.date = t.remind_ts::date
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
