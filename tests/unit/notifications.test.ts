import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_NOTIFICATION_OPTIONS,
  displayNotification,
} from "@/lib/notifications";

function registrationWith(
  notifications: { close: () => void }[] | { rejects: Error },
) {
  return {
    getNotifications: vi.fn(() =>
      "rejects" in notifications
        ? Promise.reject(notifications.rejects)
        : Promise.resolve(notifications),
    ),
    showNotification: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServiceWorkerRegistration;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("displayNotification", () => {
  it("closes the predecessors iOS would otherwise stack", async () => {
    const first = { close: vi.fn() };
    const second = { close: vi.fn() };
    const registration = registrationWith([first, second]);

    await displayNotification(registration, "Focus Complete", {
      tag: "timer_end",
    });

    expect(registration.getNotifications).toHaveBeenCalledWith({
      tag: "timer_end",
    });
    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).toHaveBeenCalledOnce();
    expect(registration.showNotification).toHaveBeenCalledOnce();
  });

  it("skips the lookup entirely for an untagged notification", async () => {
    const registration = registrationWith([]);

    await displayNotification(registration, "Focus Complete");

    expect(registration.getNotifications).not.toHaveBeenCalled();
    expect(registration.showNotification).toHaveBeenCalledOnce();
  });

  it("applies the shared defaults, letting callers override them", async () => {
    const registration = registrationWith([]);

    await displayNotification(registration, "Focus Complete", {
      icon: "/icons/custom.png",
    });

    expect(registration.showNotification).toHaveBeenCalledWith(
      "Focus Complete",
      expect.objectContaining({
        icon: "/icons/custom.png",
        badge: DEFAULT_NOTIFICATION_OPTIONS.badge,
        vibrate: DEFAULT_NOTIFICATION_OPTIONS.vibrate,
      }),
    );
  });

  it("still shows the notification when the engine cannot enumerate tags", async () => {
    const registration = registrationWith({
      rejects: new Error("not supported"),
    });

    await displayNotification(registration, "Focus Complete", {
      tag: "timer_end",
    });

    expect(registration.showNotification).toHaveBeenCalledOnce();
  });

  it("still shows the notification when closing throws part-way through", async () => {
    const registration = registrationWith([
      {
        close: vi.fn(() => {
          throw new Error("already dismissed");
        }),
      },
    ]);

    await displayNotification(registration, "Focus Complete", {
      tag: "timer_end",
    });

    expect(registration.showNotification).toHaveBeenCalledOnce();
  });
});
