import { describe, it, expect } from "vitest";
import { CreateHabitSchema } from "@/lib/schemas/habit";

describe("CreateHabitSchema", () => {
  it("accepts a minimal create input without new fields", () => {
    const result = CreateHabitSchema.safeParse({ name: "New Habit" });
    expect(result.success).toBe(true);
  });

  it("accepts a create input with all new fields", () => {
    const input = {
      name: "Drink Water",
      habit_type: "measurable",
      frequency_count: 3,
      frequency_period: "week",
      target_type: "at_most",
      target_value: 10,
      unit: "cups",
    };
    const result = CreateHabitSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects non-positive frequency_count in create", () => {
    const result = CreateHabitSchema.safeParse({
      name: "Bad Habit",
      frequency_count: -1,
    });
    expect(result.success).toBe(false);
  });
});
