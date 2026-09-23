import {
  ENTRY_VALUE_DONE,
  ENTRY_VALUE_NOT_DONE,
  ENTRY_VALUE_SKIPPED,
  type Habit,
} from "@/lib/types/habit";

/** A day's stored Entry value; `null` is no Entry (Unknown). */
export type StoredEntry = number | null;

// `found` is the pre-tap value, so cycling through Skip returns to an imported Not done instead of clearing it.
export function nextEntryValue(
  current: StoredEntry,
  found: StoredEntry,
): StoredEntry {
  if (current === ENTRY_VALUE_SKIPPED) {
    return found === ENTRY_VALUE_NOT_DONE ? ENTRY_VALUE_NOT_DONE : null;
  }
  if (current !== null && current >= ENTRY_VALUE_DONE) {
    return ENTRY_VALUE_SKIPPED;
  }
  return ENTRY_VALUE_DONE;
}

export function entryStateName(
  stored: StoredEntry,
  habit?: Pick<Habit, "habit_type" | "unit">,
): string {
  if (stored === null) return "not logged";
  if (habit?.habit_type === "measurable" && stored !== ENTRY_VALUE_SKIPPED) {
    return `${stored}${habit.unit ? ` ${habit.unit}` : ""} logged`;
  }
  if (stored === ENTRY_VALUE_SKIPPED) return "skipped";
  if (stored >= ENTRY_VALUE_DONE) return "done";
  return "not done";
}
