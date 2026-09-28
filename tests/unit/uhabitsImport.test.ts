import { describe, it, expect } from "vitest";
import {
  mapUhabitsToKanso,
  toCreateHabitInput,
} from "../../src/lib/import/uhabits";
import type { Habit } from "../../src/lib/types/habit";
import { mapKagelinFrequencyToLoop } from "../../src/lib/export/uhabitsShared";
import { getCurrentStreak } from "../../src/lib/utils/habit-streak";
import {
  classifyUhabitsError,
  WASM_ERROR_MESSAGE,
  SCHEMA_ERROR_MESSAGE,
} from "../../src/lib/import/uhabitsErrors";
import { PROJECT_COLORS } from "../../src/lib/constants/colors";
import {
  LOOP_FIXTURE,
  buildLoopBackupFixture,
  hasRealLoopBackup,
  readRealLoopBackup,
  toBlob,
} from "./support/loopBackupFixture";

describe("uhabitsImport", () => {
  it("should correctly map habits from uhabits schema", () => {
    const mockHabits = [
      {
        id: 1,
        name: "Drink Water",
        description: "Stay hydrated",
        color: 8,
        archived: 0,
      },
    ];

    const mockRepetitions = [
      {
        habit: 1,
        timestamp: 1715097600000,
        value: 2,
      },
    ];

    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);

    expect(result.habits).toHaveLength(1);
    expect(result.habits[0].name).toBe("Drink Water");
    expect(result.habits[0].description).toBe("Stay hydrated");
    expect(result.habits[0].icon).toBe("Droplet");

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].date).toBe("2024-05-07");
    expect(result.entries[0].value).toBe(1);
  });

  it("should handle empty data", () => {
    const result = mapUhabitsToKanso([], []);
    expect(result.habits).toHaveLength(0);
    expect(result.entries).toHaveLength(0);
  });

  it("should import archived habits with archived_at timestamp", () => {
    const mockHabits = [
      {
        id: 1,
        name: "Old Habit",
        archived: 1,
      },
    ];
    const result = mapUhabitsToKanso(mockHabits, []);
    expect(result.habits).toHaveLength(1);
    expect(result.habits[0].archived_at).toBeTruthy();
    expect(new Date(result.habits[0].archived_at!).getTime()).not.toBeNaN();
  });

  it("should map value=0 (NO) to an explicit miss, value=2 (YES) to done, and value=3 (SKIP) to skip", () => {
    const mockHabits = [{ id: 1, name: "Exercise", archived: 0 }];
    const mockRepetitions = [
      { habit: 1, timestamp: 1715097600000, value: 0 },
      { habit: 1, timestamp: 1715184000000, value: 2 },
      { habit: 1, timestamp: 1715270400000, value: 3 },
    ];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].value).toBe(0);
    expect(result.entries[1].value).toBe(1);
    expect(result.entries[2].value).toBe(-2);
  });

  it("should drop value=-1 (UNKNOWN) repetitions", () => {
    const mockHabits = [{ id: 1, name: "Exercise", archived: 0 }];
    const mockRepetitions = [
      { habit: 1, timestamp: 1715097600000, value: -1 },
      { habit: 1, timestamp: 1715184000000, value: 2 },
    ];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].value).toBe(1);
  });

  it("should normalize value=2 (Loop YES) to value=1 (Kagelin completed)", () => {
    const mockHabits = [{ id: 1, name: "Read", archived: 0 }];
    const mockRepetitions = [{ habit: 1, timestamp: 1715097600000, value: 2 }];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.entries[0].value).toBe(1);
  });

  it("should map Loop palette indices to the closest Kagelin palette color", () => {
    const kansoHexes = new Set(PROJECT_COLORS.map((c) => c.hex.toLowerCase()));

    const mockHabits = [
      { id: 1, name: "Test", archived: 0, color: 0 },
      { id: 2, name: "Test2", archived: 0, color: 7 },
      { id: 3, name: "Test3", archived: 0, color: 99 },
    ];
    const result = mapUhabitsToKanso(mockHabits, []);

    expect(kansoHexes.has(result.habits[0].color.toLowerCase())).toBe(true);
    expect(kansoHexes.has(result.habits[1].color.toLowerCase())).toBe(true);

    expect(result.habits[0].color).toBe("#B56C5A");
    expect(result.habits[1].color).toBe("#4A8A8A");
    expect(result.habits[2].color).toBe("#4B6CB7");
  });

  it("should infer icon from habit name keywords", () => {
    const habits = [
      { id: 1, name: "WORKOUT", archived: 0, color: 0 },
      { id: 2, name: "READ A BOOK", archived: 0, color: 0 },
      { id: 3, name: "MEDITATION", archived: 0, color: 0 },
      { id: 4, name: "EARLY TO RISE", archived: 0, color: 0 },
      { id: 5, name: "SHAMPOO", archived: 0, color: 0 },
      { id: 6, name: "RANDOM HABIT XYZ", archived: 0, color: 0 },
    ];
    const result = mapUhabitsToKanso(habits, []);
    expect(result.habits[0].icon).toBe("Dumbbell");
    expect(result.habits[1].icon).toBe("Book");
    expect(result.habits[2].icon).toBe("Brain");
    expect(result.habits[3].icon).toBe("Sun");
    expect(result.habits[4].icon).toBe("Droplet");
    expect(result.habits[5].icon).toBe("Flame");
  });

  it("should set start_date from earliest completed entry, not today", () => {
    const mockHabits = [{ id: 1, name: "Exercise", archived: 0 }];
    const mockRepetitions = [
      { habit: 1, timestamp: 1689120000000, value: 2 },
      { habit: 1, timestamp: 1715097600000, value: 2 },
      { habit: 1, timestamp: 1688947200000, value: 2 },
    ];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.habits[0].start_date).toBe("2023-07-10");
  });

  it("should default start_date to today when no completed entries exist", () => {
    const today = new Date().toISOString().split("T")[0];
    const mockHabits = [{ id: 1, name: "New Habit", archived: 0 }];
    const result = mapUhabitsToKanso(mockHabits, []);
    expect(result.habits[0].start_date).toBe(today);
  });

  it("should deduplicate entries with the same habit+date", () => {
    const mockHabits = [{ id: 1, name: "Exercise", archived: 0 }];
    const mockRepetitions = [
      { habit: 1, timestamp: 1715097600000, value: 2 },
      { habit: 1, timestamp: 1715097600000, value: 2 },
      { habit: 1, timestamp: 1715184000000, value: 2 },
    ];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.entries).toHaveLength(2);
    const dates = result.entries.map((e) => e.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("should import entries for archived habits", () => {
    const mockHabits = [
      { id: 1, name: "Active", archived: 0 },
      { id: 2, name: "Archived", archived: 1 },
    ];
    const mockRepetitions = [
      { habit: 1, timestamp: 1715097600000, value: 2 },
      { habit: 2, timestamp: 1715097600000, value: 2 },
    ];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.habits).toHaveLength(2);
    expect(result.entries).toHaveLength(2);
    expect(result.habits[1].archived_at).toBeTruthy();
    expect(result.entries.map((e) => e.habit_id)).toContain(
      result.habits[1].id,
    );
  });
});

