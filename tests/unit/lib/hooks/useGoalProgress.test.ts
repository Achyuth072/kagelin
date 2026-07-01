import { describe, it, expect } from "vitest";
import { calculateGoalProgress } from "@/lib/hooks/useGoalProgress";

describe("calculateGoalProgress — week boundary (Monday start)", () => {
  const NOW = new Date("2026-06-10T12:00:00.000Z"); // Wednesday, week of 06-08 (Mon)

  it("splits today vs this-week focus hours", () => {
    const logs = [
      { start_time: "2026-06-10T08:00:00.000Z", duration_seconds: 3600 }, // today
      { start_time: "2026-06-08T08:00:00.000Z", duration_seconds: 1800 }, // Monday, this week
      { start_time: "2026-06-01T08:00:00.000Z", duration_seconds: 7200 }, // prior week — excluded
    ];

    const result = calculateGoalProgress(logs, [], NOW);

    expect(result.focusHoursToday).toBe(1);
    expect(result.focusHoursThisWeek).toBeCloseTo(1.5);
  });

  it("splits today vs this-week tasks completed", () => {
    const tasks = [
      { completed_at: "2026-06-10T09:00:00.000Z" }, // today
      { completed_at: "2026-06-09T09:00:00.000Z" }, // this week
      { completed_at: "2026-06-01T09:00:00.000Z" }, // prior week — excluded
    ];

    const result = calculateGoalProgress([], tasks, NOW);

    expect(result.tasksCompletedToday).toBe(1);
    expect(result.tasksCompletedThisWeek).toBe(2);
  });

  it("excludes a log from the prior week's Saturday", () => {
    const logs = [
      { start_time: "2026-06-06T10:00:00.000Z", duration_seconds: 3600 }, // Saturday, prior week
    ];

    const result = calculateGoalProgress(logs, [], NOW);

    expect(result.focusHoursThisWeek).toBe(0);
  });

  it("ignores incomplete tasks (no completed_at)", () => {
    const tasks = [{ completed_at: null }];
    const result = calculateGoalProgress([], tasks, NOW);
    expect(result.tasksCompletedToday).toBe(0);
    expect(result.tasksCompletedThisWeek).toBe(0);
  });

  it("returns all zeros with no data", () => {
    const result = calculateGoalProgress([], [], NOW);
    expect(result).toEqual({
      focusHoursToday: 0,
      focusHoursThisWeek: 0,
      tasksCompletedToday: 0,
      tasksCompletedThisWeek: 0,
    });
  });
});
