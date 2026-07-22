import type { Habit, HabitEntry } from "@/lib/types/habit";

export function entry(date: string, value = 1): HabitEntry {
  return {
    id: `e-${date}`,
    habit_id: "h1",
    date,
    value,
    created_at: `${date}T00:00:00.000Z`,
  };
}

export const entries = (dates: string[]): HabitEntry[] =>
  dates.map((d) => entry(d));

const dailyBoolean: Habit = {
  id: "h1",
  user_id: "u1",
  name: "Exercise",
  description: null,
  color: "#ff0000",
  icon: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  archived_at: null,
  start_date: null,
  sort_order: 0,
  habit_type: "boolean",
  frequency_count: 1,
  frequency_period: "day",
};

export const makeHabit = (overrides: Partial<Habit> = {}): Habit => ({
  ...dailyBoolean,
  ...overrides,
});
