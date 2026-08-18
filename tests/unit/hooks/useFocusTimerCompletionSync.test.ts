import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTimerStore } from "@/lib/store/timerStore";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";
import { setServerOffset } from "@/lib/store/serverClock";

const {
  mockUpsertTimerState,
  mockClaimTimerCompletion,
  mockHydrate,
  mockLogMutate,
} = vi.hoisted(() => ({
  mockUpsertTimerState: vi.fn().mockResolvedValue(undefined),
  mockClaimTimerCompletion: vi.fn().mockResolvedValue(true),
  mockHydrate: vi.fn().mockResolvedValue(undefined),
  mockLogMutate: vi.fn(),
}));

vi.mock("@/lib/hooks/useTimerSync", () => ({
  useTimerSync: () => ({
    upsertTimerState: mockUpsertTimerState,
    claimTimerCompletion: mockClaimTimerCompletion,
    hydrate: mockHydrate,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  useMutation: vi.fn(() => ({ mutate: mockLogMutate })),
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
vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/") }));
vi.mock("@/lib/hooks/useFocusSounds", () => ({
  useFocusSounds: vi.fn(() => ({ play: vi.fn() })),
}));
vi.mock("@/lib/hooks/usePushNotifications", () => ({
  usePushNotifications: vi.fn(() => ({ showNotification: vi.fn() })),
}));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: vi.fn(() => ({ trigger: vi.fn(), isPhone: false })),
}));

import { useFocusTimer } from "@/lib/hooks/useFocusTimer";

const NOW = 1_700_000_000_000;

function mountRunningSession() {
  vi.setSystemTime(NOW);
  useTimerStore.setState({
    state: {
      mode: "focus",
      isRunning: true,
      remainingSeconds: 2,
      completedSessions: 0,
      activeTaskId: "task-1",
      endsAt: NOW + 2000,
      sourceDeviceId: "device-a",
    },
    settings: DEFAULT_TIMER_SETTINGS,
    isLoaded: true,
  });
  renderHook(() => useFocusTimer());
  mockClaimTimerCompletion.mockClear();
  mockLogMutate.mockClear();
}

describe("useFocusTimer — completion claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setServerOffset(0);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("claims the completion and logs the session when it wins the claim", async () => {
    mockClaimTimerCompletion.mockResolvedValue(true);
    mountRunningSession();

    await act(async () => {
      vi.setSystemTime(NOW + 3000);
      vi.advanceTimersByTime(3000);
    });

    expect(useTimerStore.getState().state.mode).toBe("shortBreak");
    expect(useTimerStore.getState().state.completedSessions).toBe(1);
    expect(mockClaimTimerCompletion).toHaveBeenCalledWith(NOW + 2000);
    expect(mockLogMutate).toHaveBeenCalled();
  });

  it("skips side-effects (no double-log) when it loses the claim", async () => {
    mockClaimTimerCompletion.mockResolvedValue(false);
    mountRunningSession();

    await act(async () => {
      vi.setSystemTime(NOW + 3000);
      vi.advanceTimersByTime(3000);
    });

    expect(mockClaimTimerCompletion).toHaveBeenCalledWith(NOW + 2000);
    expect(mockLogMutate).not.toHaveBeenCalled();
  });

  it("fails open and still logs when the claim throws (transient error)", async () => {
    mockClaimTimerCompletion.mockRejectedValue(new Error("network down"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mountRunningSession();

    await act(async () => {
      vi.setSystemTime(NOW + 3000);
      vi.advanceTimersByTime(3000);
    });

    expect(mockClaimTimerCompletion).toHaveBeenCalledWith(NOW + 2000);
    expect(mockLogMutate).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
