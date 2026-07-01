import { describe, it, expect } from "vitest";
import {
  projectTasksThisMonth,
  projectFocusHoursThisMonth,
  getStreaksAtRisk,
} from "@/lib/utils/projections";
import type { Habit, HabitEntry, HabitWithEntries } from "@/lib/types/habit";

function day(date: string, tasksCompleted: number, hours = 0) {
  return { date, tasksCompleted, hours };
}

function baseHabit(overrides: Partial<Habit> = {}): Habit {
  return {
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
    ...overrides,
  };
}

function entry(date: string, value = 1): HabitEntry {
  return { id: `e-${date}`, habit_id: "h1", date, value, created_at: date };
}

describe("projectTasksThisMonth", () => {
  it("projects month total from so-far + trailing pace over remaining days", () => {
    // June 2026, "today" = June 10th (10 days elapsed, 20 remaining, 30 in month)
    const now = new Date("2026-06-10T12:00:00");
    const dailyTrend = [
      day("2026-06-04", 2),
      day("2026-06-05", 2),
      day("2026-06-06", 2),
      day("2026-06-07", 2),
      day("2026-06-08", 2),
      day("2026-06-09", 2),
      day("2026-06-10", 2),
    ];
    const result = projectTasksThisMonth(dailyTrend, now);

    expect(result.soFar).toBe(14); // 7 days * 2
    expect(result.pacePerDay).toBe(2);
    expect(result.daysElapsed).toBe(10);
    expect(result.daysInMonth).toBe(30);
    expect(result.daysRemaining).toBe(20);
    expect(result.projected).toBe(14 + 2 * 20); // 54
  });

  it("ignores days after today and outside the current month", () => {
    const now = new Date("2026-06-03T00:00:00");
    const dailyTrend = [
      day("2026-05-31", 5), // last month — excluded from soFar
      day("2026-06-01", 1),
      day("2026-06-02", 1),
      day("2026-06-04", 100), // future — excluded entirely
    ];
    const result = projectTasksThisMonth(dailyTrend, now);
    expect(result.soFar).toBe(2);
  });

  it("returns zero pace and flat projection with no trend data", () => {
    const now = new Date("2026-06-15T00:00:00");
    const result = projectTasksThisMonth([], now);
    expect(result.soFar).toBe(0);
    expect(result.pacePerDay).toBe(0);
    expect(result.projected).toBe(0);
  });
});

describe("projectFocusHoursThisMonth", () => {
  it("projects using the hours field", () => {
    const now = new Date("2026-06-05T00:00:00");
    const dailyTrend = [
      day("2026-06-01", 0, 1),
      day("2026-06-02", 0, 1),
      day("2026-06-03", 0, 1),
      day("2026-06-04", 0, 1),
      day("2026-06-05", 0, 1),
    ];
    const result = projectFocusHoursThisMonth(dailyTrend, now);
    expect(result.soFar).toBe(5);
    expect(result.pacePerDay).toBe(1);
  });
});

describe("getStreaksAtRisk", () => {
  // Thursday, 2026-06-11
  const now = new Date("2026-06-11T10:00:00");

  it("flags a daily habit with an active streak that hasn't logged today", () => {
    const habit: HabitWithEntries = {
      ...baseHabit(),
      entries: [
        entry("2026-06-08"),
        entry("2026-06-09"),
        entry("2026-06-10"),
        // nothing on 2026-06-11 (today)
      ],
    };
    const risks = getStreaksAtRisk([habit], now);
    expect(risks).toHaveLength(1);
    expect(risks[0].habitId).toBe("h1");
    expect(risks[0].currentStreak).toBe(3);
  });

  it("does not flag a habit already logged today", () => {
    const habit: HabitWithEntries = {
      ...baseHabit(),
      entries: [entry("2026-06-10"), entry("2026-06-11")],
    };
    expect(getStreaksAtRisk([habit], now)).toHaveLength(0);
  });

  it("does not flag a habit with no active streak", () => {
    const habit: HabitWithEntries = {
      ...baseHabit(),
      entries: [entry("2026-06-05")], // streak long broken
    };
    expect(getStreaksAtRisk([habit], now)).toHaveLength(0);
  });

  it("does not flag a non-daily-frequency habit even with an active streak", () => {
    // 3x/week habits interpolate coverage from their last logged rep rather
    // than shrinking day-by-day as "today" advances, so this signal is
    // scoped to daily habits only (see getStreaksAtRisk doc comment).
    const habit: HabitWithEntries = {
      ...baseHabit({ frequency_count: 3, frequency_period: "week" }),
      entries: [entry("2026-06-08"), entry("2026-06-09"), entry("2026-06-10")],
    };
    expect(getStreaksAtRisk([habit], now)).toHaveLength(0);
  });

  it("excludes measurable and archived habits", () => {
    const measurable: HabitWithEntries = {
      ...baseHabit({ habit_type: "measurable", id: "h2" }),
      entries: [entry("2026-06-10")],
    };
    const archived: HabitWithEntries = {
      ...baseHabit({ archived_at: "2026-06-01T00:00:00.000Z", id: "h3" }),
      entries: [entry("2026-06-10")],
    };
    expect(getStreaksAtRisk([measurable, archived], now)).toHaveLength(0);
  });
});
