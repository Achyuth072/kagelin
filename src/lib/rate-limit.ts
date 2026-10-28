import { NextResponse } from "next/server";

// In-memory sliding window, scoped to this server instance.

const LIMITS = {
  // Unauthenticated proxy — limited per IP.
  webdav: { maxRequests: 60, windowMs: 60_000 },
  // Authenticated push sends — limited per user.
  "push-send": { maxRequests: 10, windowMs: 60_000 },
  // Telemetry ingestion — limited per IP.
  telemetry: { maxRequests: 60, windowMs: 60_000 },
} as const satisfies Record<string, { maxRequests: number; windowMs: number }>;

export type RateLimitName = keyof typeof LIMITS;

export type RateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      limit: number;
      remaining: number;
      // Unix ms timestamp when the window resets.
      reset: number;
    };

const MAX_STORED_KEYS = 5000;
const MAX_WINDOW_MS = Math.max(
  ...Object.values(LIMITS).map((item) => item.windowMs),
);
const requestBuckets = new Map<string, number[]>();

// Drops idle buckets, then the oldest ones if still over capacity.
function pruneBuckets(now: number): void {
  for (const [key, timestamps] of requestBuckets.entries()) {
    const latest = timestamps[timestamps.length - 1];
    if (!latest || now - latest > MAX_WINDOW_MS) {
      requestBuckets.delete(key);
    }
  }

  if (requestBuckets.size > MAX_STORED_KEYS) {
    const overflow = requestBuckets.size - MAX_STORED_KEYS;
    let evicted = 0;
    for (const key of requestBuckets.keys()) {
      requestBuckets.delete(key);
      evicted++;
      if (evicted >= overflow) break;
    }
  }
}

// Consumes one request against the named limit.
export async function checkRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<RateLimitResult> {
  const config = LIMITS[name];
  const key = `${name}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const existing = requestBuckets.get(key) ?? [];
  const validTimestamps = existing.filter((t) => t > windowStart);

  if (validTimestamps.length >= config.maxRequests) {
    // A slot opens when the oldest of the max requests expires.
    const earliest = validTimestamps[0] ?? now;
    const reset = earliest + config.windowMs;

    requestBuckets.set(key, validTimestamps);
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      reset,
    };
  }

  validTimestamps.push(now);
  requestBuckets.set(key, validTimestamps);

  if (requestBuckets.size > MAX_STORED_KEYS) {
    pruneBuckets(now);
  }

  return { allowed: true };
}

// Returns a 429 response when rate limited, or null when allowed.
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

// Best-effort client IP extraction behind Vercel or reverse proxies.
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// Clears stored history; used by unit tests.
export function resetRateLimitsForTesting(): void {
  requestBuckets.clear();
}
