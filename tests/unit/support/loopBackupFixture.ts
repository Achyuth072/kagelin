import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";

// A real backup kept only locally (.scratch/ is gitignored); tests against it
// are skipped, not silently passed, when it's absent (e.g. in CI).
const REAL_LOOP_BACKUP_PATH = path.resolve(
  process.cwd(),
  ".scratch/import/Loop Habits Backup 2026-09-03 103056.db",
);
export const hasRealLoopBackup = fs.existsSync(REAL_LOOP_BACKUP_PATH);
export const readRealLoopBackup = () => fs.readFileSync(REAL_LOOP_BACKUP_PATH);

const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

const YES = 2;
const NO = 0;
const SKIP = 3;
const UNKNOWN = -1;

const BASE = {
  archived: 0,
  description: null,
  freq_num: 1,
  freq_den: 1,
  highlight: 0,
  reminder_hour: null,
  reminder_min: null,
  reminder_days: 127,
  type: 0,
  target_type: 0,
  target_value: 0,
  unit: "",
  question: null,
};

const HABITS = [
  {
    ...BASE,
    id: 1,
    color: 7,
    description: "Morning session",
    name: "WORKOUT",
    position: 0,
    reminder_hour: 6,
    reminder_min: 0,
    question: "Did you work out?",
    uuid: "0a1b2c3d4e5f60718293a4b5c6d7e8f9",
  },
  {
    ...BASE,
    id: 2,
    archived: 1,
    color: 2,
    name: "READ A BOOK",
    position: 1,
    type: 1,
    target_value: 10,
    unit: "pages",
    question: "How many pages did you read?",
    uuid: "1a1b2c3d4e5f60718293a4b5c6d7e8f9",
  },
  {
    ...BASE,
    id: 3,
    color: 16,
    freq_den: 30,
    name: "HAIRCUT",
    position: 2,
    reminder_hour: 7,
    reminder_min: 0,
    reminder_days: 119,
    uuid: "2a1b2c3d4e5f60718293a4b5c6d7e8f9",
  },
  {
    ...BASE,
    id: 4,
    archived: 1,
    color: 11,
    freq_num: 3,
    freq_den: 7,
    name: "GYM",
    position: 3,
    uuid: "3a1b2c3d4e5f60718293a4b5c6d7e8f9",
  },
];

const REPETITIONS: {
  habit: number;
  date: string;
  value: number;
  notes?: string;
}[] = [
  { habit: 1, date: "2026-08-01", value: YES, notes: "Felt strong" },
  { habit: 1, date: "2026-08-02", value: YES },
  { habit: 1, date: "2026-08-03", value: NO },
  { habit: 1, date: "2026-08-04", value: SKIP, notes: "Rest day" },
  { habit: 1, date: "2026-08-05", value: YES },
  { habit: 1, date: "2026-08-06", value: NO },
  { habit: 1, date: "2026-08-07", value: UNKNOWN },
  { habit: 2, date: "2026-08-01", value: 8000, notes: "Chapter 3" },
  { habit: 2, date: "2026-08-02", value: 1000 },
  { habit: 2, date: "2026-08-03", value: SKIP },
  { habit: 2, date: "2026-08-04", value: SKIP },
  { habit: 2, date: "2026-08-05", value: UNKNOWN },
  { habit: 3, date: "2026-08-10", value: YES },
  { habit: 4, date: "2026-08-03", value: YES },
  { habit: 4, date: "2026-08-05", value: YES },
  { habit: 4, date: "2026-08-07", value: YES },
];

export const LOOP_FIXTURE = {
  habitCount: HABITS.length,
  activeCount: HABITS.filter((h) => !h.archived).length,
  archivedCount: HABITS.filter((h) => h.archived).length,
  // UNKNOWN rows have no Kagelin entry state and are dropped on import.
  entryCount: REPETITIONS.filter((r) => r.value !== UNKNOWN).length,
} as const;

export async function buildLoopBackupFixture(
  wasmPath = "public/sql-wasm.wasm",
): Promise<Uint8Array> {
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = new SQL.Database();

  db.run("PRAGMA user_version = 25;");
  db.run("CREATE TABLE android_metadata (locale TEXT)");
  db.run(
    'CREATE TABLE Habits ( id integer primary key autoincrement, archived integer, color integer, description text, freq_den integer, freq_num integer, highlight integer, name text, position integer, reminder_hour integer, reminder_min integer , reminder_days integer not null default 127, type integer not null default 0, target_type integer not null default 0, target_value real not null default 0, unit text not null default "", question text, uuid text)',
  );
  db.run(
    "CREATE TABLE Events ( id integer primary key autoincrement, timestamp integer, message text, server_id integer )",
  );
  db.run(
    "CREATE TABLE Repetitions ( id integer primary key autoincrement, habit integer not null references habits(id), timestamp integer not null, value integer not null, notes text)",
  );
  db.run(
    "CREATE UNIQUE INDEX idx_repetitions_habit_timestamp on Repetitions( habit, timestamp)",
  );
  db.run("INSERT INTO android_metadata VALUES ('en_US')");

  for (const habit of HABITS) {
    const columns = Object.keys(habit);
    db.run(
      `INSERT INTO Habits (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      Object.values(habit),
    );
  }
  for (const { habit, date, value, notes } of REPETITIONS) {
    db.run(
      "INSERT INTO Repetitions (habit, timestamp, value, notes) VALUES (?, ?, ?, ?)",
      [habit, utc(date), value, notes ?? null],
    );
  }

  const bytes = db.export();
  db.close();
  return bytes;
}

// parseUhabitsFile takes a Blob, the way the app's file input supplies one.
export const toBlob = (bytes: Uint8Array): Blob => new Blob([bytes.slice()]);
