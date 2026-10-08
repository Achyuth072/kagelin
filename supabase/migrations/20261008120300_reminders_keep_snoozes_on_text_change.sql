-- Preserve pending and snoozed reminders across re-seals and text updates.
CREATE OR REPLACE FUNCTION handle_task_notification_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  user_settings JSONB;
BEGIN
  -- Reorders and sync touches change nothing a reminder shows; leave pending ones, snoozes included.
  IF TG_OP = 'UPDATE'
     AND OLD.is_completed IS NOT DISTINCT FROM NEW.is_completed
     AND OLD.due_date IS NOT DISTINCT FROM NEW.due_date
     AND OLD.do_date IS NOT DISTINCT FROM NEW.do_date
     AND OLD.recurrence IS NOT DISTINCT FROM NEW.recurrence THEN
    -- Preserve pending reminders across text changes and re-seals by refreshing ciphertext.
    IF OLD.content IS DISTINCT FROM NEW.content AND NEW.content ~ '^xchacha20poly1305-v[12]:' THEN
      UPDATE public.notification_queue
      SET payload = jsonb_set(payload, '{encrypted,ciphertext}', to_jsonb(NEW.content))
      WHERE reference_id = NEW.id
        AND status = 'pending'
        AND type IN ('due_date', 'do_date')
        AND scheduled_at > now()
        AND payload ? 'encrypted';
    END IF;
    RETURN NEW;
  END IF;

  -- Cancel only task-owned due/do notifications; leave timer_end rows and past-due rows (#155) untouched.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.notification_queue
    SET status = 'cancelled'
    WHERE reference_id = OLD.id
      AND status = 'pending'
      AND type IN ('due_date', 'do_date')
      AND scheduled_at > now();
  END IF;

  IF (TG_OP IN ('INSERT', 'UPDATE')) AND (NEW.is_completed = FALSE) THEN
    SELECT settings INTO user_settings FROM profiles WHERE id = NEW.user_id;

    IF (user_settings->'notifications'->>'due_date_alerts')::boolean IS NOT FALSE 
       AND NEW.due_date IS NOT NULL AND NEW.due_date > now() THEN
      INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
      VALUES (NEW.user_id, NEW.due_date, 'due_date',
              jsonb_strip_nulls(jsonb_build_object(
                'title', 'Task Due Soon',
                'body', 'You have a task due now.',
                'encrypted', public.encrypted_notification_body(
                  'Your task "{}" is due now.', NEW.content),
                'data', jsonb_build_object('url', '/', 'taskId', NEW.id, 'reminderType', 'due_date', 'recurring', COALESCE(jsonb_typeof(NEW.recurrence), 'null') <> 'null')
              )),
              NEW.id)
      ON CONFLICT (user_id, type, scheduled_at, reference_id) WHERE status = 'pending' AND type IN ('due_date', 'do_date') DO NOTHING;
    END IF;

    IF (user_settings->'notifications'->>'do_date_alerts')::boolean IS NOT FALSE
       AND NEW.do_date IS NOT NULL AND NEW.do_date > now() THEN
      INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
      VALUES (NEW.user_id, NEW.do_date, 'do_date',
              jsonb_strip_nulls(jsonb_build_object(
                'title', 'Time to focus',
                'body', 'You have a task scheduled now.',
                'encrypted', public.encrypted_notification_body(
                  'Scheduled: {}', NEW.content),
                'data', jsonb_build_object('url', '/', 'taskId', NEW.id, 'reminderType', 'do_date', 'recurring', COALESCE(jsonb_typeof(NEW.recurrence), 'null') <> 'null')
              )),
              NEW.id)
      ON CONFLICT (user_id, type, scheduled_at, reference_id) WHERE status = 'pending' AND type IN ('due_date', 'do_date') DO NOTHING;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_event_notification_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  user_settings JSONB;
  tz TEXT;
  utc_start TIMESTAMP;
  event_day DATE;
  remind_local TIMESTAMP;
  remind_at TIMESTAMPTZ;
  lead_template TEXT;
BEGIN
  -- Reorders and sync touches change nothing a reminder shows; leave pending ones, snoozes included.
  IF TG_OP = 'UPDATE'
     AND OLD.start_time IS NOT DISTINCT FROM NEW.start_time
     AND OLD.reminder_minutes IS NOT DISTINCT FROM NEW.reminder_minutes
     AND OLD.is_archived IS NOT DISTINCT FROM NEW.is_archived
     AND OLD.sync_state IS NOT DISTINCT FROM NEW.sync_state
     AND OLD.all_day IS NOT DISTINCT FROM NEW.all_day
     AND OLD.recurrence_rule IS NOT DISTINCT FROM NEW.recurrence_rule THEN
    -- Preserve pending reminders across text changes and re-seals by refreshing ciphertext.
    IF OLD.title IS DISTINCT FROM NEW.title AND NEW.title ~ '^xchacha20poly1305-v[12]:' THEN
      UPDATE public.notification_queue
      SET payload = jsonb_set(payload, '{encrypted,ciphertext}', to_jsonb(NEW.title))
      WHERE reference_id = NEW.id
        AND status = 'pending'
        AND type = 'event_reminder'
        AND scheduled_at > now()
        AND payload ? 'encrypted';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.notification_queue
    SET status = 'cancelled'
    WHERE reference_id = OLD.id
      AND status = 'pending'
      AND type = 'event_reminder'
      AND scheduled_at > now();
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE')
     AND NEW.reminder_minutes IS NOT NULL
     AND NOT COALESCE(NEW.is_archived, false)
     AND NEW.sync_state IS DISTINCT FROM 'pending_delete'
     AND COALESCE(NEW.recurrence_rule, '') = '' THEN
    SELECT settings, timezone INTO user_settings, tz FROM profiles WHERE id = NEW.user_id;

    IF (user_settings->'notifications'->>'event_reminders')::boolean IS NOT FALSE THEN
      IF NEW.all_day THEN
        IF public.at_timezone_or_null(now(), tz) IS NULL THEN
          RETURN NEW;
        END IF;
        -- Synced all-day events start at UTC midnight; native ones at local midnight.
        utc_start := NEW.start_time AT TIME ZONE 'UTC';
        IF utc_start::time = '00:00' THEN
          event_day := utc_start::date;
        ELSE
          event_day := (NEW.start_time AT TIME ZONE tz)::date;
        END IF;
        remind_local := (event_day - (NEW.reminder_minutes >= 1440)::int)::timestamp + TIME '09:00';
        remind_at := remind_local AT TIME ZONE tz;
        -- ADR 0018: a local time that does not exist that day is skipped.
        IF (remind_at AT TIME ZONE tz) <> remind_local THEN
          RETURN NEW;
        END IF;
        lead_template := CASE WHEN NEW.reminder_minutes >= 1440
          THEN '"{}" is tomorrow' ELSE '"{}" is today' END;
      ELSE
        remind_at := NEW.start_time - make_interval(mins => NEW.reminder_minutes);
        lead_template := CASE WHEN NEW.reminder_minutes = 0
          THEN '"{}" is starting now'
          WHEN NEW.reminder_minutes = 60 THEN '"{}" starts in 1 hour'
          WHEN NEW.reminder_minutes = 1440 THEN '"{}" starts in 1 day'
          ELSE '"{}" starts in ' || NEW.reminder_minutes || ' minutes' END;
      END IF;

      IF remind_at > now() THEN
        INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
        VALUES (NEW.user_id, remind_at, 'event_reminder',
                jsonb_strip_nulls(jsonb_build_object(
                  'title', 'Upcoming event',
                  'body', 'You have an event coming up.',
                  'encrypted', public.encrypted_notification_body(lead_template, NEW.title),
                  'data', jsonb_build_object('url', '/calendar', 'eventId', NEW.id, 'reminderType', 'event_reminder')
                )),
                NEW.id)
        ON CONFLICT (user_id, type, scheduled_at, reference_id) WHERE status = 'pending' AND type = 'event_reminder' DO NOTHING;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
