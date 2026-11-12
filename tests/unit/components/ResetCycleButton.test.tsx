import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { ResetCycleButton } from "@/components/ResetCycleButton";
import { useTimerStore } from "@/lib/store/timerStore";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";

const { mockStop, mockTrigger, mockNotify } = vi.hoisted(() => ({
  mockStop: vi.fn(),
  mockTrigger: vi.fn(),
  mockNotify: vi.fn(),
}));

vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({ stop: mockStop }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: mockTrigger }),
}));

vi.mock("@/lib/notify", () => ({
  notify: mockNotify,
}));

describe("ResetCycleButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTimerStore.setState({
      state: {
        mode: "focus",
        remainingSeconds: 25 * 60,
        isRunning: false,
        completedSessions: 0,
        activeTaskId: null,
        endsAt: null,
        sourceDeviceId: null,
      },
      settings: DEFAULT_TIMER_SETTINGS,
    });
  });

  it("does not render when there is no cycle progress", () => {
    const { container } = render(<ResetCycleButton />);
    expect(container.innerHTML).toBe("");
    expect(
      screen.queryByRole("button", { name: /Reset cycle/i }),
    ).not.toBeInTheDocument();
  });

  it("renders when completedSessions > 0 and prompts confirmation dialog", () => {
    useTimerStore.setState((s) => ({
      ...s,
      state: {
        ...s.state,
        completedSessions: 2,
      },
    }));

    render(<ResetCycleButton />);

    const button = screen.getByRole("button", {
      name: "Reset cycle (starts from Session 1)",
    });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    expect(screen.getByText("Reset focus cycle?")).toBeInTheDocument();
    expect(mockStop).not.toHaveBeenCalled();

    const cancelBtn = screen.getByRole("button", { name: "Keep progress" });
    fireEvent.click(cancelBtn);

    expect(mockStop).not.toHaveBeenCalled();
  });

  it("renders when mode is longBreak even if completedSessions was adjusted", () => {
    useTimerStore.setState((s) => ({
      ...s,
      state: {
        ...s.state,
        mode: "longBreak",
        completedSessions: 4,
      },
    }));

    render(<ResetCycleButton />);

    expect(
      screen.getByRole("button", {
        name: "Reset cycle (starts from Session 1)",
      }),
    ).toBeInTheDocument();
  });

  it("executes stop and notification on confirmation", () => {
    useTimerStore.setState((s) => ({
      ...s,
      state: {
        ...s.state,
        completedSessions: 3,
      },
    }));

    const onResetExecuted = vi.fn();
    render(<ResetCycleButton onResetExecuted={onResetExecuted} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset cycle (starts from Session 1)",
      }),
    );
    const confirmBtn = screen.getByRole("button", { name: "Reset cycle" });
    fireEvent.click(confirmBtn);

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(onResetExecuted).toHaveBeenCalledTimes(1);
    expect(mockTrigger).toHaveBeenCalledWith("thud");
    expect(mockNotify).toHaveBeenCalledWith("Cycle reset", {
      duration: 1500,
    });
  });
});
