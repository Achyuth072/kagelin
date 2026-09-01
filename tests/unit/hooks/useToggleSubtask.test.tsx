import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Task } from "@/lib/types/task";
import React from "react";

const subtasksInDb: Task[] = [];

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { user: { id: "test-user" } } },
        }),
    },
    from: (_table: string) => ({
      select: (_cols?: string) => ({
        eq: (field: string, val: string) => {
          if (field === "parent_id") {
            const list = subtasksInDb
              .filter((t) => t.parent_id === val)
              .map((t) => ({ ...t }))
              .sort(
                (a, b) =>
                  (a.day_order ?? 0) - (b.day_order ?? 0) ||
                  a.created_at.localeCompare(b.created_at),
              );
            const queryObj = {
              order: () => queryObj,
              then: (resolve: (arg: { data: Task[]; error: null }) => void) =>
                resolve({ data: list, error: null }),
            };
            return queryObj;
          }
          if (field === "id") {
            const task = subtasksInDb.find((t) => t.id === val);
            return {
              single: () =>
                Promise.resolve({
                  data: task ? { ...task } : null,
                  error: task ? null : { message: "Not found" },
                }),
            };
          }
          return {
            single: () => Promise.resolve({ data: null, error: null }),
          };
        },
      }),
      delete: () => ({
        eq: (_field: string, id: string) => {
          const index = subtasksInDb.findIndex((t) => t.id === id);
          if (index !== -1) {
            subtasksInDb.splice(index, 1);
          }
          return Promise.resolve({ error: null });
        },
      }),
      update: (updates: Partial<Task>) => ({
        eq: (_field: string, id: string) => {
          const task = subtasksInDb.find((t) => t.id === id);
          if (task) {
            Object.assign(task, updates);
          }
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: task ? { ...task, ...updates } : null,
                  error: null,
                }),
            }),
          };
        },
      }),
    }),
  }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false, user: { id: "test-user" } }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/utils/mutation-error", () => ({
  handleMutationError: vi.fn(),
}));

vi.mock("@/lib/telemetry/client", () => ({
  trackTelemetry: vi.fn(),
}));

import { useSubtasks } from "@/lib/hooks/useSubtasks";
import {
  useToggleTask,
  useUpdateTask,
  useDeleteTask,
  useReorderTasks,
} from "@/lib/hooks/useTaskMutations";

const createWrapper = (queryClient: QueryClient) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

const makeTask = (id: string, extra: Partial<Task> = {}): Task =>
  ({
    id,
    content: `Task ${id}`,
    user_id: "test-user",
    project_id: null,
    parent_id: null,
    is_completed: false,
    completed_at: null,
    priority: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...extra,
  }) as Task;

