import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockLimit = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(function (this: unknown) {
    return {};
  }),
}));

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = vi.fn((max: number, window: string) => ({
      max,
      window,
    }));
    limit = mockLimit;
  }
  return { Ratelimit };
});

describe("rate-limit (H-5 / N-3)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    mockLimit.mockReset();
    process.env = { ...originalEnv };
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("fails open (allowed: true) when Upstash env vars are not set", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = await checkRateLimit("webdav", "id-1");

    expect(result.allowed).toBe(true);
    expect(mockLimit).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("delegates to Upstash and returns its verdict when configured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    mockLimit.mockResolvedValue({
      success: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = await checkRateLimit("webdav", "id-1");

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.remaining).toBe(0);
    }
    expect(mockLimit).toHaveBeenCalledWith("id-1");
  });

  it("getClientIp reads x-forwarded-for, falling back to x-real-ip then unknown", async () => {
    const { getClientIp } = await import("@/lib/rate-limit");

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

    expect(getClientIp(new Request("http://localhost"))).toBe("unknown");
  });

  it("enforceRateLimit returns null when the request is allowed", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    mockLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 30_000,
    });

    const { enforceRateLimit } = await import("@/lib/rate-limit");
    expect(await enforceRateLimit("webdav", "id-1")).toBeNull();
  });

  it("enforceRateLimit returns a 429 with limit headers when exceeded", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    mockLimit.mockResolvedValue({
      success: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() + 10_000,
    });

    const { enforceRateLimit } = await import("@/lib/rate-limit");
    const response = await enforceRateLimit("webdav", "id-1");

    expect(response?.status).toBe(429);
    expect(response?.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(response?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(Number(response?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
