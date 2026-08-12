import { describe, it, expect, vi, beforeEach } from "vitest";
import { taskMutations } from "@/lib/mutations/task";
import { mockStore } from "@/lib/mock/mock-store";
import type { Task } from "@/lib/types/task";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";

const mockCreateClient = vi.mocked(createClient);

describe("taskMutations.duplicate", () => {
  beforeEach(() => {
    localStorage.setItem("kanso_guest_mode", "true");
  });

  it("duplicates a task and strips recurring_series_id and recurrence", async () => {
    const originalTask = mockStore.addTask({
      content: "Recurring Task",
      description: "Original description",
      priority: 2,
      due_date: "2026-08-10T10:00:00.000Z",
      recurrence: { freq: "DAILY", interval: 1 },
      recurring_series_id: "series-12345",
    });

    const duplicatedTask = await taskMutations.duplicate(originalTask);

    expect(duplicatedTask.id).not.toBe(originalTask.id);
    expect(duplicatedTask.content).toBe("Recurring Task");
    expect(duplicatedTask.description).toBe("Original description");
    expect(duplicatedTask.priority).toBe(2);
    expect(duplicatedTask.due_date).toBe("2026-08-10T10:00:00.000Z");
    expect(duplicatedTask.recurring_series_id).toBeNull();
    expect(duplicatedTask.recurrence).toBeNull();
  });

  it("deeply copies subtasks linked to the new duplicated parent ID", async () => {
    const parentTask = mockStore.addTask({
      content: "Parent Task",
    });

    const subtask1 = mockStore.addTask({
      content: "Subtask 1",
      parent_id: parentTask.id,
      priority: 1,
    });

    const subtask2 = mockStore.addTask({
      content: "Subtask 2",
      parent_id: parentTask.id,
      priority: 3,
    });

    // Sub-subtask
    const nestedSubtask = mockStore.addTask({
      content: "Nested Subtask",
      parent_id: subtask1.id,
    });

    const duplicatedParent = await taskMutations.duplicate(parentTask);

    expect(duplicatedParent.id).not.toBe(parentTask.id);

    const allTasks = mockStore.getTasks();
    const copiedSubtasks = allTasks.filter(
      (t) => t.parent_id === duplicatedParent.id,
    );

    expect(copiedSubtasks.length).toBe(2);
    expect(copiedSubtasks.map((s) => s.content)).toContain("Subtask 1");
    expect(copiedSubtasks.map((s) => s.content)).toContain("Subtask 2");

    // Verify subtask IDs are unique
    expect(copiedSubtasks.map((s) => s.id)).not.toContain(subtask1.id);
    expect(copiedSubtasks.map((s) => s.id)).not.toContain(subtask2.id);

    // Verify nested subtask was copied under the new Subtask 1
    const copiedSub1 = copiedSubtasks.find((s) => s.content === "Subtask 1");
    expect(copiedSub1).toBeDefined();

    const copiedNested = allTasks.filter((t) => t.parent_id === copiedSub1?.id);
    expect(copiedNested.length).toBe(1);
    expect(copiedNested[0].content).toBe("Nested Subtask");
    expect(copiedNested[0].id).not.toBe(nestedSubtask.id);
  });
});

