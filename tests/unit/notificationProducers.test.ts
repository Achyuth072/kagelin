import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

const schemaSql = read("supabase/schema.sql");
const dailyBriefing = read("supabase/functions/daily-briefing/index.ts");

function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
  expect(start, `${name} not found in schema.sql`).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end, `${name} has no terminator in schema.sql`).toBeGreaterThan(start);
  // Strip SQL comments so assertions inspect executable code only.
  return sql.slice(start, end).replace(/^\s*--.*$/gm, "");
}

describe("handle_task_notification_sync", () => {
  const body = functionBody(schemaSql, "handle_task_notification_sync");

  it("passes the task's ciphertext through instead of interpolating content", () => {
    expect(body).not.toMatch(/\|\|\s*NEW\.content/);
    expect(body).toContain("public.encrypted_notification_body(");
  });

  it("queues a body that names no item for a device with no key", () => {
    expect(body).toContain("'You have a task due now.'");
    expect(body).toContain("'You have a task scheduled now.'");
  });

  it("keeps pending reminders, snoozes included, when only the text changes", () => {
    const textOnly = body.slice(0, body.indexOf("SET status = 'cancelled'"));
    expect(textOnly).not.toContain("OLD.content IS NOT DISTINCT FROM");
    expect(textOnly).toContain(
      "jsonb_set(payload, '{encrypted,ciphertext}', to_jsonb(NEW.content))",
    );
  });
});

describe("handle_event_notification_sync", () => {
  const body = functionBody(schemaSql, "public.handle_event_notification_sync");

  it("passes the event's ciphertext through instead of interpolating the title", () => {
    expect(body).not.toMatch(/\|\|\s*NEW\.title/);
    expect(body).toMatch(
      /encrypted_notification_body\(\s*[^,]+,\s*NEW\.title\s*\)/,
    );
  });

  it("queues a plain body that names no event for a device with no key", () => {
    expect(body).toContain("'Upcoming event'");
    expect(body).toContain("'You have an event coming up.'");
  });

  it("words the encrypted body by lead time", () => {
    expect(body).toContain("starts in ");
    expect(body).toContain("is starting now");
  });

  it("deep-links to the calendar and carries the event id", () => {
    expect(body).toContain("'url', '/calendar'");
    expect(body).toContain("'eventId', NEW.id");
  });

  it("keeps pending reminders, snoozes included, when only the title changes", () => {
    const textOnly = body.slice(0, body.indexOf("SET status = 'cancelled'"));
    expect(textOnly).not.toContain("OLD.title IS NOT DISTINCT FROM");
    expect(textOnly).toContain(
      "jsonb_set(payload, '{encrypted,ciphertext}', to_jsonb(NEW.title))",
    );
  });

  it("cancels only future pending event reminders on update and delete", () => {
    expect(body).toContain("TG_OP IN ('UPDATE', 'DELETE')");
    expect(body).toContain("reference_id = OLD.id");
    expect(body).toContain("type = 'event_reminder'");
    expect(body).toContain("scheduled_at > now()");
  });

  it("queues nothing without a reminder, once archived, or for a recurring series", () => {
    expect(body).toContain("NEW.reminder_minutes IS NOT NULL");
    expect(body).toContain("is_archived");
    expect(body).toContain("NEW.recurrence_rule");
  });

  it("queues nothing for a reminder time already past or an event already started", () => {
    expect(body).toMatch(/remind_at\s*>\s*now\(\)/);
  });

  it("still queues today's 9:00 reminder for an all-day event that began at midnight", () => {
    expect(body).not.toMatch(/NEW\.start_time\s*>\s*now\(\)/);
  });

  it("queues nothing for a synced event awaiting remote deletion", () => {
    expect(body).toContain("NEW.sync_state IS DISTINCT FROM 'pending_delete'");
  });

  it("words hour and day lead times naturally", () => {
    expect(body).toContain(`'"{}" starts in 1 hour'`);
    expect(body).toContain(`'"{}" starts in 1 day'`);
  });

  it("honors the event_reminders switch, on when unset", () => {
    expect(body).toContain(
      "(user_settings->'notifications'->>'event_reminders')::boolean IS NOT FALSE",
    );
  });

  it("schedules all-day events at 9:00 in the profile timezone, skipping nonexistent local times", () => {
    expect(body).toContain("'09:00'");
    expect(body).toContain("public.at_timezone_or_null(now(), tz)");
    expect(body).toMatch(/remind_at AT TIME ZONE tz\)\s*<>\s*remind_local/);
  });

  it("is wired to inserts, updates and deletes on calendar_events", () => {
    expect(schemaSql).toMatch(
      /AFTER INSERT OR UPDATE OR DELETE ON public\.calendar_events\s+FOR EACH ROW EXECUTE FUNCTION public\.handle_event_notification_sync\(\)/,
    );
  });

  it("accepts the event_reminder queue type and dedups it per event", () => {
    expect(schemaSql).toMatch(
      /type IN \([^)]*'habit_reminder', 'event_reminder'\)/,
    );
    expect(body).toContain("type = 'event_reminder'");
    expect(schemaSql).toMatch(
      /notification_queue_event_pending_dedup_idx\s+ON public\.notification_queue \(user_id, type, scheduled_at, reference_id\)\s+WHERE status = 'pending' AND type = 'event_reminder'/,
    );
  });
});

