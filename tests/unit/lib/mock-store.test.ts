import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mockStore } from "@/lib/mock/mock-store";

describe("MockStore (Guest Mode Data)", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset store state
    mockStore.clearData();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should initialize with empty data when cleared", () => {
    const tasks = mockStore.getTasks();
    expect(tasks).toEqual([]);
  });

  it("should add a task and persist to localStorage", () => {
    const newTask = mockStore.addTask({
      content: "Test Task",
      project_id: null,
      parent_id: null,
      description: null,
      priority: 4,
      due_date: null,
      do_date: null,
      is_evening: false,
      is_completed: false,
      completed_at: null,
      day_order: 0,
      recurrence: null,
      google_event_id: null,
      google_etag: null,
    });

    expect(newTask.id).toBeDefined();
    expect(mockStore.getTasks()).toHaveLength(1);
    expect(mockStore.getTasks()[0].content).toBe("Test Task");

    // Verify localStorage
    const stored = JSON.parse(
      localStorage.getItem("kanso_guest_data_v10") || "{}",
    );
    expect(stored.tasks).toHaveLength(1);
    expect(stored.tasks[0].content).toBe("Test Task");
  });

  it("should update a task correctly", () => {
    const task = mockStore.addTask({
      content: "Original Content",
      project_id: null,
      parent_id: null,
      description: null,
      priority: 4,
      due_date: null,
      do_date: null,
      is_evening: false,
      is_completed: false,
      completed_at: null,
      day_order: 0,
      recurrence: null,
      google_event_id: null,
      google_etag: null,
    });

    const updated = mockStore.updateTask(task.id, {
      content: "Updated Content",
    });

    expect(updated).not.toBeNull();
    expect(updated?.content).toBe("Updated Content");
    expect(mockStore.getTask(task.id)?.content).toBe("Updated Content");

    // Verify localStorage
    const stored = JSON.parse(
      localStorage.getItem("kanso_guest_data_v10") || "{}",
    );
    expect(stored.tasks[0].content).toBe("Updated Content");
  });

  it("should return null when updating a non-existent task", () => {
    const result = mockStore.updateTask("non-existent-id", {
      content: "New Content",
    });
    expect(result).toBeNull();
  });

  it("should seed a recurring task Series in initial data", () => {
    mockStore.reset();

    const seriesTasks = mockStore
      .getTasks()
      .filter((t) => t.recurring_series_id !== null);

    // At least two Occurrences sharing one recurring_series_id
    expect(seriesTasks.length).toBeGreaterThanOrEqual(2);
    const seriesIds = new Set(seriesTasks.map((t) => t.recurring_series_id));
    expect(seriesIds.size).toBe(1);

    // The Series has both a completed past Occurrence and an active one,
    // and every member carries a recurrence rule.
    expect(seriesTasks.some((t) => t.is_completed)).toBe(true);
    expect(seriesTasks.some((t) => !t.is_completed)).toBe(true);
    expect(seriesTasks.every((t) => t.recurrence !== null)).toBe(true);
  });
});
