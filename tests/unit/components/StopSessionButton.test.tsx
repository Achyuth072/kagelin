import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { StopSessionButton } from "@/components/StopSessionButton";
import { useTimerStore } from "@/lib/store/timerStore";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";

const { mockCancel, mockTrigger, mockNotify } = vi.hoisted(() => ({
  mockCancel: vi.fn(),
  mockTrigger: vi.fn(),
  mockNotify: vi.fn(),
}));

vi.mock("@/components/TimerProvider", () => ({
  useTimerActions: () => ({ cancel: mockCancel }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: mockTrigger }),
}));

vi.mock("@/lib/notify", () => ({
  notify: mockNotify,
}));

describe("StopSessionButton", () => {
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

  it("is disabled when timer is idle", () => {
    render(<StopSessionButton />);

    const button = screen.getByRole("button", { name: "Stop session" });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("is enabled and calls cancel() when timer is running", () => {
    useTimerStore.setState((s) => ({
      ...s,
      state: {
        ...s.state,
        isRunning: true,
        remainingSeconds: 20 * 60,
      },
    }));

    const onStopExecuted = vi.fn();
    render(<StopSessionButton onStopExecuted={onStopExecuted} />);

    const button = screen.getByRole("button", { name: "Stop session" });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(onStopExecuted).toHaveBeenCalledTimes(1);
    expect(mockTrigger).toHaveBeenCalledWith("thud");
    expect(mockNotify).toHaveBeenCalledWith("Session stopped", {
      duration: 1500,
    });
  });

  it("is enabled when paused mid-session and stops safely without dialog", () => {
    useTimerStore.setState((s) => ({
      ...s,
      state: {
        ...s.state,
        isRunning: false,
        remainingSeconds: 12 * 60,
        completedSessions: 2,
      },
    }));

    render(<StopSessionButton />);

    const button = screen.getByRole("button", { name: "Stop session" });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
