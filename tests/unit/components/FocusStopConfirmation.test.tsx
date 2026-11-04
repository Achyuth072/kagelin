import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import FocusPage from "@/../app/focus/page";

const {
  mockStop,
  mockStart,
  mockPause,
  mockSkip,
  mockTrigger,
  mockStateRef,
  mockSettingsRef,
} = vi.hoisted(() => ({
  mockStop: vi.fn(),
  mockStart: vi.fn(),
  mockPause: vi.fn(),
  mockSkip: vi.fn(),
  mockTrigger: vi.fn(),
  mockStateRef: {
    current: {
      mode: "focus" as const,
      isRunning: false,
      remainingSeconds: 1500,
      completedSessions: 0,
      activeTaskId: null as string | null,
    },
  },
  mockSettingsRef: {
    current: {
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
    },
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false }),
}));

vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({
    state: mockStateRef.current,
    settings: mockSettingsRef.current,
    start: mockStart,
    pause: mockPause,
    stop: mockStop,
    skip: mockSkip,
  }),
  useTimerActions: () => ({
    cancel: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockTrigger,
    isPhone: false,
    hapticsEnabled: true,
  }),
}));

vi.mock("@/components/providers/PiPProvider", () => ({
  usePiP: () => ({
    isPiPSupported: true,
    isPiPActive: false,
    openPiP: vi.fn(),
    closePiP: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useFullscreen", () => ({
  useFullscreen: () => ({
    isFullscreen: false,
    toggleFullscreen: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useTodayFocusSessions", () => ({
  useTodayFocusSessions: () => ({ data: 0 }),
}));

vi.mock("@/lib/hooks/useBackAnchor", () => ({
  useAnchoredBack: () => vi.fn(),
}));

type MockStore = {
  state: typeof mockStateRef.current;
  settings: typeof mockSettingsRef.current;
};

vi.mock("@/lib/store/timerStore", () => {
  const hook = <T,>(selector?: (state: MockStore) => T) => {
    const fullState: MockStore = {
      state: mockStateRef.current,
      settings: mockSettingsRef.current,
    };
    return selector ? selector(fullState) : (fullState as unknown as T);
  };
  hook.getState = () => ({
    consumeFocusStart: () => false,
    state: mockStateRef.current,
    settings: mockSettingsRef.current,
  });
  return { useTimerStore: hook };
});

vi.mock("@/components/FocusTaskPicker", () => ({
  FocusTaskPicker: () => null,
}));

vi.mock("@/components/FocusSettingsDialog", () => ({
  FocusSettingsDialog: () => null,
}));

vi.mock("@/components/FocusSubtaskList", () => ({
  FocusSubtaskList: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/focus",
}));

describe("FocusPage Stop & Reset Cycle Confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStateRef.current = {
      mode: "focus",
      isRunning: false,
      remainingSeconds: 1500,
      completedSessions: 0,
      activeTaskId: null,
    };
  });

  it("has accessible label for the square stop button", () => {
    render(<FocusPage />);
    const stopBtn = screen.getByRole("button", {
      name: "Reset timer and cycle",
    });
    expect(stopBtn).toBeInTheDocument();
  });

  it("stops immediately if timer is idle and completedSessions is 0", () => {
    render(<FocusPage />);
    const stopBtn = screen.getByRole("button", {
      name: "Reset timer and cycle",
    });
    fireEvent.click(stopBtn);
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/Reset all completed sessions/i),
    ).not.toBeInTheDocument();
  });

  it("prompts confirmation when completedSessions > 0", () => {
    mockStateRef.current.completedSessions = 2;
    render(<FocusPage />);
    const stopBtn = screen.getByRole("button", {
      name: "Reset timer and cycle",
    });
    fireEvent.click(stopBtn);

    expect(mockStop).not.toHaveBeenCalled();
    expect(screen.getByText("Reset timer and cycle?")).toBeInTheDocument();
    expect(
      screen.getByText(/Reset all completed sessions and restart cycle/i),
    ).toBeInTheDocument();

    // Clicking confirm resets cycle
    const confirmBtn = screen.getByRole("button", { name: "Reset cycle" });
    fireEvent.click(confirmBtn);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it("prompts confirmation when a session is actively running", () => {
    mockStateRef.current.isRunning = true;
    mockStateRef.current.completedSessions = 0;
    render(<FocusPage />);
    const stopBtn = screen.getByRole("button", {
      name: "Reset timer and cycle",
    });
    fireEvent.click(stopBtn);

    expect(mockStop).not.toHaveBeenCalled();
    expect(screen.getByText("Reset timer and cycle?")).toBeInTheDocument();

    // Clicking cancel retains progress
    const cancelBtn = screen.getByRole("button", { name: "Keep progress" });
    fireEvent.click(cancelBtn);
    expect(mockStop).not.toHaveBeenCalled();
  });
});
