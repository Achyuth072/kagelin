import { renderHook, act } from "@testing-library/react";
import { useFocusTimer } from "@/lib/hooks/useFocusTimer";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useTimerStore } from "@/lib/store/timerStore";
import { setServerOffset } from "@/lib/store/serverClock";
import type { TimerState } from "@/lib/types/timer";

// Mock dependencies
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  useMutation: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({ data: { id: "1", settings: {} } }),
          ),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({})) })),
      })),
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "1" } } })),
    },
  })),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: { getState: vi.fn(() => ({ isPipActive: false })) },
}));

vi.mock("@/lib/store/focusHistoryStore", () => ({
  useFocusHistoryStore: { getState: vi.fn(() => ({ addSession: vi.fn() })) },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: false })),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

vi.mock("@/lib/hooks/useFocusSounds", () => ({
  useFocusSounds: vi.fn(() => ({ play: vi.fn() })),
}));

vi.mock("@/lib/hooks/usePushNotifications", () => ({
  usePushNotifications: vi.fn(() => ({ showNotification: vi.fn() })),
}));

vi.mock("@/lib/timer-api", () => ({
  scheduleTimerNotification: vi.fn(() =>
    Promise.resolve({ success: true, notificationId: "test-id" }),
  ),
  cancelTimerNotification: vi.fn(() => Promise.resolve({ success: true })),
}));

// Use vi.hoisted() so toastMock is available in vi.mock factory
const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: vi.fn(() => ({ trigger: vi.fn(), isPhone: false })),
}));

// Stub the sync layer: completion side-effects are gated on winning the atomic
// claim, which resolves true here (single-device → always wins).
vi.mock("@/lib/hooks/useTimerSync", () => ({
  useTimerSync: () => ({
    upsertTimerState: vi.fn().mockResolvedValue(undefined),
    claimTimerCompletion: vi.fn().mockResolvedValue(true),
  }),
}));

describe("useFocusTimer - Reconciliation", () => {
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.clearAllMocks();
    // These reconciliation tests assume a live session whose server clock has
    // been probed; mark it ready so deadline completion isn't deferred by the
    // unprobed-clock guard (that deferral is covered in timerStoreClockReadiness).
    setServerOffset(0);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    // Ensure we start with a clean store state
    useTimerStore.setState({
      state: {
        mode: "focus",
        isRunning: false,
        remainingSeconds: 1500,
        completedSessions: 0,
        activeTaskId: null,
        endsAt: null,
        sourceDeviceId: null,
      },
    });
  });

  it("should reconcile remaining time silently if timer is still running within bounds", () => {
    // Given: Timer started 30s ago
    const baseTime = new Date("2024-01-01T12:00:00Z").getTime();
    const startTime = baseTime - 30000; // 30 seconds before baseTime

    const initialState = {
      mode: "focus",
      isRunning: true,
      remainingSeconds: 1500, // 25 mins initially
      completedSessions: 0,
      activeTaskId: null,
      // Deadline = start + full duration; reconcile derives remaining from it
      endsAt: startTime + 1500 * 1000, // started 30s ago → 1470s left
      sourceDeviceId: null,
    };
    useTimerStore.setState({ state: initialState as TimerState });

    // When: Set the system time to baseTime (30s after timer started), then render
    vi.setSystemTime(baseTime);
    const { result } = renderHook(() => useFocusTimer());

    // Then: 25 mins = 1500s. 30s elapsed should leave 1470s. No toast.
    expect(result.current.state.remainingSeconds).toBe(1470);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("should trigger completion and show toast exactly once when session ended while away", async () => {
    // Given: Timer started 50 mins ago (1500s session = 25 mins, so 50 mins is well over)
    const baseTime = new Date("2024-01-01T12:50:00Z").getTime();
    const startTime = baseTime - 3000000; // 50 minutes before baseTime

    const initialState = {
      mode: "focus",
      isRunning: true,
      remainingSeconds: 1500,
      completedSessions: 0,
      activeTaskId: null,
      endsAt: startTime + 1500 * 1000,
      sourceDeviceId: null,
    };
    useTimerStore.setState({ state: initialState as TimerState });

    // When: Set system time to baseTime (50 mins later), then render
    vi.setSystemTime(baseTime);
    const { result } = renderHook(() => useFocusTimer());
    // Completion side-effects await the atomic claim — flush the microtask.
    await act(async () => {});

    // Then: Reconciliation should run on mount, showing exactly 1 toast
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.stringContaining("session completed"),
      expect.anything(),
    );

    // Also verify state transitioned (mode should be shortBreak or focus-pause depending on autoStart)
    expect(result.current.state.mode).not.toBe("focus");
  });

  it("should NOT show a second toast if reconciliation is called again for the same session", () => {
    // Given: Timer started 50 mins ago (expired)
    const baseTime = new Date("2024-01-01T12:50:00Z").getTime();
    const startTime = baseTime - 3000000;

    const initialState = {
      mode: "focus",
      isRunning: true,
      remainingSeconds: 1500,
      completedSessions: 0,
      activeTaskId: null,
      endsAt: startTime + 1500 * 1000,
      sourceDeviceId: null,
    };
    useTimerStore.setState({ state: initialState as TimerState });

    vi.setSystemTime(baseTime);
    renderHook(() => useFocusTimer());

    const callCountAfterMount = toastMock.mock.calls.length;

    // When: Simulate a second visibilitychange event
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Then: Toast count should remain the same (no duplicate)
    expect(toastMock).toHaveBeenCalledTimes(callCountAfterMount);
  });

  it("should show toast on mount when session expired while app was closed", async () => {
    // Given: Timer that started 30 mins ago (expired) is in localStorage
    const baseTime = Date.now();
    const startTime = baseTime - 30 * 60 * 1000; // 30 mins ago

    const expiredState = {
      mode: "focus",
      isRunning: true,
      remainingSeconds: 1500, // 25 mins
      completedSessions: 0,
      activeTaskId: null,
      endsAt: startTime + 1500 * 1000,
      sourceDeviceId: null,
    };
    useTimerStore.setState({ state: expiredState as TimerState });

    vi.setSystemTime(baseTime);

    // When: Hook mounts (simulating PWA reopen)
    renderHook(() => useFocusTimer());
    // Completion side-effects await the atomic claim — flush the microtask.
    await act(async () => {});

    // Then: Toast should appear exactly once
    expect(toastMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.stringContaining("session completed"),
      expect.anything(),
    );
  });
});
