-- =============================================================================
-- Fix: task write cancels its own due/do-date notification (#155)
-- =============================================================================
-- handle_task_notification_sync's cleanup phase cancelled every pending
-- due_date/do_date row for the task with no scheduled_at guard. An UPDATE or
-- DELETE on a task after its due_date/do_date has passed but before the
-- poller (claim_due_notifications) has claimed the row (still 'pending') --
-- e.g. editing an unrelated field, or marking the task complete, right
-- around its due time -- cancels the notification that's already due,
-- racing the poller for whether it ever goes out. Same self-cancel bug as
-- #139, on the task path instead of the timer path. Scoping the cleanup to
-- scheduled_at > now() leaves a row that's already due for the poller
-- instead of cancelling it.
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_task_notification_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  payload_title TEXT;
  payload_body TEXT;
  user_settings JSONB;
BEGIN
  -- 1. CLEANUP: cancel only the notifications this trigger itself creates.
  -- timer_end rows share reference_id with the task but are owned by the focus
  -- timer -- cancelling those killed running timers' notifications. Scoped to
  -- scheduled_at > now() (#155) so a row that's already due is left for the
  -- poller instead of being cancelled by this write.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.notification_queue
    SET status = 'cancelled'
    WHERE reference_id = OLD.id
      AND status = 'pending'
      AND type IN ('due_date', 'do_date')
      AND scheduled_at > now();
  END IF;

  -- 2. CREATE NEW NOTIFICATIONS: If task is created or updated (and not completed)
  IF (TG_OP IN ('INSERT', 'UPDATE')) AND (NEW.is_completed = FALSE) THEN
    -- Fetch user settings to check preferences
    SELECT settings INTO user_settings FROM profiles WHERE id = NEW.user_id;

    -- i. Handle Due Date
    IF (user_settings->'notifications'->>'due_date_alerts')::boolean IS NOT FALSE
       AND NEW.due_date IS NOT NULL AND NEW.due_date > now() THEN
      payload_title := 'Task Due Soon';
      payload_body := 'Your task "' || NEW.content || '" is due now.';

      INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
      VALUES (NEW.user_id, NEW.due_date, 'due_date',
              jsonb_build_object(
                'title', payload_title,
                'body', payload_body,
                'data', jsonb_build_object('url', '/', 'taskId', NEW.id)
              ),
              NEW.id);
    END IF;

    -- ii. Handle Do Date
    IF (user_settings->'notifications'->>'do_date_alerts')::boolean IS NOT FALSE
       AND NEW.do_date IS NOT NULL AND NEW.do_date > now() THEN
      payload_title := 'Time to focus';
      payload_body := 'Scheduled: ' || NEW.content;

      INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
      VALUES (NEW.user_id, NEW.do_date, 'do_date',
              jsonb_build_object(
                'title', payload_title,
                'body', payload_body,
                'data', jsonb_build_object('url', '/', 'taskId', NEW.id)
              ),
              NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
