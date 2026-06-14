import { describe, it, expect } from "vitest";
import { computeReorderPairs } from "@/lib/utils/habit-dnd";
import type { Habit } from "@/lib/types/habit";

function makeHabit(id: string, sort_order: number): Habit {
  return {
    id,
    user_id: "u1",
    name: id,
    description: null,
    color: "#000000",
    icon: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    start_date: "2026-01-01",
    sort_order,
  };
}

describe("computeReorderPairs (habits)", () => {
  it("swaps sort_order values among reordered habits (strictly increasing)", () => {
    const habits = [makeHabit("a", 0), makeHabit("b", 1), makeHabit("c", 2)];
    // Move "c" to the top: new order c, a, b
    const pairs = computeReorderPairs(["c", "a", "b"], habits);

    expect(pairs).toEqual([
      { id: "c", sort_order: 0 },
      { id: "a", sort_order: 1 },
      { id: "b", sort_order: 2 },
    ]);
  });

  it("falls back to slot indices when sort_order values are tied", () => {
    const habits = [makeHabit("a", 0), makeHabit("b", 0), makeHabit("c", 0)];
    const pairs = computeReorderPairs(["c", "a", "b"], habits);

    // Tied values can't be distinguished by the DB sort, so use slot indices.
    expect(pairs).toEqual([
      { id: "c", sort_order: 0 },
      { id: "a", sort_order: 1 },
      { id: "b", sort_order: 2 },
    ]);
  });

  it("falls back to sequential index for an id missing from the flat list", () => {
    const habits = [makeHabit("a", 0), makeHabit("b", 1)];
    // "x" is not in the flat list (e.g. a fresh optimistic habit).
    const pairs = computeReorderPairs(["b", "x", "a"], habits);

    expect(pairs).toEqual([
      { id: "b", sort_order: 0 },
      { id: "x", sort_order: 1 },
      { id: "a", sort_order: 2 },
    ]);
  });
});
