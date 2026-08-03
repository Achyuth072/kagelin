-- =============================================================================
-- Server-derived timer_end notification chain (ADR 0002 amendment)
-- =============================================================================
-- Notification *scheduling* moves server-side. A trigger on user_timer_state
-- projects the chain of upcoming timer_end deadlines directly from the row's
-- own state, replacing the client-driven /api/timer/start path. This
-- subsumes four defects documented in .planning/65-PUSH-DELIVERY-DIAGNOSIS.md:
-- cross-device duplicate rows (no shared cancellation point), scheduling
-- drift (the API recomputed scheduled_at from a duration on its own clock),
-- the foreground-stall (the next interval was only queued by whichever
-- device ran completeTimer()), and per-device cancellation (a device could
-- only cancel the row it itself created).
--
-- Follows the same two-phase (cleanup, then create) structure as
-- handle_task_notification_sync. Completion semantics — which device logs
-- and advances a finished session, the race-free claim via
-- `WHERE ends_at = <deadline>` — are unchanged; only scheduling moves here.
-- =============================================================================

-- 1. One row per (user, type, deadline) while pending. The cleanup-then-create
-- pattern below should never violate this in normal operation; a violation is
-- a genuine signal something regressed (this is the invariant the original
-- cross-device duplicate-row bug would have tripped immediately).
CREATE UNIQUE INDEX IF NOT EXISTS notification_queue_pending_dedup_idx
  ON public.notification_queue (user_id, type, scheduled_at)
  WHERE status = 'pending';

-- 2. Chain-projection trigger function --------------------------------------
CREATE OR REPLACE FUNCTION handle_timer_notification_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  user_settings JSONB;
  timer_settings JSONB;
  task_content TEXT;
  session_threshold INT;
  auto_start_break BOOLEAN;
  auto_start_focus BOOLEAN;
  cur_mode TEXT := NEW.mode;
  cur_ends_at TIMESTAMPTZ := NEW.ends_at;
  cur_completed_sessions INT := NEW.completed_sessions;
  next_mode TEXT;
  next_running BOOLEAN;
  next_completed_sessions INT;
  next_duration_minutes NUMERIC;
  payload_title TEXT;
  payload_body TEXT;
  depth INT := 0;
  MAX_CHAIN_DEPTH CONSTANT INT := 5;
BEGIN
  -- Skip entirely when nothing chain-relevant changed (e.g. a reconcile write
  -- that re-persists remaining_seconds/source_device_id on an already-running,
  -- already-projected timer) — otherwise every such write would cancel and
  -- rebuild an identical chain for no reason.
  IF TG_OP = 'UPDATE'
    AND NEW.is_running IS NOT DISTINCT FROM OLD.is_running
    AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at
    AND NEW.mode IS NOT DISTINCT FROM OLD.mode
    AND NEW.completed_sessions IS NOT DISTINCT FROM OLD.completed_sessions
    AND NEW.active_task_id IS NOT DISTINCT FROM OLD.active_task_id
    AND NEW.settings IS NOT DISTINCT FROM OLD.settings
  THEN
    RETURN NEW;
  END IF;

  -- Phase 1 (cleanup): unconditionally cancel every still-pending timer_end
  -- row for this user. Safe because Phase 2 immediately rebuilds whatever
  -- chain is still needed, and there is exactly one user_timer_state row per
  -- user (enforced by user_timer_state_user_id_idx), so this is scoped
  -- correctly by construction — no device-local ref required.
  UPDATE public.notification_queue
  SET status = 'cancelled'
  WHERE user_id = NEW.user_id
    AND status = 'pending'
    AND type = 'timer_end';

  -- Phase 2 (create): only project a chain for a running timer with a known
  -- deadline, and only if the user has timer alerts enabled.
  IF NEW.is_running AND NEW.ends_at IS NOT NULL THEN
    SELECT settings INTO user_settings FROM profiles WHERE id = NEW.user_id;

    IF (user_settings->'notifications'->>'timer_alerts')::boolean IS NOT FALSE THEN
      timer_settings := NEW.settings;
      session_threshold := COALESCE((timer_settings->>'sessionsBeforeLongBreak')::int, 4);
      auto_start_break := COALESCE((timer_settings->>'autoStartBreak')::boolean, false);
      auto_start_focus := COALESCE((timer_settings->>'autoStartFocus')::boolean, false);

      IF NEW.active_task_id IS NOT NULL THEN
        SELECT content INTO task_content FROM tasks WHERE id = NEW.active_task_id;
      END IF;

      -- Replays timerStore's completeTimer() state machine: a focus interval
      -- advances to shortBreak/longBreak depending on the post-increment
      -- session count vs. the threshold; a break interval always advances
      -- back to focus and resets the counter only after a long break. Each
      -- subsequent interval is appended only while the relevant auto-start
      -- flag is true — the chain terminates the first time it isn't, capped
      -- at MAX_CHAIN_DEPTH regardless of settings as a safety net.
      WHILE depth < MAX_CHAIN_DEPTH LOOP
        depth := depth + 1;

        payload_title := CASE WHEN cur_mode = 'focus' THEN 'Focus Complete' ELSE 'Break Complete' END;
        payload_body := CASE
          WHEN task_content IS NOT NULL THEN 'Finished your "' || task_content || '" session. Great work!'
          WHEN cur_mode = 'focus' THEN 'Your focus session is complete. Take a break!'
          ELSE 'Your break is over. Time to focus!'
        END;

        -- reference_id stays NULL: timer_end rows are owned by the timer, not
        -- a task — a task-scoped reference_id would let task cleanup cancel a
        -- running timer's notification.
        INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
        VALUES (
          NEW.user_id,
          cur_ends_at,
          'timer_end',
          jsonb_build_object(
            'title', payload_title,
            'body', payload_body,
            'data', jsonb_build_object('url', '/focus', 'taskId', NEW.active_task_id)
          ),
          NULL
        );

        IF cur_mode = 'focus' THEN
          next_completed_sessions := cur_completed_sessions + 1;
          next_mode := CASE
            WHEN next_completed_sessions >= session_threshold THEN 'longBreak'
            ELSE 'shortBreak'
          END;
          next_running := auto_start_break;
        ELSE
          next_mode := 'focus';
          next_running := auto_start_focus;
          next_completed_sessions := CASE
            WHEN cur_mode = 'longBreak' THEN 0
            ELSE cur_completed_sessions
          END;
        END IF;

        EXIT WHEN NOT next_running;

        next_duration_minutes := CASE next_mode
          WHEN 'focus' THEN COALESCE((timer_settings->>'focusDuration')::numeric, 25)
          WHEN 'shortBreak' THEN COALESCE((timer_settings->>'shortBreakDuration')::numeric, 5)
          WHEN 'longBreak' THEN COALESCE((timer_settings->>'longBreakDuration')::numeric, 15)
        END;

        cur_ends_at := cur_ends_at + (next_duration_minutes * interval '1 minute');
        cur_mode := next_mode;
        cur_completed_sessions := next_completed_sessions;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- No DELETE: unlike tasks, a user_timer_state row is never deleted (one row
-- per user for the account's lifetime — see its own table comment).
DROP TRIGGER IF EXISTS sync_timer_notifications ON public.user_timer_state;
CREATE TRIGGER sync_timer_notifications
AFTER INSERT OR UPDATE ON public.user_timer_state
FOR EACH ROW EXECUTE FUNCTION handle_timer_notification_sync();
