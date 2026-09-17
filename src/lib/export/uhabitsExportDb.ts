import { get } from "idb-keyval";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/mock/mock-store";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import {
  LOOP_COLOR_PALETTE,
  colorDistance,
  loadSqlJs,
  LOOP_VALUE_YES,
  LOOP_VALUE_SKIP,
  LOOP_VALUE_NO,
  KANSO_VALUE_SKIP,
  KANSO_VALUE_MISSED,
} from "@/lib/import/uhabits";

export { LOOP_COLOR_PALETTE };

const LOOP_COLOR_ENTRIES = Object.entries(LOOP_COLOR_PALETTE);

export function findClosestLoopColor(hex: string): number {
  let closest = 0;
  let minDistance = Infinity;

  for (const [idxStr, loopHex] of LOOP_COLOR_ENTRIES) {
    const idx = Number(idxStr);
    const dist = colorDistance(hex, loopHex);
    if (dist < minDistance) {
      minDistance = dist;
      closest = idx;
    }
  }

  return closest;
}

function normalizeUuid(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

export function mapKagelinFrequencyToLoop(
  count?: number | null,
  period?: "day" | "week" | "month" | null,
): { freq_num: number; freq_den: number } {
  const validCount = typeof count === "number" && count > 0 ? count : 1;

  if (period === "day") {
    return { freq_num: validCount, freq_den: 1 };
  }
  if (period === "week") {
    return { freq_num: validCount, freq_den: 7 };
  }
  if (period === "month") {
    return { freq_num: validCount, freq_den: 30 };
  }

  return { freq_num: validCount, freq_den: 1 };
}

export function entryToRepetitionValue(
  value: number,
  habitType: "boolean" | "measurable",
): number {
  if (value === KANSO_VALUE_SKIP) {
    return LOOP_VALUE_SKIP;
  }
  if (value === KANSO_VALUE_MISSED) {
    return LOOP_VALUE_NO;
  }
  if (habitType === "measurable") {
    return Math.round(value * 1000);
  }
  return LOOP_VALUE_YES;
}

export function dateStringToUtcMidnightMs(dateStr: string): number {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  return Date.UTC(year, month, day);
}

export interface UhabitsExportData {
  habits: Habit[];
  entries: HabitEntry[];
  rawSources?: unknown[];
}

export interface ExportToUhabitsDbOptions {
  habits?: Habit[];
  entries?: HabitEntry[];
  rawSources?: unknown[];
  supabase?: SupabaseClient;
  isGuest?: boolean;
  wasmPath?: string;
}

const GUEST_STORE_KEY = "kanso_import_sources";

// Reads through wrapped Supabase client (or mockStore) so encrypted fields are decrypted.
export async function collectUhabitsExportData(options?: {
  supabase?: SupabaseClient;
  isGuest?: boolean;
}): Promise<UhabitsExportData> {
  const isGuest =
    options?.isGuest ??
    (typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true");

  if (isGuest) {
    const habits = mockStore.getHabits();
    const entries = mockStore.getHabitEntries();
    let rawSources: unknown[] = [];
    if (typeof indexedDB !== "undefined") {
      try {
        const stored = (await get<{ raw: unknown }[]>(GUEST_STORE_KEY)) ?? [];
        rawSources = stored.map((record) => record.raw);
      } catch {
        rawSources = [];
      }
    }
    return { habits, entries, rawSources };
  }

  const supabase = options?.supabase ?? createClient();

  const [habits, entries, habitImports] = await Promise.all([
    fetchAllRows<Habit>((from, to) =>
      supabase
        .from("habits")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<HabitEntry>((from, to) =>
      supabase
        .from("habit_entries")
        .select("*")
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<{ raw: unknown }>((from, to) =>
      supabase
        .from("habit_imports")
        .select("*")
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const rawSources = habitImports.map((row) => row.raw);

  return { habits, entries, rawSources };
}

function extractRawHabits(
  rawSources: unknown[],
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();

  for (const source of rawSources) {
    if (
      !source ||
      typeof source !== "object" ||
      !("habits" in source) ||
      !Array.isArray((source as { habits: unknown[] }).habits)
    ) {
      continue;
    }

    for (const h of (source as { habits: unknown[] }).habits) {
      if (
        h &&
        typeof h === "object" &&
        "uuid" in h &&
        typeof (h as { uuid: unknown }).uuid === "string"
      ) {
        const rawH = h as Record<string, unknown>;
        map.set(normalizeUuid(rawH.uuid as string), rawH);
      }
    }
  }

  return map;
}

interface PreparedLoopHabit {
  habitId: string;
  sqliteId: number;
  archived: number;
  color: number;
  description: string | null;
  freq_den: number;
  freq_num: number;
  highlight: number;
  name: string;
  position: number;
  reminder_hour: number | null;
  reminder_min: number | null;
  reminder_days: number;
  type: number;
  target_type: number;
  target_value: number;
  unit: string;
  question: string | null;
  uuid: string;
}

function numOr(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function strOr(value: unknown, fallback: string | null): string | null {
  return typeof value === "string" ? value : fallback;
}

function prepareLoopHabit(
  habit: Habit,
  rawHabit: Record<string, unknown> | undefined,
  cleanSourceUuid: string | undefined,
  sqliteId: number,
  position: number,
): PreparedLoopHabit {
  const archived = habit.archived_at ? 1 : 0;

  const color =
    typeof rawHabit?.color === "number"
      ? rawHabit.color
      : findClosestLoopColor(habit.color);

  const description = habit.description ?? strOr(rawHabit?.description, null);

  let freq_num: number;
  let freq_den: number;
  if (
    rawHabit &&
    typeof rawHabit.freq_num === "number" &&
    typeof rawHabit.freq_den === "number" &&
    rawHabit.freq_num > 0 &&
    rawHabit.freq_den > 0
  ) {
    freq_num = rawHabit.freq_num;
    freq_den = rawHabit.freq_den;
  } else {
    const mapped = mapKagelinFrequencyToLoop(
      habit.frequency_count,
      habit.frequency_period,
    );
    freq_num = mapped.freq_num;
    freq_den = mapped.freq_den;
  }

  const highlight = numOr(rawHabit?.highlight, 0);

  let reminder_hour: number | null = null;
  let reminder_min: number | null = null;

  if (habit.reminder_time) {
    const [hourStr, minStr] = habit.reminder_time.split(":");
    reminder_hour = parseInt(hourStr, 10);
    reminder_min = parseInt(minStr, 10);
  } else if (
    typeof rawHabit?.reminder_hour === "number" &&
    typeof rawHabit?.reminder_min === "number"
  ) {
    reminder_hour = rawHabit.reminder_hour;
    reminder_min = rawHabit.reminder_min;
  }

  const reminder_days = numOr(
    habit.reminder_days,
    numOr(rawHabit?.reminder_days, reminder_hour !== null ? 127 : 0),
  );

  const isMeasurable = habit.habit_type === "measurable";
  const type = isMeasurable ? 1 : 0;

  const target_type = isMeasurable
    ? habit.target_type === "at_most"
      ? 1
      : 0
    : numOr(rawHabit?.target_type, 0);

  const target_value = isMeasurable
    ? numOr(habit.target_value, numOr(rawHabit?.target_value, 0))
    : 0;

  const unit = isMeasurable
    ? (habit.unit ?? strOr(rawHabit?.unit, "") ?? "")
    : "";

  const question = habit.question ?? strOr(rawHabit?.question, null);

  const uuid =
    cleanSourceUuid ??
    (typeof rawHabit?.uuid === "string" && rawHabit.uuid
      ? normalizeUuid(rawHabit.uuid)
      : normalizeUuid(crypto.randomUUID()));

  return {
    habitId: habit.id,
    sqliteId,
    archived,
    color,
    description,
    freq_den,
    freq_num,
    highlight,
    name: habit.name,
    position,
    reminder_hour,
    reminder_min,
    reminder_days,
    type,
    target_type,
    target_value,
    unit,
    question,
    uuid,
  };
}

export async function exportToUhabitsDb(
  input?: ExportToUhabitsDbOptions | UhabitsExportData,
  extraOptions?: { wasmPath?: string },
): Promise<Uint8Array> {
  const wasmPath =
    extraOptions?.wasmPath ??
    (input && "wasmPath" in input ? input.wasmPath : undefined);

  const SQL = await loadSqlJs(wasmPath);

  let habits: Habit[];
  let entries: HabitEntry[];
  let rawSources: unknown[];

  if (input && "habits" in input && Array.isArray(input.habits)) {
    habits = input.habits;
    entries = input.entries ?? [];
    rawSources = input.rawSources ?? [];
  } else {
    const collected = await collectUhabitsExportData(
      input as { supabase?: SupabaseClient; isGuest?: boolean } | undefined,
    );
    habits = collected.habits;
    entries = collected.entries;
    rawSources = collected.rawSources ?? [];
  }

  const rawHabitsByUuid = extractRawHabits(rawSources);

  const db = new SQL.Database();

  db.run("PRAGMA user_version = 25;");
  db.run("CREATE TABLE android_metadata (locale TEXT);");
  db.run(
    "CREATE TABLE Events (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp INTEGER, message TEXT, server_id INTEGER);",
  );
  db.run(
    `CREATE TABLE Habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      archived INTEGER,
      color INTEGER,
      description TEXT,
      freq_den INTEGER,
      freq_num INTEGER,
      highlight INTEGER,
      name TEXT,
      position INTEGER,
      reminder_hour INTEGER,
      reminder_min INTEGER,
      reminder_days INTEGER NOT NULL DEFAULT 127,
      type INTEGER NOT NULL DEFAULT 0,
      target_type INTEGER NOT NULL DEFAULT 0,
      target_value REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT "",
      question TEXT,
      uuid TEXT
    );`,
  );
  db.run(
    `CREATE TABLE Repetitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit INTEGER NOT NULL REFERENCES Habits(id),
      timestamp INTEGER NOT NULL,
      value INTEGER NOT NULL,
      notes TEXT
    );`,
  );
  db.run(
    "CREATE UNIQUE INDEX idx_repetitions_habit_timestamp ON Repetitions(habit, timestamp);",
  );

  db.run("INSERT INTO android_metadata (locale) VALUES (?);", ["en_US"]);

  const sortedHabits = [...habits].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  // Reserve provenance IDs first so auto-assigned IDs avoid collisions.
  const usedSqliteIds = new Set<number>();
  const habitToRawMap = new Map<
    string,
    { rawHabit: Record<string, unknown> | undefined; cleanSourceUuid?: string }
  >();

  for (const habit of sortedHabits) {
    const cleanSourceUuid = habit.source_uuid
      ? normalizeUuid(habit.source_uuid)
      : undefined;
    const rawHabit = cleanSourceUuid
      ? rawHabitsByUuid.get(cleanSourceUuid)
      : undefined;
    habitToRawMap.set(habit.id, { rawHabit, cleanSourceUuid });

    if (
      rawHabit &&
      typeof rawHabit.id === "number" &&
      rawHabit.id > 0 &&
      !usedSqliteIds.has(rawHabit.id)
    ) {
      usedSqliteIds.add(rawHabit.id);
    }
  }

  let nextId = 1;
  const getNextAvailableId = (): number => {
    while (usedSqliteIds.has(nextId)) {
      nextId++;
    }
    usedSqliteIds.add(nextId);
    return nextId;
  };

  const preparedHabits: PreparedLoopHabit[] = [];
  const habitIdToSqliteId = new Map<string, number>();
  const habitMap = new Map<string, Habit>();

  for (let index = 0; index < sortedHabits.length; index++) {
    const habit = sortedHabits[index];
    const { rawHabit, cleanSourceUuid } = habitToRawMap.get(habit.id)!;

    let sqliteId: number;
    if (rawHabit && typeof rawHabit.id === "number" && rawHabit.id > 0) {
      sqliteId = rawHabit.id;
    } else {
      sqliteId = getNextAvailableId();
    }

    const position =
      typeof habit.sort_order === "number"
        ? habit.sort_order
        : typeof rawHabit?.position === "number"
          ? rawHabit.position
          : index;

    preparedHabits.push(
      prepareLoopHabit(habit, rawHabit, cleanSourceUuid, sqliteId, position),
    );
    habitIdToSqliteId.set(habit.id, sqliteId);
    habitMap.set(habit.id, habit);
  }

  db.run("BEGIN TRANSACTION;");

  const habitStmt = db.prepare(
    `INSERT INTO Habits (
      id, archived, color, description, freq_den, freq_num, highlight,
      name, position, reminder_hour, reminder_min, reminder_days,
      type, target_type, target_value, unit, question, uuid
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
  );

  for (const h of preparedHabits) {
    habitStmt.run([
      h.sqliteId,
      h.archived,
      h.color,
      h.description,
      h.freq_den,
      h.freq_num,
      h.highlight,
      h.name,
      h.position,
      h.reminder_hour,
      h.reminder_min,
      h.reminder_days,
      h.type,
      h.target_type,
      h.target_value,
      h.unit,
      h.question,
      h.uuid,
    ]);
  }
  habitStmt.free();

  const repStmt = db.prepare(
    "INSERT OR IGNORE INTO Repetitions (habit, timestamp, value, notes) VALUES (?, ?, ?, ?);",
  );

  for (const entry of entries) {
    const sqliteHabitId = habitIdToSqliteId.get(entry.habit_id);
    if (sqliteHabitId === undefined) continue;

    const habitObj = habitMap.get(entry.habit_id);
    const habitType = habitObj?.habit_type ?? "boolean";

    const timestamp = dateStringToUtcMidnightMs(entry.date);
    const val = entryToRepetitionValue(entry.value, habitType);
    const notes = entry.notes ?? "";

    repStmt.run([sqliteHabitId, timestamp, val, notes]);
  }
  repStmt.free();

  db.run("COMMIT;");

  const binary = db.export();
  db.close();

  return binary;
}
