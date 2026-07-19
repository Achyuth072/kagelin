import { describe, it, expect } from "vitest";
import {
  mapUhabitsToKanso,
  toCreateHabitInput,
} from "../../src/lib/import/uhabits";
import type { Habit } from "../../src/lib/types/habit";
import { getCurrentStreak } from "../../src/lib/utils/habit-streak";
import {
  classifyUhabitsError,
  WASM_ERROR_MESSAGE,
  SCHEMA_ERROR_MESSAGE,
} from "../../src/lib/import/uhabitsErrors";
import { PROJECT_COLORS } from "../../src/lib/constants/colors";

describe("uhabitsImport", () => {
  it("should correctly map habits from uhabits schema", () => {
    const mockHabits = [
      {
        id: 1,
        name: "Drink Water",
        description: "Stay hydrated",
        color: 8, // Loop palette index 8 = Cyan
        archived: 0,
      },
    ];

    // Loop Habit Tracker uses value=2 for YES (completed)
    const mockRepetitions = [
      {
        habit: 1,
        timestamp: 1715097600000, // 2024-05-07
        value: 2,
      },
    ];

    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);

    expect(result.habits).toHaveLength(1);
    expect(result.habits[0].name).toBe("Drink Water");
    expect(result.habits[0].description).toBe("Stay hydrated");
    expect(result.habits[0].icon).toBe("Droplet"); // "water" keyword → Droplet

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].date).toBe("2024-05-07");
    // Loop's YES (value=2) must be normalized to Kagelin's completed (value=1)
    expect(result.entries[0].value).toBe(1);
  });

  it("should handle empty data", () => {
    const result = mapUhabitsToKanso([], []);
    expect(result.habits).toHaveLength(0);
    expect(result.entries).toHaveLength(0);
  });

  it("should skip archived habits", () => {
    const mockHabits = [
      {
        id: 1,
        name: "Old Habit",
        archived: 1,
      },
    ];
    const result = mapUhabitsToKanso(mockHabits, []);
    expect(result.habits).toHaveLength(0);
  });

  it("should filter out value=0 (NO) repetitions — only completed entries imported", () => {
    const mockHabits = [{ id: 1, name: "Exercise", archived: 0 }];
    const mockRepetitions = [
      { habit: 1, timestamp: 1715097600000, value: 0 }, // NO — should be skipped
      { habit: 1, timestamp: 1715184000000, value: 2 }, // YES — should be imported
      { habit: 1, timestamp: 1715270400000, value: 3 }, // SKIP — should be skipped
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
      { id: 1, name: "Test", archived: 0, color: 0 }, // Loop Red → closest Kagelin
      { id: 2, name: "Test2", archived: 0, color: 7 }, // Loop Teal → closest Kagelin
      { id: 3, name: "Test3", archived: 0, color: 99 }, // Unknown index → default
    ];
    const result = mapUhabitsToKanso(mockHabits, []);

    // All mapped colors must exist in the Kagelin palette
    expect(kansoHexes.has(result.habits[0].color.toLowerCase())).toBe(true);
    expect(kansoHexes.has(result.habits[1].color.toLowerCase())).toBe(true);

    // Specific mappings (nearest-neighbor in RGB space against the 24-color palette)
    expect(result.habits[0].color).toBe("#B56C5A"); // Loop Red #f44336 → Terracotta
    expect(result.habits[1].color).toBe("#4A8A8A"); // Loop Teal #009688 → Teal
    expect(result.habits[2].color).toBe("#4B6CB7"); // unknown → Kagelin Blue default
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
    expect(result.habits[0].icon).toBe("Dumbbell"); // workout
    expect(result.habits[1].icon).toBe("Book"); // read
    expect(result.habits[2].icon).toBe("Brain"); // meditation
    expect(result.habits[3].icon).toBe("Sun"); // rise/morning
    expect(result.habits[4].icon).toBe("Droplet"); // shampoo/hygiene
    expect(result.habits[5].icon).toBe("Flame"); // no match → default
  });

  it("should set start_date from earliest completed entry, not today", () => {
    const mockHabits = [{ id: 1, name: "Exercise", archived: 0 }];
    const mockRepetitions = [
      { habit: 1, timestamp: 1689120000000, value: 2 }, // 2023-07-12
      { habit: 1, timestamp: 1715097600000, value: 2 }, // 2024-05-07 (later)
      { habit: 1, timestamp: 1688947200000, value: 2 }, // 2023-07-10 (earliest)
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
      { habit: 1, timestamp: 1715097600000, value: 2 }, // 2024-05-07
      { habit: 1, timestamp: 1715097600000, value: 2 }, // 2024-05-07 duplicate
      { habit: 1, timestamp: 1715184000000, value: 2 }, // 2024-05-08 different date
    ];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.entries).toHaveLength(2); // not 3
    const dates = result.entries.map((e) => e.date);
    expect(new Set(dates).size).toBe(dates.length); // all unique dates
  });

  it("should not import entries for archived habits", () => {
    const mockHabits = [
      { id: 1, name: "Active", archived: 0 },
      { id: 2, name: "Archived", archived: 1 },
    ];
    const mockRepetitions = [
      { habit: 1, timestamp: 1715097600000, value: 2 },
      { habit: 2, timestamp: 1715097600000, value: 2 }, // archived habit — entries skipped
    ];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.habits).toHaveLength(1);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].habit_id).toBe(result.habits[0].id);
  });
});

