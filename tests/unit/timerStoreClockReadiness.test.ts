import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useTimerStore } from "@/lib/store/timerStore";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";
import { setServerOffset } from "@/lib/store/serverClock";

/**
 * Regression: after a reload the server-clock offset resets to 0, so on a device
 * whose wall clock runs ahead of server time the persisted deadline can read as
 * already past. reconcile() must NOT complete the timer until the offset has been
 * probed — otherwise a skewed clock fires a spurious early completion (logs the
 * session, plays sound, advances the session) before the real clock is known.
 *
 * This file deliberately never calls setServerOffset before the first test, so
 * the module-level "clock ready" flag starts false (Vitest isolates module state
 * per test file).
 */

describe("useTimerStore — completion gated on server-clock readiness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does NOT complete on a past deadline while the clock is unprobed", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    useTimerStore.setState({
      state: {
        mode: "focus",
        isRunning: true,
        remainingSeconds: 5,
        completedSessions: 0,
        activeTaskId: "task-1",
        endsAt: Date.now() - 1000, // deadline already passed per local clock
        sourceDeviceId: null,
      },
      settings: DEFAULT_TIMER_SETTINGS,
      isLoaded: true,
    });

    useTimerStore.getState().reconcile();

    const state = useTimerStore.getState().state;
    expect(state.mode).toBe("focus"); // not advanced
    expect(state.completedSessions).toBe(0);
    expect(state.isRunning).toBe(true); // still running, deferred
    const completeCalls = dispatchSpy.mock.calls.filter(
      ([e]) => e instanceof CustomEvent && e.type === "timer-complete",
    );
    expect(completeCalls).toHaveLength(0);
    dispatchSpy.mockRestore();
  });

  it("completes once the clock is probed and the deadline is past", () => {
    setServerOffset(0); // probe lands — clock now trusted
    useTimerStore.setState({
      state: {
        mode: "focus",
        isRunning: true,
        remainingSeconds: 5,
        completedSessions: 0,
        activeTaskId: "task-1",
        endsAt: Date.now() - 1000,
        sourceDeviceId: null,
      },
      settings: DEFAULT_TIMER_SETTINGS,
      isLoaded: true,
    });

    useTimerStore.getState().reconcile();

    const state = useTimerStore.getState().state;
    expect(state.mode).toBe("shortBreak");
    expect(state.completedSessions).toBe(1);
  });
});
