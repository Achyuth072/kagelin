import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import FocusPage from "@/../app/focus/page";

const {
  mockStop,
  mockCancel,
  mockStart,
  mockPause,
  mockSkip,
  mockTrigger,
  mockNotify,
  mockStateRef,
  mockSettingsRef,
} = vi.hoisted(() => ({
  mockStop: vi.fn(),
  mockCancel: vi.fn(),
  mockStart: vi.fn(),
  mockPause: vi.fn(),
  mockSkip: vi.fn(),
  mockTrigger: vi.fn(),
  mockNotify: vi.fn(),
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
    cancel: mockCancel,
  }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockTrigger,
    isPhone: false,
    hapticsEnabled: true,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: mockNotify,
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

describe("FocusPage Stop & Reset Cycle Controls", () => {
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

  it("has accessible label for the square stop button and is disabled when idle", () => {
    render(<FocusPage />);
    const stopBtn = screen.getByRole("button", {
      name: "Stop session",
    });
    expect(stopBtn).toBeInTheDocument();
    expect(stopBtn).toBeDisabled();
  });

  it("stops active session via cancel() safely without dialog when running", () => {
    mockStateRef.current.isRunning = true;
    mockStateRef.current.remainingSeconds = 1200;
    mockStateRef.current.completedSessions = 2;

    render(<FocusPage />);
    const stopBtn = screen.getByRole("button", {
      name: "Stop session",
    });
    expect(stopBtn).toBeEnabled();

    fireEvent.click(stopBtn);
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockStop).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides Reset cycle button when completedSessions is 0", () => {
    render(<FocusPage />);
    expect(
      screen.queryByRole("button", { name: /Reset cycle/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Reset cycle button when completedSessions > 0 and prompts confirmation before calling stop()", () => {
    mockStateRef.current.completedSessions = 2;
    render(<FocusPage />);

    const resetCycleBtn = screen.getByRole("button", {
      name: "Reset cycle (starts from Session 1)",
    });
    expect(resetCycleBtn).toBeInTheDocument();

    fireEvent.click(resetCycleBtn);

    expect(screen.getByText("Reset focus cycle?")).toBeInTheDocument();
    expect(mockStop).not.toHaveBeenCalled();

    // Clicking confirm executes stop
    const confirmBtn = screen.getByRole("button", { name: "Reset cycle" });
    fireEvent.click(confirmBtn);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});
