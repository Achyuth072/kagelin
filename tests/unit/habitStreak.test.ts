import { describe, it, expect } from "vitest";
import {
  getCurrentStreak,
  getBestStreaks,
  getTotalCompletions,
} from "@/lib/utils/habit-streak";
import type { Habit } from "@/lib/types/habit";
import { entry, makeHabit } from "./support/habitFixtures";

const dailyBoolean = makeHabit();

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

const threePerWeek = makeHabit({
  frequency_count: 3,
  frequency_period: "week",
});

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

  it("stays live through a pending period, then lapses", () => {
    // Run ends 4 days ago, still within the 7-day pending window.
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-03", 1),
      entry("2026-06-05", 1),
    ];
    expect(getCurrentStreak(threePerWeek, entries, today)).toBe(7);
  });

  it("keeps the one-day window for measurable habits (no interpolation)", () => {
    // No interpolation, so a 7-day window would credit unlogged days.
    const measurableWeekly: Habit = {
      ...threePerWeek,
      habit_type: "measurable",
      target_type: "at_least",
      target_value: 3,
    };
    expect(
      getCurrentStreak(measurableWeekly, [entry("2026-06-06", 5)], today),
    ).toBe(0);
  });

  it("lapses to 0 once a full period passes with no credited day", () => {
    // 8 days past the run's end — beyond the 7-day window.
    const lateToday = new Date("2026-06-15T10:00:00");
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-03", 1),
      entry("2026-06-05", 1),
    ];
    expect(getCurrentStreak(threePerWeek, entries, lateToday)).toBe(0);
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

  it("counts logged done-days for boolean", () => {
    // Daily boolean: raw count
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-02", 1),
      entry("2026-06-03", 0),
    ];
    expect(getTotalCompletions(dailyBoolean, entries, today)).toBe(2);
  });

  it("counts only logged completions for frequency-aware habits, not interpolated days", () => {
    // Flawless 3×/week: June 1,3,5,8,10 interpolate to a ~11-day streak, but
    // Total Completions must report the 5 real check-ins (CONTEXT.md: counts
    // only days with a logged Entry that meets target).
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-03", 1),
      entry("2026-06-05", 1),
      entry("2026-06-08", 1),
      entry("2026-06-10", 1),
    ];
    expect(getTotalCompletions(threePerWeek, entries, today)).toBe(5);
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
