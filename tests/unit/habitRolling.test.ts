import { describe, it, expect } from "vitest";
import { getMonthDays, getRolling7Days } from "@/lib/utils/habit-rolling";
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
    expect(byDate["2026-06-08"]).toBe(0);
  });

  it("marks days before start_date as inert", () => {
    const days = getRolling7Days([], today, "2026-06-09");
    const byDate = Object.fromEntries(
      days.map((d) => [d.date, d.isBeforeStart]),
    );
    expect(byDate["2026-06-08"]).toBe(true);
    expect(byDate["2026-06-09"]).toBe(false);
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

describe("getMonthDays", () => {
  const today = new Date("2026-06-11T10:00:00");

  it("returns every day of the month, first to last", () => {
    const days = getMonthDays([], new Date("2026-02-15T12:00:00"), today, null);
    expect(days).toHaveLength(28);
    expect(days[0].date).toBe("2026-02-01");
    expect(days[27].date).toBe("2026-02-28");
  });

  it("spans a 31-day month and nothing from its neighbours", () => {
    const days = getMonthDays([], new Date("2026-05-01T00:00:00"), today, null);
    expect(days).toHaveLength(31);
    expect(days[0].date).toBe("2026-05-01");
    expect(days[30].date).toBe("2026-05-31");
  });

  it("flags days after today as future, and today as neither", () => {
    const days = getMonthDays([], today, today, null);
    const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
    expect(byDate["2026-06-10"].isFuture).toBe(false);
    expect(byDate["2026-06-11"].isFuture).toBe(false);
    expect(byDate["2026-06-11"].isToday).toBe(true);
    expect(byDate["2026-06-12"].isFuture).toBe(true);
    expect(byDate["2026-06-30"].isFuture).toBe(true);
  });

  it("flags days before a mid-month start date as before start", () => {
    const days = getMonthDays(
      [],
      new Date("2026-04-01T00:00:00"),
      today,
      "2026-04-15",
    );
    const byDate = Object.fromEntries(
      days.map((d) => [d.date, d.isBeforeStart]),
    );
    expect(byDate["2026-04-01"]).toBe(true);
    expect(byDate["2026-04-14"]).toBe(true);
    expect(byDate["2026-04-15"]).toBe(false);
    expect(byDate["2026-04-30"]).toBe(false);
  });

  it("looks up entry values and whether an entry exists", () => {
    const entries = [entry("2026-03-02", 1), entry("2026-03-03", 0)];
    const days = getMonthDays(
      entries,
      new Date("2026-03-10T00:00:00"),
      today,
      null,
    );
    expect(days[1]).toMatchObject({ value: 1, hasEntry: true });
    expect(days[2]).toMatchObject({ value: 0, hasEntry: true });
    expect(days[3]).toMatchObject({ value: 0, hasEntry: false });
  });
});
