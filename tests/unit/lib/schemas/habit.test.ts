import { describe, it, expect } from "vitest";
import {
  HabitSchema,
  CreateHabitSchema,
  UpdateHabitSchema,
} from "@/lib/schemas/habit";

describe("HabitSchema", () => {
  const baseHabit = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    user_id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Test Habit",
    description: null,
    color: "#4B6CB7",
    icon: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    archived_at: null,
    start_date: "2024-01-01",
    sort_order: 0,
  };

  it("parses a habit without new fields (backward compat) with defaults", () => {
    const result = HabitSchema.safeParse(baseHabit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.habit_type).toBe("boolean");
      expect(result.data.frequency_count).toBeNull();
      expect(result.data.frequency_period).toBe("day");
      expect(result.data.target_type).toBe("at_least");
      expect(result.data.target_value).toBeNull();
      expect(result.data.unit).toBeNull();
    }
  });

  it("parses a measurable habit with all new fields", () => {
    const measurable = {
      ...baseHabit,
      name: "Drink Water",
      habit_type: "measurable",
      frequency_count: 1,
      frequency_period: "day",
      target_type: "at_least",
      target_value: 8,
      unit: "glasses",
    };

    const result = HabitSchema.safeParse(measurable);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.habit_type).toBe("measurable");
      expect(result.data.frequency_count).toBe(1);
      expect(result.data.frequency_period).toBe("day");
      expect(result.data.target_type).toBe("at_least");
      expect(result.data.target_value).toBe(8);
      expect(result.data.unit).toBe("glasses");
    }
  });

  it("rejects invalid habit_type", () => {
    const result = HabitSchema.safeParse({
      ...baseHabit,
      habit_type: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid frequency_period", () => {
    const result = HabitSchema.safeParse({
      ...baseHabit,
      frequency_period: "year",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid target_type", () => {
    const result = HabitSchema.safeParse({
      ...baseHabit,
      target_type: "exactly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive frequency_count", () => {
    const result = HabitSchema.safeParse({ ...baseHabit, frequency_count: 0 });
    expect(result.success).toBe(false);
  });

  it("allows null frequency_count", () => {
    const result = HabitSchema.safeParse({
      ...baseHabit,
      frequency_count: null,
    });
    expect(result.success).toBe(true);
  });
});

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

describe("UpdateHabitSchema", () => {
  it("accepts a partial update with new fields", () => {
    const input = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      habit_type: "measurable",
      target_value: 8,
    };
    const result = UpdateHabitSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts an update without any new fields", () => {
    const input = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Renamed",
    };
    const result = UpdateHabitSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
