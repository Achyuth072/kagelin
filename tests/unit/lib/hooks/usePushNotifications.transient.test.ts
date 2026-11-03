import { renderHook, act } from "@testing-library/react";
import {
  usePushNotifications,
  usePushSubscriptionSync,
} from "@/lib/hooks/usePushNotifications";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncPushSubscription } from "@/lib/push-api";
import { recordDiagnosticError } from "@/lib/errors/diagnostics";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: false })),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn((selector) => {
    const state = {
      notificationsEnabled: true,
      setNotificationsEnabled: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("@/lib/push-api", () => ({
  syncPushSubscription: vi.fn(),
  removePushSubscription: vi.fn(),
  sendPushNotification: vi.fn(),
}));

vi.mock("@/lib/errors/diagnostics", () => ({
  recordDiagnosticError: vi.fn(),
}));

const subscription = {
  endpoint: "https://stable.test",
  unsubscribe: vi.fn(),
  toJSON: () => ({}),
};

async function mountThenResume() {
  await act(async () => {
    renderHook(() => usePushSubscriptionSync());
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  vi.clearAllMocks();
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe("push subscription sync on resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, "Notification", {
      value: { permission: "granted", requestPermission: vi.fn() },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "PushManager", {
      value: function () {},
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        controller: { state: "activated" },
        getRegistration: vi.fn().mockResolvedValue(true),
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(subscription),
            subscribe: vi.fn(),
          },
          showNotification: vi.fn(),
        }),
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it("does not report a fetch killed by page teardown", async () => {
    vi.mocked(syncPushSubscription).mockRejectedValue(
      new TypeError("Load failed"),
    );

    await mountThenResume();

    expect(syncPushSubscription).toHaveBeenCalledTimes(1);
    expect(recordDiagnosticError).not.toHaveBeenCalled();
  });

  it("reports a genuine failure, tagged with the worker state", async () => {
    vi.mocked(syncPushSubscription).mockRejectedValue(
      new Error("Failed to sync push subscription"),
    );

    await mountThenResume();

    expect(recordDiagnosticError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        pushOperation: "revalidate",
        swState: "activated",
      }),
    );
  });

  it("registers no resume listener unless it is the designated owner", async () => {
    vi.mocked(syncPushSubscription).mockResolvedValue({});

    await act(async () => {
      renderHook(() => usePushNotifications());
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    vi.clearAllMocks();
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(syncPushSubscription).not.toHaveBeenCalled();
  });
});