describe("uhabitsImport frequency mapping", () => {
  it("maps exact denominators to day/week/month with count = freq_num", () => {
    const mockHabits = [
      { id: 1, name: "Daily", archived: 0, freq_num: 1, freq_den: 1 },
      { id: 2, name: "Thrice weekly", archived: 0, freq_num: 3, freq_den: 7 },
      { id: 3, name: "Monthly", archived: 0, freq_num: 1, freq_den: 30 },
      { id: 4, name: "Monthly31", archived: 0, freq_num: 2, freq_den: 31 },
    ];
    const result = mapUhabitsToKanso(mockHabits, []);

    expect(result.habits[0].frequency_count).toBe(1);
    expect(result.habits[0].frequency_period).toBe("day");
    expect(result.habits[1].frequency_count).toBe(3);
    expect(result.habits[1].frequency_period).toBe("week");
    expect(result.habits[2].frequency_count).toBe(1);
    expect(result.habits[2].frequency_period).toBe("month");
    expect(result.habits[3].frequency_count).toBe(2);
    expect(result.habits[3].frequency_period).toBe("month");
  });

  it("approximates inexpressible fractions to weekly, half-up", () => {
    const mockHabits = [
      { id: 1, name: "Every other day", archived: 0, freq_num: 1, freq_den: 2 },
      { id: 2, name: "Every 3 days", archived: 0, freq_num: 1, freq_den: 3 },
      { id: 3, name: "Every 5 days", archived: 0, freq_num: 1, freq_den: 5 },
      { id: 4, name: "Custom 5/10", archived: 0, freq_num: 5, freq_den: 10 },
    ];
    const result = mapUhabitsToKanso(mockHabits, []);

    // count = max(1, round(freq_num * 7 / freq_den)), period = week
    expect(result.habits[0].frequency_period).toBe("week");
    expect(result.habits[0].frequency_count).toBe(4); // round(3.5)
    expect(result.habits[1].frequency_count).toBe(2); // round(2.33)
    expect(result.habits[2].frequency_count).toBe(1); // round(1.4)
    expect(result.habits[3].frequency_count).toBe(4); // round(3.5)
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
    expect(input.frequencyCount).toBe(3);
    expect(input.frequencyPeriod).toBe("week");
  });

  it("omits frequency when the habit has none", () => {
    const input = toCreateHabitInput(baseHabit);
    expect(input.frequencyCount).toBeUndefined();
    expect(input.frequencyPeriod).toBeUndefined();
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

  const today = new Date(2024, 4, 31); // local Fri 2024-05-31

  it("interpolates a 3×/week habit into one continuous run", () => {
    const { habits, entries } = mapUhabitsToKanso(
      [{ id: 1, name: "Gym", archived: 0, freq_num: 3, freq_den: 7 }],
      threePerWeekReps,
    );

    // 12 logged reps, but the schedule fills the gaps: 2024-05-06..05-31 = 26 days.
    expect(getCurrentStreak(habits[0], entries, today)).toBe(26);
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

  // When the wasm fetch is redirected to /login, the browser compiles the HTML
  // login page as wasm. The resulting errors must not blame the user's .db file.
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
