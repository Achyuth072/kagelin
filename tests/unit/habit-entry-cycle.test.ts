import { describe, it, expect } from "vitest";
import {
  nextEntryValue,
  type StoredEntry,
} from "@/lib/utils/habit-entry-cycle";
import {
  ENTRY_VALUE_DONE as DONE,
  ENTRY_VALUE_NOT_DONE as NOT_DONE,
  ENTRY_VALUE_SKIPPED as SKIPPED,
} from "@/lib/types/habit";

describe("nextEntryValue", () => {
  it.each<[string, StoredEntry, StoredEntry, StoredEntry]>([
    ["no Entry → Done", null, null, DONE],
    ["Done → Skipped", DONE, DONE, SKIPPED],
    ["Skipped → Unknown", SKIPPED, SKIPPED, null],
    ["Not done → Done", NOT_DONE, NOT_DONE, DONE],
    ["Done → Skipped, found Not done", DONE, NOT_DONE, SKIPPED],
    ["Skipped → Not done, found Not done", SKIPPED, NOT_DONE, NOT_DONE],
    ["Skipped → Unknown, found empty", SKIPPED, null, null],
    ["Skipped → Unknown, found Done", SKIPPED, DONE, null],
  ])("%s", (_name, current, found, expected) => {
    expect(nextEntryValue(current, found)).toBe(expected);
  });

  it.each<[string, StoredEntry, StoredEntry[]]>([
    ["no Entry", null, [DONE, SKIPPED, null]],
    ["Done", DONE, [SKIPPED, null, DONE]],
    ["Skipped", SKIPPED, [null, DONE, SKIPPED]],
    ["Not done", NOT_DONE, [DONE, SKIPPED, NOT_DONE]],
  ])("three taps from %s return it to how it was found", (_n, found, path) => {
    let value = found;
    const seen: StoredEntry[] = [];
    for (let tap = 0; tap < 3; tap++) {
      value = nextEntryValue(value, found);
      seen.push(value);
    }
    expect(seen).toEqual(path);
    expect(value).toBe(found);
  });
});
