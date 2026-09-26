import { get } from "idb-keyval";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { frequencyWindowDays } from "@/lib/utils/habit-frequency";
import { mockStore } from "@/lib/mock/mock-store";
import { fetchAllRows } from "@/lib/supabase/paginate";
import {
  ENTRY_VALUE_NOT_DONE,
  ENTRY_VALUE_SKIPPED,
  type Habit,
  type HabitEntry,
  type HabitType,
} from "@/lib/types/habit";
import {
  LOOP_COLOR_PALETTE,
  LOOP_VALUE_NO,
  LOOP_VALUE_SKIP,
  LOOP_VALUE_YES,
  colorDistance,
  paletteToHex,
} from "@/lib/import/uhabits";

export interface UhabitsExportData {
  habits: Habit[];
  entries: HabitEntry[];
  rawSources: unknown[];
}

export interface UhabitsExportOptions {
  habits?: Habit[];
  entries?: HabitEntry[];
  rawSources?: unknown[];
  supabase?: SupabaseClient;
  isGuest?: boolean;
}

export type RawLoopHabit = Record<string, unknown>;

const LOOP_COLOR_ENTRIES = Object.entries(LOOP_COLOR_PALETTE);

export function findClosestLoopColor(hex: string): number {
  let closest = 0;
  let minDistance = Infinity;

  for (const [idxStr, loopHex] of LOOP_COLOR_ENTRIES) {
    const dist = colorDistance(hex, loopHex);
    if (dist < minDistance) {
      minDistance = dist;
      closest = Number(idxStr);
    }
  }

  return closest;
}

export function resolveLoopColor(
  habit: Habit,
  rawHabit?: RawLoopHabit,
): number {
  if (
    typeof rawHabit?.color === "number" &&
    paletteToHex(rawHabit.color).toLowerCase() === habit.color.toLowerCase()
  ) {
    return rawHabit.color;
  }
  return findClosestLoopColor(habit.color);
}

export function normalizeUuid(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

export function mapKagelinFrequencyToLoop(
  habit: Pick<Habit, "frequency_count" | "frequency_days" | "frequency_period">,
): { freq_num: number; freq_den: number } {
  const count = habit.frequency_count;
  return {
    freq_num: typeof count === "number" && count > 0 ? count : 1,
    freq_den: frequencyWindowDays(habit),
  };
}

export function entryToRepetitionValue(
  value: number,
  habitType: HabitType,
): number {
  if (value === ENTRY_VALUE_SKIPPED) {
    return LOOP_VALUE_SKIP;
  }
  if (value === ENTRY_VALUE_NOT_DONE) {
    return LOOP_VALUE_NO;
  }
  if (habitType === "measurable") {
    return Math.round(value * 1000);
  }
  return LOOP_VALUE_YES;
}

export function toFilenameDate(date?: Date | string): string {
  if (!date) return format(new Date(), "yyyy-MM-dd");
  return date instanceof Date ? format(date, "yyyy-MM-dd") : date;
}

export function sortHabitsByOrder(habits: Habit[]): Habit[] {
  return [...habits].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function extractRawHabits(
  rawSources: unknown[],
): Map<string, RawLoopHabit> {
  const map = new Map<string, RawLoopHabit>();

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
        const rawH = h as RawLoopHabit;
        map.set(normalizeUuid(rawH.uuid as string), rawH);
      }
    }
  }

  return map;
}

export function getRawHabitByProvenance(
  habit: Habit,
  rawHabitsByUuid: Map<string, RawLoopHabit>,
): RawLoopHabit | undefined {
  if (!habit.source_uuid) return undefined;
  return rawHabitsByUuid.get(normalizeUuid(habit.source_uuid));
}

// Pre-ADR-0019 imports stored approximated frequencies; preserve raw Loop values until edited.
export function getHabitFrequency(
  habit: Habit,
  rawHabit?: RawLoopHabit,
): { freq_num: number; freq_den: number } {
  const current = mapKagelinFrequencyToLoop(habit);
  if (
    rawHabit &&
    typeof rawHabit.freq_num === "number" &&
    typeof rawHabit.freq_den === "number" &&
    rawHabit.freq_num > 0 &&
    rawHabit.freq_den > 0
  ) {
    const raw = { freq_num: rawHabit.freq_num, freq_den: rawHabit.freq_den };
    const legacy = legacyImportedFrequency(raw);
    if (
      current.freq_num === legacy.freq_num &&
      current.freq_den === legacy.freq_den
    ) {
      return raw;
    }
  }
  return current;
}

function legacyImportedFrequency({
  freq_num,
  freq_den,
}: {
  freq_num: number;
  freq_den: number;
}): { freq_num: number; freq_den: number } {
  if (freq_den === 1 || freq_den === 7 || freq_den === 30) {
    return { freq_num, freq_den };
  }
  if (freq_den === 31) return { freq_num, freq_den: 30 };
  return {
    freq_num: Math.max(1, Math.round((freq_num * 7) / freq_den)),
    freq_den: 7,
  };
}

const GUEST_STORE_KEY = "kanso_import_sources";

export async function collectUhabitsExportData(
  options: UhabitsExportOptions = {},
): Promise<UhabitsExportData> {
  const isGuest =
    options.isGuest ??
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
      } catch (err) {
        Sentry.captureException(err);
      }
    }
    return { habits, entries, rawSources };
  }

  const supabase = options.supabase ?? createClient();

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

  return { habits, entries, rawSources: habitImports.map((row) => row.raw) };
}

export async function resolveUhabitsExportData(
  options: UhabitsExportOptions = {},
): Promise<UhabitsExportData> {
  if (options.habits) {
    return {
      habits: options.habits,
      entries: options.entries ?? [],
      rawSources: options.rawSources ?? [],
    };
  }
  return collectUhabitsExportData(options);
}
