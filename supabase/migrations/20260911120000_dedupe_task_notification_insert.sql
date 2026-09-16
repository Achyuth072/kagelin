-- Multiple tasks can share the same deadline; dedupe against pending notification rows.

CREATE OR REPLACE FUNCTION handle_task_notification_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  user_settings JSONB;
BEGIN
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
                'data', jsonb_build_object('url', '/', 'taskId', NEW.id)
              )),
              NEW.id)
      ON CONFLICT (user_id, type, scheduled_at) WHERE status = 'pending' DO NOTHING;
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
                'data', jsonb_build_object('url', '/', 'taskId', NEW.id)
              )),
              NEW.id)
      ON CONFLICT (user_id, type, scheduled_at) WHERE status = 'pending' DO NOTHING;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
