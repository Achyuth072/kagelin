import { describe, it, expect } from "vitest";
import {
  getCurrentStreak,
  getBestStreaks,
  getTotalCompletions,
} from "@/lib/utils/habit-streak";
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

describe("getCurrentStreak", () => {
  // Thursday, 2026-06-11
  const today = new Date("2026-06-11T10:00:00");

  it("counts an unbroken run ending today", () => {
    const entries = [
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
      entry("2026-06-11", 1),
    ];
    expect(getCurrentStreak(dailyBoolean, entries, today)).toBe(3);
  });

  it("treats an unlogged today as pending, not a break", () => {
    // 30-day-style run through yesterday, today not yet logged.
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    expect(getCurrentStreak(dailyBoolean, entries, today)).toBe(3);
  });

  it("breaks when a day that already passed was missed", () => {
    // yesterday (2026-06-10) missing -> streak broke, today still pending
    const entries = [entry("2026-06-08", 1), entry("2026-06-09", 1)];
    expect(getCurrentStreak(dailyBoolean, entries, today)).toBe(0);
  });

  it("counts today alone", () => {
    expect(
      getCurrentStreak(dailyBoolean, [entry("2026-06-11", 1)], today),
    ).toBe(1);
  });

  it("ignores value:0 entries", () => {
    const entries = [entry("2026-06-10", 1), entry("2026-06-11", 0)];
    expect(getCurrentStreak(dailyBoolean, entries, today)).toBe(1);
  });

  it("returns 0 with no entries", () => {
    expect(getCurrentStreak(dailyBoolean, [], today)).toBe(0);
  });
});

const threePerWeek: Habit = {
  ...dailyBoolean,
  frequency_count: 3,
  frequency_period: "week",
};

describe("getCurrentStreak — 3×/week (frequency-aware)", () => {
  const today = new Date("2026-06-11T10:00:00");

  it("counts a flawless 3×/week run as one continuous streak", () => {
    // 3 reps per week, perfectly spaced: June 1,3,5,8,10 → interpolated as June 1-11
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-03", 1),
      entry("2026-06-05", 1),
      entry("2026-06-08", 1),
      entry("2026-06-10", 1),
    ];
    expect(getCurrentStreak(threePerWeek, entries, today)).toBe(11); // June 1-11
  });

  it("breaks when a gap exceeds the schedule", () => {
    // Last reps: June 1,3,5 (interval June 1-7), then nothing until June 10
    // June 8,9 are off-days that break the streak since they're past & not interpolated
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-03", 1),
      entry("2026-06-05", 1),
    ];
    // Interpolated set: June 1-7. Streak walks back from today (June 11).
    // June 11 not in set → pending → start from June 10.
    // June 10,9,8 not in set → streak = 0
    expect(getCurrentStreak(threePerWeek, entries, today)).toBe(0);
  });
});

describe("getBestStreaks", () => {
  const today = new Date("2026-06-11T10:00:00");

  it("returns top N streak lengths for daily boolean", () => {
    // Two separate runs: June 1-3 (3 days) and June 8-10 (3 days)
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-02", 1),
      entry("2026-06-03", 1),
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    const best = getBestStreaks(dailyBoolean, entries, 5, today);
    expect(best).toEqual([3, 3]);
  });

  it("returns empty array with no entries", () => {
    expect(getBestStreaks(dailyBoolean, [], 5, today)).toEqual([]);
  });

  it("returns streaks over interpolated days for 3×/week", () => {
    // Flawless 3×/week: June 1,3,5,8,10 → interpolated June 1-11 → one 11-day streak
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-03", 1),
      entry("2026-06-05", 1),
      entry("2026-06-08", 1),
      entry("2026-06-10", 1),
    ];
    const best = getBestStreaks(threePerWeek, entries, 5, today);
    expect(best).toEqual([11]);
  });
});

describe("getTotalCompletions", () => {
  const today = new Date("2026-06-11T10:00:00");

  it("counts interpolated done-days for boolean", () => {
    // Daily boolean: raw count
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-02", 1),
      entry("2026-06-03", 0),
    ];
    expect(getTotalCompletions(dailyBoolean, entries, today)).toBe(2);
  });

  it("counts target-meeting days for measurable at_least", () => {
    const atLeast: Habit = {
      ...dailyBoolean,
      habit_type: "measurable",
      target_type: "at_least",
      target_value: 10,
    };
    const entries = [
      entry("2026-06-01", 10), // meets target
      entry("2026-06-02", 5), // below target
      entry("2026-06-03", 15), // exceeds target
    ];
    expect(getTotalCompletions(atLeast, entries, today)).toBe(2);
  });

  it("counts target-meeting days for measurable at_most", () => {
    const atMost: Habit = {
      ...dailyBoolean,
      habit_type: "measurable",
      target_type: "at_most",
      target_value: 10,
    };
    const entries = [
      entry("2026-06-01", 5), // below target ✓
      entry("2026-06-02", 10), // at target ✓
      entry("2026-06-03", 15), // above target ✗
    ];
    expect(getTotalCompletions(atMost, entries, today)).toBe(2);
  });
});
