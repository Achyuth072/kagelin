import {
  nextEntryValue,
  type StoredEntry,
} from "@/lib/utils/habit-entry-cycle";

// Module scope so it survives view switches and navigation; a reload clears it.
const foundValues = new Map<string, StoredEntry>();

export function cycleEntry(
  habitId: string,
  date: string,
  current: StoredEntry,
): StoredEntry {
  const key = `${habitId}:${date}`;
  if (!foundValues.has(key)) foundValues.set(key, current);
  return nextEntryValue(current, foundValues.get(key) ?? null);
}
