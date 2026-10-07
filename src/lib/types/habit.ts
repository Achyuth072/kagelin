import type { MaybeUnreadable } from "@/lib/crypto/unreadable";
export interface Habit extends MaybeUnreadable {
  id: string;
  user_id: string;
  name: string | null;
  description: string | null;
  color: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  start_date: string | null;
  sort_order: number;
  habit_type?: HabitType;
  frequency_count?: number | null;
  frequency_days?: number | null;
  frequency_period?: FrequencyPeriod | null;
  target_type?: "at_least" | "at_most" | null;
  target_value?: number | null;
  unit?: string | null;
  question?: string | null;
  reminder_time?: string | null;
  reminder_days?: number;
  // Preserves raw source id (e.g. uhabits uuid) for round-trip export (ADR 0006).
  source_uuid?: string | null;
}

export interface HabitEntry extends MaybeUnreadable {
  id: string;
  habit_id: string;
  date: string;
  value: number;
  notes?: string | null;
  created_at: string;
}

export interface HabitWithEntries extends Habit {
  entries: HabitEntry[];
}

export type HabitType = "boolean" | "measurable";

export const FREQUENCY_PERIODS = ["day", "week", "month"] as const;
export type FrequencyPeriod = (typeof FREQUENCY_PERIODS)[number];

// Upper bound of the habits.frequency_days CHECK constraint (ADR 0019).
export const MAX_FREQUENCY_DAYS = 365;

export const ENTRY_VALUE_DONE = 1;
export const ENTRY_VALUE_NOT_DONE = 0;
export const ENTRY_VALUE_SKIPPED = -2;

// Bitmask of reminder weekdays, bit 0 = Sunday; all seven set = every day.
export const REMINDER_EVERY_DAY = 127;
