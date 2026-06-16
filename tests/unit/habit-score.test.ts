import { describe, it, expect } from "vitest";
import {
  periodDays,
  dayValue,
  computeScores,
  currentScore,
} from "@/lib/utils/habit-score";
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

describe("periodDays", () => {
  it("returns 1 for day", () => {
    expect(periodDays("day")).toBe(1);
  });

  it("returns 7 for week", () => {
    expect(periodDays("week")).toBe(7);
  });

  it("returns 30 for month", () => {
    expect(periodDays("month")).toBe(30);
  });

  it("returns 1 for null (default daily)", () => {
    expect(periodDays(null)).toBe(1);
  });
});

describe("dayValue", () => {
  it("returns 1 for boolean done", () => {
    expect(dayValue(1, dailyBoolean)).toBe(1);
  });

  it("returns 0 for boolean not-done", () => {
    expect(dayValue(0, dailyBoolean)).toBe(0);
  });

  describe("measurable at_least (target=10)", () => {
    const atLeast: Habit = {
      ...dailyBoolean,
      habit_type: "measurable",
      target_type: "at_least",
      target_value: 10,
    };

    it("returns 1 when entry meets target", () => {
      expect(dayValue(10, atLeast)).toBe(1);
    });

    it("returns 1 when entry exceeds target", () => {
      expect(dayValue(15, atLeast)).toBe(1);
    });

    it("returns fraction when entry is below target", () => {
      expect(dayValue(5, atLeast)).toBeCloseTo(0.5);
    });

    it("returns 0 for zero entry", () => {
      expect(dayValue(0, atLeast)).toBe(0);
    });
  });

  describe("measurable at_most (target=10)", () => {
    const atMost: Habit = {
      ...dailyBoolean,
      habit_type: "measurable",
      target_type: "at_most",
      target_value: 10,
    };

    it("returns 1 when entry is at target", () => {
      expect(dayValue(10, atMost)).toBe(1);
    });

    it("returns 1 when entry is below target", () => {
      expect(dayValue(5, atMost)).toBeCloseTo(1);
    });

    it("returns 0 when entry is 2x target (inverted)", () => {
      expect(dayValue(20, atMost)).toBeCloseTo(0);
    });

    it("returns 1 for zero entry (best for at_most)", () => {
      expect(dayValue(0, atMost)).toBeCloseTo(1);
    });

    it("at_most with target=0: returns 1 for zero, 0 for positive", () => {
      const zeroTarget: Habit = {
        ...dailyBoolean,
        habit_type: "measurable",
        target_type: "at_most",
        target_value: 0,
      };
      expect(dayValue(0, zeroTarget)).toBe(1);
      expect(dayValue(1, zeroTarget)).toBe(0);
    });
  });
});

describe("computeScores — daily boolean", () => {
  it("returns empty array with no entries", () => {
    const scores = computeScores(dailyBoolean, [], {
      from: new Date("2026-06-10"),
      to: new Date("2026-06-10"),
    });
    expect(scores).toEqual([]);
  });

  it("computes score series for a single entry day", () => {
    // daily boolean: frequency=1.0, multiplier=0.5^(1/13)≈0.948089
    const entries = [entry("2026-06-10", 1)];
    const to = new Date("2026-06-10T12:00:00");
    const scores = computeScores(dailyBoolean, entries, {
      from: new Date("2026-06-10"),
      to,
    });

    expect(scores).toHaveLength(1);
    expect(scores[0].date).toBe("2026-06-10");
    // score = 0 * m + 1 * (1-m) = 1 - m ≈ 0.051911
    expect(scores[0].value).toBeGreaterThan(0.05);
    expect(scores[0].value).toBeLessThan(0.06);
  });

  it("computes cumulative scores over consecutive done days", () => {
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    const to = new Date("2026-06-10T12:00:00");
    const scores = computeScores(dailyBoolean, entries, {
      from: new Date("2026-06-08"),
      to,
    });

    expect(scores).toHaveLength(3);
    // Each day's score should be higher than the previous (building up)
    expect(scores[1].value).toBeGreaterThan(scores[0].value);
    expect(scores[2].value).toBeGreaterThan(scores[1].value);
  });

  it("fills missing days with value 0 (score decays)", () => {
    // June 8 done, June 9 missing, June 10 done
    const entries = [entry("2026-06-08", 1), entry("2026-06-10", 1)];
    const to = new Date("2026-06-10T12:00:00");
    const scores = computeScores(dailyBoolean, entries, {
      from: new Date("2026-06-08"),
      to,
    });

    expect(scores).toHaveLength(3);
    // Day 2 (missing) should have lower score than day 1 (done)
    expect(scores[1].value).toBeLessThan(scores[0].value);
    // Day 3 (done) recovers
    expect(scores[2].value).toBeGreaterThan(scores[1].value);
  });
});

const threePerWeek: Habit = {
  ...dailyBoolean,
  frequency_count: 3,
  frequency_period: "week",
};

describe("computeScores — 3×/week boolean", () => {
  it("uses a lower decay multiplier than daily (score decays slower on off-days)", () => {
    // 3×/week: frequency=3/7≈0.4286, multiplier≈0.9658
    // daily: frequency=1, multiplier≈0.9481
    // A single done-day should produce a lower initial score for 3×/week
    // because the multiplier is higher (slower buildup)
    const entries = [entry("2026-06-10", 1)];
    const to = new Date("2026-06-10T12:00:00");

    const dailyScores = computeScores(dailyBoolean, entries, {
      from: new Date("2026-06-10"),
      to,
    });
    const freqScores = computeScores(threePerWeek, entries, {
      from: new Date("2026-06-10"),
      to,
    });

    // 3×/week has higher multiplier → lower initial single-day score
    expect(freqScores[0].value).toBeLessThan(dailyScores[0].value);
  });

  it("decays on off-days but slower than daily", () => {
    // One done day, then 3 off days
    const entries = [entry("2026-06-08", 1)];
    const to = new Date("2026-06-11T12:00:00");

    const dailyScores = computeScores(dailyBoolean, entries, {
      from: new Date("2026-06-08"),
      to,
    });
    const freqScores = computeScores(threePerWeek, entries, {
      from: new Date("2026-06-08"),
      to,
    });

    // 3×/week starts lower (higher multiplier → lower initial score)
    // but decays proportionally slower (each off-day loses less %)
    const dailyDecayRate = dailyScores[3].value / dailyScores[0].value;
    const freqDecayRate = freqScores[3].value / freqScores[0].value;
    expect(freqDecayRate).toBeGreaterThan(dailyDecayRate);
  });
});

describe("currentScore — daily boolean", () => {
  it("returns 0 with no entries", () => {
    expect(currentScore(dailyBoolean, [])).toBe(0);
  });

  it("returns the score of the last day in the series", () => {
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    const score = currentScore(dailyBoolean, entries);
    // Should be > 0 and < 1
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});
