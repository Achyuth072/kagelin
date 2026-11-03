import { recordDiagnosticError } from "@/lib/errors/diagnostics";

export type TelemetryConsent = "granted" | "denied" | "unprompted";

export const TELEMETRY_CONSENT_KEY = "telemetry_consent";
export const TELEMETRY_DEVICE_ID_KEY = "telemetry_device_id";
export const TELEMETRY_CONSENT_EVENT = "kagelin:telemetry-consent";
export const TELEMETRY_FIRST_ACTION_KEY = "telemetry_first_action";

function isLocalStorageAvailable(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function parseTelemetryConsent(raw: string | null): TelemetryConsent {
  return raw === "granted" || raw === "denied" ? raw : "unprompted";
}

// In-memory cache to avoid repeated synchronous localStorage reads on frequent actions.
let cachedConsent: TelemetryConsent | null = null;
let cachedDeviceId: string | null = null;
let cachedFirstAction: boolean | null = null;

function onStorageEvent(event: StorageEvent): void {
  if (event.key === TELEMETRY_FIRST_ACTION_KEY) {
    cachedFirstAction = event.newValue === "true";
    window.dispatchEvent(
      new CustomEvent(TELEMETRY_CONSENT_EVENT, {
        detail: getTelemetryConsent(),
      }),
    );
    return;
  }

  if (event.key !== TELEMETRY_CONSENT_KEY) {
    return;
  }

  const status = parseTelemetryConsent(event.newValue);
  cachedConsent = status;
  cachedDeviceId =
    status === "granted" ? localStorage.getItem(TELEMETRY_DEVICE_ID_KEY) : null;

  // Normalize cross-tab storage events into TELEMETRY_CONSENT_EVENT for single-signal consumers.
  window.dispatchEvent(
    new CustomEvent(TELEMETRY_CONSENT_EVENT, { detail: status }),
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", onStorageEvent);
}

// Test-only: resets module-level cache so tests can force fresh localStorage reads.
export function resetTelemetryConsentCache(): void {
  cachedConsent = null;
  cachedDeviceId = null;
  cachedFirstAction = null;
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

export function hasTakenFirstAction(): boolean {
  if (cachedFirstAction !== null) {
    return cachedFirstAction;
  }

  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    cachedFirstAction =
      localStorage.getItem(TELEMETRY_FIRST_ACTION_KEY) === "true";
  } catch {
    cachedFirstAction = false;
  }

  return cachedFirstAction;
}

export function markFirstAction(): void {
  if (hasTakenFirstAction()) {
    return;
  }
  cachedFirstAction = true;

  try {
    localStorage.setItem(TELEMETRY_FIRST_ACTION_KEY, "true");
  } catch (error) {
    void recordDiagnosticError(error);
  }

  // Reuses consent event so prompt subscribers re-evaluate without a separate channel.
  window.dispatchEvent(
    new CustomEvent(TELEMETRY_CONSENT_EVENT, {
      detail: getTelemetryConsent(),
    }),
  );
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
    void recordDiagnosticError(error);
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