describe("uhabitsImport source provenance", () => {
  it("stamps source_uuid from the uhabits uuid column", () => {
    const mockHabits = [
      { id: 1, name: "Water", archived: 0, uuid: "abc-123-uuid" },
    ];
    const result = mapUhabitsToKanso(mockHabits, []);
    expect(result.habits[0].source_uuid).toBe("abc-123-uuid");
  });

  it("leaves source_uuid null when the uuid column is absent", () => {
    const mockHabits = [{ id: 1, name: "Water", archived: 0 }];
    const result = mapUhabitsToKanso(mockHabits, []);
    expect(result.habits[0].source_uuid).toBeNull();
  });
});

describe("uhabitsImport frequency mapping", () => {
  it("maps freq_num/freq_den directly to count and frequency_days", () => {
    const mockHabits = [
      { id: 1, name: "Daily", archived: 0, freq_num: 1, freq_den: 1 },
      { id: 2, name: "Thrice weekly", archived: 0, freq_num: 3, freq_den: 7 },
      { id: 3, name: "Monthly", archived: 0, freq_num: 1, freq_den: 30 },
      { id: 4, name: "HAIRCUT", archived: 0, freq_num: 1, freq_den: 50 },
      { id: 5, name: "SHAMPOO", archived: 0, freq_num: 1, freq_den: 3 },
      { id: 6, name: "WASH TOWEL", archived: 0, freq_num: 1, freq_den: 2 },
      { id: 7, name: "EXFOLIATE", archived: 0, freq_num: 2, freq_den: 7 },
    ];
    const result = mapUhabitsToKanso(mockHabits, []);
    const got = result.habits.map((h) => [
      h.frequency_count,
      h.frequency_days,
      h.frequency_period,
    ]);

    expect(got).toEqual([
      [1, 1, "day"],
      [3, 7, "week"],
      [1, 30, "month"],
      [1, 50, null],
      [1, 3, null],
      [1, 2, null],
      [2, 7, "week"],
    ]);
  });

  it("import → export keeps the exact fraction", () => {
    const fractions = [
      [1, 50],
      [1, 3],
      [1, 2],
      [2, 7],
    ];
    const { habits } = mapUhabitsToKanso(
      fractions.map(([n, d], i) => ({
        id: i + 1,
        name: `H${i}`,
        archived: 0,
        freq_num: n,
        freq_den: d,
      })),
      [],
    );
    const exported = habits.map((h) => {
      const { freq_num, freq_den } = mapKagelinFrequencyToLoop(h);
      return [freq_num, freq_den];
    });
    expect(exported).toEqual(fractions);
  });

  it("round-trips through the create input keeping frequency_days", () => {
    const [haircut] = mapUhabitsToKanso(
      [{ id: 1, name: "HAIRCUT", archived: 0, freq_num: 1, freq_den: 50 }],
      [],
    ).habits;
    const input = toCreateHabitInput(haircut);
    expect(input.frequency_count).toBe(1);
    expect(input.frequency_days).toBe(50);
  });

  it("leaves frequency unset for absent or invalid freq columns", () => {
    const mockHabits = [
      { id: 1, name: "No freq", archived: 0 },
      { id: 2, name: "NaN freq", archived: 0, freq_num: NaN, freq_den: 7 },
      { id: 3, name: "Zero den", archived: 0, freq_num: 1, freq_den: 0 },
    ];
    const result = mapUhabitsToKanso(mockHabits, []);
    for (const habit of result.habits) {
      expect(habit.frequency_count).toBeUndefined();
      expect(habit.frequency_period).toBeUndefined();
    }
  });
});

