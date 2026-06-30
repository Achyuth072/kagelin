import { describe, it, expect } from "vitest";
import {
  getTaskCompletionRate,
  getTaskOnTimeRate,
  getTaskCurrentStreak,
  getTaskBestStreak,
  getTaskTotalCompletions,
  type TaskOccurrence,
} from "@/lib/utils/task-streak";

function occ(
  dueDate: string,
  isCompleted: boolean,
  completedAt: string | null = null,
): TaskOccurrence {
  return {
    due_date: `${dueDate}T09:00:00.000Z`,
    is_completed: isCompleted,
    completed_at: completedAt ? `${completedAt}T09:00:00.000Z` : null,
  };
}

// Thursday, 2026-06-25
const today = new Date("2026-06-25T10:00:00");

describe("getTaskCompletionRate", () => {
  it("returns null when every Occurrence is still pending", () => {
    const occurrences = [occ("2026-06-25", false), occ("2026-07-02", false)];
    expect(getTaskCompletionRate(occurrences, today)).toBeNull();
  });

  it("excludes today's pending Occurrence from the denominator", () => {
    const occurrences = [
      occ("2026-06-11", true, "2026-06-11"),
      occ("2026-06-18", true, "2026-06-18"),
      occ("2026-06-25", false), // due today, not yet a miss
    ];
    expect(getTaskCompletionRate(occurrences, today)).toBe(1);
  });

  it("counts an overdue, incomplete Occurrence as a miss", () => {
    const occurrences = [
      occ("2026-06-04", true, "2026-06-04"),
      occ("2026-06-11", false), // overdue, never completed
      occ("2026-06-18", true, "2026-06-18"),
    ];
    expect(getTaskCompletionRate(occurrences, today)).toBeCloseTo(2 / 3);
  });
});

describe("getTaskOnTimeRate", () => {
  it("returns null when nothing has been completed", () => {
    expect(getTaskOnTimeRate([occ("2026-06-25", false)])).toBeNull();
  });

  it("treats completed exactly at the due date as on-time", () => {
    const occurrences = [occ("2026-06-18", true, "2026-06-18")];
    expect(getTaskOnTimeRate(occurrences)).toBe(1);
  });

  it("counts a late completion against the rate", () => {
    const occurrences = [
      occ("2026-06-04", true, "2026-06-04"),
      occ("2026-06-11", true, "2026-06-13"), // completed 2 days late
    ];
    expect(getTaskOnTimeRate(occurrences)).toBe(0.5);
  });
});

describe("getTaskCurrentStreak", () => {
  it("counts an unbroken run ending at the most recent decided Occurrence", () => {
    const occurrences = [
      occ("2026-06-04", true, "2026-06-04"),
      occ("2026-06-11", true, "2026-06-11"),
      occ("2026-06-18", true, "2026-06-18"),
    ];
    expect(getTaskCurrentStreak(occurrences, today)).toBe(3);
  });

  it("treats today's still-pending Occurrence as pending, not a break", () => {
    const occurrences = [
      occ("2026-06-11", true, "2026-06-11"),
      occ("2026-06-18", true, "2026-06-18"),
      occ("2026-06-25", false), // due today
    ];
    expect(getTaskCurrentStreak(occurrences, today)).toBe(2);
  });

  it("breaks on an overdue, incomplete Occurrence", () => {
    const occurrences = [
      occ("2026-06-04", true, "2026-06-04"),
      occ("2026-06-11", false), // missed
      occ("2026-06-18", true, "2026-06-18"),
    ];
    expect(getTaskCurrentStreak(occurrences, today)).toBe(1);
  });

  it("returns 0 with no Occurrences", () => {
    expect(getTaskCurrentStreak([], today)).toBe(0);
  });
});

describe("getTaskBestStreak", () => {
  it("finds the longest run across a mixed history", () => {
    const occurrences = [
      occ("2026-05-07", true, "2026-05-07"),
      occ("2026-05-14", false),
      occ("2026-05-21", true, "2026-05-21"),
      occ("2026-05-28", true, "2026-05-28"),
      occ("2026-06-04", true, "2026-06-04"),
      occ("2026-06-11", false),
      occ("2026-06-18", true, "2026-06-18"),
    ];
    expect(getTaskBestStreak(occurrences, today)).toBe(3);
  });

  it("returns 0 when nothing was ever completed", () => {
    const occurrences = [occ("2026-06-04", false), occ("2026-06-11", false)];
    expect(getTaskBestStreak(occurrences, today)).toBe(0);
  });
});

describe("getTaskTotalCompletions", () => {
  it("counts completed Occurrences regardless of due date", () => {
    const occurrences = [
      occ("2026-06-04", true, "2026-06-04"),
      occ("2026-06-11", false),
      occ("2026-06-18", true, "2026-06-18"),
    ];
    expect(getTaskTotalCompletions(occurrences)).toBe(2);
  });
});
