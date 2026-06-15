import { describe, it, expect } from "vitest";
import { getCurrentStreak } from "@/lib/utils/habit-streak";
import type { HabitEntry } from "@/lib/types/habit";

function entry(date: string, value: number): HabitEntry {
  return {
    id: `e-${date}`,
    habit_id: "h1",
    date,
    value,
    created_at: `${date}T00:00:00.000Z`,
  };
}

describe("getCurrentStreak", () => {
  // Thursday, 2026-06-11
  const today = new Date("2026-06-11T10:00:00");

  it("counts an unbroken run ending today", () => {
    const entries = [
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
      entry("2026-06-11", 1),
    ];
    expect(getCurrentStreak(entries, today)).toBe(3);
  });

  it("treats an unlogged today as pending, not a break", () => {
    // 30-day-style run through yesterday, today not yet logged.
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    expect(getCurrentStreak(entries, today)).toBe(3);
  });

  it("breaks when a day that already passed was missed", () => {
    // yesterday (2026-06-10) missing -> streak broke, today still pending
    const entries = [entry("2026-06-08", 1), entry("2026-06-09", 1)];
    expect(getCurrentStreak(entries, today)).toBe(0);
  });

  it("counts today alone", () => {
    expect(getCurrentStreak([entry("2026-06-11", 1)], today)).toBe(1);
  });

  it("ignores value:0 entries", () => {
    const entries = [entry("2026-06-10", 1), entry("2026-06-11", 0)];
    expect(getCurrentStreak(entries, today)).toBe(1);
  });

  it("returns 0 with no entries", () => {
    expect(getCurrentStreak([], today)).toBe(0);
  });
});
