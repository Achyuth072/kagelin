import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";
import { unzipSync, strFromU8 } from "fflate";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { isCiphertext } from "@/lib/crypto/contentCipher";
import { createFakeSupabaseClient } from "../../support/fakeSupabaseClient";
import { parseUhabitsFile } from "@/lib/import/uhabits";
import { exportToUhabitsDb } from "@/lib/export/uhabitsExportDb";
import { exportToUhabitsZip } from "@/lib/export/uhabitsExportCsv";

const keyStoreState: { key: Uint8Array | null } = { key: null };
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => keyStoreState.key),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));

describe("Zero-Knowledge Content Encrypted Round-Trip Verification", () => {
  const dbPath = path.resolve(
    process.cwd(),
    ".scratch/import/Loop Habits Backup 2026-09-03 103056.db",
  );
  const wasmPath = "public/sql-wasm.wasm";

  beforeEach(() => {
    keyStoreState.key = null;
  });

  it("completes full end-to-end round trip against real encrypted flow with 100% fidelity", async () => {
    if (!fs.existsSync(dbPath)) return;

    keyStoreState.key = await generateMasterKey();
    const backend = createFakeSupabaseClient();
    (backend as unknown as { auth: unknown }).auth = {
      getSession: async () => ({
        data: { session: { user: { id: "user-round-trip" } } },
      }),
    };
    const wrapped = wrapSupabaseClient(backend, FIELD_MAP);

    const originalBuffer = fs.readFileSync(dbPath);
    const { habits, entries, source } = await parseUhabitsFile(
      originalBuffer,
      wasmPath,
    );

    expect(habits).toHaveLength(12);
    const activeHabits = habits.filter((h) => h.archived_at === null);
    const archivedHabits = habits.filter((h) => h.archived_at !== null);
    expect(activeHabits).toHaveLength(6);
    expect(archivedHabits).toHaveLength(6);
    expect(entries).toHaveLength(4183);

    await wrapped.from("habit_imports").insert({
      user_id: "user-round-trip",
      source_app: "uhabits",
      file_name: "Loop Habits Backup 2026-09-03 103056.db",
      raw: source,
    });

    const habitIdMap = new Map<string, string>();
    for (let i = 0; i < habits.length; i++) {
      const h = habits[i];
      const { data } = await wrapped
        .from("habits")
        .insert({
          user_id: "user-round-trip",
          name: h.name,
          description: h.description,
          color: h.color,
          icon: h.icon,
          archived_at: h.archived_at,
          start_date: h.start_date,
          sort_order: i,
          habit_type: h.habit_type,
          frequency_count: h.frequency_count,
          frequency_period: h.frequency_period,
          target_type: h.target_type,
          target_value: h.target_value,
          unit: h.unit,
          question: h.question,
          reminder_time: h.reminder_time,
          reminder_days: h.reminder_days,
          source_uuid: h.source_uuid,
        })
        .select()
        .single();

      habitIdMap.set(h.id, data.id);
    }

    const mappedEntries = entries.map((e, idx) => ({
      id: `entry-${idx}`,
      habit_id: habitIdMap.get(e.habit_id)!,
      date: e.date,
      value: e.value,
      notes: e.notes ?? null,
    }));

    for (let i = 0; i < mappedEntries.length; i += 500) {
      await wrapped
        .from("habit_entries")
        .insert(mappedEntries.slice(i, i + 500));
    }

    const rawHabitRows = backend.rawRows("habits");
    const rawImportRows = backend.rawRows("habit_imports");

    expect(rawHabitRows).toHaveLength(12);
    expect(rawImportRows).toHaveLength(1);

    for (const rawHabit of rawHabitRows) {
      expect(isCiphertext(rawHabit.name)).toBe(true);
      if (rawHabit.question) {
        expect(isCiphertext(rawHabit.question)).toBe(true);
      }
    }

    expect(isCiphertext(rawImportRows[0].raw)).toBe(true);
    expect(isCiphertext(rawImportRows[0].file_name)).toBe(true);

    const rawBackendJson = JSON.stringify(backend.rawRows("habits"));
    expect(rawBackendJson).not.toContain("EARLY TO RISE");
    expect(rawBackendJson).not.toContain("READ A BOOK");
    expect(rawBackendJson).not.toContain("WORKOUT");

    const exportedDbBytes = await exportToUhabitsDb({
      supabase: wrapped,
      isGuest: false,
      wasmPath,
    });

    expect(exportedDbBytes).toBeInstanceOf(Uint8Array);
    expect(exportedDbBytes.length).toBeGreaterThan(0);

    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const exportedSqlite = new SQL.Database(exportedDbBytes);

    const versionRes = exportedSqlite.exec("PRAGMA user_version");
    expect(versionRes[0].values[0][0]).toBe(25);

    const tablesRes = exportedSqlite.exec(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
    const tableNames = (
      tablesRes[0].values.map((r) => r[0]) as string[]
    ).sort();
    expect(tableNames).toEqual(
      [
        "Events",
        "Habits",
        "Repetitions",
        "android_metadata",
        "sqlite_sequence",
      ].sort(),
    );

    const indexRes = exportedSqlite.exec(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='Repetitions'",
    );
    const indexNames = indexRes[0].values.map((r) => r[0]);
    expect(indexNames).toContain("idx_repetitions_habit_timestamp");

    const metadataRows = exportedSqlite.exec(
      "SELECT locale FROM android_metadata",
    );
    expect(metadataRows[0].values[0][0]).toBe("en_US");

    const habitsTableRows = exportedSqlite.exec(
      "SELECT id, name, type, target_value, unit, question, archived, reminder_hour, reminder_min, reminder_days FROM Habits ORDER BY id ASC",
    );
    expect(habitsTableRows[0].values).toHaveLength(12);

    const exportedHabitsList = habitsTableRows[0].values.map((row) => ({
      name: row[1] as string,
      type: row[2] as number,
      target_value: row[3] as number,
      unit: row[4] as string,
      question: row[5] as string | null,
      archived: row[6] as number,
      reminder_hour: row[7] as number | null,
      reminder_min: row[8] as number | null,
      reminder_days: row[9] as number,
    }));

    const habitNames = exportedHabitsList.map((h) => h.name);
    expect(habitNames).toContain("EARLY TO RISE");
    expect(habitNames).toContain("READ A BOOK");
    expect(habitNames).toContain("WORKOUT");
    expect(habitNames).toContain("SHAMPOO");
    expect(habitNames).toContain("HAIRCUT");
    expect(habitNames).toContain("WASH TOWEL");

    const exportedBook = exportedHabitsList.find(
      (h) => h.name === "READ A BOOK",
    );
    expect(exportedBook).toBeDefined();
    expect(exportedBook?.type).toBe(1);
    expect(exportedBook?.target_value).toBe(10.0);
    expect(exportedBook?.unit).toBe("pages");
    expect(exportedBook?.question).toBe("How many pages did you read?");
    expect(exportedBook?.archived).toBe(1);

    const repsCount = exportedSqlite.exec("SELECT count(*) FROM Repetitions")[0]
      .values[0][0];
    expect(repsCount).toBe(4183);

    const workoutId = habitsTableRows[0].values.find(
      (r) => r[1] === "WORKOUT",
    )![0] as number;
    const workoutReps = exportedSqlite.exec(
      `SELECT value, count(*) FROM Repetitions WHERE habit=${workoutId} GROUP BY value ORDER BY value ASC`,
    );
    const workoutRepCounts = Object.fromEntries(
      workoutReps[0].values.map((r) => [r[0], r[1]]),
    );
    expect(workoutRepCounts[0]).toBe(701);
    expect(workoutRepCounts[2]).toBe(229);
    expect(workoutRepCounts[3]).toBe(27);

    const reimported = await parseUhabitsFile(exportedDbBytes, wasmPath);
    expect(reimported.habits).toHaveLength(12);
    expect(reimported.entries).toHaveLength(4183);

    exportedSqlite.close();

    const exportedZipBytes = await exportToUhabitsZip(
      { supabase: wrapped, isGuest: false },
      { today: "2026-09-03" },
    );

    expect(exportedZipBytes).toBeInstanceOf(Uint8Array);
    expect(exportedZipBytes.length).toBeGreaterThan(0);

    const unzipped = unzipSync(exportedZipBytes);
    const archiveFiles = Object.keys(unzipped);

    expect(archiveFiles).toContain("Habits.csv");
    expect(archiveFiles).toContain("Checkmarks.csv");
    expect(archiveFiles).toContain("Scores.csv");

    const habitsCsvContent = strFromU8(unzipped["Habits.csv"]);
    const habitsCsvLines = habitsCsvContent.trim().split("\n");
    expect(habitsCsvLines).toHaveLength(13);
    expect(habitsCsvContent).toContain("EARLY TO RISE,YES_NO");
    expect(habitsCsvContent).toContain("READ A BOOK,NUMERICAL");
    expect(habitsCsvContent).not.toContain("kanso:v1:");

    const checkmarksCsv = strFromU8(unzipped["Checkmarks.csv"]);
    const checkmarksHeader = checkmarksCsv.split("\n")[0];
    expect(checkmarksHeader).toContain("EARLY TO RISE");
    expect(checkmarksHeader).toContain("READ A BOOK");
    expect(checkmarksHeader).toContain("WORKOUT");

    expect(archiveFiles).toContain("004 READ A BOOK/Checkmarks.csv");
    const bookCheckmarks = strFromU8(
      unzipped["004 READ A BOOK/Checkmarks.csv"],
    );
    expect(bookCheckmarks).toContain("1000");
    expect(bookCheckmarks).toContain("8000");

    expect(archiveFiles).toContain("003 WORKOUT/Checkmarks.csv");
    const workoutCheckmarks = strFromU8(unzipped["003 WORKOUT/Checkmarks.csv"]);
    expect(workoutCheckmarks).toContain("YES_MANUAL");
    expect(workoutCheckmarks).toContain("SKIP");
  });

  it("refuses export if content key is unavailable (locked/missing)", async () => {
    keyStoreState.key = await generateMasterKey();
    const backend = createFakeSupabaseClient();
    const wrapped = wrapSupabaseClient(backend, FIELD_MAP);

    await wrapped.from("habits").insert({
      id: "h1",
      user_id: "user-1",
      name: "Encrypted Habit",
    });

    keyStoreState.key = null;

    await expect(
      exportToUhabitsDb({
        supabase: wrapped,
        isGuest: false,
        wasmPath,
      }),
    ).rejects.toThrow(
      /content encryption is set up for this account but the master key is unavailable/i,
    );
  });
});
