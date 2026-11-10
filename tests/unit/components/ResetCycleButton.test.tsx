import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResetCycleButton } from "@/components/ResetCycleButton";
import { useTimerStore } from "@/lib/store/timerStore";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";

const mockStop = vi.fn();
vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({ stop: mockStop }),
}));

const mockTrigger = vi.fn();
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: mockTrigger }),
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

  it("calls stop directly when no progress has been made", () => {
    const onStopExecuted = vi.fn();
    render(<ResetCycleButton onStopExecuted={onStopExecuted} />);

    const button = screen.getByRole("button", {
      name: "Reset timer and cycle",
    });
    fireEvent.click(button);

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(onStopExecuted).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText("Reset timer and cycle?"),
    ).not.toBeInTheDocument();
  });

  it("opens confirmation dialog when timer has progress", () => {
    useTimerStore.setState((s) => ({
      ...s,
      state: {
        ...s.state,
        completedSessions: 2,
      },
    }));

    render(<ResetCycleButton />);

    const button = screen.getByRole("button", {
      name: "Reset timer and cycle",
    });
    fireEvent.click(button);

    expect(screen.getByText("Reset timer and cycle?")).toBeInTheDocument();
    expect(mockStop).not.toHaveBeenCalled();

    const cancelBtn = screen.getByRole("button", { name: "Keep progress" });
    fireEvent.click(cancelBtn);

    expect(mockStop).not.toHaveBeenCalled();
  });

  it("executes stop on confirmation", () => {
    useTimerStore.setState((s) => ({
      ...s,
      state: {
        ...s.state,
        isRunning: true,
        remainingSeconds: 20 * 60,
      },
    }));

    const onStopExecuted = vi.fn();
    render(<ResetCycleButton onStopExecuted={onStopExecuted} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Reset timer and cycle" }),
    );
    const confirmBtn = screen.getByRole("button", { name: "Reset cycle" });
    fireEvent.click(confirmBtn);

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(onStopExecuted).toHaveBeenCalledTimes(1);
  });
});
