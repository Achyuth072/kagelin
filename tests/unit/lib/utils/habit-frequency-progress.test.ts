import { describe, it, expect } from "vitest";
import { getFrequencyProgress } from "@/lib/utils/habit-frequency-progress";
import type { Habit, HabitEntry } from "@/lib/types/habit";

function entry(date: string, value: number): HabitEntry {
  return {
    id: `e-${date}`,
    habit_id: "h1",
    date,
    value,
    created_at: `${date}T00:00:00.000Z`,
  };
}

const baseHabit: Habit = {
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

describe("getFrequencyProgress — daily habit", () => {
  it("target defaults from frequency_count, window is just today", () => {
    const ref = new Date("2026-06-10T12:00:00.000Z");
    const result = getFrequencyProgress(
      baseHabit,
      [entry("2026-06-10", 1)],
      ref,
    );
    expect(result).toEqual({ completed: 1, target: 1, period: "day" });
  });

  it("0/1 when today is not logged", () => {
    const ref = new Date("2026-06-10T12:00:00.000Z");
    const result = getFrequencyProgress(
      baseHabit,
      [entry("2026-06-09", 1)],
      ref,
    );
    expect(result).toEqual({ completed: 0, target: 1, period: "day" });
  });
});

describe("getFrequencyProgress — weekly habit (Monday-start)", () => {
  const weekly: Habit = {
    ...baseHabit,
    frequency_count: 3,
    frequency_period: "week",
  };

  it("counts completions within the Monday-start week, partial completion", () => {
    // 2026-06-08 is a Monday.
    const ref = new Date("2026-06-10T12:00:00.000Z"); // Wednesday, same week
    const entries = [
      entry("2026-06-08", 1), // Monday — in window
      entry("2026-06-09", 1), // Tuesday — in window
      entry("2026-06-01", 1), // previous week — out of window
    ];
    const result = getFrequencyProgress(weekly, entries, ref);
    expect(result).toEqual({ completed: 2, target: 3, period: "week" });
  });

  it("resets to 0 on Monday (new week)", () => {
    const ref = new Date("2026-06-08T06:00:00.000Z"); // Monday morning
    const entries = [entry("2026-06-07", 1)]; // Sunday (prior week)
    const result = getFrequencyProgress(weekly, entries, ref);
    expect(result).toEqual({ completed: 0, target: 3, period: "week" });
  });
});

describe("getFrequencyProgress — monthly habit", () => {
  const monthly: Habit = {
    ...baseHabit,
    frequency_count: 10,
    frequency_period: "month",
  };

  it("counts completions within the calendar month", () => {
    const ref = new Date("2026-06-15T12:00:00.000Z");
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-14", 1),
      entry("2026-05-31", 1), // previous month — out of window
    ];
    const result = getFrequencyProgress(monthly, entries, ref);
    expect(result).toEqual({ completed: 2, target: 10, period: "month" });
  });
});

describe("getFrequencyProgress — null frequency_count fallback", () => {
  it("falls back to target=1/day when frequency_count is null", () => {
    const habit: Habit = {
      ...baseHabit,
      frequency_count: null,
      frequency_period: null,
    };
    const ref = new Date("2026-06-10T12:00:00.000Z");
    const result = getFrequencyProgress(habit, [entry("2026-06-10", 1)], ref);
    expect(result).toEqual({ completed: 1, target: 1, period: "day" });
  });
});

describe("getFrequencyProgress — measurable at_most habit", () => {
  it("counts a day via the shared dayValue predicate (at_most met)", () => {
    const habit: Habit = {
      ...baseHabit,
      habit_type: "measurable",
      target_type: "at_most",
      target_value: 1,
      frequency_count: 7,
      frequency_period: "week",
    };
    const ref = new Date("2026-06-10T12:00:00.000Z"); // Wednesday, week of 06-08
    const entries = [
      entry("2026-06-08", 1), // meets at_most 1 → counts
      entry("2026-06-09", 3), // exceeds at_most 1 → does not count
    ];
    const result = getFrequencyProgress(habit, entries, ref);
    expect(result).toEqual({ completed: 1, target: 7, period: "week" });
  });
});