describe("event reminder migration", () => {
  const migration = read(
    "supabase/migrations/20261006120000_event_reminders.sql",
  );

  it("adds a nullable reminder_minutes column", () => {
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER\s*;/,
    );
    expect(schemaSql).toMatch(/reminder_minutes INTEGER/);
  });
});

describe("task and event notification actions migrations", () => {
  const first = read(
    "supabase/migrations/20261006130000_task_event_notification_actions.sql",
  );
  const second = read(
    "supabase/migrations/20261008120300_reminders_keep_snoozes_on_text_change.sql",
  );
  const third = read(
    "supabase/migrations/20261008120700_snooze_rebuilds_text.sql",
  );

  it("matches the schema's complete_task_from_notification", () => {
    const name = "public.complete_task_from_notification";
    expect(functionBody(first, name)).toBe(functionBody(schemaSql, name));
  });

  it.each([
    "handle_task_notification_sync",
    "public.handle_event_notification_sync",
  ])("matches the schema's %s", (name) => {
    expect(functionBody(second, name)).toBe(functionBody(schemaSql, name));
  });

  it("matches the schema's snooze_reminder", () => {
    const name = "public.snooze_reminder";
    expect(functionBody(third, name)).toBe(functionBody(schemaSql, name));
  });
});

describe("handle_timer_notification_sync", () => {
  const body = functionBody(schemaSql, "handle_timer_notification_sync");

  it("queues no readable task text when a focus session completes", () => {
    expect(body).not.toMatch(/\bFROM\s+tasks\b/i);
    expect(body).not.toMatch(/\bcontent\b/);
  });

  it("still deep-links to the task it was run against", () => {
    expect(body).toContain("'taskId', NEW.active_task_id");
  });
});

