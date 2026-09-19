import type { Habit } from "@/lib/types/habit";
import { REMINDER_EVERY_DAY } from "@/lib/types/habit";
import { loadSqlJs } from "@/lib/import/uhabits";
import {
  entryToRepetitionValue,
  extractRawHabits,
  getHabitFrequency,
  getRawHabitByProvenance,
  normalizeUuid,
  resolveLoopColor,
  resolveUhabitsExportData,
  sortHabitsByOrder,
  toFilenameDate,
  type RawLoopHabit,
  type UhabitsExportOptions,
} from "@/lib/export/uhabitsShared";

export function dateStringToUtcMidnightMs(dateStr: string): number {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  return Date.UTC(year, month, day);
}

export function generateUhabitsDbFilename(date?: Date | string): string {
  return `Loop Habits Backup ${toFilenameDate(date)}.db`;
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
  rawHabit: RawLoopHabit | undefined,
  uuid: string,
  sqliteId: number,
  position: number,
): PreparedLoopHabit {
  const archived = habit.archived_at ? 1 : 0;
  const color = resolveLoopColor(habit, rawHabit);
  const description = habit.description ?? strOr(rawHabit?.description, null);
  const { freq_num, freq_den } = getHabitFrequency(habit, rawHabit);

  const highlight = numOr(rawHabit?.highlight, 0);

  let reminder_hour: number | null = null;
  let reminder_min: number | null = null;

  if (habit.reminder_time) {
    const [hourStr, minStr] = habit.reminder_time.split(":");
    reminder_hour = parseInt(hourStr, 10);
    reminder_min = parseInt(minStr, 10);
  }

  const reminder_days = numOr(
    habit.reminder_days,
    numOr(
      rawHabit?.reminder_days,
      reminder_hour !== null ? REMINDER_EVERY_DAY : 0,
    ),
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
  options: UhabitsExportOptions & { wasmPath?: string } = {},
): Promise<Uint8Array> {
  const SQL = await loadSqlJs(options.wasmPath);
  const { habits, entries, rawSources } =
    await resolveUhabitsExportData(options);

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

  const sortedHabits = sortHabitsByOrder(habits);

  // Provenance IDs and UUIDs go to the first habit that claims them, reserved
  // before auto-assignment. Later claimants (overlapping backups, or the same
  // Loop habit imported twice) get fresh ones instead of colliding.
  const sqliteIdOwner = new Map<number, string>();
  const uuidOwner = new Map<string, string>();
  const rawByHabitId = new Map<string, RawLoopHabit | undefined>();

  for (const habit of sortedHabits) {
    const rawHabit = getRawHabitByProvenance(habit, rawHabitsByUuid);
    rawByHabitId.set(habit.id, rawHabit);

    if (typeof rawHabit?.id === "number" && rawHabit.id > 0) {
      if (!sqliteIdOwner.has(rawHabit.id)) {
        sqliteIdOwner.set(rawHabit.id, habit.id);
      }
    }
    if (habit.source_uuid) {
      const uuid = normalizeUuid(habit.source_uuid);
      if (!uuidOwner.has(uuid)) uuidOwner.set(uuid, habit.id);
    }
  }

  const usedSqliteIds = new Set(sqliteIdOwner.keys());

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
    const rawHabit = rawByHabitId.get(habit.id);

    const sqliteId =
      typeof rawHabit?.id === "number" &&
      sqliteIdOwner.get(rawHabit.id) === habit.id
        ? rawHabit.id
        : getNextAvailableId();

    const sourceUuid = habit.source_uuid
      ? normalizeUuid(habit.source_uuid)
      : undefined;
    const uuid =
      sourceUuid && uuidOwner.get(sourceUuid) === habit.id
        ? sourceUuid
        : normalizeUuid(crypto.randomUUID());

    const position =
      typeof habit.sort_order === "number"
        ? habit.sort_order
        : typeof rawHabit?.position === "number"
          ? rawHabit.position
          : index;

    preparedHabits.push(
      prepareLoopHabit(habit, rawHabit, uuid, sqliteId, position),
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
