/**
 * Pomodoro Timer Types
 */

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
  endsAt: number | null; // Absolute server-epoch deadline (ms) while running; null when paused/idle
  sourceDeviceId: string | null; // Device that last explicitly wrote the running state (ownership marker)
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
