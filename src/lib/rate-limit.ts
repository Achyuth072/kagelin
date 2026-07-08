import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

/**
 * Rate limiting for beta (H-5 / addendum N-3).
 *
 * An in-memory limiter is a no-op on Vercel serverless — instances are
 * short-lived and don't share memory, so beta needs a shared store. Upstash's
 * free tier covers an invite beta and survives a later hosting move (unlike
 * Vercel WAF rules, which are dashboard-only and tied to the host).
 *
 * If `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` aren't set (local
 * dev, CI, or a beta deploy before the Upstash database is provisioned) this
 * fails open — requests are allowed and a warning is logged once — rather
 * than taking the app down over an unconfigured optional dependency.
 */

type Window = `${number} ${"s" | "m" | "h" | "d"}`;

/**
 * Per-route limits live here, not at call sites: limiters are cached by
 * name, so two call sites configuring the same name differently would
 * silently diverge — a single table makes that impossible.
 */
const LIMITS = {
  /** Unauthenticated proxy — limited per IP. */
  webdav: { maxRequests: 60, window: "1 m" },
  /** Authenticated push sends — limited per user. */
  "push-send": { maxRequests: 10, window: "1 m" },
} as const satisfies Record<string, { maxRequests: number; window: Window }>;

export type RateLimitName = keyof typeof LIMITS;

export type RateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      limit: number;
      remaining: number;
      /** Unix ms timestamp when the window resets. */
      reset: number;
    };

let warnedNotConfigured = false;
const limiters = new Map<RateLimitName, Ratelimit>();

function getLimiter(name: RateLimitName): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting is disabled (failing open).",
      );
    }
    return null;
  }

  const cached = limiters.get(name);
  if (cached) return cached;

  const { maxRequests, window } = LIMITS[name];
  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    prefix: `kagelin-ratelimit:${name}`,
    analytics: false,
  });
  limiters.set(name, limiter);
  return limiter;
}

/**
 * Checks and consumes one request against a named, sliding-window limit.
 * Fails open (allowed: true) if Upstash isn't configured.
 */
export async function checkRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = getLimiter(name);
  if (!limiter) {
    return { allowed: true };
  }

  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  return success
    ? { allowed: true }
    : { allowed: false, limit, remaining, reset };
}

/**
 * Route-level guard: returns a ready-to-return 429 when the named limit is
 * exceeded, or null when the request may proceed.
 *
 * Usage:
 *   const limited = await enforceRateLimit("webdav", getClientIp(request));
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<NextResponse | null> {
  const result = await checkRateLimit(name, identifier);
  if (result.allowed) return null;

  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "Retry-After": String(
          Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
        ),
      },
    },
  );
}

/** Best-effort client IP extraction behind Vercel's proxy. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
