import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useTimerStore } from "@/lib/store/timerStore";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";
import { setServerOffset } from "@/lib/store/serverClock";
import { getDeviceId } from "@/lib/store/deviceId";

/**
 * Deadline-model timer store (TIMER-01).
 *
 * Running state is anchored on an absolute `endsAt` (server epoch ms), not a
 * `startedAt` + full-duration assumption. serverNow() == Date.now() here
 * (offset 0 + fake system time), so deadlines are exact and deterministic.
 */
const NOW = 1_700_000_000_000;

function resetStore() {
  useTimerStore.setState({
    state: {
      mode: "focus",
      isRunning: false,
      remainingSeconds: DEFAULT_TIMER_SETTINGS.focusDuration * 60,
      completedSessions: 0,
      activeTaskId: null,
      endsAt: null,
      sourceDeviceId: null,
    },
    settings: DEFAULT_TIMER_SETTINGS,
    isLoaded: true,
  });
}

describe("timerStore deadline model", () => {
  beforeEach(() => {
    localStorage.clear();
    setServerOffset(0);
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    resetStore();
  });

  afterEach(() => {
    setServerOffset(0);
    vi.useRealTimers();
  });

  describe("start / resume", () => {
    it("start sets endsAt = serverNow() + remainingSeconds*1000 and stamps owner", () => {
      useTimerStore.getState().start("task-1");

      const { state } = useTimerStore.getState();
      expect(state.isRunning).toBe(true);
      expect(state.activeTaskId).toBe("task-1");
      expect(state.endsAt).toBe(NOW + 1500 * 1000);
      expect(state.sourceDeviceId).toBe(getDeviceId());
    });

    it("resume from a partial pause anchors endsAt to the remaining time, not the full duration", () => {
      // Given: a paused timer with only 600s left (resume bug: must NOT inflate to 1500)
      useTimerStore.setState((s) => ({
        state: {
          ...s.state,
          isRunning: false,
          remainingSeconds: 600,
          endsAt: null,
        },
      }));

      useTimerStore.getState().start();

      expect(useTimerStore.getState().state.endsAt).toBe(NOW + 600 * 1000);
    });
  });

  describe("pause / tick / reconcile derive remaining from the deadline", () => {
    it("pause computes remainingSeconds from endsAt and clears it", () => {
      useTimerStore.getState().start();
      vi.setSystemTime(NOW + 100_000); // 100s elapsed

      useTimerStore.getState().pause();

      const { state } = useTimerStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.remainingSeconds).toBe(1400);
      expect(state.endsAt).toBeNull();
    });

    it("tick recomputes remaining from the deadline (drift-proof, not a -1 decrement)", () => {
      useTimerStore.getState().start();
      vi.setSystemTime(NOW + 100_000); // jump 100s (e.g. throttled background tab)

      useTimerStore.getState().tick();

      expect(useTimerStore.getState().state.remainingSeconds).toBe(1400);
    });

    it("reconcile recomputes remaining from the deadline", () => {
      useTimerStore.getState().start();
      vi.setSystemTime(NOW + 250_000);

      useTimerStore.getState().reconcile();

      expect(useTimerStore.getState().state.remainingSeconds).toBe(1250);
    });
  });

  describe("completion (foregrounded device)", () => {
    it("a foregrounded device reaching the deadline completes: mode flips, completedSessions++", () => {
      // jsdom defaults document.visibilityState to "visible" (foreground).
      useTimerStore.getState().start();
      vi.setSystemTime(NOW + 1500_000 + 1); // past endsAt

      useTimerStore.getState().reconcile();

      const { state } = useTimerStore.getState();
      expect(state.mode).toBe("shortBreak");
      expect(state.completedSessions).toBe(1);
    });

    it("auto-started next session anchors a fresh endsAt and re-stamps the device", () => {
      useTimerStore.setState({
        settings: { ...DEFAULT_TIMER_SETTINGS, autoStartBreak: true },
      });
      useTimerStore.getState().start();
      vi.setSystemTime(NOW + 1500_000 + 1);

      useTimerStore.getState().reconcile();

      const { state } = useTimerStore.getState();
      expect(state.isRunning).toBe(true);
      expect(state.endsAt).toBe(serverNowNoFns() + 300 * 1000);
      expect(state.sourceDeviceId).toBe(getDeviceId());
    });

    it("a backgrounded device reaching the deadline clamps to 00:00 and never completes", () => {
      const visSpy = vi
        .spyOn(document, "visibilityState", "get")
        .mockReturnValue("hidden");
      try {
        useTimerStore.setState((s) => ({
          state: {
            ...s.state,
            isRunning: true,
            mode: "focus",
            remainingSeconds: 10,
            completedSessions: 2,
            endsAt: NOW + 10_000,
            sourceDeviceId: "some-other-device",
          },
        }));
        vi.setSystemTime(NOW + 20_000); // past endsAt

        useTimerStore.getState().reconcile();

        const { state } = useTimerStore.getState();
        expect(state.remainingSeconds).toBe(0);
        expect(state.mode).toBe("focus"); // no flip
        expect(state.completedSessions).toBe(2); // no increment
        expect(state.isRunning).toBe(true); // still mirroring, waiting to return
      } finally {
        visSpy.mockRestore();
      }
    });

    it("intent flag: consumeFocusStart returns true once after a request, then false", () => {
      expect(useTimerStore.getState().consumeFocusStart()).toBe(false);

      useTimerStore.getState().requestFocusStart();
      expect(useTimerStore.getState().consumeFocusStart()).toBe(true);
      expect(useTimerStore.getState().consumeFocusStart()).toBe(false);
    });

    it("deploy transient (isRunning && endsAt==null) keeps remaining and never completes", () => {
      useTimerStore.setState((s) => ({
        state: {
          ...s.state,
          isRunning: true,
          mode: "focus",
          remainingSeconds: 42,
          endsAt: null,
          sourceDeviceId: null,
        },
      }));
      vi.setSystemTime(NOW + 999_000);

      useTimerStore.getState().reconcile();

      const { state } = useTimerStore.getState();
      expect(state.remainingSeconds).toBe(42);
      expect(state.mode).toBe("focus");
    });
  });
});

// serverNow() with fake timers active equals the current fake system time.
function serverNowNoFns(): number {
  return Date.now();
}
