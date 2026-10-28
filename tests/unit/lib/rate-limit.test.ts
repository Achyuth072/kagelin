import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkRateLimit,
  enforceRateLimit,
  getClientIp,
  resetRateLimitsForTesting,
} from "@/lib/rate-limit";

describe("rate-limit (in-memory sliding window)", () => {
  beforeEach(() => {
    resetRateLimitsForTesting();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to maxRequests within the window", async () => {
    for (let i = 0; i < 10; i++) {
      const result = await checkRateLimit("push-send", "user-1");
      expect(result.allowed).toBe(true);
    }

    const blocked = await checkRateLimit("push-send", "user-1");
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.limit).toBe(10);
      expect(blocked.remaining).toBe(0);
      expect(blocked.reset).toBeGreaterThan(Date.now());
    }
  });

  it("recovers capacity as the sliding window advances", async () => {
    const startTime = 100_000;
    vi.setSystemTime(startTime);

    for (let i = 0; i < 10; i++) {
      await checkRateLimit("push-send", "user-1");
    }

    const blocked = await checkRateLimit("push-send", "user-1");
    expect(blocked.allowed).toBe(false);

    // Still inside the 60s window
    vi.advanceTimersByTime(30_000);
    const stillBlocked = await checkRateLimit("push-send", "user-1");
    expect(stillBlocked.allowed).toBe(false);

    // Past the first request's window
    vi.advanceTimersByTime(31_000);
    const nowAllowed = await checkRateLimit("push-send", "user-1");
    expect(nowAllowed.allowed).toBe(true);
  });

  it("isolates rate limits by identifier and route name", async () => {
    for (let i = 0; i < 10; i++) {
      await checkRateLimit("push-send", "user-1");
    }

    expect((await checkRateLimit("push-send", "user-1")).allowed).toBe(false);
    expect((await checkRateLimit("push-send", "user-2")).allowed).toBe(true);
    expect((await checkRateLimit("telemetry", "user-1")).allowed).toBe(true);
  });

  it("getClientIp reads x-forwarded-for, falling back to x-real-ip then unknown", () => {
    expect(
      getClientIp(
        new Request("http://localhost", {
          headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
        }),
      ),
    ).toBe("1.2.3.4");

    expect(
      getClientIp(
        new Request("http://localhost", {
          headers: { "x-real-ip": "9.9.9.9" },
        }),
      ),
    ).toBe("9.9.9.9");

    expect(
      getClientIp(
        new Request("http://localhost", {
          headers: { "x-forwarded-for": "   " },
        }),
      ),
    ).toBe("unknown");

    expect(getClientIp(new Request("http://localhost"))).toBe("unknown");
  });

  it("bounds memory by pruning expired entries when capacity is exceeded", async () => {
    const startTime = 100_000;
    vi.setSystemTime(startTime);

    for (let i = 0; i < 5001; i++) {
      await checkRateLimit("push-send", `bulk-${i}`);
    }

    // Advance beyond active window to expire bulk entries
    vi.advanceTimersByTime(70_000);

    const res = await checkRateLimit("push-send", "trigger-prune");
    expect(res.allowed).toBe(true);
  });

  it("enforceRateLimit returns null when request is allowed", async () => {
    const response = await enforceRateLimit("webdav", "client-1");
    expect(response).toBeNull();
  });

  it("enforceRateLimit returns a 429 response with headers when limit is exceeded", async () => {
    const now = 200_000;
    vi.setSystemTime(now);

    for (let i = 0; i < 60; i++) {
      await enforceRateLimit("webdav", "client-1");
    }

    const response = await enforceRateLimit("webdav", "client-1");
    expect(response?.status).toBe(429);
    expect(response?.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(response?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(Number(response?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
