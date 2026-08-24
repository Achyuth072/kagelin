import * as Sentry from "@sentry/nextjs";

export type TelemetryConsent = "granted" | "denied" | "unprompted";

export const TELEMETRY_CONSENT_KEY = "telemetry_consent";
export const TELEMETRY_DEVICE_ID_KEY = "telemetry_device_id";
export const TELEMETRY_CONSENT_EVENT = "kagelin:telemetry-consent";

function isLocalStorageAvailable(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function parseTelemetryConsent(raw: string | null): TelemetryConsent {
  return raw === "granted" || raw === "denied" ? raw : "unprompted";
}

// In-memory mirror of the two localStorage keys above. trackTelemetry() calls
// getOrCreateDeviceId() on every tracked action (task/habit/focus events), so
// without this cache a guest who never opts in still pays a localStorage.getItem
// on every action. null means "not read this session yet"; kept in sync by the
// write path below and by the cross-tab storage listener attached at module load.
let cachedConsent: TelemetryConsent | null = null;
let cachedDeviceId: string | null = null;

function onStorageEvent(event: StorageEvent): void {
  if (event.key !== TELEMETRY_CONSENT_KEY) {
    return;
  }

  const status = parseTelemetryConsent(event.newValue);
  cachedConsent = status;
  cachedDeviceId =
    status === "granted" ? localStorage.getItem(TELEMETRY_DEVICE_ID_KEY) : null;

  // Re-dispatch the same event setTelemetryConsent() uses, so consumers (e.g.
  // useTelemetryConsent) only need to listen for one signal, not a second
  // raw "storage" listener duplicating this key filter.
  window.dispatchEvent(
    new CustomEvent(TELEMETRY_CONSENT_EVENT, { detail: status }),
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", onStorageEvent);
}

/**
 * Reset the in-memory consent/device-id cache. Test-only — the module-level
 * cache otherwise has no path back to "unread," and tests that write to
 * localStorage directly (bypassing setTelemetryConsent) or call
 * localStorage.clear() need a way to force a fresh read.
 */
export function resetTelemetryConsentCache(): void {
  cachedConsent = null;
  cachedDeviceId = null;
}

export function getTelemetryConsent(): TelemetryConsent {
  if (cachedConsent !== null) {
    return cachedConsent;
  }

  if (!isLocalStorageAvailable()) {
    return "unprompted";
  }

  try {
    cachedConsent = parseTelemetryConsent(
      localStorage.getItem(TELEMETRY_CONSENT_KEY),
    );
  } catch {
    cachedConsent = "unprompted";
  }

  return cachedConsent;
}

export function setTelemetryConsent(status: "granted" | "denied"): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.setItem(TELEMETRY_CONSENT_KEY, status);

    if (status === "denied") {
      localStorage.removeItem(TELEMETRY_DEVICE_ID_KEY);
      cachedDeviceId = null;
    } else if (status === "granted") {
      const existingId = localStorage.getItem(TELEMETRY_DEVICE_ID_KEY);
      cachedDeviceId = existingId ?? crypto.randomUUID();
      if (!existingId) {
        localStorage.setItem(TELEMETRY_DEVICE_ID_KEY, cachedDeviceId);
      }
    }
    cachedConsent = status;

    if (
      typeof window !== "undefined" &&
      typeof window.dispatchEvent === "function"
    ) {
      window.dispatchEvent(
        new CustomEvent(TELEMETRY_CONSENT_EVENT, { detail: status }),
      );
    }
  } catch (error) {
    // Don't throw over a storage write failing — telemetry consent isn't
    // critical to app function — but report it rather than swallow it.
    Sentry.captureException(error);
  }
}

export function getOrCreateDeviceId(): string | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  const consent = getTelemetryConsent();
  if (consent !== "granted") {
    return null;
  }

  if (cachedDeviceId !== null) {
    return cachedDeviceId;
  }

  try {
    let deviceId = localStorage.getItem(TELEMETRY_DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(TELEMETRY_DEVICE_ID_KEY, deviceId);
    }
    cachedDeviceId = deviceId;
    return deviceId;
  } catch {
    return null;
  }
}
