import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  trackTelemetry,
  trackSignupCompleted,
  flushTelemetry,
  getTelemetryQueue,
  clearTelemetryQueue,
  initTelemetry,
  destroyTelemetry,
  TELEMETRY_ENDPOINT,
} from "@/lib/telemetry/client";
import {
  setTelemetryConsent,
  resetTelemetryConsentCache,
} from "@/lib/telemetry/store";

describe("Telemetry Client", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTelemetryConsentCache();
    clearTelemetryQueue();
    destroyTelemetry();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    destroyTelemetry();
    vi.useRealTimers();
  });

  describe("trackTelemetry & Consent", () => {
    it("silently drops events when consent is unprompted", () => {
      trackTelemetry("app_opened", {
        display_mode: "browser",
        platform: "desktop",
      });

      expect(getTelemetryQueue()).toHaveLength(0);
    });

    it("silently drops events when consent is denied", () => {
      setTelemetryConsent("denied");

      trackTelemetry("app_opened", {
        display_mode: "browser",
        platform: "desktop",
      });

      expect(getTelemetryQueue()).toHaveLength(0);
    });

    it("queues event when consent is granted", () => {
      setTelemetryConsent("granted");

      trackTelemetry("app_opened", {
        display_mode: "standalone",
        platform: "ios",
      });

      const queue = getTelemetryQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].name).toBe("app_opened");
      expect(queue[0].properties).toEqual({
        display_mode: "standalone",
        platform: "ios",
      });
      expect(queue[0].deviceId).toBeTruthy();
    });

    it("queues event without properties (e.g. signup_completed)", () => {
      setTelemetryConsent("granted");

      trackTelemetry("signup_completed");

      const queue = getTelemetryQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].name).toBe("signup_completed");
      expect(queue[0].properties).toEqual({});
    });

    it("auto-initializes interval and visibility listener on trackTelemetry", () => {
      setTelemetryConsent("granted");
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal("navigator", { ...navigator, sendBeacon: sendBeaconMock });

      // Note: initTelemetry is not explicitly called here
      trackTelemetry("task_action", { action: "created" });

      // Interval should have been auto-initialized
      vi.advanceTimersByTime(15_000);
      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    });

    it("automatically flushes when queue reaches batch threshold (20 events)", async () => {
      setTelemetryConsent("granted");
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal("navigator", { ...navigator, sendBeacon: sendBeaconMock });

      for (let i = 0; i < 19; i++) {
        trackTelemetry("task_action", { action: "created" });
      }
      expect(getTelemetryQueue()).toHaveLength(19);
      expect(sendBeaconMock).not.toHaveBeenCalled();

      // 20th event triggers immediate flush
      trackTelemetry("task_action", { action: "completed" });

      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      expect(getTelemetryQueue()).toHaveLength(0);
    });
  });

  describe("trackSignupCompleted", () => {
    it("tracks once and is a no-op on subsequent calls, even across separate call sites", () => {
      setTelemetryConsent("granted");

      trackSignupCompleted();
      trackSignupCompleted();

      const queue = getTelemetryQueue();
      expect(queue.filter((e) => e.name === "signup_completed")).toHaveLength(
        1,
      );
    });
  });

  describe("Periodic Flush Timer", () => {
    it("flushes queue every 15 seconds if non-empty", async () => {
      setTelemetryConsent("granted");
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal("navigator", { ...navigator, sendBeacon: sendBeaconMock });

      initTelemetry();

      trackTelemetry("habit_logged", { streak_milestone: "7" });
      expect(getTelemetryQueue()).toHaveLength(1);

      // Advance by 14 seconds: not yet flushed
      vi.advanceTimersByTime(14_000);
      expect(sendBeaconMock).not.toHaveBeenCalled();

      // Advance 1 more second (15s total): flushes
      vi.advanceTimersByTime(1_000);
      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      expect(getTelemetryQueue()).toHaveLength(0);
    });

    it("does not trigger network request on interval if queue is empty", () => {
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal("navigator", { ...navigator, sendBeacon: sendBeaconMock });

      initTelemetry();

      vi.advanceTimersByTime(30_000);
      expect(sendBeaconMock).not.toHaveBeenCalled();
    });
  });

  describe("Visibility Change Flush", () => {
    it("flushes on visibilitychange when visibilityState is 'hidden'", () => {
      setTelemetryConsent("granted");
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal("navigator", { ...navigator, sendBeacon: sendBeaconMock });

      initTelemetry();

      trackTelemetry("focus_session", {
        status: "completed",
        duration_minutes: 25,
      });

      // Change visibility to hidden
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      expect(getTelemetryQueue()).toHaveLength(0);
    });

    it("does not flush on visibilitychange when visibilityState is 'visible'", () => {
      setTelemetryConsent("granted");
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal("navigator", { ...navigator, sendBeacon: sendBeaconMock });

      initTelemetry();

      trackTelemetry("focus_session", {
        status: "completed",
        duration_minutes: 25,
      });

      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(sendBeaconMock).not.toHaveBeenCalled();
      expect(getTelemetryQueue()).toHaveLength(1);
    });
  });

  describe("Dispatch Transport: sendBeacon and fetch fallback", () => {
    it("uses navigator.sendBeacon with Blob payload when available", async () => {
      setTelemetryConsent("granted");
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal("navigator", { ...navigator, sendBeacon: sendBeaconMock });

      trackTelemetry("pwa_installed", { platform: "android" });
      await flushTelemetry();

      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      expect(sendBeaconMock).toHaveBeenCalledWith(
        TELEMETRY_ENDPOINT,
        expect.any(Blob),
      );
    });

    it("falls back to fetch with keepalive if navigator.sendBeacon is unavailable", async () => {
      setTelemetryConsent("granted");
      vi.stubGlobal("navigator", { ...navigator, sendBeacon: undefined });
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      trackTelemetry("signup_completed");
      await flushTelemetry();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        TELEMETRY_ENDPOINT,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: expect.stringContaining("signup_completed"),
        }),
      );
      expect(getTelemetryQueue()).toHaveLength(0);
    });

    it("falls back to fetch if navigator.sendBeacon returns false", async () => {
      setTelemetryConsent("granted");
      const sendBeaconMock = vi.fn().mockReturnValue(false);
      vi.stubGlobal("navigator", { ...navigator, sendBeacon: sendBeaconMock });
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      trackTelemetry("signup_completed");
      await flushTelemetry();

      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(getTelemetryQueue()).toHaveLength(0);
    });

    it("retains up to 50 events on dispatch network failure for retry", async () => {
      setTelemetryConsent("granted");
      vi.stubGlobal("navigator", { ...navigator, sendBeacon: undefined });
      const fetchMock = vi.fn().mockRejectedValue(new Error("Network offline"));
      vi.stubGlobal("fetch", fetchMock);

      for (let i = 0; i < 55; i++) {
        // queue directly without auto-flush triggering
        trackTelemetry("task_action", { action: "created" });
      }

      await flushTelemetry();

      // Should retain capped to 50 events
      expect(getTelemetryQueue().length).toBeLessThanOrEqual(50);
      expect(getTelemetryQueue().length).toBe(50);
    });
  });
});