describe("Subtask mutations", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 60000 },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    subtasksInDb.length = 0;
  });

  it("optimistically updates subtask completion in subtasks query cache and invalidates on settle", async () => {
    const parentId = "parent-task-1";
    const subtask = makeTask("subtask-1", {
      parent_id: parentId,
      is_completed: false,
    });
    subtasksInDb.push(subtask);

    const wrapper = createWrapper(queryClient);

    // Fetch subtasks for the parent task
    const { result: subtasksResult } = renderHook(() => useSubtasks(parentId), {
      wrapper,
    });

    await waitFor(() => {
      expect(subtasksResult.current.isSuccess).toBe(true);
      expect(subtasksResult.current.data).toHaveLength(1);
    });

    expect(subtasksResult.current.data?.[0].is_completed).toBe(false);

    // Toggle the subtask
    const { result: toggleResult } = renderHook(() => useToggleTask(), {
      wrapper,
    });

    act(() => {
      toggleResult.current.mutate({
        id: "subtask-1",
        is_completed: true,
      });
    });

    // 1. Optimistic update check: UI cache must show completed=true
    await waitFor(() => {
      expect(subtasksResult.current.data?.[0].is_completed).toBe(true);
    });

    // 2. Wait for mutation to settle
    await waitFor(() => {
      expect(toggleResult.current.isSuccess).toBe(true);
    });

    // 3. Check invalidation of subtasks queries occurred
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    act(() => {
      toggleResult.current.mutate({
        id: "subtask-1",
        is_completed: false,
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["subtasks"] }),
      );
    });

    await waitFor(() => {
      expect(subtasksResult.current.data?.[0].is_completed).toBe(false);
    });
  });

  it("optimistically updates subtask content via useUpdateTask", async () => {
    const parentId = "parent-task-2";
    const subtask = makeTask("subtask-2", {
      parent_id: parentId,
      content: "Original Step",
    });
    subtasksInDb.push(subtask);

    const wrapper = createWrapper(queryClient);

    const { result: subtasksResult } = renderHook(() => useSubtasks(parentId), {
      wrapper,
    });

    await waitFor(() => {
      expect(subtasksResult.current.isSuccess).toBe(true);
      expect(subtasksResult.current.data?.[0].content).toBe("Original Step");
    });

    const { result: updateResult } = renderHook(() => useUpdateTask(), {
      wrapper,
    });

    act(() => {
      updateResult.current.mutate({
        id: "subtask-2",
        content: "Updated Step",
      });
    });

    await waitFor(() => {
      expect(subtasksResult.current.data?.[0].content).toBe("Updated Step");
    });

    await waitFor(() => {
      expect(updateResult.current.isSuccess).toBe(true);
    });
  });

  it("optimistically removes deleted subtask via useDeleteTask", async () => {
    const parentId = "parent-task-3";
    const subtask = makeTask("subtask-3", {
      parent_id: parentId,
      content: "Step to delete",
    });
    subtasksInDb.push(subtask);

    const wrapper = createWrapper(queryClient);

    const { result: subtasksResult } = renderHook(() => useSubtasks(parentId), {
      wrapper,
    });

    await waitFor(() => {
      expect(subtasksResult.current.isSuccess).toBe(true);
      expect(subtasksResult.current.data).toHaveLength(1);
    });

    const { result: deleteResult } = renderHook(() => useDeleteTask(), {
      wrapper,
    });

    act(() => {
      deleteResult.current.mutate("subtask-3");
    });

    await waitFor(() => {
      expect(subtasksResult.current.data).toHaveLength(0);
    });

    await waitFor(() => {
      expect(deleteResult.current.isSuccess).toBe(true);
    });
  });

  it("orders subtasks by day_order ASC, created_at ASC", async () => {
    const parentId = "parent-task-order";
    const subtaskA = makeTask("subtask-a", {
      parent_id: parentId,
      content: "Step A",
      day_order: 2,
      created_at: "2026-08-31T10:00:00.000Z",
    });
    const subtaskB = makeTask("subtask-b", {
      parent_id: parentId,
      content: "Step B",
      day_order: 1,
      created_at: "2026-08-31T11:00:00.000Z",
    });
    const subtaskC = makeTask("subtask-c", {
      parent_id: parentId,
      content: "Step C",
      day_order: 1,
      created_at: "2026-08-31T09:00:00.000Z",
    });
    subtasksInDb.push(subtaskA, subtaskB, subtaskC);

    const wrapper = createWrapper(queryClient);

    const { result: subtasksResult } = renderHook(() => useSubtasks(parentId), {
      wrapper,
    });

    await waitFor(() => {
      expect(subtasksResult.current.isSuccess).toBe(true);
      expect(subtasksResult.current.data).toHaveLength(3);
    });

    // subtaskC (day_order 1, 09:00), subtaskB (day_order 1, 11:00), subtaskA (day_order 2)
    expect(subtasksResult.current.data?.map((s) => s.id)).toEqual([
      "subtask-c",
      "subtask-b",
      "subtask-a",
    ]);
  });

  it("optimistically updates subtask order via useReorderTasks", async () => {
    const parentId = "parent-task-reorder";
    const subtask1 = makeTask("subtask-1", {
      parent_id: parentId,
      content: "Step 1",
      day_order: 0,
      created_at: "2026-08-31T10:00:00.000Z",
    });
    const subtask2 = makeTask("subtask-2", {
      parent_id: parentId,
      content: "Step 2",
      day_order: 1,
      created_at: "2026-08-31T10:01:00.000Z",
    });
    subtasksInDb.push(subtask1, subtask2);

    const wrapper = createWrapper(queryClient);

    const { result: subtasksResult } = renderHook(() => useSubtasks(parentId), {
      wrapper,
    });

    await waitFor(() => {
      expect(subtasksResult.current.isSuccess).toBe(true);
      expect(subtasksResult.current.data).toHaveLength(2);
    });

    expect(subtasksResult.current.data?.map((s) => s.id)).toEqual([
      "subtask-1",
      "subtask-2",
    ]);

    const { result: reorderResult } = renderHook(() => useReorderTasks(), {
      wrapper,
    });

    act(() => {
      reorderResult.current.mutate([
        { id: "subtask-1", day_order: 1 },
        { id: "subtask-2", day_order: 0 },
      ]);
    });

    await waitFor(() => {
      expect(subtasksResult.current.data?.map((s) => s.id)).toEqual([
        "subtask-2",
        "subtask-1",
      ]);
    });
  });
});
