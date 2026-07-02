import { describe, it, expect } from "vitest";
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskSchema,
} from "@/lib/schemas/task";

describe("CreateTaskSchema", () => {
  it("validates a correct task input", () => {
    const input = {
      content: "Test Task",
      priority: 1,
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("fails if content is empty", () => {
    const input = {
      content: "",
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.content).toContain("Task content is required");
    }
  });

  it("fails if content is too long", () => {
    const input = {
      content: "a".repeat(501),
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("validates with a Date object for due_date", () => {
    const input = {
      content: "Test Task",
      due_date: new Date(),
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("validates with do_date and is_evening", () => {
    const input = {
      content: "Test Task",
      do_date: new Date(),
      is_evening: true,
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("validates with a valid datetime string for due_date", () => {
    const input = {
      content: "Test Task",
      due_date: new Date().toISOString(),
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("fails with an invalid datetime string for due_date", () => {
    const input = {
      content: "Test Task",
      due_date: "not-a-date",
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("validates with a date-only string for due_date and do_date", () => {
    const input = {
      content: "Test Task",
      due_date: "2026-07-02",
      do_date: "2026-07-02",
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("validates with a valid recurrence object", () => {
    const input = {
      content: "Recurring Task",
      recurrence: {
        freq: "DAILY",
        interval: 1,
      },
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("UpdateTaskSchema", () => {
  it("validates with a date-only string for due_date and do_date", () => {
    const input = {
      id: "task-1",
      due_date: "2026-07-02",
      do_date: "2026-07-02",
    };
    const result = UpdateTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("TaskSchema", () => {
  it("validates a task with date-only due_date and do_date", () => {
    const input = {
      id: "task-1",
      user_id: "user-1",
      content: "Test Task",
      priority: 4,
      due_date: "2026-07-02",
      do_date: "2026-07-02",
      is_completed: false,
      day_order: 0,
      created_at: "2026-07-02T00:00:00.000Z",
      updated_at: "2026-07-02T00:00:00.000Z",
    };
    const result = TaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
