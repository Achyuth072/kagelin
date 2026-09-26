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
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}()`);
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

  it("stays quiet once the window holds N Done days in the last D days", () => {
    expect(body).toMatch(/e\.date BETWEEN t\.remind_ts::date - \(/);
    expect(body).toMatch(/\)\s*<\s*COALESCE\(h\.frequency_count, 1\)/);
  });

  it("falls back to the period's day count when frequency_days is unset", () => {
    expect(body).toMatch(
      /COALESCE\(\s*h\.frequency_days,\s*CASE h\.frequency_period WHEN 'week' THEN 7 WHEN 'month' THEN 30 ELSE 1 END\s*\)/,
    );
  });

  it("counts a Boolean Done as value = 1 and never counts Skipped (negative) values", () => {
    expect(body).toContain("e.value >= 0");
    expect(body).toContain("ELSE e.value = 1");
  });

  it("judges a Measurable Done against the target in either direction", () => {
    expect(body).toContain("WHEN 'at_least' THEN e.value >= h.target_value");
    expect(body).toContain("WHEN 'at_most' THEN e.value <= h.target_value");
  });

  it("judges a Measurable Done like dayValue when the target is unset or not positive", () => {
    expect(body).toContain(
      "WHEN h.habit_type = 'measurable' AND h.target_value > 0 THEN",
    );
    expect(body).toMatch(/h\.target_type = 'at_most' THEN e\.value <= 0/);
    expect(body).toContain(
      "WHEN h.habit_type = 'measurable' THEN e.value >= 1",
    );
    expect(body).not.toContain("e.value > 0");
  });

  it("tolerates an unrecognised profile timezone instead of aborting the batch", () => {
    expect(body).not.toMatch(/AT TIME ZONE\s+p\.timezone/);
    expect(body).toContain("public.at_timezone_or_null(now(), p.timezone)");
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
