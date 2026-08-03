/* eslint-disable @typescript-eslint/no-explicit-any, react/display-name */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import React, { useEffect } from "react";

// ===== Hoisted mocks =====

const {
  mockRouterPush,
  mockSetActiveTaskId,
  mockStart,
  mockPause,
  mockConsumeFocusStart,
} = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockSetActiveTaskId: vi.fn(),
  mockStart: vi.fn(),
  mockPause: vi.fn(),
  mockConsumeFocusStart: vi.fn(() => false),
}));

// ===== Reactive mock state for timer store =====

let mockActiveTaskId: string | null = null;
let mockIsRunning = false;

// ===== Mocks for modules =====

vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
  usePathname: () => "/focus",
}));

vi.mock("@/lib/hooks/useAuth", () => ({
  useAuth: () => ({
    isGuestMode: false,
  }),
}));

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useToggleTask: () => ({
    mutate: vi.fn(),
  }),
  useDeleteTask: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => {
        return (
          <div {...props} ref={ref}>
            {children}
          </div>
        );
      }),
      button: React.forwardRef(
        ({ children, onClick, ...props }: any, ref: any) => {
          return (
            <button ref={ref} onClick={onClick} {...props}>
              {children}
            </button>
          );
        },
      ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useMotionValue: vi.fn(() => ({ get: () => 0, set: vi.fn() })),
    useTransform: vi.fn(() => ({ get: () => 0 })),
  };
});

vi.mock("@/components/tasks/task-utils", () => ({
  priorityCheckboxClasses: { "1": "", "2": "", "3": "", "4": "" },
  formatDueDate: () => "",
  priorityTextClasses: { "1": "", "2": "", "3": "", "4": "" },
}));

vi.mock("@/components/kanban", () => ({
  KanbanBoardCardButton: ({ children, onClick, className, ...props }: any) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, className, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      readOnly
      className={className}
      data-testid="checkbox"
      {...props}
    />
  ),
}));

vi.mock("lucide-react", () => ({
  Play: (props: any) => <svg data-testid="play-icon" {...props} />,
  Pause: (props: any) => <svg data-testid="pause-icon" {...props} />,
  X: (props: any) => <svg data-testid="x-icon" {...props} />,
  Maximize2: (props: any) => <svg data-testid="maximize2-icon" {...props} />,
  Calendar: () => <svg />,
  Flag: () => <svg />,
  Check: () => <svg />,
  Square: () => <svg />,
  SkipForward: () => <svg />,
  Minimize2: () => <svg />,
  Target: () => <svg />,
}));

vi.mock("@/lib/store/timerStore", () => ({
  useTimerStore: (selector: (state: any) => any) => {
    const state = {
      state: {
        mode: "focus" as const,
        isRunning: mockIsRunning,
        remainingSeconds: 1500,
        completedSessions: 0,
        activeTaskId: mockActiveTaskId,
        startedAt: null,
      },
      settings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        autoStartBreak: false,
        autoStartFocus: false,
      },
      start: mockStart,
      pause: mockPause,
      stop: vi.fn(),
      cancel: vi.fn(),
      setActiveTaskId: mockSetActiveTaskId,
      skip: vi.fn(),
      tick: vi.fn(),
    };
    return selector(state);
  },
}));

// ===== Minimal auto-start harness (replicates app/focus/page.tsx mount effect) =====
// The focus page now auto-starts ONLY on an explicit play-focus intent flag,
// consumed once on mount — never merely because a task is active.

function FocusPageAutoStartHarness() {
  const ranRef = React.useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (mockConsumeFocusStart()) {
      mockStart();
    }
  }, []);

  return <div data-testid="focus-harness">Focus Page Mock</div>;
}

// ===== Test suites =====

describe("Focus auto-start on mount (Tests 7 & 8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveTaskId = null;
    mockIsRunning = false;
    mockConsumeFocusStart.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Test 7: Auto-start when an explicit play-focus intent was set ---

  it("should call start() on mount when a pending focus-start intent is present", () => {
    mockConsumeFocusStart.mockReturnValue(true);

    render(<FocusPageAutoStartHarness />);

    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  // --- Test 8a: No auto-start without the intent flag (plain navigation) ---

  it("should NOT call start() on mount when there is no pending focus-start intent", () => {
    mockConsumeFocusStart.mockReturnValue(false);

    render(<FocusPageAutoStartHarness />);

    expect(mockStart).not.toHaveBeenCalled();
  });

  // --- Test 8b: No auto-start when resuming a paused session without intent ---

  it("should NOT call start() on mount for an active paused session without intent", () => {
    mockActiveTaskId = "task-123";
    mockIsRunning = false;
    mockConsumeFocusStart.mockReturnValue(false);

    render(<FocusPageAutoStartHarness />);

    expect(mockStart).not.toHaveBeenCalled();
  });
});
