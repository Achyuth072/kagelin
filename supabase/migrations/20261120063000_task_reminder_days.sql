-- =============================================================================
-- Migration: Add reminder_days to tasks and update task notification trigger
-- =============================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reminder_days INT NOT NULL DEFAULT 127;

CREATE OR REPLACE FUNCTION handle_task_notification_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  user_settings JSONB;
  tz TEXT;
  due_dow INT;
  do_dow INT;
  local_due TIMESTAMP;
  local_do TIMESTAMP;
BEGIN
  -- Reorders and sync touches change nothing a reminder shows; leave pending ones, snoozes included.
  IF TG_OP = 'UPDATE'
     AND OLD.is_completed IS NOT DISTINCT FROM NEW.is_completed
     AND OLD.due_date IS NOT DISTINCT FROM NEW.due_date
     AND OLD.do_date IS NOT DISTINCT FROM NEW.do_date
     AND OLD.recurrence IS NOT DISTINCT FROM NEW.recurrence
     AND OLD.reminder_days IS NOT DISTINCT FROM NEW.reminder_days THEN
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
    SELECT settings, timezone INTO user_settings, tz FROM profiles WHERE id = NEW.user_id;

    IF NEW.due_date IS NOT NULL THEN
      local_due := COALESCE(public.at_timezone_or_null(NEW.due_date, tz), NEW.due_date AT TIME ZONE 'UTC');
      due_dow := EXTRACT(DOW FROM local_due)::int;
    END IF;

    IF (user_settings->'notifications'->>'due_date_alerts')::boolean IS NOT FALSE 
       AND NEW.due_date IS NOT NULL AND NEW.due_date > now()
       AND ((COALESCE(NEW.reminder_days, 127) >> due_dow) & 1 = 1) THEN
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

    IF NEW.do_date IS NOT NULL THEN
      local_do := COALESCE(public.at_timezone_or_null(NEW.do_date, tz), NEW.do_date AT TIME ZONE 'UTC');
      do_dow := EXTRACT(DOW FROM local_do)::int;
    END IF;

    IF (user_settings->'notifications'->>'do_date_alerts')::boolean IS NOT FALSE
       AND NEW.do_date IS NOT NULL AND NEW.do_date > now()
       AND ((COALESCE(NEW.reminder_days, 127) >> do_dow) & 1 = 1) THEN
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
