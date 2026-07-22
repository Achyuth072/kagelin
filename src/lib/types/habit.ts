export interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  start_date: string | null;
  sort_order: number;
  habit_type?: "boolean" | "measurable";
  frequency_count?: number | null;
  frequency_period?: "day" | "week" | "month" | null;
  target_type?: "at_least" | "at_most" | null;
  target_value?: number | null;
  unit?: string | null;
  // Origin identifier from an import source (e.g. uhabits' `uuid`), so a future
  // export can join current state back to its raw source record. See ADR 0006.
  source_uuid?: string | null;
}

export interface HabitEntry {
  id: string;
  habit_id: string;
  date: string; // ISO 8601 date (YYYY-MM-DD)
  value: number;
  created_at: string;
}

export interface HabitWithEntries extends Habit {
  entries: HabitEntry[];
}
