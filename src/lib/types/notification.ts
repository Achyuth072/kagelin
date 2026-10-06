export const REMINDER_TYPES = [
  "due_date",
  "do_date",
  "event_reminder",
] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];
