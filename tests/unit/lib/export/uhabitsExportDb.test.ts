import { describe, it, expect, vi } from "vitest";
import initSqlJs from "sql.js";
import {
  exportToUhabitsDb,
  findClosestLoopColor,
  mapKagelinFrequencyToLoop,
  entryToRepetitionValue,
  dateStringToUtcMidnightMs,
  collectUhabitsExportData,
} from "@/lib/export/uhabitsExportDb";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { PROJECT_COLORS } from "@/lib/constants/colors";

describe("uhabitsExportDb - pure helpers", () => {
  it("maps hex colors to the closest Loop palette index (0-20)", () => {
    expect(findClosestLoopColor("#f44336")).toBe(0);
    expect(findClosestLoopColor("#ff9800")).toBe(2);
    expect(findClosestLoopColor("#4caf50")).toBe(6);
    expect(findClosestLoopColor("#009688")).toBe(7);
    expect(findClosestLoopColor("#2196f3")).toBe(10);
    expect(findClosestLoopColor("#3f51b5")).toBe(11);
    expect(findClosestLoopColor("#9c27b0")).toBe(13);
    expect(findClosestLoopColor("#e91e63")).toBe(14);
  });

  it("maps every Kagelin project color (PROJECT_COLORS) to a valid Loop color index (0-20)", () => {
    for (const color of PROJECT_COLORS) {
      const idx = findClosestLoopColor(color.hex);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(20);
    }
  });

  it("maps Kagelin frequency periods and counts to freq_num / freq_den", () => {
    expect(mapKagelinFrequencyToLoop(1, "day")).toEqual({
      freq_num: 1,
      freq_den: 1,
    });
    expect(mapKagelinFrequencyToLoop(2, "day")).toEqual({
      freq_num: 2,
      freq_den: 1,
    });
    expect(mapKagelinFrequencyToLoop(3, "week")).toEqual({
      freq_num: 3,
      freq_den: 7,
    });
    expect(mapKagelinFrequencyToLoop(5, "month")).toEqual({
      freq_num: 5,
      freq_den: 30,
    });
    expect(mapKagelinFrequencyToLoop(undefined, undefined)).toEqual({
      freq_num: 1,
      freq_den: 1,
    });
  });

  it("maps entry values to Loop repetition values", () => {
    expect(entryToRepetitionValue(1, "boolean")).toBe(2);
    expect(entryToRepetitionValue(0, "boolean")).toBe(0);
    expect(entryToRepetitionValue(-2, "boolean")).toBe(3);

    expect(entryToRepetitionValue(10, "measurable")).toBe(10000);
    expect(entryToRepetitionValue(1.5, "measurable")).toBe(1500);
    expect(entryToRepetitionValue(0.123, "measurable")).toBe(123);
    expect(entryToRepetitionValue(0, "measurable")).toBe(0);
    expect(entryToRepetitionValue(-2, "measurable")).toBe(3);
  });

  it("converts YYYY-MM-DD date strings to UTC midnight epoch milliseconds", () => {
    expect(dateStringToUtcMidnightMs("2023-07-10")).toBe(1688947200000);
    expect(dateStringToUtcMidnightMs("2024-01-01")).toBe(1704067200000);
  });
});

