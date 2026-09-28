export const HABITS_PATH = "/habits";
export const HABIT_URL_PARAM = "habit";
export const HABIT_ENTRY_UPDATED = "HABIT_ENTRY_UPDATED";

export function habitPath(habitId: string): string {
  return `${HABITS_PATH}?${HABIT_URL_PARAM}=${encodeURIComponent(habitId)}`;
}