describe("toCreateHabitInput", () => {
  const baseHabit: Habit = {
    id: "h1",
    user_id: "",
    name: "Exercise",
    description: "Stay fit",
    color: "#4A8A8A",
    icon: "Dumbbell",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    archived_at: null,
    start_date: "2024-01-01",
    sort_order: 0,
  };

  it("forwards core fields and frequency to the create-habit input", () => {
    const input = toCreateHabitInput({
      ...baseHabit,
      frequency_count: 3,
      frequency_period: "week",
    });

    expect(input.name).toBe("Exercise");
    expect(input.description).toBe("Stay fit");
    expect(input.color).toBe("#4A8A8A");
    expect(input.icon).toBe("Dumbbell");
    expect(input.start_date).toBe("2024-01-01");
    expect(input.frequency_count).toBe(3);
    expect(input.frequency_period).toBe("week");
  });

  it("omits frequency when the habit has none", () => {
    const input = toCreateHabitInput(baseHabit);
    expect(input.frequency_count).toBeUndefined();
    expect(input.frequency_period).toBeUndefined();
  });

  it("forwards source_uuid so the origin link survives persist", () => {
    const input = toCreateHabitInput({
      ...baseHabit,
      source_uuid: "abc-123-uuid",
    });
    expect(input.source_uuid).toBe("abc-123-uuid");
  });

  it("forwards full-fidelity habit fields (measurable, reminders, prompt, archived_at)", () => {
    const input = toCreateHabitInput({
      ...baseHabit,
      archived_at: "2026-09-03T12:00:00.000Z",
      habit_type: "measurable",
      target_type: "at_least",
      target_value: 10,
      unit: "pages",
      question: "How many pages?",
      reminder_time: "08:00",
      reminder_days: 127,
    });

    expect(input.archived_at).toBe("2026-09-03T12:00:00.000Z");
    expect(input.habit_type).toBe("measurable");
    expect(input.target_type).toBe("at_least");
    expect(input.target_value).toBe(10);
    expect(input.unit).toBe("pages");
    expect(input.question).toBe("How many pages?");
    expect(input.reminder_time).toBe("08:00");
    expect(input.reminder_days).toBe(127);
  });
});

