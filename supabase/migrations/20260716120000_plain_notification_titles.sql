-- =============================================================================
-- Drop emoji from push notification titles (ink & matte)
-- =============================================================================
-- DESIGN_SYSTEM.md: "No gloss, no bloom, no decorative elements." The colour
-- emoji render from the OS emoji font, so no theme token reaches them. The
-- titles already read clearly without.
--
-- Body is otherwise identical to schema.sql's definition (modulo trailing
-- whitespace). The
-- `SET search_path = public` clause must stay: CREATE OR REPLACE resets a
-- function's configuration parameters, so omitting it would silently revert
-- the pinning applied in 20260712120000_advisor_security_fixes.sql.
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
  -- 1. CLEANUP: If task is updated or deleted, cancel pending notifications for this task
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.notification_queue
    SET status = 'cancelled'
    WHERE reference_id = OLD.id
      AND status = 'pending';
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
                'data', jsonb_build_object('url', '/today', 'taskId', NEW.id)
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
                'data', jsonb_build_object('url', '/today', 'taskId', NEW.id)
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
