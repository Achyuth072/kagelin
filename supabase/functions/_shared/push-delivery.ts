// No Deno/Node APIs — tests/unit imports this directly.

export type NotificationType =
  "timer_end" | "due_date" | "do_date" | "evening" | "briefing";

export interface SendOptions {
  TTL: number;
  urgency: "very-low" | "low" | "normal" | "high";
  topic: string;
}

// A focus-timer alert is stale within minutes; a briefing can run late.
const TTL_SECONDS: Record<NotificationType, number> = {
  timer_end: 300,
  due_date: 3600,
  do_date: 3600,
  evening: 3600,
  briefing: 3600,
};

// RFC 8030 topic: a later message replaces a still-queued one with the same
// topic, so an offline device wakes to one current reminder, not a pile.
export function buildTopic(
  type: NotificationType,
  referenceId?: string | null,
): string {
  if (type !== "due_date" && type !== "do_date") return type;
  if (!referenceId) return type;
  const suffix = referenceId.replace(/-/g, "").slice(0, 8);
  return `${type}-${suffix}`;
}

export function buildSendOptions(
  type: NotificationType,
  referenceId?: string | null,
): SendOptions {
  return {
    TTL: TTL_SECONDS[type],
    // 'normal' gets batched by Android Doze.
    urgency: "high",
    topic: buildTopic(type, referenceId),
  };
}

// Mirrored in claim_due_notifications (schema.sql).
export const MAX_RETRIES = 3;

export function isRetryableStatus(statusCode?: number): boolean {
  if (statusCode === undefined) return true;
  if (statusCode === 429) return true;
  return statusCode >= 500;
}

export function isGoneStatus(statusCode?: number): boolean {
  return statusCode === 404 || statusCode === 410;
}

export function retryDelaySeconds(retryCount: number): number {
  return 10 * Math.pow(3, retryCount);
}

// TTL only bounds the push service's hold time, not a row stuck in Postgres.
export function isExpired(
  type: NotificationType,
  scheduledAt: string | Date,
  now: Date = new Date(),
): boolean {
  const scheduled = new Date(scheduledAt).getTime();
  return now.getTime() - scheduled > TTL_SECONDS[type] * 1000;
}

export type FailureResolution =
  | { action: "retry"; retryCount: number; nextAttemptAt: string }
  | { action: "fail"; errorMessage: string };

export function resolveFailure(
  retryCount: number,
  statusCodes: (number | undefined)[],
  now: Date = new Date(),
): FailureResolution {
  const retryable = statusCodes.some(isRetryableStatus);

  if (retryable && retryCount < MAX_RETRIES) {
    const next = retryCount + 1;
    return {
      action: "retry",
      retryCount: next,
      nextAttemptAt: new Date(
        now.getTime() + retryDelaySeconds(retryCount) * 1000,
      ).toISOString(),
    };
  }

  return {
    action: "fail",
    errorMessage: retryable
      ? `Delivery failed after ${retryCount + 1} attempts`
      : `Delivery failed permanently (status ${statusCodes.filter(Boolean).join(", ") || "unknown"})`,
  };
}