describe("exportToUhabitsDb - SQLite database construction", () => {
  const getSql = async () => {
    return await initSqlJs({
      locateFile: () => "public/sql-wasm.wasm",
    });
  };

  it("builds an in-memory SQLite database with PRAGMA user_version = 25, expected tables and index", async () => {
    const SQL = await getSql();

    const mockHabit: Habit = {
      id: "h1",
      user_id: "u1",
      name: "Meditation",
      description: "Daily mindfulness",
      color: "#4caf50",
      icon: "Brain",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      archived_at: null,
      start_date: "2024-01-01",
      sort_order: 0,
      habit_type: "boolean",
      frequency_count: 1,
      frequency_period: "day",
      question: "Did you meditate?",
      reminder_time: "07:00",
      reminder_days: 127,
    };

    const mockEntry: HabitEntry = {
      id: "e1",
      habit_id: "h1",
      date: "2024-01-02",
      value: 1,
      notes: "Peaceful morning",
      created_at: "2024-01-02T07:15:00Z",
    };

    const binary = await exportToUhabitsDb({
      habits: [mockHabit],
      entries: [mockEntry],
      wasmPath: "public/sql-wasm.wasm",
    });

    expect(binary).toBeInstanceOf(Uint8Array);
    expect(binary.length).toBeGreaterThan(0);

    const db = new SQL.Database(binary);

    const versionResult = db.exec("PRAGMA user_version");
    expect(versionResult[0].values[0][0]).toBe(25);

    const metadataResult = db.exec("SELECT locale FROM android_metadata");
    expect(metadataResult[0].values[0][0]).toBe("en_US");

    const tablesResult = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const tableNames = tablesResult[0].values.map((row) => row[0]);
    expect(tableNames).toContain("android_metadata");
    expect(tableNames).toContain("Habits");
    expect(tableNames).toContain("Repetitions");
    expect(tableNames).toContain("Events");
    expect(tableNames).toContain("sqlite_sequence");

    const indicesResult = db.exec(
      "SELECT name FROM sqlite_master WHERE type='index'",
    );
    const indexNames = indicesResult[0].values.map((row) => row[0]);
    expect(indexNames).toContain("idx_repetitions_habit_timestamp");

    const habitsResult = db.exec("SELECT * FROM Habits");
    expect(habitsResult[0].values).toHaveLength(1);
    const habitCols = habitsResult[0].columns;
    const habitRow = habitsResult[0].values[0];
    const getHabitVal = (col: string) => habitRow[habitCols.indexOf(col)];

    expect(getHabitVal("name")).toBe("Meditation");
    expect(getHabitVal("description")).toBe("Daily mindfulness");
    expect(getHabitVal("question")).toBe("Did you meditate?");
    expect(getHabitVal("freq_num")).toBe(1);
    expect(getHabitVal("freq_den")).toBe(1);
    expect(getHabitVal("reminder_hour")).toBe(7);
    expect(getHabitVal("reminder_min")).toBe(0);
    expect(getHabitVal("reminder_days")).toBe(127);
    expect(getHabitVal("type")).toBe(0);
    expect(getHabitVal("archived")).toBe(0);
    expect(getHabitVal("uuid")).toMatch(/^[0-9a-f]{32}$/);

    const repetitionsResult = db.exec("SELECT * FROM Repetitions");
    expect(repetitionsResult[0].values).toHaveLength(1);
    const repCols = repetitionsResult[0].columns;
    const repRow = repetitionsResult[0].values[0];
    const getRepVal = (col: string) => repRow[repCols.indexOf(col)];

    expect(getRepVal("habit")).toBe(getHabitVal("id"));
    expect(getRepVal("timestamp")).toBe(
      dateStringToUtcMidnightMs("2024-01-02"),
    );
    expect(getRepVal("value")).toBe(2);
    expect(getRepVal("notes")).toBe("Peaceful morning");

    db.close();
  });

  it("exports newly created measurable and boolean habits with valid uhabits metadata", async () => {
    const SQL = await getSql();

    const booleanHabit: Habit = {
      id: "h-bool",
      user_id: "u1",
      name: "Floss",
      description: null,
      icon: null,
      color: "#ff9800",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      archived_at: "2024-02-01T00:00:00Z",
      start_date: "2024-01-01",
      sort_order: 1,
      habit_type: "boolean",
      frequency_count: 5,
      frequency_period: "week",
      reminder_time: null,
      reminder_days: 0,
    };

    const measurableHabit: Habit = {
      id: "h-meas",
      user_id: "u1",
      name: "Run",
      description: null,
      icon: null,
      color: "#2196f3",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      archived_at: null,
      start_date: "2024-01-01",
      sort_order: 2,
      habit_type: "measurable",
      target_type: "at_least",
      target_value: 5.5,
      unit: "km",
      frequency_count: 3,
      frequency_period: "week",
      reminder_time: "18:45",
      reminder_days: 62,
    };

    const binary = await exportToUhabitsDb({
      habits: [booleanHabit, measurableHabit],
      entries: [
        {
          id: "e-meas-1",
          habit_id: "h-meas",
          date: "2024-01-05",
          value: 6.2,
          notes: null,
          created_at: "2024-01-05T19:00:00Z",
        },
        {
          id: "e-meas-2",
          habit_id: "h-meas",
          date: "2024-01-06",
          value: -2,
          notes: "Rest day",
          created_at: "2024-01-06T19:00:00Z",
        },
        {
          id: "e-bool-1",
          habit_id: "h-bool",
          date: "2024-01-05",
          value: 0,
          notes: "",
          created_at: "2024-01-05T20:00:00Z",
        },
      ],
      wasmPath: "public/sql-wasm.wasm",
    });

    const db = new SQL.Database(binary);
    const habitsResult = db.exec("SELECT * FROM Habits ORDER BY position");
    expect(habitsResult[0].values).toHaveLength(2);

    const cols = habitsResult[0].columns;
    const rowBool = habitsResult[0].values[0];
    const rowMeas = habitsResult[0].values[1];
    const getBool = (col: string) => rowBool[cols.indexOf(col)];
    const getMeas = (col: string) => rowMeas[cols.indexOf(col)];

    expect(getBool("name")).toBe("Floss");
    expect(getBool("type")).toBe(0);
    expect(getBool("archived")).toBe(1);
    expect(getBool("color")).toBe(2);
    expect(getBool("freq_num")).toBe(5);
    expect(getBool("freq_den")).toBe(7);
    expect(getBool("reminder_hour")).toBeNull();
    expect(getBool("reminder_min")).toBeNull();
    expect(getBool("reminder_days")).toBe(0);
    expect(getBool("uuid")).toMatch(/^[0-9a-f]{32}$/);

    expect(getMeas("name")).toBe("Run");
    expect(getMeas("type")).toBe(1);
    expect(getMeas("archived")).toBe(0);
    expect(getMeas("target_type")).toBe(0);
    expect(getMeas("target_value")).toBe(5.5);
    expect(getMeas("unit")).toBe("km");
    expect(getMeas("color")).toBe(10);
    expect(getMeas("freq_num")).toBe(3);
    expect(getMeas("freq_den")).toBe(7);
    expect(getMeas("reminder_hour")).toBe(18);
    expect(getMeas("reminder_min")).toBe(45);
    expect(getMeas("reminder_days")).toBe(62);
    expect(getMeas("uuid")).toMatch(/^[0-9a-f]{32}$/);

    const repsResult = db.exec(
      "SELECT habit, timestamp, value, notes FROM Repetitions ORDER BY timestamp, habit",
    );
    expect(repsResult[0].values).toHaveLength(3);

    const repMeas = repsResult[0].values.find(
      (r) => r[0] === getMeas("id") && r[2] === 6200,
    );
    expect(repMeas).toBeDefined();
    expect(repMeas![3]).toBe("");

    const repSkip = repsResult[0].values.find(
      (r) => r[0] === getMeas("id") && r[2] === 3,
    );
    expect(repSkip).toBeDefined();
    expect(repSkip![3]).toBe("Rest day");

    const repMiss = repsResult[0].values.find(
      (r) => r[0] === getBool("id") && r[2] === 0,
    );
    expect(repMiss).toBeDefined();

    db.close();
  });

  it("merges habits with source_uuid with raw provenance from habit_imports (preserving frequencies, UUIDs, reminders)", async () => {
    const SQL = await getSql();

    const originalUuid = "ef277f81d78b40fcb72293018228790c";

    const importedHabit: Habit = {
      id: "kagelin-h2",
      user_id: "u1",
      name: "SHAMPOO",
      description: null,
      color: "#ff9800",
      icon: "Droplet",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      archived_at: null,
      start_date: "2023-07-10",
      sort_order: 1,
      source_uuid: originalUuid,
      habit_type: "boolean",
      frequency_count: 2,
      frequency_period: "week",
      question: null,
      reminder_time: "07:00",
      reminder_days: 127,
    };

    const rawProvenance = {
      habits: [
        {
          id: 2,
          archived: 0,
          color: 2,
          description: "Original description",
          freq_den: 3,
          freq_num: 1,
          highlight: 1,
          name: "SHAMPOO",
          position: 1,
          reminder_hour: 7,
          reminder_min: 0,
          reminder_days: 127,
          type: 0,
          target_type: 0,
          target_value: 0,
          unit: "",
          question: "Did you shampoo?",
          uuid: originalUuid,
        },
      ],
      repetitions: [],
    };

    const binary = await exportToUhabitsDb({
      habits: [importedHabit],
      entries: [],
      rawSources: [rawProvenance],
      wasmPath: "public/sql-wasm.wasm",
    });

    const db = new SQL.Database(binary);
    const habitsResult = db.exec("SELECT * FROM Habits");
    expect(habitsResult[0].values).toHaveLength(1);

    const cols = habitsResult[0].columns;
    const row = habitsResult[0].values[0];
    const getVal = (col: string) => row[cols.indexOf(col)];

    expect(getVal("uuid")).toBe(originalUuid);
    expect(getVal("freq_num")).toBe(1);
    expect(getVal("freq_den")).toBe(3);
    expect(getVal("color")).toBe(2);
    expect(getVal("highlight")).toBe(1);
    expect(getVal("question")).toBe("Did you shampoo?");

    db.close();
  });

  it("does not allow newly created habits sorted first to steal IDs of imported habits", async () => {
    const SQL = await getSql();

    const newHabit: Habit = {
      id: "new-h1",
      user_id: "u1",
      name: "AAA New Habit",
      description: null,
      icon: null,
      color: "#ff9800",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      archived_at: null,
      start_date: "2024-01-01",
      sort_order: 0,
      habit_type: "boolean",
    };

    const importedHabit: Habit = {
      id: "imp-h1",
      user_id: "u1",
      name: "BBB Imported Habit",
      description: null,
      icon: null,
      color: "#2196f3",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      archived_at: null,
      start_date: "2024-01-01",
      sort_order: 1,
      source_uuid: "11112222333344445555666677778888",
      habit_type: "boolean",
    };

    const rawProvenance = {
      habits: [
        {
          id: 1,
          uuid: "11112222333344445555666677778888",
          name: "BBB Imported Habit",
        },
      ],
      repetitions: [],
    };

    const binary = await exportToUhabitsDb({
      habits: [newHabit, importedHabit],
      entries: [],
      rawSources: [rawProvenance],
      wasmPath: "public/sql-wasm.wasm",
    });

    const db = new SQL.Database(binary);
    const rows = db.exec("SELECT id, name FROM Habits ORDER BY id");
    expect(rows[0].values).toEqual([
      [1, "BBB Imported Habit"],
      [2, "AAA New Habit"],
    ]);
    db.close();
  });
});

