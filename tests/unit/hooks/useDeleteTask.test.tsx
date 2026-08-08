import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Task } from "@/lib/types/task";
import React from "react";

// Mutable state the supabase mock reads/writes, reset per test.
const supabaseState = vi.hoisted(() => ({
  subtasksInDb: [] as Partial<Task>[],
  deleteError: null as { message: string } | null,
  parentInsertError: null as { message: string } | null,
  subtaskInsertError: null as { message: string } | null,
  insertedPayloads: [] as unknown[],
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: supabaseState.subtasksInDb,
            error: null,
          }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: supabaseState.deleteError }),
      }),
      insert: (payload: unknown) => {
        supabaseState.insertedPayloads.push(payload);
        const error = Array.isArray(payload)
          ? supabaseState.subtaskInsertError
          : supabaseState.parentInsertError;
        return Promise.resolve({ error });
      },
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

const notifyFn = vi.hoisted(() => {
  const fn = vi.fn();
  return Object.assign(fn, { error: vi.fn() });
});
vi.mock("@/lib/notify", () => ({ notify: notifyFn }));

import { useDeleteTask } from "@/lib/hooks/useTaskMutations";
import { notify } from "@/lib/notify";

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
    ...extra,
  }) as Task;

// Reads the onClick handler off the "Undo" action of the most recent
// "Task deleted" toast, so tests can simulate the user clicking Undo.
function getUndoHandler() {
  const call = vi
    .mocked(notify)
    .mock.calls.find(([message]) => message === "Task deleted");
  if (!call) throw new Error("Expected a 'Task deleted' toast to be fired");
  const options = call[1] as {
    action?: { onClick: () => void | Promise<void> };
  };
  if (!options.action) throw new Error("Expected toast to have an action");
  return options.action.onClick;
}

describe("useDeleteTask", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    supabaseState.subtasksInDb = [];
    supabaseState.deleteError = null;
    supabaseState.parentInsertError = null;
    supabaseState.subtaskInsertError = null;
    supabaseState.insertedPayloads = [];
  });

  it("restores subtasks (not just the parent) when Undo is clicked", async () => {
    const parent = makeTask("parent-1");
    const subtaskA = makeTask("sub-a", { parent_id: "parent-1" });
    const subtaskB = makeTask("sub-b", { parent_id: "parent-1" });
    supabaseState.subtasksInDb = [subtaskA, subtaskB];

    queryClient.setQueryData(["tasks"], [parent]);

    const { result } = renderHook(() => useDeleteTask(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate("parent-1");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // The toast only fires once the delete (and cascade) is confirmed.
    expect(notify).toHaveBeenCalledWith(
      "Task deleted",
      expect.objectContaining({ action: expect.any(Object) }),
    );

    await getUndoHandler()();

    // Parent re-inserted as a single object; subtasks re-inserted as a batch.
    const parentInsert = supabaseState.insertedPayloads.find(
      (p) => !Array.isArray(p),
    ) as { id: string } | undefined;
    const subtaskInsert = supabaseState.insertedPayloads.find((p) =>
      Array.isArray(p),
    ) as { id: string }[] | undefined;

    expect(parentInsert?.id).toBe("parent-1");
    expect(subtaskInsert?.map((s) => s.id).sort()).toEqual(["sub-a", "sub-b"]);
    expect(notify).toHaveBeenCalledWith("Task restored");
  });

  it("does not attempt a subtask insert when the task had no subtasks", async () => {
    supabaseState.subtasksInDb = [];
    queryClient.setQueryData(["tasks"], [makeTask("solo-1")]);

    const { result } = renderHook(() => useDeleteTask(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate("solo-1");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await getUndoHandler()();

    expect(
      supabaseState.insertedPayloads.filter((p) => Array.isArray(p)),
    ).toHaveLength(0);
    expect(notify).toHaveBeenCalledWith("Task restored");
  });

  it("does not show an Undo toast when the delete itself fails", async () => {
    supabaseState.deleteError = { message: "network error" };
    queryClient.setQueryData(["tasks"], [makeTask("fails-1")]);

    const { result } = renderHook(() => useDeleteTask(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate("fails-1");

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(notify).not.toHaveBeenCalledWith("Task deleted", expect.anything());
  });

  it("surfaces a failure notice if restoring the subtasks fails", async () => {
    supabaseState.subtasksInDb = [makeTask("sub-c", { parent_id: "parent-2" })];
    supabaseState.subtaskInsertError = { message: "insert failed" };
    queryClient.setQueryData(["tasks"], [makeTask("parent-2")]);

    const { result } = renderHook(() => useDeleteTask(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate("parent-2");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await getUndoHandler()();

    expect(notify.error).toHaveBeenCalledWith("Failed to restore task");
    expect(notify).not.toHaveBeenCalledWith("Task restored");
  });
});