describe("uhabitsImport streak fidelity (integration)", () => {
  // Mon/Wed/Fri across four weeks, ending on today (Fri 2024-05-31).
  const threePerWeekReps = [
    "2024-05-06",
    "2024-05-08",
    "2024-05-10",
    "2024-05-13",
    "2024-05-15",
    "2024-05-17",
    "2024-05-20",
    "2024-05-22",
    "2024-05-24",
    "2024-05-27",
    "2024-05-29",
    "2024-05-31",
  ].map((d) => ({ habit: 1, timestamp: Date.parse(d), value: 2 }));

  const today = new Date(2024, 4, 31);

  it("interpolates a 3×/week habit into one continuous run", () => {
    const { habits, entries } = mapUhabitsToKanso(
      [{ id: 1, name: "Gym", archived: 0, freq_num: 3, freq_den: 7 }],
      threePerWeekReps,
    );

    // 12 logged reps, backward-snapped & interpolated: 2024-05-04..05-31 = 28 days.
    expect(getCurrentStreak(habits[0], entries, today)).toBe(28);
  });

  it("would collapse to a 1-day streak without the frequency (the bug)", () => {
    const { entries } = mapUhabitsToKanso(
      [{ id: 1, name: "Gym", archived: 0, freq_num: 3, freq_den: 7 }],
      threePerWeekReps,
    );

    // Frequency stripped → treated as daily → breaks on every off-day.
    const asDaily = { frequency_count: undefined, frequency_period: undefined };
    expect(getCurrentStreak(asDaily, entries, today)).toBe(1);
  });
});

describe("classifyUhabitsError", () => {
  it("returns WASM_ERROR_MESSAGE for WASM streaming compile errors", () => {
    const err = new Error(
      "wasm streaming compile failed: TypeError: Failed to fetch",
    );
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns WASM_ERROR_MESSAGE for both async and sync fetching failed error", () => {
    const err = new Error("both async and sync fetching of the wasm failed");
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns WASM_ERROR_MESSAGE for Aborted WASM errors", () => {
    const err = new Error(
      "Aborted(both async and sync fetching of the wasm failed)",
    );
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns WASM_ERROR_MESSAGE for failed to asynchronously prepare wasm errors", () => {
    const err = new Error("failed to asynchronously prepare wasm: TypeError");
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns WASM_ERROR_MESSAGE when an HTML page is compiled as wasm (Chrome)", () => {
    const err = new Error(
      "CompileError: WebAssembly.instantiate(): expected magic word 00 61 73 6d, found 3c 21 44 4f @+0",
    );
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns WASM_ERROR_MESSAGE when an HTML page is compiled as wasm (Firefox)", () => {
    const err = new Error(
      "CompileError: wasm validation error: at offset 0: failed to match magic number",
    );
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns WASM_ERROR_MESSAGE for an unsupported MIME type response", () => {
    const err = new Error(
      "TypeError: WebAssembly: Response has unsupported MIME type 'text/html' expected 'application/wasm'",
    );
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns WASM_ERROR_MESSAGE for a truncated wasm body", () => {
    const err = new Error(
      "CompileError: WebAssembly.instantiate(): expected 4 bytes, fell off end @+0",
    );
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns WASM_ERROR_MESSAGE for an empty wasm body", () => {
    const err = new Error(
      "CompileError: WebAssembly.instantiate(): BufferSource argument is empty",
    );
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns SCHEMA_ERROR_MESSAGE for non-WASM errors", () => {
    const err = new Error("no such table: habits");
    expect(classifyUhabitsError(err)).toBe(SCHEMA_ERROR_MESSAGE);
  });

  it("returns SCHEMA_ERROR_MESSAGE for generic errors", () => {
    const err = new Error("some unexpected db error");
    expect(classifyUhabitsError(err)).toBe(SCHEMA_ERROR_MESSAGE);
  });

  it("returns SCHEMA_ERROR_MESSAGE for non-Error objects", () => {
    expect(classifyUhabitsError("string error")).toBe(SCHEMA_ERROR_MESSAGE);
    expect(classifyUhabitsError(null)).toBe(SCHEMA_ERROR_MESSAGE);
    expect(classifyUhabitsError(undefined)).toBe(SCHEMA_ERROR_MESSAGE);
  });
});

describe("uhabits module exports", () => {
  it("exports parseUhabitsFile as an async function", async () => {
    const mod = await import("../../src/lib/import/uhabits");
    expect(typeof mod.parseUhabitsFile).toBe("function");
  });

  it("exports mapUhabitsToKanso as a function", async () => {
    const mod = await import("../../src/lib/import/uhabits");
    expect(typeof mod.mapUhabitsToKanso).toBe("function");
  });
});

