export type TimerMode = "focus" | "shortBreak" | "longBreak";

export type TaskSwitchBehavior =
  "keepRunning" | "pauseOnSwitch" | "resetOnSwitch";

export interface TimerSettings {
  focusDuration: number; // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  sessionsBeforeLongBreak: number;
  autoStartBreak: boolean; // Auto-start break after focus session
  autoStartFocus: boolean; // Auto-start focus after break
  taskSwitchBehavior: TaskSwitchBehavior; // Behavior when switching tasks during active timer
}

export interface TimerState {
  mode: TimerMode;
  isRunning: boolean;
  remainingSeconds: number;
  completedSessions: number;
  activeTaskId: string | null;
  sessionDurationSeconds?: number | null; // Full duration stamped when a session starts; null when idle
  endsAt: number | null; // Absolute server-epoch deadline (ms) while running; null when paused/idle
  sourceDeviceId: string | null; // Device that last explicitly wrote the running state (ownership marker)
  lastSessionDate?: string | null; // Daily cycle reset across midnight rollover
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreak: false,
  autoStartFocus: false,
  taskSwitchBehavior: "keepRunning",
};

export function getDurationForMode(
  mode: TimerMode,
  settings: TimerSettings,
): number {
  switch (mode) {
    case "focus":
      return (
        (settings?.focusDuration ?? DEFAULT_TIMER_SETTINGS.focusDuration) * 60
      );
    case "shortBreak":
      return (
        (settings?.shortBreakDuration ??
          DEFAULT_TIMER_SETTINGS.shortBreakDuration) * 60
      );
    case "longBreak":
      return (
        (settings?.longBreakDuration ??
          DEFAULT_TIMER_SETTINGS.longBreakDuration) * 60
      );
  }
}
