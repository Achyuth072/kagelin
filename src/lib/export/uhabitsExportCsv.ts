import { format, parseISO, eachDayOfInterval, startOfDay } from "date-fns";
import { zipSync, strToU8 } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import {
  mapKagelinFrequencyToLoop,
  findClosestLoopColor,
  extractRawHabits,
  collectUhabitsExportData,
  entryToRepetitionValue,
  type UhabitsExportData,
} from "@/lib/export/uhabitsExportDb";
import { computeScores } from "@/lib/utils/habit-score";
import {
  buildIntervals,
  snapIntervalsTogether,
  shift,
} from "@/lib/utils/habit-intervals";

export type { UhabitsExportData };

export interface ExportToUhabitsZipOptions {
  habits?: Habit[];
  entries?: HabitEntry[];
  rawSources?: unknown[];
  supabase?: SupabaseClient;
  isGuest?: boolean;
  today?: Date | string;
}

export const LOOP_CSV_COLORS = [
  "#D32F2F",
  "#E64A19",
  "#F57C00",
  "#FF8F00",
  "#F9A825",
  "#AFB42B",
  "#7CB342",
  "#388E3C",
  "#00897B",
  "#00ACC1",
  "#039BE5",
  "#1976D2",
  "#303F9F",
  "#5E35B1",
  "#8E24AA",
  "#D81B60",
  "#5D4037",
  "#303030",
  "#757575",
  "#aaaaaa",
];

