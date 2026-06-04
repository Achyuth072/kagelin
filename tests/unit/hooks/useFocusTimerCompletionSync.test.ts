import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTimerStore } from "@/lib/store/timerStore";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";
import { setServerOffset } from "@/lib/store/serverClock";

/**
 * Regression: when the focus timer auto-completes on a foregrounded device, it
 * atomically claims the completion. The winner persists the transition and fires
 * side-effects (logs the focus session); a loser (another device finishing the
 * same session) gets a failed claim and must skip side-effects so the session is
 * never double-logged.
 */

const { mockUpsertTimerState, mockClaimTimerCompletion, mockLogMutate } =
  vi.hoisted(() => ({
    mockUpsertTimerState: vi.fn().mockResolvedValue(undefined),
    mockClaimTimerCompletion: vi.fn().mockResolvedValue(true),
    mockLogMutate: vi.fn(),
  }));

vi.mock("@/lib/hooks/useTimerSync", () => ({
  useTimerSync: () => ({
    upsertTimerState: mockUpsertTimerState,
    claimTimerCompletion: mockClaimTimerCompletion,
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
vi.mock("@/lib/timer-api", () => ({
  scheduleTimerNotification: vi.fn(() =>
    Promise.resolve({ success: true, notificationId: "id" }),
  ),
  cancelTimerNotification: vi.fn(() => Promise.resolve({ success: true })),
}));
vi.mock("sonner", () => ({ toast: vi.fn() }));
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
      endsAt: NOW + 2000, // deadline 2s out
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
      vi.advanceTimersByTime(3000); // tick past the deadline
    });

    expect(useTimerStore.getState().state.mode).toBe("shortBreak");
    expect(useTimerStore.getState().state.completedSessions).toBe(1);
    // Claimed against the deadline that just passed.
    expect(mockClaimTimerCompletion).toHaveBeenCalledWith(NOW + 2000);
    // Winner logs the focus session.
    expect(mockLogMutate).toHaveBeenCalled();
  });

  it("skips side-effects (no double-log) when it loses the claim", async () => {
    mockClaimTimerCompletion.mockResolvedValue(false);
    mountRunningSession();

    await act(async () => {
      vi.setSystemTime(NOW + 3000);
      vi.advanceTimersByTime(3000);
    });

    // Local state still advanced optimistically (will converge via realtime)...
    expect(mockClaimTimerCompletion).toHaveBeenCalledWith(NOW + 2000);
    // ...but the loser must NOT log the session again.
    expect(mockLogMutate).not.toHaveBeenCalled();
  });
});
