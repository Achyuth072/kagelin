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
    count(*) FILTER (WHERE COALESCE(t.do_date, t.due_date) < day_start),
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
