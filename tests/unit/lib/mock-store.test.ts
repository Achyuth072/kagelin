import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { mockStore, STORAGE_KEY } from "@/lib/mock/mock-store";
import type { HabitEntry } from "@/lib/types/habit";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const makeEntries = (count: number): HabitEntry[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `entry-${i}`,
    habit_id: "habit-1",
    date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    value: 1,
    created_at: new Date().toISOString(),
  }));

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
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
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
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
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

// A Loop Habit Tracker import writes thousands of entries at once. Saving on
// every entry is quadratic, and a swallowed quota error loses data silently
// while the UI reports success.
describe("MockStore bulk habit entry writes", () => {
  beforeEach(() => {
    localStorage.clear();
    mockStore.clearData();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("persists a bulk insert with a single write", () => {
    const setItem = vi.spyOn(localStorage, "setItem");
    setItem.mockClear(); // discard the write from clearData() in beforeEach
    mockStore.addHabitEntries(makeEntries(2033));

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(mockStore.getHabitEntries()).toHaveLength(2033);
  });

  it("round-trips a bulk insert through localStorage", () => {
    mockStore.addHabitEntries(makeEntries(500));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored.habit_entries).toHaveLength(500);
  });

  it("throws instead of silently losing data when storage is full", () => {
    vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => {
      throw new DOMException("exceeded the quota", "QuotaExceededError");
    });

    expect(() => mockStore.addHabitEntries(makeEntries(10))).toThrow(
      /storage/i,
    );
  });

  // Guest writes reach storage from ~30 call sites; only the uhabits import
  // reports failures itself. Reporting here covers the rest.
  it("reports a failed write to Sentry", () => {
    vi.mocked(Sentry.captureException).mockClear();
    vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => {
      throw new DOMException("exceeded the quota", "QuotaExceededError");
    });

    expect(() => mockStore.addHabitEntries(makeEntries(10))).toThrow();

    expect(Sentry.captureException).toHaveBeenCalledOnce();
    const [reported] = vi.mocked(Sentry.captureException).mock.calls[0];
    expect((reported as DOMException).name).toBe("QuotaExceededError");
  });
});
