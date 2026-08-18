import { renderHook, act } from "@testing-library/react";
import { useFocusTimer } from "@/lib/hooks/useFocusTimer";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useTimerStore } from "@/lib/store/timerStore";
import { setServerOffset } from "@/lib/store/serverClock";
import { getDeviceId } from "@/lib/store/deviceId";
import type { TimerState } from "@/lib/types/timer";

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

const { notifyMock, showNotificationMock } = vi.hoisted(() => ({
  notifyMock: vi.fn(),
  showNotificationMock: vi.fn(),
}));

vi.mock("@/lib/hooks/usePushNotifications", () => ({
  usePushNotifications: vi.fn(() => ({
    showNotification: showNotificationMock,
  })),
}));

vi.mock("@/lib/notify", () => ({
  notify: notifyMock,
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: vi.fn(() => ({ trigger: vi.fn(), isPhone: false })),
}));

const { upsertTimerStateMock, hydrateMock } = vi.hoisted(() => ({
  upsertTimerStateMock: vi.fn().mockResolvedValue(undefined),
  hydrateMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/hooks/useTimerSync", () => ({
  useTimerSync: () => ({
    upsertTimerState: upsertTimerStateMock,
    claimTimerCompletion: vi.fn().mockResolvedValue(true),
    hydrate: hydrateMock,
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
    setServerOffset(0);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
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
    const baseTime = new Date("2024-01-01T12:00:00Z").getTime();
    const startTime = baseTime - 30000;

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
    const { result } = renderHook(() => useFocusTimer());

    expect(result.current.state.remainingSeconds).toBe(1470);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("should trigger completion and show toast exactly once when session ended while away", async () => {
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
    const { result } = renderHook(() => useFocusTimer());
    await act(async () => {});

    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.stringContaining("session completed"),
      expect.anything(),
    );

    expect(result.current.state.mode).not.toBe("focus");
  });

  it("should NOT show a second toast if reconciliation is called again for the same session", () => {
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

    const callCountAfterMount = notifyMock.mock.calls.length;

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(notifyMock).toHaveBeenCalledTimes(callCountAfterMount);
  });

  it("should show toast on mount when session expired while app was closed", async () => {
    const baseTime = Date.now();
    const startTime = baseTime - 30 * 60 * 1000;

    const expiredState = {
      mode: "focus",
      isRunning: true,
      remainingSeconds: 1500,
      completedSessions: 0,
      activeTaskId: null,
      endsAt: startTime + 1500 * 1000,
      sourceDeviceId: null,
    };
    useTimerStore.setState({ state: expiredState as TimerState });

    vi.setSystemTime(baseTime);

    renderHook(() => useFocusTimer());
    await act(async () => {});

    expect(notifyMock).toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      expect.stringContaining("session completed"),
      expect.anything(),
    );
  });

  it("syncs the freshly computed endsAt deadline to the server on start, with no client-side notification scheduling", async () => {
    const baseTime = new Date("2024-01-01T12:00:00Z").getTime();
    vi.setSystemTime(baseTime);

    const { result } = renderHook(() => useFocusTimer());

    await act(async () => {
      await result.current.start();
    });

    expect(useTimerStore.getState().state.endsAt).toBe(baseTime + 1500 * 1000);
    expect(upsertTimerStateMock).toHaveBeenCalledTimes(1);
  });

  // #129: Reopening the app must not push a stale local running state without hydrating first.
  const runningState = (overrides: Partial<TimerState>): TimerState => ({
    mode: "focus",
    isRunning: true,
    remainingSeconds: 900,
    completedSessions: 0,
    activeTaskId: null,
    endsAt: Date.now() + 900_000,
    sourceDeviceId: null,
    ...overrides,
  });

  it("does not push a mount-time resync for a session mirrored from another device", async () => {
    useTimerStore.setState({
      state: runningState({
        activeTaskId: "task-remote",
        sourceDeviceId: "other-device",
      }),
    });

    renderHook(() => useFocusTimer());
    await act(async () => {});

    expect(upsertTimerStateMock).not.toHaveBeenCalled();
  });

  it("does not push a stale own session once hydrate reveals another device took it over while this one was offline", async () => {
    useTimerStore.setState({
      state: runningState({
        activeTaskId: "task-own",
        sourceDeviceId: getDeviceId(),
      }),
    });
    hydrateMock.mockImplementationOnce(async () => {
      useTimerStore.setState({
        state: runningState({
          mode: "shortBreak",
          activeTaskId: null,
          sourceDeviceId: "device-that-completed-it",
        }),
      });
    });

    renderHook(() => useFocusTimer());
    await act(async () => {});

    expect(upsertTimerStateMock).not.toHaveBeenCalled();
  });

  it("still re-pushes on mount to recover a running session this device owns", async () => {
    useTimerStore.setState({
      state: runningState({
        activeTaskId: "task-own",
        sourceDeviceId: getDeviceId(),
      }),
    });

    renderHook(() => useFocusTimer());
    await act(async () => {});

    expect(upsertTimerStateMock).toHaveBeenCalledTimes(1);
  });

  it("fires showNotification with data.url = /focus on completion when document is hidden", async () => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });

    renderHook(() => useFocusTimer());

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("timer-complete", {
          detail: {
            prevState: { mode: "focus", endsAt: null },
            nextState: { isRunning: false, mode: "shortBreak" },
          },
        }),
      );
    });

    expect(showNotificationMock).toHaveBeenCalledWith(
      "Focus Complete",
      expect.objectContaining({
        tag: "timer_end",
        data: { url: "/focus" },
      }),
    );
  });
});