describe("enqueue_due_habit_reminders", () => {
  const body = functionBody(schemaSql, "public.enqueue_due_habit_reminders");

  it("passes the habit's ciphertext through instead of interpolating content", () => {
    expect(body).not.toMatch(/\|\|\s*h\.(name|question)/);
    expect(body).toContain("public.encrypted_notification_body(");
  });

  it("queues a body that names no habit for a device with no key", () => {
    expect(body).toContain("'You have a habit scheduled now.'");
  });

  it("includes an encrypted title envelope over the habit name", () => {
    expect(body).toContain("'encryptedTitle'");
    expect(body).toMatch(
      /encrypted_notification_body\(\s*'{}'\s*,\s*h\.name\s*\)/,
    );
  });

  it("keeps the plaintext title generic — never the habit name", () => {
    expect(body).toContain("'Habit reminder'");
    expect(body).not.toMatch(/'title'\s*,\s*h\.(name|question)/);
  });

  it("uses the question as the encrypted body when present", () => {
    expect(body).toMatch(
      /encrypted_notification_body\(\s*'{}'\s*,\s*h\.question\s*\)/,
    );
  });

  it("omits the encrypted body and shows 'Time to check in.' when there is no question", () => {
    expect(body).toContain("'Time to check in.'");
    expect(body).not.toContain("'Time for {}'");
  });

  it("includes the reminder's local date in the payload data", () => {
    expect(body).toMatch(/to_char\s*\(/i);
    expect(body).toMatch(/'date'/);
    expect(body).toMatch(/'YYYY-MM-DD'/);
  });

  it("includes the habit kind in the payload data", () => {
    expect(body).toMatch(/'habitKind'/);
    expect(body).toMatch(/h\.habit_type/);
  });

  it("defers the window check to the shared helper", () => {
    expect(body).toContain(
      "public.habit_window_unsatisfied(h, t.remind_ts::date)",
    );
  });

  it("tolerates an unrecognised profile timezone instead of aborting the batch", () => {
    expect(body).not.toMatch(/AT TIME ZONE\s+p\.timezone/);
    expect(body).toContain("public.at_timezone_or_null(now(), p.timezone)");
  });
});

describe("habit_window_unsatisfied", () => {
  const windowBody = functionBody(schemaSql, "public.habit_window_unsatisfied");

  it("stays quiet once the window holds N Done days in the last D days", () => {
    expect(windowBody).toMatch(/e\.date BETWEEN p_date - \(/);
    expect(windowBody).toMatch(
      /\)\s*<\s*COALESCE\(p_habit\.frequency_count, 1\)/,
    );
  });

  it("falls back to the period's day count when frequency_days is unset", () => {
    expect(windowBody).toMatch(
      /COALESCE\(\s*p_habit\.frequency_days,\s*CASE p_habit\.frequency_period WHEN 'week' THEN 7 WHEN 'month' THEN 30 ELSE 1 END\s*\)/,
    );
  });

  it("counts a Boolean Done as value = 1 and never counts Skipped (negative) values", () => {
    expect(windowBody).toContain("e.value >= 0");
    expect(windowBody).toContain("ELSE e.value = 1");
  });

  it("judges a Measurable Done against the target in either direction", () => {
    expect(windowBody).toContain(
      "WHEN 'at_least' THEN e.value >= p_habit.target_value",
    );
    expect(windowBody).toContain(
      "WHEN 'at_most' THEN e.value <= p_habit.target_value",
    );
  });

  it("judges a Measurable Done like dayValue when the target is unset or not positive", () => {
    expect(windowBody).toContain(
      "WHEN p_habit.habit_type = 'measurable' AND p_habit.target_value > 0 THEN",
    );
    expect(windowBody).toMatch(
      /p_habit\.target_type = 'at_most' THEN e\.value <= 0/,
    );
    expect(windowBody).toContain(
      "WHEN p_habit.habit_type = 'measurable' THEN e.value >= 1",
    );
    expect(windowBody).not.toContain("e.value > 0");
  });
});

describe("get_briefing_counts", () => {
  const body = functionBody(schemaSql, "public.get_briefing_counts");

  it("bounds today's tasks to the local day instead of 'today or later'", () => {
    expect(body).toContain("t.do_date >= day_start AND t.do_date < day_end");
  });

  it("counts a Task as overdue by its do date, else its due date, like Home", () => {
    expect(body).toContain("COALESCE(t.do_date, t.due_date) < day_start");
  });

  it("derives the day from the profile timezone without aborting on a bad zone", () => {
    expect(body).toContain("public.at_timezone_or_null(now(), tz)");
  });

  it("counts pending habits with the same helper Habit reminders use", () => {
    expect(body).toContain("public.habit_window_unsatisfied(h, local_date)");
  });

  it("selects no readable item text", () => {
    expect(body).not.toMatch(/\b(content|title|name)\b/);
  });
});

describe("sync_habit_frequency_days", () => {
  const body = functionBody(schemaSql, "public.sync_habit_frequency_days");

  it("carries a period-only preset change into frequency_days", () => {
    expect(body).toContain(
      "NEW.frequency_period IS DISTINCT FROM OLD.frequency_period",
    );
    expect(body).toContain(
      "NEW.frequency_days IS NOT DISTINCT FROM OLD.frequency_days",
    );
    expect(body).toMatch(/WHEN 'week' THEN 7\s+WHEN 'month' THEN 30\s+ELSE 1/);
  });

  it("leaves a custom (period-less) habit alone", () => {
    expect(body).toContain("OLD.frequency_period IS NOT NULL");
    expect(body).toContain("NEW.frequency_period IS NOT NULL");
  });

  it("runs before updates to habits' period", () => {
    expect(schemaSql).toMatch(
      /BEFORE UPDATE OF frequency_period ON public\.habits\s+FOR EACH ROW EXECUTE FUNCTION public\.sync_habit_frequency_days\(\)/,
    );
  });
});

describe("daily-briefing", () => {
  it("counts tasks without selecting their content", () => {
    expect(dailyBriefing).not.toMatch(/\.select\(\s*"[^"]*content/);
    expect(dailyBriefing).not.toContain("tasks[0].content");
  });
});

describe("notification action payloads", () => {
  it("tags task reminders with their queue type and whether the task recurs", () => {
    const body = functionBody(schemaSql, "handle_task_notification_sync");

    expect(body).toContain("'reminderType', 'due_date'");
    expect(body).toContain("'reminderType', 'do_date'");
    expect(
      body.match(
        /'recurring', COALESCE\(jsonb_typeof\(NEW\.recurrence\), 'null'\) <> 'null'/g,
      ),
    ).toHaveLength(2);
  });

  it("tags event reminders with their queue type", () => {
    const body = functionBody(
      schemaSql,
      "public.handle_event_notification_sync",
    );

    expect(body).toContain("'reminderType', 'event_reminder'");
  });
});

describe("snooze_reminder", () => {
  const body = functionBody(schemaSql, "public.snooze_reminder");

  it("runs as definer but only ever touches the caller's own rows", () => {
    expect(body).toContain("SECURITY DEFINER");
    expect(body).toContain("user_id = auth.uid()");
    expect(body).not.toMatch(/p_user_id/);
  });

  it("re-queues the sent reminder's own payload ten minutes out", () => {
    expect(body).toContain("interval '10 minutes'");
    expect(body).toContain("status = 'sent'");
    expect(body).toMatch(/payload/);
  });

  it("drops the snooze when that reminder type has been switched off", () => {
    expect(body).toContain("'due_date_alerts'");
    expect(body).toContain("'do_date_alerts'");
    expect(body).toContain("'event_reminders'");
    expect(body).toMatch(/::boolean IS FALSE THEN\s+RETURN 'dropped'/);
  });

  it("re-words a timed event's lead time from the snooze time, not the sent row", () => {
    expect(body).toContain("event_row.start_time - snooze_until");
    expect(body).toMatch(
      /encrypted_notification_body\([\s\S]*starts in[\s\S]*event_row\.title\)/,
    );
    expect(body).toContain("IF NOT event_row.all_day");
  });

  it("rebuilds a task snooze's text from the task, since a Re-seal strips the delivered copy", () => {
    expect(body).toContain("SELECT t.content INTO task_content");
    expect(body).toMatch(
      /encrypted_notification_body\([\s\S]*'Your task "\{\}" is due now\.'[\s\S]*'Scheduled: \{\}'[\s\S]*task_content\)/,
    );
  });

  it("rebuilds an all-day event snooze's text from the event", () => {
    expect(body).toMatch(
      /'"\{\}" is tomorrow' ELSE '"\{\}" is today' END,\s*event_row\.title\)/,
    );
  });

  it("does not queue a second snooze while one is already pending", () => {
    expect(body).toMatch(/IF EXISTS \([^;]*status = 'pending'/);
  });

  it("drops the snooze for a completed task", () => {
    expect(body).toContain("NOT t.is_completed");
  });

  it("drops the snooze for a deleted event, or a timed event that has started", () => {
    expect(body).toContain("e.is_archived");
    expect(body).toContain("pending_delete");
    expect(body).toContain("e.start_time > snooze_until");
  });

  it("drops an all-day event's snooze once it would land past that local day", () => {
    expect(body).toContain("WHEN e.all_day");
    expect(body).toContain("public.at_timezone_or_null(snooze_until, tz)");
    expect(body).toContain(
      "public.at_timezone_or_null(sent_row.scheduled_at, tz)",
    );
  });

  it("is callable by signed-in users only", () => {
    expect(schemaSql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.snooze_reminder(TEXT, UUID) FROM PUBLIC, anon;",
    );
    expect(schemaSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.snooze_reminder(TEXT, UUID) TO authenticated;",
    );
  });
});

describe("complete_task_from_notification", () => {
  const body = functionBody(
    schemaSql,
    "public.complete_task_from_notification",
  );

  it("runs as the caller so row security scopes it to their own tasks", () => {
    expect(body).not.toContain("SECURITY DEFINER");
  });

  it("refuses a recurring task, whose next Occurrence only the app creates", () => {
    expect(body).toContain("RETURN 'recurring'");
    expect(body).toContain("recurrence");
  });

  it("stamps completion and leaves an already completed task alone", () => {
    expect(body).toContain("RETURN 'already_completed'");
    expect(body).toMatch(/is_completed = true,\s*completed_at = now\(\)/);
  });

  it("is callable by signed-in users only", () => {
    expect(schemaSql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.complete_task_from_notification(UUID) FROM PUBLIC, anon;",
    );
    expect(schemaSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.complete_task_from_notification(UUID) TO authenticated;",
    );
  });
});

describe("reminder triggers ignore updates that change nothing a reminder shows", () => {
  it.each([
    [
      "handle_task_notification_sync",
      ["is_completed", "due_date", "do_date", "recurrence"],
    ],
    [
      "public.handle_event_notification_sync",
      [
        "start_time",
        "reminder_minutes",
        "is_archived",
        "sync_state",
        "all_day",
        "recurrence_rule",
      ],
    ],
  ])(
    "%s returns early when only unrelated columns changed",
    (name, columns) => {
      const body = functionBody(schemaSql, name);
      const guard = body.slice(0, body.indexOf("RETURN NEW;"));

      expect(guard).toContain("TG_OP = 'UPDATE'");
      for (const column of columns) {
        expect(guard).toContain(
          `OLD.${column} IS NOT DISTINCT FROM NEW.${column}`,
        );
      }
      // The early return must come before any queue cancellation.
      expect(body.indexOf("RETURN NEW;")).toBeLessThan(
        body.indexOf("status = 'cancelled'"),
      );
    },
  );
});
