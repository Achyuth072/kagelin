import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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

export interface RateLimitResult {
  allowed: boolean;
  limit?: number;
  remaining?: number;
  /** Unix ms timestamp when the window resets. */
  reset?: number;
}

let warnedNotConfigured = false;
const limiters = new Map<string, Ratelimit>();

function getLimiter(
  name: string,
  maxRequests: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`,
): Ratelimit | null {
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
  name: string,
  identifier: string,
  opts: { maxRequests: number; window: `${number} ${"s" | "m" | "h" | "d"}` },
): Promise<RateLimitResult> {
  const limiter = getLimiter(name, opts.maxRequests, opts.window);
  if (!limiter) {
    return { allowed: true };
  }

  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  return { allowed: success, limit, remaining, reset };
}

/** Best-effort client IP extraction behind Vercel's proxy. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitResponseHeaders(
  result: RateLimitResult,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (result.limit !== undefined)
    headers["X-RateLimit-Limit"] = String(result.limit);
  if (result.remaining !== undefined)
    headers["X-RateLimit-Remaining"] = String(result.remaining);
  if (result.reset !== undefined) {
    headers["Retry-After"] = String(
      Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
    );
  }
  return headers;
}
