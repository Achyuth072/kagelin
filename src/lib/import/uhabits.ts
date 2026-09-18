import initSqlJs from "sql.js";
import type { Habit, HabitEntry } from "../types/habit";
import type { CreateHabitInput } from "../mutations/habit";
import { PROJECT_COLORS } from "../constants/colors";

export interface UhabitsRawSource {
  habits: Record<string, unknown>[];
  repetitions: Record<string, unknown>[];
}

let sqlJsPromise: ReturnType<typeof initSqlJs> | undefined;

// Uses local WASM binary (public/sql-wasm.wasm) to support offline and PWA environments.
export function loadSqlJs(wasmPath?: string) {
  if (!sqlJsPromise) {
    const isNode =
      typeof process !== "undefined" &&
      Boolean(process.versions?.node) &&
      (typeof window === "undefined" ||
        (process as unknown as { release?: { name?: string } }).release
          ?.name === "node");

    sqlJsPromise = initSqlJs({
      locateFile: () =>
        wasmPath || (isNode ? "public/sql-wasm.wasm" : "/sql-wasm.wasm"),
    });
  }
  return sqlJsPromise;
}

export async function parseUhabitsFile(
  file: File | Blob | ArrayBuffer | Uint8Array,
  wasmPath?: string,
): Promise<{
  habits: Habit[];
  entries: HabitEntry[];
  source: UhabitsRawSource;
}> {
  const SQL = await loadSqlJs(wasmPath);

  let uint8: Uint8Array;
  if (file instanceof Uint8Array) {
    uint8 = file;
  } else if (ArrayBuffer.isView(file)) {
    uint8 = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
  } else if (file instanceof ArrayBuffer) {
    uint8 = new Uint8Array(file);
  } else if (typeof (file as Blob).arrayBuffer === "function") {
    uint8 = new Uint8Array(await file.arrayBuffer());
  } else {
    throw new Error("Unsupported file input");
  }

  const db = new SQL.Database(uint8);

  const habitsResult = db.exec("SELECT * FROM habits");
  const repetitionsResult = db.exec("SELECT * FROM Repetitions");

  if (!habitsResult.length) {
    return { habits: [], entries: [], source: { habits: [], repetitions: [] } };
  }

  const habitsData = resultToObjects(habitsResult[0]);
  const repetitionsData = repetitionsResult.length
    ? resultToObjects(repetitionsResult[0])
    : [];

  db.close();

  // Raw parse, kept verbatim for round-trip export (ADR 0006).
  return {
    ...mapUhabitsToKanso(habitsData, repetitionsData),
    source: { habits: habitsData, repetitions: repetitionsData },
  };
}

