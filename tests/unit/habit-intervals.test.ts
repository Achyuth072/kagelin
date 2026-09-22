import { describe, it, expect } from "vitest";
import {
  interpolateDoneDays,
  snapIntervalsTogether,
} from "@/lib/utils/habit-intervals";
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

const today = new Date("2026-06-11T12:00:00");

const threePerWeek: Habit = {
  ...dailyBoolean,
  frequency_count: 3,
  frequency_period: "week",
};

describe("interpolateDoneDays — daily boolean (identity)", () => {
  it("returns raw done-days for daily habit (no interpolation)", () => {
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    const result = interpolateDoneDays(dailyBoolean, entries, today);
    expect(result).toEqual(new Set(["2026-06-08", "2026-06-09", "2026-06-10"]));
  });

  it("excludes value:0 entries", () => {
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 0),
      entry("2026-06-10", 1),
    ];
    const result = interpolateDoneDays(dailyBoolean, entries, today);
    expect(result).toEqual(new Set(["2026-06-08", "2026-06-10"]));
  });

  it("returns empty set with no entries", () => {
    const result = interpolateDoneDays(dailyBoolean, [], today);
    expect(result.size).toBe(0);
  });
});

describe("interpolateDoneDays — 3×/week flawless", () => {
  it("merges overlapping intervals into one continuous run", () => {
    // Reps: June 1, 3, 5, 8, 10 (5 reps, 3×/week schedule)
    // Windows: [1,3,5]→interval June 1-7, [3,5,8]→interval June 3-9,
    // [5,8,10]→interval June 5-11
    // All overlap → snapped to single interval June 1-11
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-03", 1),
      entry("2026-06-05", 1),
      entry("2026-06-08", 1),
      entry("2026-06-10", 1),
    ];
    const result = interpolateDoneDays(threePerWeek, entries, today);
    // With backward sliding (uhabits snapIntervalsTogether), intervals slide back
    // to fill days before the first rep: June 1, 3, 5 slides back to May 30
    expect(result.has("2026-05-30")).toBe(true); // backward slid
    expect(result.has("2026-05-31")).toBe(true); // backward slid
    expect(result.has("2026-06-01")).toBe(true);
    expect(result.has("2026-06-02")).toBe(true); // interpolated
    expect(result.has("2026-06-04")).toBe(true); // interpolated
    expect(result.has("2026-06-06")).toBe(true); // interpolated
    expect(result.has("2026-06-07")).toBe(true); // interpolated
    expect(result.has("2026-06-09")).toBe(true); // interpolated
    expect(result.has("2026-06-11")).toBe(true); // clamped to today
    expect(result.size).toBe(13); // May 30 - June 11
  });

  it("clamps intervals to today", () => {
    // Reps extend past today (June 11) — intervals should not go beyond today
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-03", 1),
      entry("2026-06-05", 1),
    ];
    const result = interpolateDoneDays(threePerWeek, entries, today);
    // Interval: June 1 → June 7 (7 days from June 1), clamped to today (June 11)
    // So June 1-7 should be in the set
    expect(result.has("2026-06-01")).toBe(true);
    expect(result.has("2026-06-07")).toBe(true);
    expect(result.has("2026-06-08")).toBe(false);
    expect(result.has("2026-06-12")).toBe(false); // past today
  });

  it("does not merge non-overlapping intervals (gapped schedule)", () => {
    // Two separate clusters: June 1-3-5 and June 15-17-19, gap between them
    const laterToday = new Date("2026-06-25T12:00:00");
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-03", 1),
      entry("2026-06-05", 1),
      entry("2026-06-15", 1),
      entry("2026-06-17", 1),
      entry("2026-06-19", 1),
    ];
    const result = interpolateDoneDays(threePerWeek, entries, laterToday);
    // Interval 1: June 1-7 (from first window)
    expect(result.has("2026-06-01")).toBe(true);
    expect(result.has("2026-06-07")).toBe(true);
    // Gap: June 8-14 NOT included
    expect(result.has("2026-06-08")).toBe(false);
    expect(result.has("2026-06-14")).toBe(false);
    // Interval 2: June 15-21 (from second window)
    expect(result.has("2026-06-15")).toBe(true);
    expect(result.has("2026-06-21")).toBe(true);
  });
});

describe("snapIntervalsTogether — backward sliding logic", () => {
  it("slides intervals backward when they overlap or touch to eliminate gaps", () => {
    // Two intervals in newest-first order:
    // next (newer): [2026-06-05, center 2026-06-10, end 2026-06-11]
    // curr (older): [2026-06-03, center 2026-06-08, end 2026-06-09]
    // gapNextToCurrent = 2026-06-09 - 2026-06-05 = 4 days
    // gapCenterToEnd = 2026-06-09 - 2026-06-08 = 1 day
    // s = min(1, 4 + 1) = 1 day
    // curr slides back by 1 day: [2026-06-02, 2026-06-08]
    const intervals = [
      { begin: "2026-06-05", center: "2026-06-10", end: "2026-06-11" },
      { begin: "2026-06-03", center: "2026-06-08", end: "2026-06-09" },
    ];
    snapIntervalsTogether(intervals);
    expect(intervals[1]).toEqual({
      begin: "2026-06-02",
      center: "2026-06-08",
      end: "2026-06-08",
    });
  });

  it("does not slide when there is a strict positive gap between intervals", () => {
    // next: begin 2026-06-15, center 2026-06-19, end 2026-06-21
    // curr: begin 2026-06-01, center 2026-06-05, end 2026-06-07
    // gapNextToCurrent = 2026-06-07 - 2026-06-15 = -8 (< 0) -> no slide
    const intervals = [
      { begin: "2026-06-15", center: "2026-06-19", end: "2026-06-21" },
      { begin: "2026-06-01", center: "2026-06-05", end: "2026-06-07" },
    ];
    snapIntervalsTogether(intervals);
    expect(intervals[1]).toEqual({
      begin: "2026-06-01",
      center: "2026-06-05",
      end: "2026-06-07",
    });
  });
});
