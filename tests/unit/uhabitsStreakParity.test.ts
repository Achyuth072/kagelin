import { describe, it, expect } from "vitest";
import { getCurrentStreak } from "@/lib/utils/habit-streak";
import { interpolateDoneDays } from "@/lib/utils/habit-intervals";
import {
  computeDoneSet,
  currentStreak as uhabitsCurrentStreak,
} from "./support/uhabitsReference";
import { entries, makeHabit } from "./support/habitFixtures";

const threePerWeek = makeHabit({
  frequency_count: 3,
  frequency_period: "week",
});
// Prove the oracle against uhabits' own published fixture before trusting it.
describe("uhabits reference oracle — faithful to uhabits-core fixtures", () => {
  it("reproduces EntryListTest.testComputeBoolean (freq 1/3)", () => {
    // today = 2015-01-25; reps at today-4, today-9, today-10.
    const done = computeDoneSet(1, 3, [
      "2015-01-21",
      "2015-01-16",
      "2015-01-15",
    ]);
    const expected = new Set([
      "2015-01-23",
      "2015-01-22",
      "2015-01-21", // run ending today-2
      "2015-01-18",
      "2015-01-17",
      "2015-01-16",
      "2015-01-15",
      "2015-01-14",
      "2015-01-13",
    ]);
    expect(done).toEqual(expected);
  });

  it("reports the most-recent run even when it ends before today", () => {
    const done = computeDoneSet(1, 3, [
      "2015-01-21",
      "2015-01-16",
      "2015-01-15",
    ]);
    // Newest done-day is today-2 (2015-01-23); uhabits still reports its run.
    expect(uhabitsCurrentStreak(done, "2015-01-25")).toBe(3);
  });
});

describe("getCurrentStreak — reports the most-recent run (the bug fix)", () => {
  const today = new Date("2026-06-11T10:00:00");

  // A genuine 3×/week cadence whose interpolated run ends 2 days before today.
  const reproDates = [
    "2026-05-14",
    "2026-05-16",
    "2026-05-19",
    "2026-05-21",
    "2026-05-23",
    "2026-05-26",
    "2026-05-28",
    "2026-05-30",
    "2026-06-03",
    "2026-06-06",
    "2026-06-09",
  ];

  it("shows the historical streak on import, before marking today", () => {
    const streak = getCurrentStreak(threePerWeek, entries(reproDates), today);
    // Regression: this read 0 until the user marked today complete.
    expect(streak).toBe(27);
    // Still 1 short of uhabits (28) — the backward-snap gap below.
    expect(
      uhabitsCurrentStreak(computeDoneSet(3, 7, reproDates), "2026-06-11"),
    ).toBe(28);
  });
});

describe("getCurrentStreak — deliberate deviations from raw uhabits (documented)", () => {
  const todayStr = "2026-06-11";

  it("lapses a long-abandoned frequency streak that uhabits would still report", () => {
    // uhabits reports the run forever; Kagelin caps liveness at one period.
    const dates = ["2026-05-01", "2026-05-03", "2026-05-05"];
    const late = new Date("2026-06-11T10:00:00");
    const kagelin = getCurrentStreak(threePerWeek, entries(dates), late);
    const uhabits = uhabitsCurrentStreak(computeDoneSet(3, 7, dates), todayStr);
    expect(kagelin).toBe(0);
    expect(uhabits).toBeGreaterThan(0);
  });

  it("KNOWN GAP: interpolation does not port uhabits' backward interval snap", () => {
    // uhabits slides intervals backward to fill days before the first rep;
    // Kagelin's snap only merges overlaps. See ADR 0004.
    const today = new Date("2026-06-11T10:00:00");
    const dates = [
      "2026-06-01",
      "2026-06-03",
      "2026-06-05",
      "2026-06-08",
      "2026-06-10",
    ];
    const reps = entries(dates);
    const kagelinDone = interpolateDoneDays(threePerWeek, reps, today);
    const uhabitsDone = computeDoneSet(3, 7, dates);
    // Kagelin starts the run at the first rep; uhabits slides it 2 days earlier.
    expect(kagelinDone.has("2026-06-01")).toBe(true);
    expect(kagelinDone.has("2026-05-30")).toBe(false);
    expect(uhabitsDone.has("2026-05-30")).toBe(true);
    expect(getCurrentStreak(threePerWeek, reps, today)).toBe(11);
    expect(uhabitsCurrentStreak(uhabitsDone, "2026-06-11")).toBe(13);
  });
});
