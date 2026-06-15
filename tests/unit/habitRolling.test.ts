import { describe, it, expect } from "vitest";
import { getRolling7Days } from "@/lib/utils/habit-rolling";
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

describe("getRolling7Days", () => {
  // Thursday, 2026-06-11
  const today = new Date("2026-06-11T10:00:00");

  it("returns 7 days ending today, today last", () => {
    const days = getRolling7Days([], today, "2020-01-01");
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.date)).toEqual([
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
    ]);
  });

  it("flags only the last cell as today", () => {
    const days = getRolling7Days([], today, "2020-01-01");
    expect(days.filter((d) => d.isToday)).toHaveLength(1);
    expect(days[6].isToday).toBe(true);
  });

  it("uses narrow weekday letters", () => {
    const days = getRolling7Days([], today, "2020-01-01");
    expect(days.map((d) => d.weekdayLabel)).toEqual([
      "F",
      "S",
      "S",
      "M",
      "T",
      "W",
      "T",
    ]);
  });

  it("looks up entry values, defaulting absent days to 0", () => {
    const entries = [entry("2026-06-09", 1), entry("2026-06-11", 0)];
    const days = getRolling7Days(entries, today, "2020-01-01");
    const byDate = Object.fromEntries(days.map((d) => [d.date, d.value]));
    expect(byDate["2026-06-09"]).toBe(1);
    expect(byDate["2026-06-11"]).toBe(0);
    expect(byDate["2026-06-08"]).toBe(0); // absent
  });

  it("marks days before start_date as inert", () => {
    const days = getRolling7Days([], today, "2026-06-09");
    const byDate = Object.fromEntries(
      days.map((d) => [d.date, d.isBeforeStart]),
    );
    expect(byDate["2026-06-08"]).toBe(true);
    expect(byDate["2026-06-09"]).toBe(false); // start day itself is active
    expect(byDate["2026-06-11"]).toBe(false);
  });

  it("handles a datetime start_date by comparing the date portion", () => {
    const days = getRolling7Days([], today, "2026-06-09T12:34:56.000Z");
    const byDate = Object.fromEntries(
      days.map((d) => [d.date, d.isBeforeStart]),
    );
    expect(byDate["2026-06-08"]).toBe(true);
    expect(byDate["2026-06-09"]).toBe(false);
  });
});