describe("uhabitsImport full-fidelity mapping", () => {
  it("maps measurable habit type, target_type, target_value, and unit", () => {
    const mockHabits = [
      {
        id: 1,
        name: "Read",
        archived: 0,
        type: 1,
        target_type: 0,
        target_value: 10.0,
        unit: "pages",
      },
      {
        id: 2,
        name: "Limit Sugar",
        archived: 0,
        type: 1,
        target_type: 1,
        target_value: 25.0,
        unit: "grams",
      },
    ];
    const result = mapUhabitsToKanso(mockHabits, []);
    expect(result.habits[0].habit_type).toBe("measurable");
    expect(result.habits[0].target_type).toBe("at_least");
    expect(result.habits[0].target_value).toBe(10.0);
    expect(result.habits[0].unit).toBe("pages");

    expect(result.habits[1].habit_type).toBe("measurable");
    expect(result.habits[1].target_type).toBe("at_most");
    expect(result.habits[1].target_value).toBe(25.0);
    expect(result.habits[1].unit).toBe("grams");
  });

  it("maps question prompt, reminder_time formatted as HH:mm, and reminder_days", () => {
    const mockHabits = [
      {
        id: 1,
        name: "Wake Early",
        archived: 0,
        question: "Did you wake up early?",
        reminder_hour: 6,
        reminder_min: 0,
        reminder_days: 127,
      },
      {
        id: 2,
        name: "Night Stretch",
        archived: 0,
        question: "Did you stretch before bed?",
        reminder_hour: 22,
        reminder_min: 45,
        reminder_days: 119,
      },
      {
        id: 3,
        name: "No Reminder",
        archived: 0,
        reminder_hour: null,
        reminder_min: null,
        reminder_days: 0,
      },
    ];
    const result = mapUhabitsToKanso(mockHabits, []);
    expect(result.habits[0].question).toBe("Did you wake up early?");
    expect(result.habits[0].reminder_time).toBe("06:00");
    expect(result.habits[0].reminder_days).toBe(127);

    expect(result.habits[1].question).toBe("Did you stretch before bed?");
    expect(result.habits[1].reminder_time).toBe("22:45");
    expect(result.habits[1].reminder_days).toBe(119);

    expect(result.habits[2].reminder_time).toBeNull();
    expect(result.habits[2].reminder_days).toBe(0);
  });

  it("maps numerical repetitions by dividing by 1000.0 and preserves notes", () => {
    const mockHabits = [
      {
        id: 1,
        name: "Read",
        archived: 0,
        type: 1,
        target_value: 10.0,
        unit: "pages",
      },
    ];
    const mockRepetitions = [
      {
        habit: 1,
        timestamp: 1715097600000,
        value: 1000,
        notes: "Read 1 page intro",
      },
      {
        habit: 1,
        timestamp: 1715184000000,
        value: 8000,
        notes: "Read chapter 2",
      },
      {
        habit: 1,
        timestamp: 1715270400000,
        value: 3,
        notes: "Rest day",
      },
    ];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].value).toBe(1.0);
    expect(result.entries[0].notes).toBe("Read 1 page intro");
    expect(result.entries[1].value).toBe(8.0);
    expect(result.entries[1].notes).toBe("Read chapter 2");
    expect(result.entries[2].value).toBe(-2);
    expect(result.entries[2].notes).toBe("Rest day");
  });
});

