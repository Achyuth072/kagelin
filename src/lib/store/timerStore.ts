"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TimerMode, TimerState, TimerSettings } from "@/lib/types/timer";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";
import { serverNow, isServerClockReady } from "@/lib/store/serverClock";
import { getDeviceId } from "@/lib/store/deviceId";

interface TimerStore {
  state: TimerState;
  settings: TimerSettings;
  isLoaded: boolean;
  // Transient intent: set by an explicit "play focus" tap, consumed once by the
  // focus page on mount. Keeps mere navigation to /focus from starting a timer.
  pendingFocusStart: boolean;

  // Actions
  setLoaded: (loaded: boolean) => void;
  requestFocusStart: () => void;
  consumeFocusStart: () => boolean;
  start: (taskId?: string) => void;
  pause: () => void;
  stop: () => void;
  cancel: () => void;
  setActiveTaskId: (taskId: string | null) => void;
  skip: () => void;
  tick: () => void;
  updateSettings: (newSettings: Partial<TimerSettings>) => void;
  reconcile: () => void;

  // Internal/Transition logic
  completeTimer: (options?: { skipLog?: boolean }) => void;
}

function getDurationForMode(mode: TimerMode, settings: TimerSettings): number {
  switch (mode) {
    case "focus":
      return settings.focusDuration * 60;
    case "shortBreak":
      return settings.shortBreakDuration * 60;
    case "longBreak":
      return settings.longBreakDuration * 60;
  }
}

// Helper to get initial state
const getInitialState = (settings: TimerSettings): TimerState => ({
  mode: "focus",
  isRunning: false,
  remainingSeconds: settings.focusDuration * 60,
  completedSessions: 0,
  activeTaskId: null,
  endsAt: null,
  sourceDeviceId: null,
});

// remainingSeconds left until an absolute deadline, clamped at 0.
function secondsUntil(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - serverNow()) / 1000));
}

