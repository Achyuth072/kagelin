"use client";

import React, { createContext, useContext, ReactNode, useMemo } from "react";
import { useFocusTimer } from "@/lib/hooks/useFocusTimer";
import type { TimerState, TimerSettings } from "@/lib/types/timer";

interface TimerContextValue {
  // We keep the state here for legacy support, but it should be used sparingly
  // for high-frequency updates (use useTimerStore instead)
  state: TimerState;
  settings: TimerSettings;
  isLoaded: boolean;
  start: (taskId?: string) => void;
  pause: () => void;
  stop: () => void;
  cancel: () => void;
  skip: () => void;
  updateSettings: (newSettings: Partial<TimerSettings>) => void;
}

// Wraps the raw timerStore actions with DB sync (#70) — call these, not
// useTimerStore((s) => s.pause) etc. Excludes `start`, which closes over
// per-tick state and so can't be made referentially stable.
interface TimerActionsContextValue {
  pause: () => void;
  stop: () => void;
  cancel: () => void;
  skip: () => void;
  updateSettings: (newSettings: Partial<TimerSettings>) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);
const TimerActionsContext = createContext<TimerActionsContextValue | null>(
  null,
);

/**
 * TimerProvider now acts as the side-effect manager and provides stable actions.
 * Components that need the 'remainingSeconds' should use useTimerStore(s => s.state.remainingSeconds)
 * to avoid re-rendering the whole tree.
 */
export function TimerProvider({ children }: { children: ReactNode }) {
  // This hook handles intervals and side-effects centrally
  const timer = useFocusTimer();

  // `timer.state` changes every second, so `value` below churns on every tick.
  // Memoizing `actions` separately keeps it stable for useTimerActions()
  // callers who don't need to re-render on tick.
  const actions = useMemo(
    () => ({
      pause: timer.pause,
      stop: timer.stop,
      cancel: timer.cancel,
      skip: timer.skip,
      updateSettings: timer.updateSettings,
    }),
    [timer.pause, timer.stop, timer.cancel, timer.skip, timer.updateSettings],
  );

  const value = useMemo(
    () => ({
      state: timer.state,
      settings: timer.settings,
      isLoaded: timer.isLoaded,
      start: timer.start,
      ...actions,
    }),
    [timer.state, timer.settings, timer.isLoaded, timer.start, actions],
  );

  return (
    <TimerActionsContext.Provider value={actions}>
      <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
    </TimerActionsContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
}

/** See TimerActionsContextValue for why this exists instead of useTimer(). */
export function useTimerActions() {
  const context = useContext(TimerActionsContext);
  if (!context) {
    throw new Error("useTimerActions must be used within a TimerProvider");
  }
  return context;
}