describe("synthetic Loop backup import", () => {
  it("imports every fidelity path from a Loop-schema .db", async () => {
    const { parseUhabitsFile } = await import("../../src/lib/import/uhabits");
    const { habits, entries } = await parseUhabitsFile(
      toBlob(await buildLoopBackupFixture()),
      "public/sql-wasm.wasm",
    );

    expect(habits).toHaveLength(LOOP_FIXTURE.habitCount);
    expect(habits.filter((h) => h.archived_at === null)).toHaveLength(
      LOOP_FIXTURE.activeCount,
    );
    expect(entries).toHaveLength(LOOP_FIXTURE.entryCount);

    const workout = habits.find((h) => h.name === "WORKOUT")!;
    expect(workout.question).toBe("Did you work out?");
    expect(workout.reminder_time).toBe("06:00");
    const workoutEntries = entries.filter((e) => e.habit_id === workout.id);
    expect(workoutEntries.filter((e) => e.value === 1)).toHaveLength(3);
    expect(workoutEntries.filter((e) => e.value === 0)).toHaveLength(2);
    expect(workoutEntries.filter((e) => e.value === -2)).toHaveLength(1);
    expect(workoutEntries.find((e) => e.value === -2)?.notes).toBe("Rest day");

    const book = habits.find((h) => h.name === "READ A BOOK")!;
    expect(book.archived_at).toBeTruthy();
    expect(book.habit_type).toBe("measurable");
    expect(book.target_value).toBe(10);
    expect(book.unit).toBe("pages");
    const bookEntries = entries.filter((e) => e.habit_id === book.id);
    expect(
      bookEntries
        .filter((e) => e.value > 0)
        .map((e) => e.value)
        .sort(),
    ).toEqual([1, 8]);
    expect(bookEntries.filter((e) => e.value === -2)).toHaveLength(2);

    const haircut = habits.find((h) => h.name === "HAIRCUT")!;
    expect(haircut.frequency_period).toBe("month");
    expect(haircut.reminder_time).toBe("07:00");
    expect(haircut.reminder_days).toBe(119);

    const gym = habits.find((h) => h.name === "GYM")!;
    expect(gym.frequency_count).toBe(3);
    expect(gym.frequency_period).toBe("week");
  });
});

describe("real Loop Habits backup database audit", () => {
  it.skipIf(!hasRealLoopBackup)(
    "imports cleanly from Loop Habits Backup 2026-09-03 103056.db with full fidelity",
    async () => {
      const { parseUhabitsFile } = await import("../../src/lib/import/uhabits");

      const buf = readRealLoopBackup();
      const { habits, entries } = await parseUhabitsFile(
        toBlob(buf),
        "public/sql-wasm.wasm",
      );

      // 2 UNKNOWN rows lack Kagelin equivalents and are dropped.
      expect(entries).toHaveLength(4183);

      expect(habits).toHaveLength(12);

      const activeHabits = habits.filter((h) => h.archived_at === null);
      const archivedHabits = habits.filter((h) => h.archived_at !== null);
      expect(activeHabits).toHaveLength(6);
      expect(archivedHabits).toHaveLength(6);

      const readBook = habits.find((h) => h.name === "READ A BOOK");
      expect(readBook).toBeDefined();
      expect(readBook?.archived_at).toBeTruthy();
      expect(readBook?.habit_type).toBe("measurable");
      expect(readBook?.target_value).toBe(10.0);
      expect(readBook?.unit).toBe("pages");
      expect(readBook?.target_type).toBe("at_least");
      expect(readBook?.question).toBe("How many pages did you read?");

      const bookEntries = entries.filter((e) => e.habit_id === readBook?.id);
      expect(bookEntries).toHaveLength(6);
      const skipBookEntries = bookEntries.filter((e) => e.value === -2);
      expect(skipBookEntries).toHaveLength(4);
      const numericalEntries = bookEntries.filter((e) => e.value > 0);
      expect(numericalEntries.map((e) => e.value).sort()).toEqual([1.0, 8.0]);

      const workout = habits.find((h) => h.name === "WORKOUT");
      expect(workout).toBeDefined();
      expect(workout?.archived_at).toBeNull();
      const workoutEntries = entries.filter((e) => e.habit_id === workout?.id);
      const workoutSkips = workoutEntries.filter((e) => e.value === -2);
      const workoutDone = workoutEntries.filter((e) => e.value === 1);
      const workoutMissed = workoutEntries.filter((e) => e.value === 0);
      expect(workoutSkips).toHaveLength(27);
      expect(workoutDone).toHaveLength(229);
      expect(workoutMissed).toHaveLength(701);
      expect(workoutEntries).toHaveLength(957);

      const earlyToRise = habits.find((h) => h.name === "EARLY TO RISE");
      expect(earlyToRise?.reminder_time).toBe("06:00");
      expect(earlyToRise?.reminder_days).toBe(127);

      const haircut = habits.find((h) => h.name === "HAIRCUT");
      expect(haircut?.reminder_time).toBe("07:00");
      expect(haircut?.reminder_days).toBe(119);

      const earlyToBed = habits.find((h) => h.name === "EARLY TO BED");
      expect(earlyToBed?.reminder_time).toBe("22:45");
      expect(earlyToBed?.reminder_days).toBe(127);
    },
  );
});