// The device the user is actively looking at finishes the session; a
// backgrounded or closed device clamps to 00:00 and mirrors the result. When
// several foregrounded devices hit the deadline at once, an atomic DB claim in
// the sync layer elects a single winner (so only one logs/sounds/advances).
function isForeground(): boolean {
  return (
    typeof document === "undefined" || document.visibilityState === "visible"
  );
}

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      state: getInitialState(DEFAULT_TIMER_SETTINGS),
      settings: DEFAULT_TIMER_SETTINGS,
      isLoaded: false,
      pendingFocusStart: false,

      setLoaded: (loaded) => set({ isLoaded: loaded }),

      requestFocusStart: () => set({ pendingFocusStart: true }),

      consumeFocusStart: () => {
        const had = get().pendingFocusStart;
        if (had) set({ pendingFocusStart: false });
        return had;
      },

      start: (taskId) => {
        const { state } = get();
        const targetTaskId = taskId ?? state.activeTaskId;

        set((s) => ({
          state: {
            ...s.state,
            isRunning: true,
            activeTaskId: targetTaskId,
            // Anchor the deadline to the time that remains — resuming a partial
            // session must not inflate back toward the full duration.
            endsAt: serverNow() + s.state.remainingSeconds * 1000,
            sourceDeviceId: getDeviceId(),
          },
        }));
      },

      pause: () => {
        set((s) => ({
          state: {
            ...s.state,
            isRunning: false,
            remainingSeconds: s.state.endsAt
              ? secondsUntil(s.state.endsAt)
              : s.state.remainingSeconds,
            endsAt: null,
            sourceDeviceId: getDeviceId(),
          },
        }));
      },

      stop: () => {
        const { settings } = get();
        set({
          state: {
            ...getInitialState(settings),
            sourceDeviceId: getDeviceId(),
          },
        });
      },

      cancel: () => {
        const { settings, state } = get();
        const rolledBack =
          state.mode === "focus"
            ? state.completedSessions
            : Math.max(0, state.completedSessions - 1);
        set({
          state: {
            ...getInitialState(settings),
            completedSessions: rolledBack,
            sourceDeviceId: getDeviceId(),
          },
        });
      },

      setActiveTaskId: (taskId: string | null) => {
        set((s) => ({
          state: {
            ...s.state,
            activeTaskId: taskId,
          },
        }));
      },

      skip: () => {
        get().completeTimer({ skipLog: true });
      },

      tick: () => {
        get().reconcile();
      },

      updateSettings: (newSettings) => {
        set((s) => {
          const merged = { ...s.settings, ...newSettings };
          const newState = { ...s.state };

          // If timer is idle, sync the displayed time to new duration
          if (!s.state.isRunning) {
            newState.remainingSeconds = getDurationForMode(
              s.state.mode,
              merged,
            );
          }

          return {
            settings: merged,
            state: newState,
          };
        });
      },

      reconcile: () => {
        const { state } = get();
        if (!state.isRunning) return;

        // Deploy-boundary transient: a running row whose endsAt hasn't been
        // populated yet — trust remaining_seconds, never complete. The owner's
        // next write populates endsAt.
        if (state.endsAt === null) return;

        // Never complete on an unprobed clock: after a reload the server offset
        // resets to 0, so a skewed wall clock could read past the deadline and
        // fire a spurious early completion before the offset is re-established.
        // Clamp the display to 00:00 and defer — the next tick after the probe
        // lands re-evaluates against the real clock.
        if (!isServerClockReady()) {
          set((s) => ({
            state: {
              ...s.state,
              remainingSeconds: secondsUntil(state.endsAt!),
            },
          }));
          return;
        }

        const remaining = secondsUntil(state.endsAt);
        if (remaining <= 0) {
          // The foregrounded device completes; backgrounded/closed devices clamp
          // to 00:00 and mirror the synced transition when they return.
          if (isForeground()) {
            get().completeTimer();
          } else {
            set((s) => ({ state: { ...s.state, remainingSeconds: 0 } }));
          }
          return;
        }

        set((s) => ({ state: { ...s.state, remainingSeconds: remaining } }));
      },

      completeTimer: (options) => {
        const { state, settings } = get();

        // Calculate next state
        let nextMode: TimerMode = state.mode;
        let newCompletedSessions = state.completedSessions;
        let nextIsRunning = false;

        if (state.mode === "focus") {
          newCompletedSessions = state.completedSessions + 1;
          const isLongBreakTime =
            newCompletedSessions >= settings.sessionsBeforeLongBreak;
          nextMode = isLongBreakTime ? "longBreak" : "shortBreak";
          nextIsRunning = settings.autoStartBreak;
        } else {
          nextMode = "focus";
          nextIsRunning = settings.autoStartFocus;
          newCompletedSessions =
            state.mode === "longBreak" ? 0 : state.completedSessions;
        }

        const nextDuration = getDurationForMode(nextMode, settings);
        const nextState: TimerState = {
          ...state,
          mode: nextMode,
          isRunning: nextIsRunning,
          remainingSeconds: nextDuration,
          completedSessions: newCompletedSessions,
          // The completing owner writes the next deadline and re-stamps itself.
          endsAt: nextIsRunning ? serverNow() + nextDuration * 1000 : null,
          sourceDeviceId: getDeviceId(),
        };

        set({ state: nextState });

        // Trigger side effects via event or just let the hook handle it
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("timer-complete", {
              detail: {
                prevState: state,
                nextState,
                options,
              },
            }),
          );
        }
      },
    }),
    {
      name: "kanso-timer-storage",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // v0 persisted `startedAt` (the removed full-duration anchor). Drop it and
      // reconstruct an absolute `endsAt` from the surviving remainingSeconds so a
      // running timer keeps counting down across the deadline-model upgrade.
      migrate: (persisted, version) => {
        const next = persisted as { state?: Partial<TimerState> };
        if (version < 1 && next?.state) {
          const s = next.state as Partial<TimerState> & { startedAt?: unknown };
          delete s.startedAt;
          s.sourceDeviceId = null;
          s.endsAt =
            s.isRunning && typeof s.remainingSeconds === "number"
              ? serverNow() + s.remainingSeconds * 1000
              : null;
        }
        return next as { state: TimerState; settings: TimerSettings };
      },
      partialize: (s) => ({
        state: s.state,
        settings: s.settings,
      }),
    },
  ),
);
