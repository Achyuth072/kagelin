CREATE OR REPLACE FUNCTION public.habit_window_unsatisfied(p_habit public.habits, p_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT (
    SELECT count(*) FROM public.habit_entries e
    WHERE e.habit_id = p_habit.id
      AND e.date BETWEEN p_date - (
        COALESCE(
          p_habit.frequency_days,
          CASE p_habit.frequency_period WHEN 'week' THEN 7 WHEN 'month' THEN 30 ELSE 1 END
        ) - 1
      ) AND p_date
      AND e.value >= 0
      -- Mirrors dayValue() >= 1 in src/lib/utils/habit-score.ts.
      AND CASE
        WHEN p_habit.habit_type = 'measurable' AND p_habit.target_value > 0 THEN
          CASE p_habit.target_type
            WHEN 'at_least' THEN e.value >= p_habit.target_value
            WHEN 'at_most' THEN e.value <= p_habit.target_value
            ELSE e.value >= 1
          END
        WHEN p_habit.habit_type = 'measurable' AND p_habit.target_value IS NOT NULL
          AND p_habit.target_type = 'at_most' THEN e.value <= 0
        WHEN p_habit.habit_type = 'measurable' THEN e.value >= 1
        ELSE e.value = 1
      END
  ) < COALESCE(p_habit.frequency_count, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.habit_window_unsatisfied(public.habits, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.habit_window_unsatisfied(public.habits, DATE) TO service_role;

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
    AND public.habit_window_unsatisfied(h, t.remind_ts::date)
    AND (p.settings->'notifications'->>'habit_reminders')::boolean IS NOT FALSE
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_queue n
      WHERE n.reference_id = h.id
        AND n.type = 'habit_reminder'
        AND n.created_at > now() - interval '20 hours'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_briefing_counts(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  tz TEXT;
  local_now TIMESTAMP;
  day_start TIMESTAMPTZ;
  day_end TIMESTAMPTZ;
  local_date DATE;
  tasks_today BIGINT;
  overdue BIGINT;
  due_today BIGINT;
BEGIN
  SELECT timezone INTO tz FROM public.profiles WHERE id = p_user_id;
  local_now := public.at_timezone_or_null(now(), tz);
  IF local_now IS NULL THEN
    RETURN NULL;
  END IF;

  local_date := local_now::date;
  day_start := local_date::timestamp AT TIME ZONE tz;
  day_end := (local_date + 1)::timestamp AT TIME ZONE tz;

  SELECT
    count(*) FILTER (WHERE t.do_date >= day_start AND t.do_date < day_end),
    count(*) FILTER (WHERE t.due_date < day_start),
    count(*) FILTER (WHERE t.due_date >= day_start AND t.due_date < day_end)
  INTO tasks_today, overdue, due_today
  FROM public.tasks t
  WHERE t.user_id = p_user_id AND NOT t.is_completed;

  RETURN jsonb_build_object(
    'tasksToday', tasks_today,
    'overdue', overdue,
    'dueToday', due_today,
    'eventsToday', (
      SELECT count(*) FROM public.calendar_events ev
      WHERE ev.user_id = p_user_id AND NOT COALESCE(ev.is_archived, false)
        AND ev.start_time < day_end AND ev.end_time > day_start
    ),
    'habitsPending', (
      SELECT count(*) FROM public.habits h
      WHERE h.user_id = p_user_id AND h.archived_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.habit_entries e
          WHERE e.habit_id = h.id AND e.date = local_date
        )
        AND public.habit_window_unsatisfied(h, local_date)
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_briefing_counts(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_briefing_counts(UUID) TO service_role;
