-- Rebuild encrypted reminder text on snooze because re-seals strip delivered ciphertext.
CREATE OR REPLACE FUNCTION public.snooze_reminder(p_type TEXT, p_reference_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  snooze_until TIMESTAMPTZ := now() + interval '10 minutes';
  sent_row public.notification_queue;
  event_row public.calendar_events;
  task_content TEXT;
  user_settings JSONB;
  tz TEXT;
  snooze_day DATE;
  reminded_day DATE;
  mins INTEGER;
  hours INTEGER;
BEGIN
  IF p_type NOT IN ('due_date', 'do_date', 'event_reminder') THEN
    RETURN 'not_found';
  END IF;

  SELECT * INTO sent_row
  FROM public.notification_queue
  WHERE user_id = auth.uid()
    AND type = p_type
    AND reference_id = p_reference_id
    AND status = 'sent'
  ORDER BY scheduled_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  SELECT settings, timezone INTO user_settings, tz FROM public.profiles WHERE id = auth.uid();
  IF (user_settings->'notifications'->>(CASE p_type
        WHEN 'due_date' THEN 'due_date_alerts'
        WHEN 'do_date' THEN 'do_date_alerts'
        ELSE 'event_reminders'
      END))::boolean IS FALSE THEN
    RETURN 'dropped';
  END IF;

  IF p_type = 'event_reminder' THEN
    -- An all-day event has begun by its 9:00 reminder, so it lasts to the end of
    -- that local day instead. An unknown timezone leaves no day to compare.
    snooze_day := public.at_timezone_or_null(snooze_until, tz)::date;
    reminded_day := public.at_timezone_or_null(sent_row.scheduled_at, tz)::date;

    SELECT * INTO event_row FROM public.calendar_events e
    WHERE e.id = p_reference_id
      AND e.user_id = auth.uid()
      AND NOT COALESCE(e.is_archived, false)
      AND e.sync_state IS DISTINCT FROM 'pending_delete'
      AND CASE WHEN e.all_day
            THEN COALESCE(snooze_day = reminded_day, false)
            ELSE e.start_time > snooze_until
          END;

    IF NOT FOUND THEN
      RETURN 'dropped';
    END IF;

    -- The sent body's lead time is stale by the time the snooze fires.
    IF NOT event_row.all_day THEN
      mins := ceil(extract(epoch FROM event_row.start_time - snooze_until) / 60);
      hours := round(mins / 60.0);
      sent_row.payload := jsonb_strip_nulls(sent_row.payload || jsonb_build_object(
        'encrypted', public.encrypted_notification_body(
          CASE WHEN mins = 1 THEN '"{}" starts in 1 minute'
               WHEN mins < 60 THEN '"{}" starts in ' || mins || ' minutes'
               WHEN hours = 1 THEN '"{}" starts in 1 hour'
               ELSE '"{}" starts in ' || hours || ' hours'
          END,
          event_row.title)));
    ELSE
      sent_row.payload := jsonb_strip_nulls(sent_row.payload || jsonb_build_object(
        'encrypted', public.encrypted_notification_body(
          CASE WHEN event_row.reminder_minutes >= 1440
            THEN '"{}" is tomorrow' ELSE '"{}" is today' END,
          event_row.title)));
    END IF;
  ELSE
    SELECT t.content INTO task_content FROM public.tasks t
    WHERE t.id = p_reference_id
      AND t.user_id = auth.uid()
      AND NOT t.is_completed;

    IF NOT FOUND THEN
      RETURN 'dropped';
    END IF;

    -- Re-seals strip delivered ciphertext; rebuild from the task.
    sent_row.payload := jsonb_strip_nulls(sent_row.payload || jsonb_build_object(
      'encrypted', public.encrypted_notification_body(
        CASE p_type WHEN 'due_date' THEN 'Your task "{}" is due now.' ELSE 'Scheduled: {}' END,
        task_content)));
  END IF;

  -- A double tap, or a second device, must not queue a second snooze.
  IF EXISTS (
    SELECT 1 FROM public.notification_queue
    WHERE user_id = auth.uid()
      AND type = p_type
      AND reference_id = p_reference_id
      AND status = 'pending'
      AND scheduled_at > now()
  ) THEN
    RETURN 'snoozed';
  END IF;

  INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
  VALUES (sent_row.user_id, snooze_until, sent_row.type, sent_row.payload, sent_row.reference_id)
  ON CONFLICT DO NOTHING;

  RETURN 'snoozed';
END;
$$;
