-- Pre-ADR-0019 clients update only frequency_period; keep frequency_days in sync.
CREATE OR REPLACE FUNCTION public.sync_habit_frequency_days()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.frequency_period IS DISTINCT FROM OLD.frequency_period
     AND NEW.frequency_days IS NOT DISTINCT FROM OLD.frequency_days
     AND OLD.frequency_period IS NOT NULL
     AND NEW.frequency_period IS NOT NULL THEN
    NEW.frequency_days := CASE NEW.frequency_period
      WHEN 'week' THEN 7
      WHEN 'month' THEN 30
      ELSE 1
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER habits_sync_frequency_days
  BEFORE UPDATE OF frequency_period ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.sync_habit_frequency_days();

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
      'body', CASE WHEN NULLIF(h.question, '') IS NOT NULL THEN 'You have a habit scheduled now.' ELSE 'Time to check in.' END,
      'encryptedTitle', public.encrypted_notification_body('{}', h.name),
      'encrypted', CASE WHEN NULLIF(h.question, '') IS NOT NULL
                        THEN public.encrypted_notification_body('{}', h.question)
                        ELSE NULL
                   END,
      'data', jsonb_build_object(
        'url', '/habits',
        'habitId', h.id,
        'date', to_char(t.remind_ts::date, 'YYYY-MM-DD'),
        'habitKind', h.habit_type
      )
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
    AND (
      SELECT count(*) FROM public.habit_entries e
      WHERE e.habit_id = h.id
        AND e.date BETWEEN t.remind_ts::date - (
          COALESCE(
            h.frequency_days,
            CASE h.frequency_period WHEN 'week' THEN 7 WHEN 'month' THEN 30 ELSE 1 END
          ) - 1
        ) AND t.remind_ts::date
        AND e.value >= 0
        -- Mirrors dayValue() >= 1 in src/lib/utils/habit-score.ts.
        AND CASE
          WHEN h.habit_type = 'measurable' AND h.target_value > 0 THEN
            CASE h.target_type
              WHEN 'at_least' THEN e.value >= h.target_value
              WHEN 'at_most' THEN e.value <= h.target_value
              ELSE e.value >= 1
            END
          WHEN h.habit_type = 'measurable' AND h.target_value IS NOT NULL
            AND h.target_type = 'at_most' THEN e.value <= 0
          WHEN h.habit_type = 'measurable' THEN e.value >= 1
          ELSE e.value = 1
        END
    ) < COALESCE(h.frequency_count, 1)
    AND (p.settings->'notifications'->>'habit_reminders')::boolean IS NOT FALSE
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_queue n
      WHERE n.reference_id = h.id
        AND n.type = 'habit_reminder'
        AND n.created_at > now() - interval '20 hours'
    );
END;
$$;
