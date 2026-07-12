import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { CancelSessionButton } from "@/components/CancelSessionButton";

// ===== Hoisted mocks =====

const { mockCancel, mockToast } = vi.hoisted(() => ({
  mockCancel: vi.fn(),
  mockToast: vi.fn(),
  mockTrigger: vi.fn(),
}));

// ===== Mock state control =====

let mockIsRunning = false;
let mockRemainingSeconds = 1500; // 25 min
const TOTAL_SECONDS = 1500;

// ===== Module mocks =====

interface MockTimerStoreState {
  state: {
    isRunning: boolean;
    remainingSeconds: number;
    mode: string;
  };
  settings: {
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
  };
}

vi.mock("@/lib/store/timerStore", () => ({
  useTimerStore: (selector: (state: MockTimerStoreState) => unknown) => {
    const state: MockTimerStoreState = {
      state: {
        isRunning: mockIsRunning,
        remainingSeconds: mockRemainingSeconds,
        mode: "focus",
      },
      settings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
      },
    };
    return selector(state);
  },
}));

// cancel must come from the synced TimerProvider wrapper, not the raw store
// (see #70 — a raw-store bypass here never persists to the DB, so a later
// resync-on-visibility silently resumes the "cancelled" timer).
vi.mock("@/components/TimerProvider", () => ({
  useTimerActions: () => ({
    cancel: mockCancel,
  }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
    isPhone: false,
    hapticsEnabled: true,
  }),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

describe("CancelSessionButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRunning = false;
    mockRemainingSeconds = TOTAL_SECONDS;
  });

  // --- Test 1: Visible when timer is active ---

  it("should render 'Cancel session' text when timer is active (isRunning)", () => {
    mockIsRunning = true;

    render(<CancelSessionButton />);

    expect(screen.getByText("Cancel session")).toBeInTheDocument();
  });

  it("should render 'Cancel session' when session is paused mid-session", () => {
    mockIsRunning = false;
    mockRemainingSeconds = 800; // Session has progressed

    render(<CancelSessionButton />);

    expect(screen.getByText("Cancel session")).toBeInTheDocument();
  });

  // --- Test 2: Hidden when timer is idle ---

  it("should be hidden when timer is idle (not running, remaining === total)", () => {
    mockIsRunning = false;
    mockRemainingSeconds = TOTAL_SECONDS;

    const { container } = render(<CancelSessionButton />);

    expect(container.innerHTML).toBe("");
    expect(screen.queryByText("Cancel session")).not.toBeInTheDocument();
  });

  // --- Test 3: Click calls cancel() and shows toast ---

  it("should call cancel() and show toast on click", () => {
    mockIsRunning = true;

    render(<CancelSessionButton />);

    const button = screen.getByText("Cancel session");
    fireEvent.click(button);

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith("Session cancelled", {
      duration: 1500,
    });
  });
});
