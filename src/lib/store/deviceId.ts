"use client";

/**
 * deviceId — a stable identifier for this browser/device, persisted in
 * localStorage. Used as the focus timer's `source_device_id`: the device that
 * last explicitly wrote the running state owns completion, and every device
 * skips realtime echoes stamped with its own id.
 */

const DEVICE_ID_KEY = "kanso-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";

  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
