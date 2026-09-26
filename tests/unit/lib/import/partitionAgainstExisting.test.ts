import { describe, it, expect } from "vitest";
import { partitionAgainstExisting } from "@/lib/import/uhabits";
import type { Habit } from "@/lib/types/habit";

const h = (name: string, source_uuid: string | null) =>
  ({ name, source_uuid }) as Habit;

describe("partitionAgainstExisting", () => {
  it("skips a renamed or archived habit by its Loop identity", () => {
    const { toImport, skippedNames } = partitionAgainstExisting(
      [h("Run", "u1")],
      [{ ...h("Jogging", "u1"), archived_at: "2026-01-01T00:00:00Z" } as Habit],
    );
    expect(toImport).toEqual([]);
    expect(skippedNames).toEqual(["Run"]);
  });

  it("falls back to case-insensitive name when there is no uuid match", () => {
    const { toImport, skippedNames } = partitionAgainstExisting(
      [h("READ", "u9"), h("New", "u2")],
      [h("read", null)],
    );
    expect(skippedNames).toEqual(["READ"]);
    expect(toImport.map((x) => x.name)).toEqual(["New"]);
  });
});