describe("taskMutations.duplicate — authenticated (Supabase)", () => {
  const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: "task-1",
    user_id: "user-1",
    project_id: null,
    parent_id: null,
    content: "Original",
    description: null,
    priority: 4,
    due_date: null,
    do_date: null,
    is_evening: false,
    is_completed: false,
    completed_at: null,
    day_order: 0,
    recurrence: { freq: "DAILY", interval: 1 },
    recurring_series_id: "series-12345",
    google_event_id: null,
    google_etag: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });

  // Builds a `from("tasks")` stand-in covering exactly the chains
  // taskMutations.duplicate's Supabase branch issues: a day_order lookup
  // (select -> eq -> order -> limit -> maybeSingle), a subtree fetch
  // (select -> eq, awaited directly), and an insert (insert -> select ->
  // single). `subtasksByParentId` is keyed by the *original* row id, since
  // the recursive fetch always queries by the source subtree's ids.
  function makeSupabaseMock({
    dayOrder = null,
    subtasksByParentId = {},
    hasSession = true,
    subtaskFetchErrorForParentId,
    subtaskInsertErrorForContent,
  }: {
    dayOrder?: number | null;
    subtasksByParentId?: Record<string, Record<string, unknown>[]>;
    hasSession?: boolean;
    // Simulates a failed subtree fetch for a specific parent id.
    subtaskFetchErrorForParentId?: string;
    // Simulates a failed insert for a specific subtask's content.
    subtaskInsertErrorForContent?: string;
  } = {}) {
    const insertedRows: Record<string, unknown>[] = [];
    const maybeSingle = vi.fn().mockResolvedValue({
      data: dayOrder === null ? null : { day_order: dayOrder },
      error: null,
    });

    const from = vi.fn(() => ({
      select: (cols: string) =>
        cols === "day_order"
          ? {
              eq: () => ({ order: () => ({ limit: () => ({ maybeSingle }) }) }),
            }
          : {
              eq: (_col: string, parentId: string) =>
                Promise.resolve(
                  parentId === subtaskFetchErrorForParentId
                    ? { data: null, error: { message: "fetch failed" } }
                    : { data: subtasksByParentId[parentId] ?? [], error: null },
                ),
            },
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: vi.fn().mockImplementation(async () => {
            if (row.content === subtaskInsertErrorForContent) {
              return { data: null, error: { message: "insert failed" } };
            }
            const newRow = { ...row, id: `dup-${insertedRows.length}` };
            insertedRows.push(newRow);
            return { data: newRow, error: null };
          }),
        }),
      }),
    }));

    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: hasSession ? { user: { id: "user-1" } } : null },
        }),
      },
      from,
    };
    mockCreateClient.mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );
    return { insertedRows, maybeSingle, from };
  }

  beforeEach(() => {
    localStorage.removeItem("kanso_guest_mode");
    vi.clearAllMocks();
  });

  it("computes day_order as max+1 and strips recurrence on the inserted row", async () => {
    const { insertedRows, maybeSingle } = makeSupabaseMock({ dayOrder: 4 });

    const result = await taskMutations.duplicate(makeTask());

    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      user_id: "user-1",
      content: "Original",
      recurrence: null,
      recurring_series_id: null,
      day_order: 5,
      is_completed: false,
    });
    expect(result.id).toBe("dup-0");
    expect(result.id).not.toBe("task-1");
  });

  it("falls back to day_order 0 when the user has no existing tasks", async () => {
    const { insertedRows } = makeSupabaseMock({ dayOrder: null });

    await taskMutations.duplicate(makeTask());

    expect(insertedRows[0]).toMatchObject({ day_order: 0 });
  });

  it("recursively persists subtasks against Supabase, relinking each to the new parent id", async () => {
    const { insertedRows, maybeSingle } = makeSupabaseMock({
      dayOrder: -1,
      subtasksByParentId: {
        "task-1": [
          { id: "sub-1", content: "Subtask 1", day_order: 1, priority: 2 },
          { id: "sub-2", content: "Subtask 2", day_order: 2, priority: 3 },
        ],
        "sub-1": [
          {
            id: "sub-1-1",
            content: "Nested Subtask",
            day_order: 0,
            priority: 4,
          },
        ],
      },
    });

    const duplicatedParent = await taskMutations.duplicate(makeTask());

    // Parent's day_order came from the single maybeSingle lookup; subtask
    // inserts reuse each original row's own day_order rather than re-querying.
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(insertedRows).toHaveLength(4);

    const byContent = (content: string) =>
      insertedRows.find((r) => r.content === content);

    const dupSub1 = byContent("Subtask 1");
    const dupSub2 = byContent("Subtask 2");
    const dupNested = byContent("Nested Subtask");

    expect(dupSub1).toMatchObject({
      parent_id: duplicatedParent.id,
      day_order: 1,
    });
    expect(dupSub2).toMatchObject({
      parent_id: duplicatedParent.id,
      day_order: 2,
    });
    expect(dupNested).toMatchObject({ parent_id: dupSub1?.id, day_order: 0 });

    // None of the duplicated rows reuse an original id.
    const originalIds = ["task-1", "sub-1", "sub-2", "sub-1-1"];
    expect(insertedRows.map((r) => r.id)).not.toEqual(
      expect.arrayContaining(originalIds),
    );
  });

  it("throws without querying Supabase when there is no authenticated session", async () => {
    const { from } = makeSupabaseMock({ hasSession: false });

    await expect(taskMutations.duplicate(makeTask())).rejects.toThrow(
      "Not authenticated",
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("throws rather than silently truncating the tree when a subtask fetch fails", async () => {
    makeSupabaseMock({
      dayOrder: -1,
      subtaskFetchErrorForParentId: "task-1",
    });

    await expect(taskMutations.duplicate(makeTask())).rejects.toThrow(
      "fetch failed",
    );
  });

  it("throws rather than silently dropping a subtask when its insert fails", async () => {
    makeSupabaseMock({
      dayOrder: -1,
      subtasksByParentId: {
        "task-1": [
          { id: "sub-1", content: "Subtask 1", day_order: 1, priority: 2 },
        ],
      },
      subtaskInsertErrorForContent: "Subtask 1",
    });

    await expect(taskMutations.duplicate(makeTask())).rejects.toThrow(
      "insert failed",
    );
  });
});
