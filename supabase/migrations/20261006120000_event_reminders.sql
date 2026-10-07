ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER;

ALTER TABLE public.notification_queue
  DROP CONSTRAINT IF EXISTS notification_queue_type_check;
ALTER TABLE public.notification_queue
  ADD CONSTRAINT notification_queue_type_check
  CHECK (type IN ('timer_end', 'due_date', 'do_date', 'evening', 'briefing', 'habit_reminder', 'event_reminder'));

CREATE UNIQUE INDEX IF NOT EXISTS notification_queue_event_pending_dedup_idx
  ON public.notification_queue (user_id, type, scheduled_at, reference_id)
  WHERE status = 'pending' AND type = 'event_reminder';

-- Recurring series are skipped: nothing parses RRULEs yet.
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
                  'data', jsonb_build_object('url', '/calendar', 'eventId', NEW.id)
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

DROP TRIGGER IF EXISTS sync_event_notifications ON public.calendar_events;
CREATE TRIGGER sync_event_notifications
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.handle_event_notification_sync();
