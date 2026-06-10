import { describe, it, expect, beforeEach } from "vitest";
import { getDeviceId } from "@/lib/store/deviceId";

/**
 * deviceId — a stable per-device id used as the timer's ownership / echo marker.
 * Persisted in localStorage so it survives reloads but differs across devices.
 */
describe("getDeviceId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the same id across calls (persisted)", () => {
    const first = getDeviceId();
    const second = getDeviceId();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it("reuses an id already stored in localStorage", () => {
    localStorage.setItem("kanso-device-id", "device-abc");

    expect(getDeviceId()).toBe("device-abc");
  });
});