describe("collectUhabitsExportData - wrapped client & guest mode", () => {
  it("collects data for guests from mockStore and idb-keyval", async () => {
    const { mockStore } = await import("@/lib/mock/mock-store");

    const testHabit: Habit = {
      id: "guest-h1",
      user_id: "",
      name: "Guest Habit",
      description: null,
      icon: null,
      color: "#ff9800",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      archived_at: null,
      start_date: "2024-01-01",
      sort_order: 0,
      habit_type: "boolean",
    };
    mockStore.restoreHabit(testHabit);

    const testEntry: HabitEntry = {
      id: "guest-e1",
      habit_id: "guest-h1",
      date: "2024-01-02",
      value: 1,
      notes: "Guest note",
      created_at: "2024-01-02T00:00:00Z",
    };
    mockStore.addHabitEntries([testEntry]);

    const data = await collectUhabitsExportData({ isGuest: true });

    expect(data.habits.some((h) => h.id === "guest-h1")).toBe(true);
    expect(data.entries.some((e) => e.id === "guest-e1")).toBe(true);
    expect(Array.isArray(data.rawSources)).toBe(true);
  });

  it("reads decrypted fields through the wrapped Supabase client", async () => {
    const { wrapSupabaseClient } = await import("@/lib/supabase/wrapClient");
    const { FIELD_MAP } = await import("@/lib/supabase/fieldMap");
    const { generateMasterKey } = await import("@/lib/crypto/masterKey");
    const { isCiphertext } = await import("@/lib/crypto/contentCipher");
    const { createFakeSupabaseClient } =
      await import("../../support/fakeSupabaseClient");

    const backend = createFakeSupabaseClient();
    const wrapped = wrapSupabaseClient(backend, FIELD_MAP);

    const key = await generateMasterKey();
    const keyStoreMod = await import("@/lib/crypto/keyStore");
    const loadSpy = vi
      .spyOn(keyStoreMod.keyStore, "load")
      .mockResolvedValue(key);

    await wrapped.from("habits").insert({
      id: "enc-h1",
      user_id: "u1",
      name: "Encrypted Meditation",
      description: "Secret mindfulness",
      question: "Did you meditate secretly?",
      sort_order: 1,
      color: "#4caf50",
      habit_type: "boolean",
    });

    await wrapped.from("habit_entries").insert({
      id: "enc-e1",
      habit_id: "enc-h1",
      date: "2024-01-02",
      value: 1,
      notes: "Secret reflection note",
    });

    await wrapped.from("habit_imports").insert({
      id: "enc-imp-1",
      user_id: "u1",
      source_app: "uhabits",
      file_name: "backup.db",
      raw: { habits: [{ id: 1, name: "Original Raw" }] },
    });

    const rawHabitRow = backend
      .rawRows("habits")
      .find((r: { id?: string }) => r.id === "enc-h1");
    expect(isCiphertext(rawHabitRow?.name)).toBe(true);
    expect(isCiphertext(rawHabitRow?.description)).toBe(true);
    expect(isCiphertext(rawHabitRow?.question)).toBe(true);

    const rawEntryRow = backend
      .rawRows("habit_entries")
      .find((r: { id?: string }) => r.id === "enc-e1");
    expect(isCiphertext(rawEntryRow?.notes)).toBe(true);

    const rawImportRow = backend
      .rawRows("habit_imports")
      .find((r: { id?: string }) => r.id === "enc-imp-1");
    expect(isCiphertext(rawImportRow?.raw)).toBe(true);

    const data = await collectUhabitsExportData({
      supabase:
        wrapped as unknown as import("@supabase/supabase-js").SupabaseClient,
      isGuest: false,
    });

    const exportedHabit = data.habits.find((h) => h.id === "enc-h1");
    expect(exportedHabit?.name).toBe("Encrypted Meditation");
    expect(exportedHabit?.description).toBe("Secret mindfulness");
    expect(exportedHabit?.question).toBe("Did you meditate secretly?");
    expect(isCiphertext(exportedHabit?.name)).toBe(false);

    const exportedEntry = data.entries.find((e) => e.id === "enc-e1");
    expect(exportedEntry?.notes).toBe("Secret reflection note");
    expect(isCiphertext(exportedEntry?.notes)).toBe(false);

    expect(data.rawSources).toHaveLength(1);
    const firstRawSource = data.rawSources![0] as {
      habits: Array<{ name: string }>;
    };
    expect(firstRawSource.habits[0].name).toBe("Original Raw");

    loadSpy.mockRestore();
  });
});