function resultToObjects(result: {
  columns: string[];
  values: unknown[][];
}): Record<string, unknown>[] {
  const columns = result.columns;
  return result.values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// Loop Habit Tracker stores colors as palette indices (not ARGB ints).
// Source: HabitColor enum in uhabits-core (indices 0-20).
export const LOOP_COLOR_PALETTE: Record<number, string> = {
  0: "#f44336",
  1: "#ff5722",
  2: "#ff9800",
  3: "#ffc107",
  4: "#ffeb3b",
  5: "#cddc39",
  6: "#4caf50",
  7: "#009688",
  8: "#00bcd4",
  9: "#03a9f4",
  10: "#2196f3",
  11: "#3f51b5",
  12: "#673ab7",
  13: "#9c27b0",
  14: "#e91e63",
  15: "#f50057",
  16: "#607d8b",
  17: "#9e9e9e",
  18: "#616161",
  19: "#795548",
  20: "#4e342e",
};

const ICON_KEYWORDS: Array<[RegExp, string]> = [
  [/workout|exercise|gym|run(ning)?|jog|swim|sport|fitness|lift/i, "Dumbbell"],
  [/read|book|study|learn/i, "Book"],
  [/meditat|breath|relax|calm|mindful|zen/i, "Brain"],
  [/water|hydrat|drink/i, "Droplet"],
  [/sleep|bed|rest|nap/i, "Moon"],
  [/wake|rise|morning|alarm|early/i, "Sun"],
  [/food|eat|diet|meal|cook|nutrition/i, "Cooking"],
  [/walk|step|hike|bike|cycl/i, "Bike"],
  [/journal|write|diary|pencil/i, "Pencil"],
  [/music|guitar|piano|sing/i, "Music"],
  [/code|program|develop/i, "Code"],
  [/photo|camera|picture/i, "Camera"],
  [/medic|pill|vitamin|supplement/i, "Heart"],
  [/money|budget|financ|saving|invest/i, "Finances"],
  [/language|vocab|spanish|french|english/i, "Language"],
  [/clean|wash|shower|bath|hygiene|shampoo|exfoliat|haircut|groom/i, "Droplet"],
  [/garden|plant|tree|nature|outdoor/i, "Trees"],
  [/social|friend|family|call/i, "User"],
  [/game|play|chess/i, "Gamepad"],
  [/travel|flight|trip/i, "Plane"],
  [/sun|sunscreen/i, "Sun"],
  [/target|goal|achiev/i, "Target"],
  [/news|newspaper|article/i, "Book"],
  [/knee|stretch|yoga|flex/i, "Dumbbell"],
  [/coffee|tea/i, "Coffee"],
  [/smile|mood|happy|gratitude/i, "Smile"],
  [/leaf|salad|veggie|vegetable|organic/i, "Leaf"],
];

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export function colorDistance(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function findClosestKansoColor(loopHex: string): string {
  let closest = PROJECT_COLORS[0].hex;
  let minDistance = Infinity;

  for (const color of PROJECT_COLORS) {
    const dist = colorDistance(loopHex, color.hex);
    if (dist < minDistance) {
      minDistance = dist;
      closest = color.hex;
    }
  }

  return closest;
}

function paletteToHex(colorIndex: number): string {
  const loopHex = LOOP_COLOR_PALETTE[colorIndex];
  if (!loopHex) return "#4B6CB7";
  return findClosestKansoColor(loopHex);
}

// uhabits frequency is a fraction freq_num/freq_den; Kagelin has only
// day/week/month, so inexpressible denominators are approximated. See ADR 0005.
function mapFrequency(
  freqNum: number,
  freqDen: number,
): { count: number; period: "day" | "week" | "month" } | null {
  if (!Number.isFinite(freqNum) || !Number.isFinite(freqDen)) return null;
  if (freqDen <= 0 || freqNum <= 0) return null;

  if (freqDen === 1) return { count: freqNum, period: "day" };
  if (freqDen === 7) return { count: freqNum, period: "week" };
  if (freqDen === 30 || freqDen === 31)
    return { count: freqNum, period: "month" };

  const count = Math.max(1, Math.round((freqNum * 7) / freqDen));
  return { count, period: "week" };
}

function inferIcon(habitName: string, description?: string): string {
  const text = description ? `${habitName} ${description}` : habitName;
  for (const [pattern, icon] of ICON_KEYWORDS) {
    if (pattern.test(text)) return icon;
  }
  return "Flame";
}

export const LOOP_VALUE_YES = 2;
export const LOOP_VALUE_SKIP = 3;
export const LOOP_VALUE_NO = 0;
export const LOOP_VALUE_UNKNOWN = -1;
import {
  KANSO_VALUE_DONE,
  KANSO_VALUE_SKIP,
  KANSO_VALUE_MISSED,
} from "../types/habit";

export function parseRepetitionValue(
  rawVal: number,
  habitType: "boolean" | "measurable",
): number | null {
  if (rawVal === LOOP_VALUE_SKIP) return KANSO_VALUE_SKIP;
  if (rawVal === LOOP_VALUE_NO) return KANSO_VALUE_MISSED;
  if (rawVal === LOOP_VALUE_UNKNOWN) return null;
  if (habitType === "measurable") {
    return rawVal > 0 ? rawVal / 1000.0 : null;
  }
  if (rawVal === LOOP_VALUE_YES) return KANSO_VALUE_DONE;
  return null;
}

// Habit → createHabit payload; carries frequency and fidelity fields through so
// they aren't dropped between parse and persist. See ADR 0005.
export function toCreateHabitInput(habit: Habit): CreateHabitInput {
  return {
    name: habit.name,
    description: habit.description || undefined,
    color: habit.color,
    icon: habit.icon || undefined,
    start_date: habit.start_date ?? undefined,
    archived_at: habit.archived_at ?? undefined,
    habit_type: habit.habit_type,
    sort_order: habit.sort_order ?? undefined,
    frequencyCount: habit.frequency_count ?? undefined,
    frequencyPeriod: habit.frequency_period ?? undefined,
    target_type: habit.target_type ?? undefined,
    target_value: habit.target_value ?? undefined,
    unit: habit.unit ?? undefined,
    question: habit.question ?? undefined,
    reminder_time: habit.reminder_time ?? undefined,
    reminder_days: habit.reminder_days ?? undefined,
    source_uuid: habit.source_uuid ?? undefined,
  };
}

export function mapUhabitsToKanso(
  uhHabits: Record<string, unknown>[],
  uhRepetitions: Record<string, unknown>[],
) {
  const today = new Date().toISOString().split("T")[0];

  const habitTypeMap = new Map<number, "boolean" | "measurable">();
  uhHabits.forEach((rawHabit) => {
    habitTypeMap.set(
      rawHabit.id as number,
      rawHabit.type === 1 ? "measurable" : "boolean",
    );
  });

  const earliestDate = new Map<number, string>();
  uhRepetitions.forEach((rawRepetition) => {
    const loopId = rawRepetition.habit as number;
    const habitType = habitTypeMap.get(loopId) ?? "boolean";
    const rawVal = rawRepetition.value as number;
    const mapped = parseRepetitionValue(rawVal, habitType);
    const hasNotes =
      typeof rawRepetition.notes === "string" &&
      rawRepetition.notes.trim().length > 0;

    if (mapped === null && !hasNotes) return;

    const date = new Date(rawRepetition.timestamp as number)
      .toISOString()
      .split("T")[0];
    const prev = earliestDate.get(loopId);
    if (!prev || date < prev) earliestDate.set(loopId, date);
  });

  const habits: Habit[] = [];
  const rawEntries: HabitEntry[] = [];
  const idMap = new Map<number, string>();

  uhHabits.forEach((rawHabit) => {
    const id = crypto.randomUUID();
    idMap.set(rawHabit.id as number, id);

    const frequency = mapFrequency(
      rawHabit.freq_num as number,
      rawHabit.freq_den as number,
    );

    const isMeasurable = rawHabit.type === 1;

    const reminder_days =
      typeof rawHabit.reminder_days === "number"
        ? (rawHabit.reminder_days as number)
        : 127;

    const hasReminderTime =
      reminder_days > 0 &&
      rawHabit.reminder_hour !== null &&
      rawHabit.reminder_hour !== undefined &&
      rawHabit.reminder_min !== null &&
      rawHabit.reminder_min !== undefined;
    const reminder_time = hasReminderTime
      ? `${String(rawHabit.reminder_hour).padStart(2, "0")}:${String(rawHabit.reminder_min).padStart(2, "0")}`
      : null;

    habits.push({
      id,
      user_id: "",
      name: rawHabit.name as string,
      description: (rawHabit.description as string) || null,
      color: paletteToHex(rawHabit.color as number),
      icon: inferIcon(
        rawHabit.name as string,
        (rawHabit.description as string) || (rawHabit.question as string),
      ),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: rawHabit.archived === 1 ? new Date().toISOString() : null,
      start_date: earliestDate.get(rawHabit.id as number) ?? today,
      sort_order:
        typeof rawHabit.position === "number"
          ? (rawHabit.position as number)
          : habits.length,
      source_uuid: (rawHabit.uuid as string | undefined) ?? null,
      habit_type: isMeasurable ? "measurable" : "boolean",
      target_type: isMeasurable
        ? (rawHabit.target_type as number) === 1
          ? "at_most"
          : "at_least"
        : null,
      target_value: isMeasurable
        ? typeof rawHabit.target_value === "number"
          ? rawHabit.target_value
          : Number(rawHabit.target_value) || null
        : null,
      unit: isMeasurable ? (rawHabit.unit as string) || null : null,
      question: (rawHabit.question as string) || null,
      reminder_time,
      reminder_days,
      ...(frequency && {
        frequency_count: frequency.count,
        frequency_period: frequency.period,
      }),
    });
  });

  uhRepetitions.forEach((rawRepetition) => {
    const habitId = idMap.get(rawRepetition.habit as number);
    if (!habitId) return;

    const habitType =
      habitTypeMap.get(rawRepetition.habit as number) ?? "boolean";
    const rawVal = rawRepetition.value as number;
    const mappedValue = parseRepetitionValue(rawVal, habitType);

    const notes =
      typeof rawRepetition.notes === "string" &&
      rawRepetition.notes.trim().length > 0
        ? rawRepetition.notes.trim()
        : null;

    if (mappedValue === null && !notes) return;

    rawEntries.push({
      id: crypto.randomUUID(),
      habit_id: habitId,
      date: new Date(rawRepetition.timestamp as number)
        .toISOString()
        .split("T")[0],
      value: mappedValue !== null ? mappedValue : 0,
      notes,
      created_at: new Date().toISOString(),
    });
  });

  const seen = new Set<string>();
  const entries = rawEntries.filter((e) => {
    const key = `${e.habit_id}|${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { habits, entries };
}
