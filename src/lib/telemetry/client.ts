import type { TelemetryEvent } from "@/lib/schemas/telemetry";
import { getOrCreateDeviceId } from "@/lib/telemetry/store";
import {
  getTelemetryDisplayMode,
  getTelemetryPlatform,
} from "@/lib/utils/platform";

export const TELEMETRY_ENDPOINT = "/api/telemetry";
export const BATCH_FLUSH_THRESHOLD = 20;
export const FLUSH_INTERVAL_MS = 15_000;
export const MAX_QUEUE_CAPACITY = 50;
export const MAX_BATCH_SIZE = 50;

type TelemetryEventName = TelemetryEvent["name"];
type TelemetryEventProperties<T extends TelemetryEventName> = Extract<
  TelemetryEvent,
  { name: T }
>["properties"];

let eventQueue: TelemetryEvent[] = [];
let flushIntervalId: ReturnType<typeof setInterval> | null = null;
let isVisibilityListenerAttached = false;

function onVisibilityChange(): void {
  if (
    typeof document !== "undefined" &&
    document.visibilityState === "hidden"
  ) {
    void flushTelemetry();
  }
}

export function initTelemetry(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!flushIntervalId) {
    flushIntervalId = setInterval(() => {
      if (eventQueue.length > 0) {
        void flushTelemetry();
      }
    }, FLUSH_INTERVAL_MS);
  }

  if (!isVisibilityListenerAttached && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
    isVisibilityListenerAttached = true;
  }
}

export function destroyTelemetry(): void {
  if (flushIntervalId) {
    clearInterval(flushIntervalId);
    flushIntervalId = null;
  }

  if (isVisibilityListenerAttached && typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    isVisibilityListenerAttached = false;
  }
}

export async function flushTelemetry(): Promise<void> {
  if (eventQueue.length === 0) {
    return;
  }

  const batch = eventQueue.splice(0, MAX_BATCH_SIZE);
  if (batch.length === 0) {
    return;
  }

  let dispatched = false;

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    try {
      const payload = new Blob([JSON.stringify({ events: batch })], {
        type: "application/json",
      });
      dispatched = navigator.sendBeacon(TELEMETRY_ENDPOINT, payload);
    } catch {
      dispatched = false;
    }
  }

  if (!dispatched && typeof fetch === "function") {
    try {
      const response = await fetch(TELEMETRY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ events: batch }),
      });
      if (response.ok) {
        dispatched = true;
      }
    } catch {
      dispatched = false;
    }
  }

  if (!dispatched) {
    eventQueue = [...batch, ...eventQueue].slice(-MAX_QUEUE_CAPACITY);
  }
}

export function trackTelemetry<T extends TelemetryEventName>(
  name: T,
  properties?: TelemetryEventProperties<T>,
): void {
  const deviceId = getOrCreateDeviceId();
  if (!deviceId) {
    return;
  }

  initTelemetry();

  const event = {
    name,
    deviceId,
    properties: properties ?? {},
  } as TelemetryEvent;

  eventQueue.push(event);

  if (eventQueue.length >= BATCH_FLUSH_THRESHOLD) {
    void flushTelemetry();
  }
}

export function trackAppOpened(): void {
  trackTelemetry("app_opened", {
    display_mode: getTelemetryDisplayMode(),
    platform: getTelemetryPlatform(),
  });
}

const SIGNUP_COMPLETED_TRACKED_KEY = "kagelin_signup_completed_tracked";

// Multiple independent surfaces can observe the same signup (OAuth callback,
// email confirmation, guest-data migration) — this flag dedupes across them.
export function trackSignupCompleted(): void {
  try {
    if (localStorage.getItem(SIGNUP_COMPLETED_TRACKED_KEY)) {
      return;
    }
    localStorage.setItem(SIGNUP_COMPLETED_TRACKED_KEY, "true");
  } catch {
    // trackTelemetry() no-ops anyway if storage is unavailable.
  }

  trackTelemetry("signup_completed");
}

export function getTelemetryQueue(): readonly TelemetryEvent[] {
  return eventQueue;
}

export function clearTelemetryQueue(): void {
  eventQueue = [];
}
