import { describe, it, expect, beforeEach } from "vitest";
import { habitMutations } from "@/lib/mutations/habit";
import { mockStore } from "@/lib/mock/mock-store";

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
    expect(habit.target_type).toBeNull();
    expect(habit.target_value).toBeNull();
    expect(habit.unit).toBeNull();
    expect(habit.question).toBeNull();
    expect(habit.reminder_time).toBeNull();
    expect(habit.reminder_days).toBe(127);
  });

  it("creates a measurable habit with new fields", async () => {
    const habit = await habitMutations.create({
      name: "Drink Water",
      habit_type: "measurable",
      frequency_count: 1,
      frequency_period: "day",
      target_type: "at_least",
      target_value: 8,
      unit: "glasses",
    });

    expect(habit.habit_type).toBe("measurable");
    expect(habit.frequency_count).toBe(1);
    expect(habit.frequency_period).toBe("day");
    expect(habit.target_type).toBe("at_least");
    expect(habit.target_value).toBe(8);
    expect(habit.unit).toBe("glasses");
  });

  it("creates a habit with question, reminder_time, reminder_days and snake_case properties", async () => {
    const habit = await habitMutations.create({
      name: "Read Book",
      habit_type: "measurable",
      frequency_count: 5,
      frequency_period: "week",
      target_type: "at_least",
      target_value: 20,
      unit: "pages",
      question: "How many pages did you read?",
      reminder_time: "21:00",
      reminder_days: 62,
    });

    expect(habit.habit_type).toBe("measurable");
    expect(habit.frequency_count).toBe(5);
    expect(habit.frequency_period).toBe("week");
    expect(habit.target_type).toBe("at_least");
    expect(habit.target_value).toBe(20);
    expect(habit.unit).toBe("pages");
    expect(habit.question).toBe("How many pages did you read?");
    expect(habit.reminder_time).toBe("21:00");
    expect(habit.reminder_days).toBe(62);
  });
});

describe("habitMutations.update", () => {
  it("updates habit fields including new ones", async () => {
    const habit = await habitMutations.create({
      name: "Test Habit",
    });

    const updated = await habitMutations.update({
      id: habit.id,
      habit_type: "measurable",
      target_value: 5,
    });

    expect(updated.habit_type).toBe("measurable");
    expect(updated.target_value).toBe(5);
  });

  it("updates question, reminder_time, reminder_days, and snake_case fields", async () => {
    const habit = await habitMutations.create({
      name: "Test Habit",
    });

    const updated = await habitMutations.update({
      id: habit.id,
      habit_type: "measurable",
      target_value: 15,
      target_type: "at_most",
      unit: "minutes",
      question: "Updated prompt?",
      reminder_time: "07:30",
      reminder_days: 31,
    });

    expect(updated.habit_type).toBe("measurable");
    expect(updated.target_value).toBe(15);
    expect(updated.target_type).toBe("at_most");
    expect(updated.unit).toBe("minutes");
    expect(updated.question).toBe("Updated prompt?");
    expect(updated.reminder_time).toBe("07:30");
    expect(updated.reminder_days).toBe(31);
  });

  it("leaves unspecified new fields unchanged", async () => {
    const habit = await habitMutations.create({
      name: "Test Habit",
      habit_type: "measurable",
      target_value: 8,
    });

    const updated = await habitMutations.update({
      id: habit.id,
      name: "Renamed",
    });

    expect(updated.name).toBe("Renamed");
    expect(updated.habit_type).toBe("measurable");
    expect(updated.target_value).toBe(8);
  });

  it("clears measurable target fields when switching to boolean", async () => {
    const habit = await habitMutations.create({
      name: "Read",
      habit_type: "measurable",
      target_type: "at_most",
      target_value: 20,
      unit: "pages",
    });

    const updated = await habitMutations.update({
      id: habit.id,
      habit_type: "boolean",
    });

    expect(updated.habit_type).toBe("boolean");
    expect(updated.target_type).toBeNull();
    expect(updated.target_value).toBeNull();
    expect(updated.unit).toBeNull();
  });
});

describe("habitMutations.markComplete", () => {
  it("saves notes on habit entry", async () => {
    const habit = await habitMutations.create({
      name: "Journaling",
    });

    const entry = await habitMutations.markComplete({
      habitId: habit.id,
      date: "2026-09-03",
      value: 1,
      notes: "Felt very productive today.",
    });

    expect(entry?.value).toBe(1);
    expect(entry?.notes).toBe("Felt very productive today.");
  });
});

describe("habitMutations.markComplete clearing", () => {
  it("deletes the entry when value is null", async () => {
    const habit = await habitMutations.create({ name: "Stretch" });
    await habitMutations.markComplete({
      habitId: habit.id,
      date: "2026-09-01",
      value: 1,
    });

    const result = await habitMutations.markComplete({
      habitId: habit.id,
      date: "2026-09-01",
      value: null,
    });

    expect(result).toBeNull();
    expect(mockStore.getHabitEntries(habit.id)).toHaveLength(0);
  });
});

describe("habitMutations.update clearing a target", () => {
  it("clears target_value when null is passed", async () => {
    const habit = await habitMutations.create({
      name: "Read",
      habit_type: "measurable",
      target_type: "at_least",
      target_value: 20,
    });

    const updated = await habitMutations.update({
      id: habit.id,
      habit_type: "measurable",
      target_value: null,
    });

    expect(updated.target_value).toBeNull();
  });
});
