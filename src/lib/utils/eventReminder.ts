export interface ReminderOption {
  value: number;
  label: string;
}

const ONE_DAY_MINUTES = 1440;

export const TIMED_REMINDER_OPTIONS: ReminderOption[] = [
  { value: 0, label: "At start" },
  { value: 5, label: "5 minutes before" },
  { value: 10, label: "10 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: ONE_DAY_MINUTES, label: "1 day before" },
];

// The event_reminder trigger treats all-day values >= 1440 as the day before.
export const ALL_DAY_REMINDER_OPTIONS: ReminderOption[] = [
  { value: 0, label: "On the day (9:00 AM)" },
  { value: ONE_DAY_MINUTES, label: "Day before (9:00 AM)" },
];

export function reminderOptions(allDay: boolean): ReminderOption[] {
  return allDay ? ALL_DAY_REMINDER_OPTIONS : TIMED_REMINDER_OPTIONS;
}

export function snapAllDayReminder(
  allDay: boolean,
  minutes: number | null,
): number | null {
  if (minutes === null || !allDay) return minutes;
  return minutes >= ONE_DAY_MINUTES ? ONE_DAY_MINUTES : 0;
}