describe("real Loop Habits backup database audit round-trip", () => {
  it("imports from Loop Habits Backup 2026-09-03 103056.db, exports to SQLite .db, and round-trips with full fidelity", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const { parseUhabitsFile } = await import("@/lib/import/uhabits");

    const dbPath = path.resolve(
      process.cwd(),
      ".scratch/import/Loop Habits Backup 2026-09-03 103056.db",
    );
    expect(fs.existsSync(dbPath)).toBe(true);

    const originalBuffer = fs.readFileSync(dbPath);
    const { habits, entries, source } = await parseUhabitsFile(
      originalBuffer,
      "public/sql-wasm.wasm",
    );

    expect(habits).toHaveLength(12);
    expect(entries).toHaveLength(4183);

    const exportedBinary = await exportToUhabitsDb({
      habits,
      entries,
      rawSources: [source],
      wasmPath: "public/sql-wasm.wasm",
    });

    expect(exportedBinary).toBeInstanceOf(Uint8Array);
    expect(exportedBinary.length).toBeGreaterThan(0);

    const SQL = await initSqlJs({
      locateFile: () => "public/sql-wasm.wasm",
    });
    const exportedDb = new SQL.Database(exportedBinary);

    const version = exportedDb.exec("PRAGMA user_version");
    expect(version[0].values[0][0]).toBe(25);

    const tables = exportedDb.exec(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
    const tableNames = tables[0].values.map((r) => r[0]);
    expect(tableNames).toContain("android_metadata");
    expect(tableNames).toContain("Habits");
    expect(tableNames).toContain("Repetitions");
    expect(tableNames).toContain("Events");
    expect(tableNames).toContain("sqlite_sequence");

    const repsCountResult = exportedDb.exec("SELECT count(*) FROM Repetitions");
    expect(repsCountResult[0].values[0][0]).toBe(4183);

    exportedDb.close();

    const reimported = await parseUhabitsFile(
      exportedBinary,
      "public/sql-wasm.wasm",
    );

    expect(reimported.habits).toHaveLength(12);
    expect(reimported.entries).toHaveLength(4183);

    const readBook = reimported.habits.find((h) => h.name === "READ A BOOK");
    expect(readBook).toBeDefined();
    expect(readBook?.habit_type).toBe("measurable");
    expect(readBook?.target_value).toBe(10.0);
    expect(readBook?.unit).toBe("pages");
    expect(readBook?.question).toBe("How many pages did you read?");
    expect(readBook?.archived_at).toBeTruthy();

    const bookEntries = reimported.entries.filter(
      (e) => e.habit_id === readBook?.id,
    );
    expect(bookEntries).toHaveLength(6);
    const bookSkips = bookEntries.filter((e) => e.value === -2);
    expect(bookSkips).toHaveLength(4);
    const bookVals = bookEntries
      .filter((e) => e.value > 0)
      .map((e) => e.value)
      .sort();
    expect(bookVals).toEqual([1.0, 8.0]);

    const workout = reimported.habits.find((h) => h.name === "WORKOUT");
    expect(workout).toBeDefined();
    expect(workout?.archived_at).toBeNull();
    const workoutEntries = reimported.entries.filter(
      (e) => e.habit_id === workout?.id,
    );
    expect(workoutEntries).toHaveLength(957);
    expect(workoutEntries.filter((e) => e.value === 1)).toHaveLength(229);
    expect(workoutEntries.filter((e) => e.value === -2)).toHaveLength(27);
    expect(workoutEntries.filter((e) => e.value === 0)).toHaveLength(701);

    const haircut = reimported.habits.find((h) => h.name === "HAIRCUT");
    expect(haircut).toBeDefined();
    expect(haircut?.reminder_time).toBe("07:00");
    expect(haircut?.reminder_days).toBe(119);

    const shampoo = reimported.habits.find((h) => h.name === "SHAMPOO");
    expect(shampoo).toBeDefined();
    expect(shampoo?.reminder_time).toBe("07:00");
    expect(shampoo?.reminder_days).toBe(127);
  });
});