export function escapeCsvField(
  field: string | number | boolean | null | undefined,
): string {
  if (field === null || field === undefined) return "";
  const str = String(field);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatCsvRow(
  fields: (string | number | boolean | null | undefined)[],
): string {
  return fields.map(escapeCsvField).join(",");
}

export function toCsvColor(paletteIndex: number): string {
  if (paletteIndex >= 0 && paletteIndex < LOOP_CSV_COLORS.length) {
    return LOOP_CSV_COLORS[paletteIndex];
  }
  if (paletteIndex === 20) {
    return "#4e342e";
  }
  return "#D32F2F";
}

export function sanitizeHabitDirName(name: string): string {
  return name.replace(/[^ a-zA-Z0-9._-]+/g, "").slice(0, 100);
}

export function formatHabitDirName(index: number, name: string): string {
  const sane = sanitizeHabitDirName(name);
  const prefix = String(index + 1).padStart(3, "0");
  const combined = sane ? `${prefix} ${sane}` : prefix;
  return `${combined.trim()}/`;
}

function toDateStr(date?: Date | string): string {
  if (!date) return format(new Date(), "yyyy-MM-dd");
  return date instanceof Date ? format(date, "yyyy-MM-dd") : date;
}

export function formatRepetitionValue(value: number): string {
  switch (value) {
    case 2:
      return "YES_MANUAL";
    case 1:
      return "YES_AUTO";
    case 0:
      return "NO";
    case 3:
      return "SKIP";
    case -1:
      return "UNKNOWN";
    default:
      return value.toString();
  }
}

export function computeDoneDays(
  num: number,
  den: number,
  doneDates: string[],
): Set<string> {
  const intervals = buildIntervals(num, den, doneDates);
  snapIntervalsTogether(intervals);
  const done = new Set<string>();
  for (const { begin, end } of intervals) {
    let cur = begin;
    while (cur <= end) {
      done.add(cur);
      cur = shift(cur, 1);
    }
  }
  return done;
}

export function getRawHabitByProvenance(
  habit: Habit,
  rawHabitsByUuid: Map<string, Record<string, unknown>>,
): Record<string, unknown> | undefined {
  if (!habit.source_uuid) return undefined;
  const cleanSourceUuid = habit.source_uuid.replace(/-/g, "").toLowerCase();
  return rawHabitsByUuid.get(cleanSourceUuid);
}

export function getHabitFrequency(
  habit: Habit,
  rawHabit?: Record<string, unknown>,
): { freq_num: number; freq_den: number } {
  if (
    rawHabit &&
    typeof rawHabit.freq_num === "number" &&
    typeof rawHabit.freq_den === "number" &&
    rawHabit.freq_num > 0 &&
    rawHabit.freq_den > 0
  ) {
    return { freq_num: rawHabit.freq_num, freq_den: rawHabit.freq_den };
  }
  return mapKagelinFrequencyToLoop(
    habit.frequency_count,
    habit.frequency_period,
  );
}

export function generateHabitsCsv(
  habits: Habit[],
  rawSources: unknown[] = [],
): string {
  const sortedHabits = [...habits].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const rawHabitsByUuid = extractRawHabits(rawSources);

  const header = [
    "Position",
    "Name",
    "Type",
    "Question",
    "Description",
    "FrequencyNumerator",
    "FrequencyDenominator",
    "Color",
    "Unit",
    "Target Type",
    "Target Value",
    "Archived?",
  ];

  const rows: string[] = [formatCsvRow(header)];

  for (let index = 0; index < sortedHabits.length; index++) {
    const habit = sortedHabits[index];
    const rawHabit = getRawHabitByProvenance(habit, rawHabitsByUuid);

    const positionStr = String(index + 1).padStart(3, "0");
    const name = habit.name;
    const isMeasurable = habit.habit_type === "measurable";
    const type = isMeasurable ? "NUMERICAL" : "YES_NO";
    const question =
      habit.question ??
      (typeof rawHabit?.question === "string" ? rawHabit.question : "");
    const description =
      habit.description ??
      (typeof rawHabit?.description === "string" ? rawHabit.description : "");

    const { freq_num, freq_den } = getHabitFrequency(habit, rawHabit);

    const colorIdx =
      typeof rawHabit?.color === "number"
        ? rawHabit.color
        : findClosestLoopColor(habit.color);
    const colorHex = toCsvColor(colorIdx);

    const unit = isMeasurable
      ? (habit.unit ??
        (typeof rawHabit?.unit === "string" ? rawHabit.unit : ""))
      : "";

    const targetType = isMeasurable
      ? (habit.target_type ??
          (rawHabit?.target_type === 1 || rawHabit?.target_type === "at_most"
            ? "at_most"
            : "at_least")) === "at_most"
        ? "AT_MOST"
        : "AT_LEAST"
      : "";

    const targetValue = isMeasurable
      ? (
          habit.target_value ??
          (typeof rawHabit?.target_value === "number"
            ? rawHabit.target_value
            : 0)
        ).toString()
      : "";

    const isArchived = Boolean(habit.archived_at).toString();

    rows.push(
      formatCsvRow([
        positionStr,
        name,
        type,
        question,
        description,
        freq_num,
        freq_den,
        colorHex,
        unit,
        targetType,
        targetValue,
        isArchived,
      ]),
    );
  }

  return rows.join("\n") + "\n";
}

function formatEntryValueForHabit(
  habit: Habit,
  entry: HabitEntry | undefined,
  isAutoDone: boolean,
): string {
  if (!entry) {
    if (habit.habit_type !== "measurable" && isAutoDone) {
      return formatRepetitionValue(1);
    }
    return formatRepetitionValue(-1);
  }

  const repVal = entryToRepetitionValue(
    entry.value,
    habit.habit_type === "measurable" ? "measurable" : "boolean",
  );
  return formatRepetitionValue(repVal);
}

export function generateHabitCheckmarksCsv(
  habit: Habit,
  entries: HabitEntry[],
  options?: { today?: string; rawSources?: unknown[] },
): string {
  const rawHabitsByUuid = extractRawHabits(options?.rawSources ?? []);
  const { entryByDate, doneSet } = buildHabitCheckmarkHelper(
    habit,
    entries,
    rawHabitsByUuid,
  );

  const manualDates = new Set(entryByDate.keys());

  const allDates = new Set<string>(manualDates);
  for (const d of doneSet) {
    allDates.add(d);
  }

  if (allDates.size === 0) {
    return "Date,Value,Notes\n";
  }

  const sortedDates = [...allDates].sort((a, b) => b.localeCompare(a));
  const rows: string[] = [formatCsvRow(["Date", "Value", "Notes"])];

  for (const date of sortedDates) {
    const entry = entryByDate.get(date);
    const isAuto = !manualDates.has(date) && doneSet.has(date);
    const val = formatEntryValueForHabit(habit, entry, isAuto);
    const notes = entry?.notes ?? "";
    rows.push(formatCsvRow([date, val, notes]));
  }

  return rows.join("\n") + "\n";
}

export function generateHabitScoresCsv(
  habit: Habit,
  entries: HabitEntry[],
  options?: { today?: string },
): string {
  const habitEntries = entries.filter((e) => e.habit_id === habit.id);
  const todayStr = options?.today ?? format(new Date(), "yyyy-MM-dd");

  if (habitEntries.length === 0) {
    return `Date,Score\n${todayStr},0.0000\n`;
  }

  const oldest = habitEntries.reduce(
    (min, e) => (e.date < min ? e.date : min),
    habitEntries[0].date,
  );
  const newest = habitEntries.reduce(
    (max, e) => (e.date > max ? e.date : max),
    habitEntries[0].date,
  );
  const fromDateStr = oldest <= todayStr ? oldest : todayStr;
  const toDateStr = newest >= todayStr ? newest : todayStr;

  const scores = computeScores(habit, habitEntries, {
    from: parseISO(fromDateStr),
    to: parseISO(toDateStr),
  });

  const scoreMap = new Map<string, number>();
  for (const s of scores) {
    scoreMap.set(s.date, s.value);
  }

  const days = eachDayOfInterval({
    start: startOfDay(parseISO(fromDateStr)),
    end: startOfDay(parseISO(toDateStr)),
  });

  const sortedDays = days.reverse();
  const rows: string[] = ["Date,Score"];

  for (const day of sortedDays) {
    const key = format(day, "yyyy-MM-dd");
    const scoreVal = scoreMap.get(key) ?? 0;
    rows.push(`${key},${scoreVal.toFixed(4)}`);
  }

  return rows.join("\n") + "\n";
}

function computeDateRange(
  entries: HabitEntry[],
  todayStr: string,
): { oldest: string; newest: string } {
  let oldest = todayStr;
  let newest = todayStr;
  for (const e of entries) {
    if (e.date < oldest) oldest = e.date;
    if (e.date > newest) newest = e.date;
  }
  return { oldest, newest };
}

function buildMatrixHeader(habits: Habit[]): string {
  let header = "Date,";
  for (const h of habits) {
    header += escapeCsvField(h.name) + ",";
  }
  return header + "\n";
}

function buildHabitCheckmarkHelper(
  habit: Habit,
  entries: HabitEntry[],
  rawHabitsByUuid: Map<string, Record<string, unknown>>,
): { entryByDate: Map<string, HabitEntry>; doneSet: Set<string> } {
  const habitEntries = entries.filter((e) => e.habit_id === habit.id);
  const rawHabit = getRawHabitByProvenance(habit, rawHabitsByUuid);

  const { freq_num, freq_den } = getHabitFrequency(habit, rawHabit);
  const doneDates = habitEntries.filter((e) => e.value >= 1).map((e) => e.date);

  const doneSet =
    habit.habit_type !== "measurable" && freq_den > 1
      ? computeDoneDays(freq_num, freq_den, doneDates)
      : new Set<string>();

  const entryByDate = new Map<string, HabitEntry>();
  for (const e of habitEntries) {
    entryByDate.set(e.date, e);
  }

  return { entryByDate, doneSet };
}

export function generateCheckmarksMatrixCsv(
  habits: Habit[],
  entries: HabitEntry[],
  options?: { today?: string; rawSources?: unknown[] },
): string {
  const sortedHabits = [...habits].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const todayStr = options?.today ?? format(new Date(), "yyyy-MM-dd");
  const { oldest, newest } = computeDateRange(entries, todayStr);
  const header = buildMatrixHeader(sortedHabits);

  const rawHabitsByUuid = extractRawHabits(options?.rawSources ?? []);
  const habitHelpers = sortedHabits.map((habit) => ({
    habit,
    ...buildHabitCheckmarkHelper(habit, entries, rawHabitsByUuid),
  }));

  const days = eachDayOfInterval({
    start: startOfDay(parseISO(oldest)),
    end: startOfDay(parseISO(newest)),
  }).reverse();

  const lines: string[] = [header.trimEnd()];

  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");
    let row = dateStr + ",";
    for (const { habit, entryByDate, doneSet } of habitHelpers) {
      const entry = entryByDate.get(dateStr);
      const isAuto = !entry && doneSet.has(dateStr);
      const val = formatEntryValueForHabit(habit, entry, isAuto);
      row += val + ",";
    }
    lines.push(row);
  }

  return lines.join("\n") + "\n";
}

