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

export function getTelemetryConsent(): TelemetryConsent {
  if (!isLocalStorageAvailable()) {
    return "unprompted";
  }

  try {
    const raw = localStorage.getItem(TELEMETRY_CONSENT_KEY);
    return raw === "granted" || raw === "denied" ? raw : "unprompted";
  } catch {
    return "unprompted";
  }
}

export function setTelemetryConsent(status: "granted" | "denied"): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.setItem(TELEMETRY_CONSENT_KEY, status);

    if (status === "denied") {
      localStorage.removeItem(TELEMETRY_DEVICE_ID_KEY);
    } else if (status === "granted") {
      const existingId = localStorage.getItem(TELEMETRY_DEVICE_ID_KEY);
      if (!existingId) {
        localStorage.setItem(TELEMETRY_DEVICE_ID_KEY, crypto.randomUUID());
      }
    }

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

  try {
    let deviceId = localStorage.getItem(TELEMETRY_DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(TELEMETRY_DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return null;
  }
}
