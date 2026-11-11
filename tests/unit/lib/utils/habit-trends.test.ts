import { describe, it, expect } from "vitest";
import {
  formatHabitFrequencyLabel,
  hasSufficientHistory,
  calculateScoreTrend,
  calculateStreakTrend,
  calculateMeasurableOverviewMetrics,
} from "@/lib/utils/habit-trends";
import type { Habit, HabitEntry } from "@/lib/types/habit";

function createEntry(date: string, value: number): HabitEntry {
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
  color: "#10b981",
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

describe("formatHabitFrequencyLabel", () => {
  it("formats 1/day as 'Daily'", () => {
    expect(
      formatHabitFrequencyLabel({
        frequency_count: 1,
        frequency_period: "day",
      }),
    ).toBe("Daily");
  });

  it("formats missing frequency fields as 'Daily'", () => {
    expect(formatHabitFrequencyLabel({})).toBe("Daily");
  });

  it("formats weekly frequency as 'N× / week'", () => {
    expect(
      formatHabitFrequencyLabel({
        frequency_count: 3,
        frequency_period: "week",
      }),
    ).toBe("3× / week");

    expect(
      formatHabitFrequencyLabel({
        frequency_count: 1,
        frequency_period: "week",
      }),
    ).toBe("1× / week");
  });

  it("formats monthly frequency as 'N× / month'", () => {
    expect(
      formatHabitFrequencyLabel({
        frequency_count: 2,
        frequency_period: "month",
      }),
    ).toBe("2× / month");
  });

  it("formats custom days when frequency_count is 1 as 'Every N days'", () => {
    expect(
      formatHabitFrequencyLabel({
        frequency_count: 1,
        frequency_days: 14,
      }),
    ).toBe("Every 14 days");
  });

  it("formats custom days with count > 1 as 'N× / D days'", () => {
    expect(
      formatHabitFrequencyLabel({
        frequency_count: 3,
        frequency_days: 14,
      }),
    ).toBe("3× / 14 days");
  });

  it("formats frequency_days: 1 as 'Daily'", () => {
    expect(
      formatHabitFrequencyLabel({
        frequency_count: 1,
        frequency_days: 1,
      }),
    ).toBe("Daily");
  });
});

describe("hasSufficientHistory", () => {
  const refDate = new Date("2026-06-20T12:00:00.000Z");

  it("returns false when entries is empty", () => {
    expect(hasSufficientHistory(baseHabit, [], refDate)).toBe(false);
  });

  it("returns false when entries span fewer than 14 days from reference date", () => {
    // 2026-06-20 minus 10 days = 2026-06-10 (10 days of history)
    const entries = [
      createEntry("2026-06-10", 1),
      createEntry("2026-06-20", 1),
    ];
    expect(hasSufficientHistory(baseHabit, entries, refDate)).toBe(false);
  });

  it("returns true when entries span 14 or more days", () => {
    // 2026-06-06 to 2026-06-20 = 14 days
    const entries = [
      createEntry("2026-06-06", 1),
      createEntry("2026-06-20", 1),
    ];
    expect(hasSufficientHistory(baseHabit, entries, refDate)).toBe(true);
  });

  it("respects start_date if earlier than earliest entry", () => {
    const habitWithStartDate = {
      ...baseHabit,
      start_date: "2026-06-01",
    };
    // Earliest entry is 2026-06-18 (only 2 days), but start_date is 2026-06-01 (19 days)
    const entries = [createEntry("2026-06-18", 1)];
    expect(hasSufficientHistory(habitWithStartDate, entries, refDate)).toBe(
      true,
    );
  });
});

describe("calculateScoreTrend", () => {
  const refDate = new Date("2026-06-30T12:00:00.000Z");

  it("returns undefined when history is fewer than 14 days", () => {
    const entries = [createEntry("2026-06-25", 1)];
    expect(calculateScoreTrend(baseHabit, entries, refDate)).toBeUndefined();
  });

  it("calculates positive score delta over 30 days", () => {
    // Habit active for 40 days, completed every day in the last 15 days, score rising
    const entries: HabitEntry[] = [];
    // Start habit 40 days ago: 2026-05-21
    entries.push(createEntry("2026-05-21", 1));
    // Consistent completions in recent 10 days
    for (let day = 20; day <= 30; day++) {
      entries.push(
        createEntry(`2026-06-${day.toString().padStart(2, "0")}`, 1),
      );
    }

    const trend = calculateScoreTrend(baseHabit, entries, refDate);
    expect(trend).toBeDefined();
    expect(trend?.isPositive).toBe(true);
    expect(trend?.value).toBeGreaterThan(0);
  });
});

describe("calculateStreakTrend", () => {
  const refDate = new Date("2026-06-30T12:00:00.000Z");

  it("returns undefined when history is fewer than 14 days", () => {
    const entries = [createEntry("2026-06-25", 1)];
    expect(calculateStreakTrend(baseHabit, entries, refDate)).toBeUndefined();
  });

  it("calculates streak delta between now and 30 days ago", () => {
    const entries: HabitEntry[] = [];
    // History spans > 14 days (started May 15)
    entries.push(createEntry("2026-05-15", 1));
    // Unbroken streak for 5 days ending June 30
    entries.push(createEntry("2026-06-26", 1));
    entries.push(createEntry("2026-06-27", 1));
    entries.push(createEntry("2026-06-28", 1));
    entries.push(createEntry("2026-06-29", 1));
    entries.push(createEntry("2026-06-30", 1));

    // 30 days ago was May 31. Streak on May 31 was 0.
    // Streak on June 30 is 5.
    const trend = calculateStreakTrend(baseHabit, entries, refDate);
    expect(trend).toBeDefined();
    expect(trend?.value).toBe(5);
    expect(trend?.isPositive).toBe(true);
  });
});

describe("calculateMeasurableOverviewMetrics", () => {
  const refDate = new Date("2026-06-30T12:00:00.000Z");
  const measurableHabit: Habit = {
    ...baseHabit,
    habit_type: "measurable",
    target_type: "at_least",
    target_value: 10,
    unit: "km",
  };

  it("calculates Target Met Rate when target is defined", () => {
    // 4 logged entries: 12, 10, 5, 8.
    // Meeting >= 10: 12 and 10 (2 out of 4 = 50%)
    const entries = [
      createEntry("2026-06-10", 12),
      createEntry("2026-06-15", 10),
      createEntry("2026-06-20", 5),
      createEntry("2026-06-25", 8),
    ];

    const metrics = calculateMeasurableOverviewMetrics(
      measurableHabit,
      entries,
      refDate,
    );

    expect(metrics.targetMetRate).toEqual({
      title: "Target Met Rate",
      value: "50%",
    });
  });

  it("falls back to Days Logged when no target is set", () => {
    const noTargetHabit: Habit = {
      ...measurableHabit,
      target_value: null,
    };
    const entries = [
      createEntry("2026-06-10", 5),
      createEntry("2026-06-15", 8),
    ];

    const metrics = calculateMeasurableOverviewMetrics(
      noTargetHabit,
      entries,
      refDate,
    );

    expect(metrics.targetMetRate).toEqual({
      title: "Days Logged",
      value: "2",
    });
  });

  it("calculates 30-Day Average rounded to 1 decimal place with unit", () => {
    // Total in last 30 days = 30 + 15 = 45 km.
    // 45 / 30 = 1.5 km.
    const entries = [
      createEntry("2026-06-10", 30),
      createEntry("2026-06-20", 15),
    ];

    const metrics = calculateMeasurableOverviewMetrics(
      measurableHabit,
      entries,
      refDate,
    );

    expect(metrics.thirtyDayAverage).toBe("1.5 km");
  });

  it("calculates Total Volume with unit", () => {
    const entries = [
      createEntry("2026-05-01", 50),
      createEntry("2026-06-10", 30),
      createEntry("2026-06-20", 15),
    ];

    const metrics = calculateMeasurableOverviewMetrics(
      measurableHabit,
      entries,
      refDate,
    );

    expect(metrics.totalVolume).toBe("95 km");
  });
});
