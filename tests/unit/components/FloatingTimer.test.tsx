import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { FloatingTimer } from "@/components/FloatingTimer";

// ===== Hoisted mocks =====

const {
  mockSyncedStart,
  mockSyncedPause,
  mockRawStart,
  mockRawPause,
  mockRouterPush,
} = vi.hoisted(() => ({
  mockSyncedStart: vi.fn(),
  mockSyncedPause: vi.fn(),
  // Stand-ins for the raw Zustand store actions. These intentionally never
  // sync to the DB — that's the wrapper's job. If a component calls these
  // directly instead of the TimerProvider wrapper, the assertions below
  // (which only check the synced mocks) will fail to see the call.
  mockRawStart: vi.fn(),
  mockRawPause: vi.fn(),
  mockRouterPush: vi.fn(),
}));

// ===== Mock state control =====

let mockMode: "focus" | "shortBreak" | "longBreak" = "focus";
let mockIsRunning = false;
let mockRemainingSeconds = 1500;
let mockCompletedSessions = 1; // shouldShow requires isRunning || completedSessions > 0
let mockIsPipActive = false;

// ===== Module mocks =====

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/", // not "/focus", so FloatingTimer is eligible to show
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
    isPhone: false,
    hapticsEnabled: true,
  }),
}));

interface MockUiStoreState {
  isPipActive: boolean;
}

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: (selector: (state: MockUiStoreState) => unknown) =>
    selector({ isPipActive: mockIsPipActive }),
}));

interface MockTimerStoreState {
  state: {
    mode: string;
    isRunning: boolean;
    remainingSeconds: number;
    completedSessions: number;
  };
  start: typeof mockRawStart;
  pause: typeof mockRawPause;
}

vi.mock("@/lib/store/timerStore", () => ({
  useTimerStore: (selector: (state: MockTimerStoreState) => unknown) => {
    const state: MockTimerStoreState = {
      state: {
        mode: mockMode,
        isRunning: mockIsRunning,
        remainingSeconds: mockRemainingSeconds,
        completedSessions: mockCompletedSessions,
      },
      // Raw store actions — must NOT be the ones this component invokes.
      start: mockRawStart,
      pause: mockRawPause,
    };
    return selector(state);
  },
}));

// pause/start must come from the synced TimerProvider wrapper, not the raw
// store (see #70 — a raw-store bypass here never persists to the DB, so a
// later resync-on-visibility silently resumes/re-pauses the timer).
vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({
    start: mockSyncedStart,
    pause: mockSyncedPause,
  }),
}));

describe("FloatingTimer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMode = "focus";
    mockIsRunning = false;
    mockRemainingSeconds = 1500;
    mockCompletedSessions = 1;
    mockIsPipActive = false;
  });

  it("calls the synced pause() (not the raw store) when running and play/pause is tapped", () => {
    mockIsRunning = true;

    render(<FloatingTimer />);
    fireEvent.click(screen.getByRole("button", { name: "Pause timer" }));

    expect(mockSyncedPause).toHaveBeenCalledTimes(1);
    expect(mockRawPause).not.toHaveBeenCalled();
  });

  it("calls the synced start() (not the raw store) when paused and play/pause is tapped", () => {
    mockIsRunning = false;

    render(<FloatingTimer />);
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));

    expect(mockSyncedStart).toHaveBeenCalledTimes(1);
    expect(mockRawStart).not.toHaveBeenCalled();
  });

  it("calls the synced pause() (not the raw store) when the close button is tapped", () => {
    mockIsRunning = true;

    render(<FloatingTimer />);
    fireEvent.click(screen.getByRole("button", { name: "Close timer" }));

    expect(mockSyncedPause).toHaveBeenCalledTimes(1);
    expect(mockRawPause).not.toHaveBeenCalled();
  });
});
