import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useFocusTimer } from "@/lib/hooks/useFocusTimer";
import { useTimerStore } from "@/lib/store/timerStore";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: true }),
}));

vi.mock("@/lib/hooks/useFocusSounds", () => ({
  useFocusSounds: () => ({ play: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/lib/hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({ showNotification: vi.fn() }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/useTimerSync", () => ({
  useTimerSync: () => ({
    upsertTimerState: vi.fn(),
    claimTimerCompletion: vi.fn().mockResolvedValue(true),
    hydrate: vi.fn(),
  }),
}));

describe("useFocusTimer document.title sync", () => {
  beforeEach(() => {
    document.title = "Kagelin";
    useTimerStore.setState({
      state: {
        mode: "focus",
        isRunning: false,
        remainingSeconds: 25 * 60,
        completedSessions: 0,
        activeTaskId: null,
        sessionDurationSeconds: null,
        endsAt: null,
        sourceDeviceId: null,
      },
      settings: DEFAULT_TIMER_SETTINGS,
      isLoaded: true,
    });
  });

  it("shows idle title when timer is idle", () => {
    renderHook(() => useFocusTimer());
    expect(document.title).toBe("Kagelin");
  });

  it("shows countdown and mode when running", () => {
    useTimerStore.setState((s) => ({
      state: {
        ...s.state,
        mode: "focus",
        isRunning: true,
        remainingSeconds: 14 * 60 + 5,
        sessionDurationSeconds: 25 * 60,
        endsAt: Date.now() + 845_000,
      },
    }));

    const { rerender } = renderHook(() => useFocusTimer());
    expect(document.title).toBe("14:05 · Focus — Kagelin");

    act(() => {
      useTimerStore.setState((s) => ({
        state: {
          ...s.state,
          mode: "shortBreak",
          remainingSeconds: 4 * 60 + 30,
        },
      }));
    });
    rerender();
    expect(document.title).toBe("04:30 · Short Break — Kagelin");
  });

  it("shows paused title when paused mid-session", () => {
    useTimerStore.setState((s) => ({
      state: {
        ...s.state,
        mode: "focus",
        isRunning: false,
        remainingSeconds: 12 * 60 + 9,
        sessionDurationSeconds: 25 * 60,
        endsAt: null,
      },
    }));

    renderHook(() => useFocusTimer());
    expect(document.title).toBe("Paused (12:09) · Kagelin");
  });
});
