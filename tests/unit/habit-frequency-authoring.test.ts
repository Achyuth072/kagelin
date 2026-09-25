import { describe, it, expect } from "vitest";
import {
  isOnceEveryDDays,
  getLastDoneNext,
  lastDoneNextLabel,
  getFrequencyProgress,
  hasFrequencyTarget,
} from "@/lib/utils/habit-frequency-progress";
import type { Habit, HabitEntry } from "@/lib/types/habit";

function makeHabit(
  overrides: Partial<Habit> = {},
): Pick<
  Habit,
  | "habit_type"
  | "frequency_count"
  | "frequency_days"
  | "frequency_period"
  | "target_type"
  | "target_value"
> {
  return {
    habit_type: "boolean",
    frequency_count: 1,
    frequency_days: 1,
    frequency_period: "day",
    target_type: null,
    target_value: null,
    ...overrides,
  };
}

function makeEntry(date: string, value = 1): HabitEntry {
  return {
    id: date,
    habit_id: "h1",
    date,
    value,
    created_at: date + "T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// isOnceEveryDDays
// ---------------------------------------------------------------------------
describe("isOnceEveryDDays", () => {
  it("returns false for daily habit (count=1, days=1)", () => {
    expect(isOnceEveryDDays(makeHabit({ frequency_days: 1 }))).toBe(false);
  });

  it("returns true for 1-in-3 Boolean habit (every 3 days)", () => {
    expect(
      isOnceEveryDDays(makeHabit({ frequency_count: 1, frequency_days: 3 })),
    ).toBe(true);
  });

  it("returns false for 3-in-7 habit (N>1)", () => {
    expect(
      isOnceEveryDDays(makeHabit({ frequency_count: 3, frequency_days: 7 })),
    ).toBe(false);
  });

  it("returns false for Measurable habit even when count=1, days>1", () => {
    expect(
      isOnceEveryDDays(
        makeHabit({
          habit_type: "measurable",
          frequency_count: 1,
          frequency_days: 50,
        }),
      ),
    ).toBe(false);
  });

  it("falls back to period when frequency_days is null", () => {
    // period=week means 7 days, count=1 → once every 7 days → true
    expect(
      isOnceEveryDDays(
        makeHabit({
          frequency_count: 1,
          frequency_days: null,
          frequency_period: "week",
        }),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getLastDoneNext + lastDoneNextLabel
// ---------------------------------------------------------------------------
describe("getLastDoneNext", () => {
  const ref = new Date("2026-09-25");
  const habit = makeHabit({ frequency_count: 1, frequency_days: 50 });

  it("returns never_done when no entries", () => {
    const result = getLastDoneNext(habit, [], ref);
    expect(result.kind).toBe("never_done");
    expect(lastDoneNextLabel(result)).toBe("Not done yet");
  });

  it("returns done_ago with correct days when done 12 days ago (next in 38)", () => {
    const entries = [makeEntry("2026-09-13")];
    const result = getLastDoneNext(habit, entries, ref);
    expect(result.kind).toBe("done_ago");
    if (result.kind === "done_ago") {
      expect(result.daysDone).toBe(12);
      expect(result.daysNext).toBe(38);
    }
    expect(lastDoneNextLabel(result)).toBe(
      "Done 12 days ago · next in 38 days",
    );
  });

  it("returns done_ago with daysNext=1 when done 49 days ago", () => {
    const entries = [makeEntry("2026-08-07")];
    const result = getLastDoneNext(habit, entries, ref);
    expect(result.kind).toBe("done_ago");
    if (result.kind === "done_ago") {
      expect(result.daysDone).toBe(49);
      expect(result.daysNext).toBe(1);
    }
  });

  it("returns done_ago with singular 'day' when daysDone=1", () => {
    const entries = [makeEntry("2026-09-24")];
    const result = getLastDoneNext(habit, entries, ref);
    expect(result.kind).toBe("done_ago");
    expect(lastDoneNextLabel(result)).toContain("Done 1 day ago");
  });

  it("returns late when done 60 days ago (10 days late)", () => {
    const entries = [makeEntry("2026-07-27")];
    const result = getLastDoneNext(habit, entries, ref);
    expect(result.kind).toBe("late");
    if (result.kind === "late") {
      expect(result.daysLate).toBe(10);
    }
    expect(lastDoneNextLabel(result)).toBe("10 days late");
  });

  it("does not count skipped entries as done", () => {
    const entries = [makeEntry("2026-09-24", -2)];
    const result = getLastDoneNext(habit, entries, ref);
    expect(result.kind).toBe("never_done");
  });

  it("does not count not-done (value=0) entries as done", () => {
    const entries = [makeEntry("2026-09-24", 0)];
    const result = getLastDoneNext(habit, entries, ref);
    expect(result.kind).toBe("never_done");
  });

  it("uses the most recent done entry when multiple exist", () => {
    const entries = [
      makeEntry("2026-09-10"),
      makeEntry("2026-09-20"), // 5 days ago
    ];
    const result = getLastDoneNext(habit, entries, ref);
    expect(result.kind).toBe("done_ago");
    if (result.kind === "done_ago") {
      expect(result.daysDone).toBe(5);
    }
  });

  it("returns done_ago with daysDone=0 and label 'Done today · next in 50 days' when done today", () => {
    const entries = [makeEntry("2026-09-25")];
    const result = getLastDoneNext(habit, entries, ref);
    expect(result.kind).toBe("done_ago");
    expect(lastDoneNextLabel(result)).toBe("Done today · next in 50 days");
  });

  it("returns done_ago with daysNext=0 and label 'Due today' when done exactly windowDays ago", () => {
    // done exactly 50 days ago → daysRemaining = 0 → "Due today"
    const entries = [makeEntry("2026-08-06")];
    const result = getLastDoneNext(habit, entries, ref);
    expect(result.kind).toBe("done_ago");
    if (result.kind === "done_ago") {
      expect(result.daysNext).toBe(0);
    }
    expect(lastDoneNextLabel(result)).toBe("Due today");
  });
});

// ---------------------------------------------------------------------------
// Frequency control: most-specific mode round-trip
// (Logic lives in HabitFrequencyField; tested here via hasFrequencyTarget and
// getFrequencyProgress to verify the D-value feeds the metric layer correctly.)
// ---------------------------------------------------------------------------
describe("frequency metric layer with custom frequency_days", () => {
  it("hasFrequencyTarget is true for count=1, days=50", () => {
    expect(
      hasFrequencyTarget(makeHabit({ frequency_count: 1, frequency_days: 50 })),
    ).toBe(true);
  });

  it("hasFrequencyTarget is false for count=1, days=1 (daily)", () => {
    expect(
      hasFrequencyTarget(makeHabit({ frequency_count: 1, frequency_days: 1 })),
    ).toBe(false);
  });

  it("getFrequencyProgress uses frequency_days=14 for N-in-D window", () => {
    const habit = makeHabit({ frequency_count: 2, frequency_days: 14 });
    const entries = [makeEntry("2026-09-24"), makeEntry("2026-09-20")];
    const ref = new Date("2026-09-25");
    const progress = getFrequencyProgress(habit, entries, ref);
    expect(progress.windowDays).toBe(14);
    expect(progress.target).toBe(2);
    expect(progress.completed).toBe(2);
  });
});
