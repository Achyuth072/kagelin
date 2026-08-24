import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getTelemetryConsent,
  setTelemetryConsent,
  getOrCreateDeviceId,
  resetTelemetryConsentCache,
  TELEMETRY_CONSENT_KEY,
  TELEMETRY_DEVICE_ID_KEY,
} from "@/lib/telemetry/store";

describe("Telemetry Store", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTelemetryConsentCache();
    vi.clearAllMocks();
  });

  describe("getTelemetryConsent", () => {
    it("returns 'unprompted' by default when no consent is set", () => {
      expect(getTelemetryConsent()).toBe("unprompted");
    });

    it("returns 'granted' when set in localStorage", () => {
      localStorage.setItem(TELEMETRY_CONSENT_KEY, "granted");
      expect(getTelemetryConsent()).toBe("granted");
    });

    it("returns 'denied' when set in localStorage", () => {
      localStorage.setItem(TELEMETRY_CONSENT_KEY, "denied");
      expect(getTelemetryConsent()).toBe("denied");
    });

    it("returns 'unprompted' if stored value is invalid", () => {
      localStorage.setItem(TELEMETRY_CONSENT_KEY, "invalid_status");
      expect(getTelemetryConsent()).toBe("unprompted");
    });
  });

  describe("setTelemetryConsent", () => {
    it("persists 'granted' and generates a valid UUID device_id", () => {
      setTelemetryConsent("granted");

      expect(localStorage.getItem(TELEMETRY_CONSENT_KEY)).toBe("granted");
      const deviceId = localStorage.getItem(TELEMETRY_DEVICE_ID_KEY);
      expect(deviceId).toBeTruthy();
      // UUID v4 format check
      expect(deviceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("preserves existing device_id if already present when granted", () => {
      const existingId = "123e4567-e89b-12d3-a456-426614174000";
      localStorage.setItem(TELEMETRY_DEVICE_ID_KEY, existingId);

      setTelemetryConsent("granted");

      expect(localStorage.getItem(TELEMETRY_DEVICE_ID_KEY)).toBe(existingId);
    });

    it("persists 'denied' and immediately deletes device_id", () => {
      localStorage.setItem(
        TELEMETRY_DEVICE_ID_KEY,
        "123e4567-e89b-12d3-a456-426614174000",
      );

      setTelemetryConsent("denied");

      expect(localStorage.getItem(TELEMETRY_CONSENT_KEY)).toBe("denied");
      expect(localStorage.getItem(TELEMETRY_DEVICE_ID_KEY)).toBeNull();
    });
  });

  describe("getOrCreateDeviceId", () => {
    it("returns null if consent is not granted (unprompted)", () => {
      expect(getOrCreateDeviceId()).toBeNull();
    });

    it("returns null if consent is denied", () => {
      setTelemetryConsent("denied");
      expect(getOrCreateDeviceId()).toBeNull();
    });

    it("returns existing device_id if consent is granted", () => {
      const existingId = "123e4567-e89b-12d3-a456-426614174000";
      localStorage.setItem(TELEMETRY_CONSENT_KEY, "granted");
      localStorage.setItem(TELEMETRY_DEVICE_ID_KEY, existingId);

      expect(getOrCreateDeviceId()).toBe(existingId);
    });

    it("generates and stores a new device_id if consent is granted but device_id is missing", () => {
      localStorage.setItem(TELEMETRY_CONSENT_KEY, "granted");

      const deviceId = getOrCreateDeviceId();
      expect(deviceId).toBeTruthy();
      expect(localStorage.getItem(TELEMETRY_DEVICE_ID_KEY)).toBe(deviceId);
    });
  });

  describe("consent caching", () => {
    it("does not observe a same-tab localStorage write that bypasses setTelemetryConsent", () => {
      expect(getTelemetryConsent()).toBe("unprompted"); // primes the cache

      localStorage.setItem(TELEMETRY_CONSENT_KEY, "granted");

      expect(getTelemetryConsent()).toBe("unprompted");
    });

    it("picks up consent changes from a cross-tab storage event", () => {
      expect(getTelemetryConsent()).toBe("unprompted"); // primes the cache + listener

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: TELEMETRY_CONSENT_KEY,
          newValue: "granted",
        }),
      );

      expect(getTelemetryConsent()).toBe("granted");
    });
  });
});
