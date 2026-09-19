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

  it("accepts valid question, reminder_time, and reminder_days", () => {
    const result = CreateHabitSchema.safeParse({
      name: "Morning Walk",
      question: "Did you walk this morning?",
      reminder_time: "08:30",
      reminder_days: 127,
    });
    expect(result.success).toBe(true);

    const nullReminder = CreateHabitSchema.safeParse({
      name: "Morning Walk",
      reminder_time: null,
    });
    expect(nullReminder.success).toBe(true);
  });

  it("rejects question longer than 200 characters", () => {
    const result = CreateHabitSchema.safeParse({
      name: "Habit",
      question: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid reminder_time formats", () => {
    expect(
      CreateHabitSchema.safeParse({ name: "Habit", reminder_time: "24:00" })
        .success,
    ).toBe(false);
    expect(
      CreateHabitSchema.safeParse({ name: "Habit", reminder_time: "8:30" })
        .success,
    ).toBe(false);
    expect(
      CreateHabitSchema.safeParse({
        name: "Habit",
        reminder_time: "not-a-time",
      }).success,
    ).toBe(false);
  });

  it("rejects reminder_days outside [0, 127] or non-integer", () => {
    expect(
      CreateHabitSchema.safeParse({ name: "Habit", reminder_days: -1 }).success,
    ).toBe(false);
    expect(
      CreateHabitSchema.safeParse({ name: "Habit", reminder_days: 128 })
        .success,
    ).toBe(false);
    expect(
      CreateHabitSchema.safeParse({ name: "Habit", reminder_days: 12.5 })
        .success,
    ).toBe(false);
  });
});
