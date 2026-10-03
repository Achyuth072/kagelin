-- Names leave only as ciphertext so the server cannot read them (ADR 0016); unencrypted rows yield no name.
CREATE OR REPLACE FUNCTION public.get_briefing_facts(p_user_id UUID, p_kind TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  tz TEXT;
  local_now TIMESTAMP;
  local_date DATE;
  today_start TIMESTAMPTZ;
  today_end TIMESTAMPTZ;
  target_start TIMESTAMPTZ;
  target_end TIMESTAMPTZ;
  counts JSONB;
  next_up JSONB;
BEGIN
  IF p_kind NOT IN ('morning', 'evening') THEN
    RAISE EXCEPTION 'unknown briefing kind: %', p_kind;
  END IF;

  SELECT timezone INTO tz FROM public.profiles WHERE id = p_user_id;
  local_now := public.at_timezone_or_null(now(), tz);
  IF local_now IS NULL THEN
    RETURN NULL;
  END IF;

  local_date := local_now::date;
  today_start := local_date::timestamp AT TIME ZONE tz;
  today_end := (local_date + 1)::timestamp AT TIME ZONE tz;

  IF p_kind = 'morning' THEN
    target_start := today_start;
    target_end := today_end;
    counts := public.get_briefing_counts(p_user_id);
  ELSE
    target_start := today_end;
    target_end := (local_date + 2)::timestamp AT TIME ZONE tz;
    counts := jsonb_build_object(
      'tasksFinished', (
        SELECT count(*) FROM public.tasks t
        WHERE t.user_id = p_user_id AND t.is_completed
          AND t.completed_at >= today_start AND t.completed_at < today_end
      ),
      -- Skipped habits are stored as -2.
      'habitsFinished', (
        SELECT count(*) FROM public.habit_entries e
        JOIN public.habits h ON h.id = e.habit_id
        WHERE h.user_id = p_user_id AND e.date = local_date AND e.value > 0
      ),
      'tasksTomorrow', (
        SELECT count(*) FROM public.tasks t
        WHERE t.user_id = p_user_id AND NOT t.is_completed
          AND t.do_date >= target_start AND t.do_date < target_end
      ),
      'eventsTomorrow', (
        SELECT count(*) FROM public.calendar_events ev
        WHERE ev.user_id = p_user_id AND NOT COALESCE(ev.is_archived, false)
          AND ev.start_time < target_end AND ev.end_time > target_start
      )
    );
  END IF;

  -- All-day events have no start time to announce.
  SELECT jsonb_build_object(
    'ciphertext', (public.encrypted_notification_body('{}', ev.title))->>'ciphertext',
    'time', to_char(ev.start_time AT TIME ZONE tz, 'HH24:MI')
  )
  INTO next_up
  FROM public.calendar_events ev
  WHERE ev.user_id = p_user_id
    AND NOT COALESCE(ev.is_archived, false)
    AND NOT COALESCE(ev.all_day, false)
    AND ev.start_time >= GREATEST(now(), target_start)
    AND ev.start_time < target_end
  ORDER BY ev.start_time
  LIMIT 1;

  IF next_up IS NULL THEN
    SELECT jsonb_build_object(
      'ciphertext', (public.encrypted_notification_body('{}', t.content))->>'ciphertext'
    )
    INTO next_up
    FROM public.tasks t
    WHERE t.user_id = p_user_id AND NOT t.is_completed
      AND t.do_date >= target_start AND t.do_date < target_end
    ORDER BY t.priority, t.do_date, t.created_at
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object('counts', counts, 'nextUp', next_up);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_briefing_facts(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_briefing_facts(UUID, TEXT) TO service_role;