export function generateScoresMatrixCsv(
  habits: Habit[],
  entries: HabitEntry[],
  options?: { today?: string },
): string {
  const sortedHabits = [...habits].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const todayStr = options?.today ?? format(new Date(), "yyyy-MM-dd");
  const { oldest, newest } = computeDateRange(entries, todayStr);
  const header = buildMatrixHeader(sortedHabits);

  const habitScoreMaps = sortedHabits.map((habit) => {
    const habitEntries = entries.filter((e) => e.habit_id === habit.id);
    if (habitEntries.length === 0) {
      return new Map<string, number>();
    }
    const scores = computeScores(habit, habitEntries, {
      from: parseISO(oldest),
      to: parseISO(newest),
    });
    const map = new Map<string, number>();
    for (const s of scores) {
      map.set(s.date, s.value);
    }
    return map;
  });

  const days = eachDayOfInterval({
    start: startOfDay(parseISO(oldest)),
    end: startOfDay(parseISO(newest)),
  }).reverse();

  const lines: string[] = [header.trimEnd()];

  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");
    let row = dateStr + ",";
    for (const map of habitScoreMaps) {
      const scoreVal = map.get(dateStr) ?? 0;
      row += scoreVal.toFixed(4) + ",";
    }
    lines.push(row);
  }

  return lines.join("\n") + "\n";
}

