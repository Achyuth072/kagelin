import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { useProfile } from "@/lib/hooks/useProfile";
import { useAuth } from "@/components/AuthProvider";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { sendPushNotification } from "@/lib/push-api";
import { ANDROID_BATTERY_HINT_STORAGE_KEY } from "@/lib/utils/androidBatteryHint";
import React from "react";

vi.mock("@/lib/hooks/usePushNotifications");
vi.mock("@/lib/hooks/useProfile");
vi.mock("@/components/AuthProvider");
vi.mock("@/lib/hooks/useHaptic");
vi.mock("@/lib/push-api", () => ({
  sendPushNotification: vi.fn(),
}));

describe("NotificationSettings Component", () => {
  const mockUpdateSettings = { mutateAsync: vi.fn() };
  const mockUpdateProfile = { mutate: vi.fn() };
  const mockRequestPermission = vi.fn();
  const mockSubscribeToPush = vi.fn();
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeToPush.mockResolvedValue({
      endpoint: "https://current-device.test",
    });

    (usePushNotifications as Mock).mockReturnValue({
      isSupported: true,
      permission: "granted",
      notificationsEnabled: true,
      subscription: { endpoint: "https://current-device.test" },
      isSyncing: false,
      requestPermission: mockRequestPermission,
      subscribeToPush: mockSubscribeToPush,
      unsubscribe: mockUnsubscribe,
    });

    (useProfile as Mock).mockReturnValue({
      profile: {
        timezone: "UTC",
        settings: {
          notifications: {
            morning_briefing: true,
            evening_plan: true,
            due_date_alerts: true,
            do_date_alerts: true,
            timer_alerts: true,
          },
        },
      },
      updateSettings: mockUpdateSettings,
      updateProfile: mockUpdateProfile,
    });

    (useAuth as Mock).mockReturnValue({ isGuestMode: false });
    (useHaptic as Mock).mockReturnValue({ trigger: vi.fn() });
    vi.mocked(sendPushNotification).mockResolvedValue({
      success: true,
      sentCount: 1,
      failedCount: 0,
      endpointMatched: true,
    });
  });

  it("TC-NS-01: should render all notification toggles and timezone picker", () => {
    render(<NotificationSettings />);

    expect(screen.getByText(/Push Notifications/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirm your timezone/i)).toBeInTheDocument();
    expect(screen.getByText("Morning Briefing")).toBeInTheDocument();
    expect(screen.getByText("Evening Plan")).toBeInTheDocument();
  });

  it("TC-NS-02: should call updateSettings when a toggle is changed", () => {
    render(<NotificationSettings />);

    const briefingToggle = screen.getByLabelText(/Morning Briefing/i);
    fireEvent.click(briefingToggle);

    expect(mockUpdateSettings.mutateAsync).toHaveBeenCalled();
  });

  it("TC-NS-03: should send the test notification to the current subscription endpoint", async () => {
    render(<NotificationSettings />);

    const testBtn = screen.getByRole("button", {
      name: /Send Test Notification \(Server\)/i,
    });
    fireEvent.click(testBtn);

    await waitFor(
      () => {
        expect(sendPushNotification).toHaveBeenCalledWith({
          endpoint: "https://current-device.test",
          title: "Test Notification",
          body: "This is a server-sent test notification from Kagelin",
          data: { type: "test" },
        });
      },
      { timeout: 3000 },
    );
  });

  it("TC-NS-04: should show guest mode warning when permission is granted", () => {
    (useAuth as Mock).mockReturnValue({ isGuestMode: true });
    render(<NotificationSettings />);

    expect(
      screen.getByText(/Sign in to enable notifications/i),
    ).toBeInTheDocument();
  });

  it("TC-NS-05: should show not supported message when browser doesn't support push", () => {
    (usePushNotifications as Mock).mockReturnValue({
      isSupported: false,
      permission: "default",
    });
    render(<NotificationSettings />);

    expect(
      screen.getByText(/Notifications Not Supported/i),
    ).toBeInTheDocument();
  });

  describe("Android battery-optimization hint", () => {
    const androidChromeUA =
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36";
    const desktopChromeUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

    const setUserAgent = (ua: string) => {
      Object.defineProperty(window.navigator, "userAgent", {
        value: ua,
        configurable: true,
      });
    };

    // usePushNotifications is mocked, so nothing makes `permission` /
    // `notificationsEnabled` react to a resolved requestPermission() call the
    // way the real hook would. Back the mock with a mutable object that
    // requestPermission's mock implementation updates in place, so the
    // re-render triggered by the component's own state change picks up the
    // hook's "new" values too.
    let hookState: {
      isSupported: boolean;
      permission: "default" | "granted" | "denied";
      notificationsEnabled: boolean;
      subscription: null;
      isSyncing: boolean;
      requestPermission: typeof mockRequestPermission;
      subscribeToPush: typeof mockSubscribeToPush;
      unsubscribe: typeof mockUnsubscribe;
    };

    beforeEach(() => {
      localStorage.clear();
      hookState = {
        isSupported: true,
        permission: "default",
        notificationsEnabled: false,
        subscription: null,
        isSyncing: false,
        requestPermission: mockRequestPermission,
        subscribeToPush: mockSubscribeToPush,
        unsubscribe: mockUnsubscribe,
      };
      (usePushNotifications as Mock).mockImplementation(() => hookState);
    });

    afterEach(() => {
      setUserAgent(desktopChromeUA);
    });

    const enablePush = () => {
      const toggle = screen.getByLabelText("Push Notifications");
      fireEvent.click(toggle);
    };

    const mockGrantedSubscribe = (endpoint: string) => {
      mockRequestPermission.mockImplementation(async () => {
        hookState.permission = "granted";
        hookState.notificationsEnabled = true;
        return { permission: "granted", subscription: { endpoint } };
      });
    };

    it("TC-NS-06: renders the hint after a successful subscribe on Android Chrome", async () => {
      setUserAgent(androidChromeUA);
      mockGrantedSubscribe("https://android-device.test");

      render(<NotificationSettings />);
      enablePush();

      await waitFor(() => {
        expect(
          screen.getByText(/Notifications may arrive late on Android/i),
        ).toBeInTheDocument();
      });
    });

    it("TC-NS-07: does not render the hint after a successful subscribe on non-Android", async () => {
      setUserAgent(desktopChromeUA);
      mockGrantedSubscribe("https://desktop-device.test");

      render(<NotificationSettings />);
      enablePush();

      await waitFor(() => {
        expect(mockRequestPermission).toHaveBeenCalled();
      });
      expect(
        screen.queryByText(/Notifications may arrive late on Android/i),
      ).not.toBeInTheDocument();
    });

    it("TC-NS-08: does not render the hint once dismissed, but stays reachable via a persistent link", async () => {
      setUserAgent(androidChromeUA);
      mockGrantedSubscribe("https://android-device.test");

      render(<NotificationSettings />);
      enablePush();

      await waitFor(() => {
        expect(
          screen.getByText(/Notifications may arrive late on Android/i),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText("Dismiss"));

      expect(
        screen.queryByText(/Notifications may arrive late on Android/i),
      ).not.toBeInTheDocument();
      expect(localStorage.getItem(ANDROID_BATTERY_HINT_STORAGE_KEY)).toBe(
        "true",
      );

      const reopenLink = screen.getByRole("button", {
        name: /Notifications arriving late on Android\?/i,
      });
      fireEvent.click(reopenLink);

      expect(
        screen.getByText(/Notifications may arrive late on Android/i),
      ).toBeInTheDocument();
    });

    it("TC-NS-09: offers the persistent link on mount for a returning Android Chrome user who enabled push before this feature shipped", () => {
      setUserAgent(androidChromeUA);
      hookState.permission = "granted";
      hookState.notificationsEnabled = true;

      render(<NotificationSettings />);

      expect(
        screen.getByRole("button", {
          name: /Notifications arriving late on Android\?/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/Notifications may arrive late on Android/i),
      ).not.toBeInTheDocument();
    });
  });
});
