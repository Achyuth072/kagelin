import { describe, it, expect } from "vitest";
import {
  getFrequencyProgress,
  frequencyProgressLabel,
} from "@/lib/utils/habit-frequency-progress";
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
    expect(result).toEqual({ completed: 1, target: 1, windowDays: 1 });
  });

  it("0/1 when today is not logged", () => {
    const ref = new Date("2026-06-10T12:00:00.000Z");
    const result = getFrequencyProgress(
      baseHabit,
      [entry("2026-06-09", 1)],
      ref,
    );
    expect(result).toEqual({ completed: 0, target: 1, windowDays: 1 });
  });
});

describe("getFrequencyProgress — sliding window", () => {
  const weekly: Habit = {
    ...baseHabit,
    frequency_count: 3,
    frequency_days: 7,
    frequency_period: "week",
  };

  it("counts completions in the last 7 days, today included", () => {
    const ref = new Date("2026-06-10T12:00:00.000Z");
    const entries = [
      entry("2026-06-10", 1),
      entry("2026-06-04", 1),
      entry("2026-06-03", 1),
    ];
    expect(getFrequencyProgress(weekly, entries, ref)).toEqual({
      completed: 2,
      target: 3,
      windowDays: 7,
    });
  });

  it("does not reset on Monday", () => {
    const ref = new Date("2026-06-08T06:00:00.000Z");
    const result = getFrequencyProgress(weekly, [entry("2026-06-07", 1)], ref);
    expect(result.completed).toBe(1);
  });

  it("uses an arbitrary D (1 in 50)", () => {
    const habit: Habit = {
      ...baseHabit,
      frequency_days: 50,
      frequency_period: null,
    };
    const ref = new Date("2026-06-10T12:00:00.000Z");
    const result = getFrequencyProgress(habit, [entry("2026-04-22", 1)], ref);
    expect(result).toEqual({ completed: 1, target: 1, windowDays: 50 });
    const older = getFrequencyProgress(habit, [entry("2026-04-21", 1)], ref);
    expect(older.completed).toBe(0);
  });

  it("falls back to the period for period-only habits", () => {
    const habit: Habit = {
      ...baseHabit,
      frequency_count: 10,
      frequency_period: "month",
    };
    const ref = new Date("2026-06-15T12:00:00.000Z");
    const result = getFrequencyProgress(habit, [entry("2026-05-20", 1)], ref);
    expect(result).toEqual({ completed: 1, target: 10, windowDays: 30 });
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
    expect(result).toEqual({ completed: 1, target: 1, windowDays: 1 });
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
    const ref = new Date("2026-06-10T12:00:00.000Z");
    const entries = [entry("2026-06-08", 1), entry("2026-06-09", 3)];
    const result = getFrequencyProgress(habit, entries, ref);
    expect(result).toEqual({ completed: 1, target: 7, windowDays: 7 });
  });
});

describe("frequencyProgressLabel", () => {
  it("reads as the last D days", () => {
    expect(
      frequencyProgressLabel({ completed: 2, target: 3, windowDays: 7 }),
    ).toBe("2 of 3 in the last 7 days");
    expect(
      frequencyProgressLabel({ completed: 1, target: 1, windowDays: 1 }),
    ).toBe("1 of 1 today");
  });
});
