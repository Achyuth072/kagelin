import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import FocusPage from "../../../app/focus/page";
import { useTimerStore } from "@/lib/store/timerStore";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";

const { mockStart, mockPause, mockCancel, mockSkip } = vi.hoisted(() => ({
  mockStart: vi.fn(),
  mockPause: vi.fn(),
  mockCancel: vi.fn(),
  mockSkip: vi.fn(),
}));

let mockIsRunning = false;
let mockRemainingSeconds = 25 * 60;
let mockSessionDurationSeconds: number | null = null;

vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({
    state: {
      mode: "focus",
      isRunning: mockIsRunning,
      remainingSeconds: mockRemainingSeconds,
      completedSessions: 0,
      activeTaskId: null,
      sessionDurationSeconds: mockSessionDurationSeconds,
      endsAt: null,
      sourceDeviceId: null,
    },
    settings: DEFAULT_TIMER_SETTINGS,
    isLoaded: true,
    start: mockStart,
    pause: mockPause,
    stop: vi.fn(),
    cancel: mockCancel,
    skip: mockSkip,
    updateSettings: vi.fn(),
  }),
  useTimerActions: () => ({
    pause: mockPause,
    stop: vi.fn(),
    cancel: mockCancel,
    skip: mockSkip,
    updateSettings: vi.fn(),
  }),
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("motion/react-m", () => ({
  div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/lib/hooks/useBackAnchor", () => ({
  useAnchoredBack: () => vi.fn(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn(), isPhone: false }),
}));

vi.mock("@/components/providers/PiPProvider", () => ({
  usePiP: () => ({
    isPiPSupported: false,
    isPiPActive: false,
    openPiP: vi.fn(),
    closePiP: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useFullscreen", () => ({
  useFullscreen: () => ({ isFullscreen: false }),
}));

vi.mock("@/lib/hooks/useTodayFocusSessions", () => ({
  useTodayFocusSessions: () => ({ data: 0 }),
}));

vi.mock("@/lib/hooks/usePrefersReducedMotion", () => ({
  usePrefersReducedMotion: () => true,
}));

vi.mock("@/components/FocusTaskPicker", () => ({
  FocusTaskPicker: () => <div />,
}));

vi.mock("@/components/FocusSubtaskList", () => ({
  FocusSubtaskList: () => <div />,
}));

vi.mock("@/components/FocusSyncIndicator", () => ({
  FocusSyncIndicator: () => <div />,
}));

vi.mock("@/components/FullscreenToggle", () => ({
  FullscreenToggle: () => <div />,
}));

vi.mock("@/components/ResetCycleButton", () => ({
  ResetCycleButton: () => <div />,
}));

vi.mock("@/components/ui/animated-countdown", () => ({
  AnimatedCountdown: ({ seconds }: { seconds: number }) => (
    <span>{seconds}</span>
  ),
}));

vi.mock("@/components/FocusSettingsDialog", () => ({
  FocusSettingsDialog: ({
    open,
    onOpenChange,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="settings-dialog" data-open={String(Boolean(open))}>
      <button type="button" onClick={() => onOpenChange?.(true)}>
        Adjust Settings
      </button>
    </div>
  ),
}));

describe("FocusPage keyboard shortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRunning = false;
    mockRemainingSeconds = 25 * 60;
    mockSessionDurationSeconds = null;
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

  it("toggles start/pause with Space when focus is not on a button", () => {
    render(<FocusPage />);

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("does not double-fire Space when a button currently has focus", () => {
    render(<FocusPage />);

    const playButton = screen.getByRole("button", { name: "Start timer" });
    playButton.focus();

    fireEvent.keyDown(playButton, { key: " ", code: "Space" });
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("triggers skip on s, opens settings on ',', and opens stop confirmation on Shift+R when active", () => {
    mockIsRunning = true;
    mockRemainingSeconds = 20 * 60;
    mockSessionDurationSeconds = 25 * 60;

    render(<FocusPage />);

    fireEvent.keyDown(window, { key: "s" });
    expect(mockSkip).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "," });
    expect(screen.getByTestId("settings-dialog")).toHaveAttribute(
      "data-open",
      "true",
    );
  });

  it("opens stop confirmation on Shift+R when session is active or paused", () => {
    mockIsRunning = false;
    mockRemainingSeconds = 18 * 60;
    mockSessionDurationSeconds = 25 * 60;

    render(<FocusPage />);

    fireEvent.keyDown(window, { key: "R", shiftKey: true });
    expect(screen.getByText("Stop focus session?")).toBeInTheDocument();
  });
});
