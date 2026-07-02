import { describe, it, expect, beforeEach } from "vitest";
import { habitMutations } from "@/lib/mutations/habit";
import { mockStore } from "@/lib/mock/mock-store";

// Enable guest mode for mutation tests
beforeEach(() => {
  localStorage.setItem("kanso_guest_mode", "true");
  mockStore.clearData();
});

describe("habitMutations.create", () => {
  it("creates a boolean habit with defaults for new fields", async () => {
    const habit = await habitMutations.create({
      name: "Morning Exercise",
    });

    expect(habit.habit_type).toBe("boolean");
    expect(habit.frequency_count).toBeNull();
    expect(habit.frequency_period).toBe("day");
    expect(habit.target_type).toBe("at_least");
    expect(habit.target_value).toBeNull();
    expect(habit.unit).toBeNull();
  });

  it("creates a measurable habit with new fields", async () => {
    const habit = await habitMutations.create({
      name: "Drink Water",
      habitType: "measurable",
      frequencyCount: 1,
      frequencyPeriod: "day",
      targetType: "at_least",
      targetValue: 8,
      unit: "glasses",
    });

    expect(habit.habit_type).toBe("measurable");
    expect(habit.frequency_count).toBe(1);
    expect(habit.frequency_period).toBe("day");
    expect(habit.target_type).toBe("at_least");
    expect(habit.target_value).toBe(8);
    expect(habit.unit).toBe("glasses");
  });
});

describe("habitMutations.update", () => {
  it("updates habit fields including new ones", async () => {
    const habit = await habitMutations.create({
      name: "Test Habit",
    });

    const updated = await habitMutations.update({
      id: habit.id,
      habitType: "measurable",
      targetValue: 5,
    });

    expect(updated.habit_type).toBe("measurable");
    expect(updated.target_value).toBe(5);
  });

  it("leaves unspecified new fields unchanged", async () => {
    const habit = await habitMutations.create({
      name: "Test Habit",
      habitType: "measurable",
      targetValue: 8,
    });

    const updated = await habitMutations.update({
      id: habit.id,
      name: "Renamed",
    });

    expect(updated.name).toBe("Renamed");
    expect(updated.habit_type).toBe("measurable");
    expect(updated.target_value).toBe(8);
  });
});