export function generateUhabitsZipFilename(date?: Date | string): string {
  return `Loop Habits CSV ${toDateStr(date)}.zip`;
}

export function buildUhabitsCsvArchive(
  data: UhabitsExportData,
  options?: { today?: string | Date },
): Record<string, Uint8Array> {
  const habits = data.habits ?? [];
  const entries = data.entries ?? [];
  const rawSources = data.rawSources ?? [];

  const todayStr = toDateStr(options?.today);

  const sortedHabits = [...habits].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  const archive: Record<string, Uint8Array> = {};

  const habitsCsv = generateHabitsCsv(sortedHabits, rawSources);
  archive["Habits.csv"] = strToU8(habitsCsv);

  const checkmarksCsv = generateCheckmarksMatrixCsv(sortedHabits, entries, {
    today: todayStr,
    rawSources,
  });
  archive["Checkmarks.csv"] = strToU8(checkmarksCsv);

  const scoresCsv = generateScoresMatrixCsv(sortedHabits, entries, {
    today: todayStr,
  });
  archive["Scores.csv"] = strToU8(scoresCsv);

  for (let index = 0; index < sortedHabits.length; index++) {
    const habit = sortedHabits[index];
    const dirName = formatHabitDirName(index, habit.name);

    const habitChecksCsv = generateHabitCheckmarksCsv(habit, entries, {
      today: todayStr,
      rawSources,
    });
    archive[`${dirName}Checkmarks.csv`] = strToU8(habitChecksCsv);

    const habitScoresCsv = generateHabitScoresCsv(habit, entries, {
      today: todayStr,
    });
    archive[`${dirName}Scores.csv`] = strToU8(habitScoresCsv);
  }

  return archive;
}

export async function exportToUhabitsZip(
  input?: ExportToUhabitsZipOptions | UhabitsExportData,
  extraOptions?: { today?: string | Date },
): Promise<Uint8Array> {
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

  const today =
    extraOptions?.today ??
    (input && "today" in input ? input.today : undefined);

  const archive = buildUhabitsCsvArchive(
    { habits, entries, rawSources },
    { today },
  );

  return zipSync(archive);
}
