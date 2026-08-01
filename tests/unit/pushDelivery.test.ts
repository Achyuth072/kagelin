import { describe, it, expect } from "vitest";
import {
  buildSendOptions,
  buildTopic,
  isExpired,
  isGoneStatus,
  isRetryableStatus,
  MAX_RETRIES,
  pushStatusCode,
  resolveFailure,
  retryDelaySeconds,
} from "../../supabase/functions/_shared/push-delivery";

describe("buildSendOptions", () => {
  it("sends every queued notification at high urgency", () => {
    for (const type of [
      "timer_end",
      "due_date",
      "do_date",
      "evening",
      "briefing",
    ] as const) {
      expect(buildSendOptions(type).urgency).toBe("high");
    }
  });

  it("gives a focus-timer alert a short TTL and a briefing a long one", () => {
    expect(buildSendOptions("timer_end").TTL).toBe(300);
    expect(buildSendOptions("briefing").TTL).toBe(3600);
  });
});

describe("buildTopic", () => {
  it("keys per-task types on the task so two tasks do not collapse", () => {
    const a = buildTopic("due_date", "11111111-2222-3333-4444-555555555555");
    const b = buildTopic("due_date", "99999999-8888-7777-6666-555555555555");
    expect(a).not.toBe(b);
  });

  it("collapses superseded reminders for the same task", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    expect(buildTopic("due_date", id)).toBe(buildTopic("due_date", id));
  });

  it("uses the bare type for singleton notifications", () => {
    expect(buildTopic("timer_end", "any-task-id")).toBe("timer_end");
    expect(buildTopic("briefing", null)).toBe("briefing");
  });

  it("stays within the RFC 8030 topic constraints", () => {
    const topics = [
      buildTopic("due_date", "11111111-2222-3333-4444-555555555555"),
      buildTopic("do_date", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
      buildTopic("timer_end", null),
      buildTopic("briefing", null),
    ];
    for (const topic of topics) {
      expect(topic.length).toBeLessThanOrEqual(32);
      expect(topic).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe("isExpired", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");
  const minutesAgo = (n: number) =>
    new Date(now.getTime() - n * 60_000).toISOString();

  it("treats a long-overdue focus-timer row as undeliverable", () => {
    expect(isExpired("timer_end", minutesAgo(60), now)).toBe(true);
  });

  it("still delivers a row that is only slightly late", () => {
    expect(isExpired("timer_end", minutesAgo(2), now)).toBe(false);
  });

  it("gives a briefing a longer grace than a focus timer", () => {
    expect(isExpired("timer_end", minutesAgo(30), now)).toBe(true);
    expect(isExpired("briefing", minutesAgo(30), now)).toBe(false);
  });

  it("does not expire a row scheduled for the future", () => {
    expect(isExpired("timer_end", minutesAgo(-5), now)).toBe(false);
  });
});

describe("failure classification", () => {
  it("treats a gone subscription as permanent, not retryable", () => {
    for (const code of [404, 410]) {
      expect(isGoneStatus(code)).toBe(true);
      expect(isRetryableStatus(code)).toBe(false);
    }
  });

  it("retries transient push-service failures", () => {
    for (const code of [429, 500, 502, 503]) {
      expect(isRetryableStatus(code)).toBe(true);
    }
  });

  it("retries transport errors that carry no status code", () => {
    expect(isRetryableStatus(undefined)).toBe(true);
  });

  it("does not retry a malformed request", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(413)).toBe(false);
  });
});

describe("resolveFailure", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");

  it("schedules a retry after a transient failure", () => {
    const result = resolveFailure(0, [503], now);
    expect(result.action).toBe("retry");
    if (result.action !== "retry") throw new Error("expected retry");
    expect(result.retryCount).toBe(1);
    expect(result.nextAttemptAt).toBe("2026-07-27T12:00:10.000Z");
  });

  it("backs off further on each successive attempt", () => {
    expect(retryDelaySeconds(0)).toBe(10);
    expect(retryDelaySeconds(1)).toBe(30);
    expect(retryDelaySeconds(2)).toBe(90);
  });

  it("actually reaches every documented backoff step", () => {
    const delays = [0, 1, 2].map((n) => {
      const result = resolveFailure(n, [503], now);
      if (result.action !== "retry") throw new Error(`expected retry at ${n}`);
      return (
        (Date.parse(result.nextAttemptAt) - now.getTime()) /
        1000
      ).toString();
    });
    expect(delays).toEqual(["10", "30", "90"]);
  });

  it("gives up once retries are exhausted", () => {
    expect(resolveFailure(MAX_RETRIES, [503], now).action).toBe("fail");
  });

  it("fails immediately on a permanent error rather than burning retries", () => {
    const result = resolveFailure(0, [410], now);
    expect(result.action).toBe("fail");
    if (result.action !== "fail") throw new Error("expected fail");
    expect(result.errorMessage).toContain("permanently");
  });

  it("retries when any endpoint failed transiently", () => {
    // Multi-device user: one dead subscription, one transient failure.
    expect(resolveFailure(0, [410, 503], now).action).toBe("retry");
  });
});

describe("pushStatusCode", () => {
  it("reads the status web-push attaches to a rejected send", () => {
    expect(
      pushStatusCode(Object.assign(new Error("Gone"), { statusCode: 410 })),
    ).toBe(410);
  });

  it("reports no status for a throw that never reached the push service", () => {
    expect(pushStatusCode(new Error("getaddrinfo ENOTFOUND"))).toBeUndefined();
    expect(pushStatusCode("boom")).toBeUndefined();
    expect(pushStatusCode(null)).toBeUndefined();
  });

  it("ignores a non-numeric status instead of trusting it as a code", () => {
    expect(pushStatusCode({ statusCode: "410" })).toBeUndefined();
  });
});
