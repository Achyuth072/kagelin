import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Task } from "@/lib/types/task";
import React from "react";
import {
  useCreateTask,
  useToggleTask,
  useUpdateTask,
  useDeleteTask,
  useDuplicateTask,
} from "@/lib/hooks/useTaskMutations";

// Mock dependencies
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: false, user: { id: "test-user" } })),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/telemetry/client", () => ({
  trackTelemetry: vi.fn(),
}));

vi.mock("@/lib/notify", () => {
  const fn = vi.fn();
  return { notify: Object.assign(fn, { error: vi.fn() }) };
});

vi.mock("@/lib/mutations/task", () => ({
  taskMutations: {
    create: vi.fn(),
    toggle: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
    reorder: vi.fn(),
  },
}));

vi.mock("@/lib/utils/mutation-error", () => ({
  handleMutationError: vi.fn(),
}));

import { taskMutations } from "@/lib/mutations/task";

const makeTask = (id: string, extra: Partial<Task> = {}): Task =>
  ({
    id,
    content: `Task ${id}`,
    description: null,
    user_id: "test-user",
    project_id: null,
    parent_id: null,
    priority: 4,
    due_date: null,
    do_date: null,
    is_evening: false,
    is_completed: false,
    completed_at: null,
    day_order: 0,
    recurrence: null,
    recurring_series_id: null,
    google_event_id: null,
    google_etag: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subtasks: [],
    ...extra,
  }) as Task;

const makeTaskKey = (
  options: {
    projectId?: string | null;
    filter?: string;
    showCompleted?: boolean;
  } = {},
) => [
  "tasks",
  {
    projectId: options.projectId,
    showCompleted: options.showCompleted ?? false,
    filter: options.filter,
    isGuestMode: false,
  },
];

const createWrapper = (queryClient: QueryClient) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe("useTaskMutations - optimistic updates", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  describe("useCreateTask", () => {
    it("TC-OPT-01: optimistically adds task to all matching query slices (project, filter) before mutationFn resolves", async () => {
      let resolveMutation!: (task: Task) => void;
      vi.mocked(taskMutations.create).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveMutation = resolve;
          }),
      );

      const proj1Key = makeTaskKey({ projectId: "proj-1" });
      const proj2Key = makeTaskKey({ projectId: "proj-2" });

      queryClient.setQueryData(proj1Key, [makeTask("t-existing")]);
      queryClient.setQueryData(proj2Key, [makeTask("t-other")]);

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({
          content: "Optimistic Task",
          project_id: "proj-1",
        });
      });

      await waitFor(() => {
        // proj-1 must immediately have the new optimistic task
        const proj1Tasks = queryClient.getQueryData<Task[]>(proj1Key);
        expect(proj1Tasks).toHaveLength(2);
        expect(proj1Tasks![0].content).toBe("Optimistic Task");
        expect(proj1Tasks![0].project_id).toBe("proj-1");

        // proj-2 must remain unchanged
        const proj2Tasks = queryClient.getQueryData<Task[]>(proj2Key);
        expect(proj2Tasks).toHaveLength(1);
        expect(proj2Tasks![0].id).toBe("t-other");
      });

      // Resolve mutation to clean up
      await act(async () => {
        resolveMutation(
          makeTask("server-task-1", {
            content: "Optimistic Task",
            project_id: "proj-1",
          }),
        );
      });
    });

    it("TC-OPT-02: reconciles tempId with server-returned id on success", async () => {
      vi.mocked(taskMutations.create).mockResolvedValueOnce(
        makeTask("server-id-999", {
          content: "Server Confirmed",
          project_id: "proj-1",
        }),
      );

      const proj1Key = makeTaskKey({ projectId: "proj-1" });
      queryClient.setQueryData(proj1Key, []);

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          content: "Server Confirmed",
          project_id: "proj-1",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const tasks = queryClient.getQueryData<Task[]>(proj1Key);
      expect(tasks).toHaveLength(1);
      expect(tasks![0].id).toBe("server-id-999");
    });

    it("TC-OPT-03: rolls back cache across all matching slices when creation fails", async () => {
      vi.mocked(taskMutations.create).mockRejectedValueOnce(
        new Error("Network Error"),
      );

      const projKey = makeTaskKey({ projectId: "proj-1" });
      const initial = [makeTask("initial-1", { project_id: "proj-1" })];
      queryClient.setQueryData(projKey, initial);

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          content: "Will Fail",
          project_id: "proj-1",
        });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const tasks = queryClient.getQueryData<Task[]>(projKey);
      expect(tasks).toEqual(initial);
    });

    it("TC-OPT-04: optimistically adds subtask to parent subtasks summary and ['subtasks'] cache", async () => {
      let resolveMutation!: (task: Task) => void;
      vi.mocked(taskMutations.create).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveMutation = resolve;
          }),
      );

      const tasksKey = makeTaskKey();
      const subtasksKey = ["subtasks", "parent-1", false];

      queryClient.setQueryData(tasksKey, [
        makeTask("parent-1", { subtasks: [] }),
      ]);
      queryClient.setQueryData(subtasksKey, []);

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({
          content: "Subtask Step",
          parent_id: "parent-1",
        });
      });

      await waitFor(() => {
        // Parent task in tasksKey must have subtasks summary updated
        const tasks = queryClient.getQueryData<Task[]>(tasksKey);
        expect(tasks![0].subtasks).toHaveLength(1);
        expect(tasks![0].subtasks![0].is_completed).toBe(false);

        // Subtasks cache must contain the new subtask
        const subtasks = queryClient.getQueryData<Task[]>(subtasksKey);
        expect(subtasks).toHaveLength(1);
        expect(subtasks![0].content).toBe("Subtask Step");
        expect(subtasks![0].parent_id).toBe("parent-1");
      });

      await act(async () => {
        resolveMutation(
          makeTask("subtask-srv-1", {
            content: "Subtask Step",
            parent_id: "parent-1",
          }),
        );
      });
    });
  });

  describe("useToggleTask", () => {
    it("TC-OPT-05: optimistically toggles task completion across custom project and filtered query slices", async () => {
      let resolveMutation!: (value: {
        task: Task;
        newRecurringTask?: Task;
      }) => void;
      vi.mocked(taskMutations.toggle).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveMutation = resolve;
          }),
      );

      const customKey = makeTaskKey({
        projectId: "work-project",
        filter: "today",
      });
      queryClient.setQueryData(customKey, [
        makeTask("t-toggle-1", { is_completed: false }),
      ]);

      const { result } = renderHook(() => useToggleTask(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ id: "t-toggle-1", is_completed: true });
      });

      await waitFor(() => {
        const tasks = queryClient.getQueryData<Task[]>(customKey);
        expect(tasks![0].is_completed).toBe(true);
        expect(tasks![0].completed_at).toBeDefined();
      });

      await act(async () => {
        resolveMutation({
          task: makeTask("t-toggle-1", { is_completed: true }),
        });
      });
    });

    it("TC-OPT-06: rolls back toggle across all slices on error", async () => {
      vi.mocked(taskMutations.toggle).mockRejectedValueOnce(
        new Error("Server error"),
      );

      const customKey = makeTaskKey({
        projectId: "work-project",
        filter: "today",
      });
      const initial = [makeTask("t-toggle-err", { is_completed: false })];
      queryClient.setQueryData(customKey, initial);

      const { result } = renderHook(() => useToggleTask(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ id: "t-toggle-err", is_completed: true });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const tasks = queryClient.getQueryData<Task[]>(customKey);
      expect(tasks![0].is_completed).toBe(false);
    });

    it("TC-OPT-07: toggling a subtask updates parent subtasks summary in ['tasks'] and in ['subtasks']", async () => {
      let resolveMutation!: (value: {
        task: Task;
        newRecurringTask?: Task;
      }) => void;
      vi.mocked(taskMutations.toggle).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveMutation = resolve;
          }),
      );

      const tasksKey = ["tasks", { projectId: "proj-1" }];
      const subtasksKey = ["subtasks", "parent-1", false];

      queryClient.setQueryData(tasksKey, [
        makeTask("parent-1", {
          subtasks: [{ id: "sub-1", is_completed: false }],
        }),
      ]);
      queryClient.setQueryData(subtasksKey, [
        makeTask("sub-1", { parent_id: "parent-1", is_completed: false }),
      ]);

      const { result } = renderHook(() => useToggleTask(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ id: "sub-1", is_completed: true });
      });

      await waitFor(() => {
        const parentTask = queryClient.getQueryData<Task[]>(tasksKey)![0];
        expect(parentTask.subtasks![0].is_completed).toBe(true);

        const subtasks = queryClient.getQueryData<Task[]>(subtasksKey)!;
        expect(subtasks[0].is_completed).toBe(true);
      });

      await act(async () => {
        resolveMutation({
          task: makeTask("sub-1", {
            parent_id: "parent-1",
            is_completed: true,
          }),
        });
      });
    });
  });

  describe("useUpdateTask", () => {
    it("TC-OPT-08: optimistically updates task in ['tasks'], ['subtasks'], and single-task ['task', id] caches", async () => {
      let resolveMutation!: (value: Task) => void;
      vi.mocked(taskMutations.update).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveMutation = resolve;
          }),
      );

      const tasksKey = ["tasks", { projectId: "proj-1" }];
      const singleKey = ["task", "task-upd-1", false];

      queryClient.setQueryData(tasksKey, [
        makeTask("task-upd-1", { content: "Old Content" }),
      ]);
      queryClient.setQueryData(
        singleKey,
        makeTask("task-upd-1", { content: "Old Content" }),
      );

      const { result } = renderHook(() => useUpdateTask(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ id: "task-upd-1", content: "New Content" });
      });

      await waitFor(() => {
        expect(queryClient.getQueryData<Task[]>(tasksKey)![0].content).toBe(
          "New Content",
        );
        expect(queryClient.getQueryData<Task>(singleKey)!.content).toBe(
          "New Content",
        );
      });

      await act(async () => {
        resolveMutation(makeTask("task-upd-1", { content: "New Content" }));
      });
    });

    it("TC-OPT-09: rolls back all caches if update fails", async () => {
      vi.mocked(taskMutations.update).mockRejectedValueOnce(
        new Error("Update failed"),
      );

      const tasksKey = ["tasks", { projectId: "proj-1" }];
      const singleKey = ["task", "task-upd-fail", false];

      queryClient.setQueryData(tasksKey, [
        makeTask("task-upd-fail", { content: "Original" }),
      ]);
      queryClient.setQueryData(
        singleKey,
        makeTask("task-upd-fail", { content: "Original" }),
      );

      const { result } = renderHook(() => useUpdateTask(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ id: "task-upd-fail", content: "Modified" });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(queryClient.getQueryData<Task[]>(tasksKey)![0].content).toBe(
        "Original",
      );
      expect(queryClient.getQueryData<Task>(singleKey)!.content).toBe(
        "Original",
      );
    });

    it("TC-OPT-13: a saved field leaves the unreadable marker in the cached row", async () => {
      let resolveMutation!: (value: Task) => void;
      vi.mocked(taskMutations.update).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveMutation = resolve;
          }),
      );

      const tasksKey = ["tasks", { projectId: "proj-1" }];
      const singleKey = ["task", "task-unread-1", false];
      const unreadable = makeTask("task-unread-1", {
        content: null,
        unreadable: ["content"],
      });

      queryClient.setQueryData(tasksKey, [unreadable]);
      queryClient.setQueryData(singleKey, unreadable);

      const { result } = renderHook(() => useUpdateTask(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ id: "task-unread-1", content: "Retyped" });
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData<Task>(singleKey)!;
        expect(cached.content).toBe("Retyped");
        expect(cached).not.toHaveProperty("unreadable");
      });
      expect(queryClient.getQueryData<Task[]>(tasksKey)![0]).not.toHaveProperty(
        "unreadable",
      );

      await act(async () => {
        resolveMutation(makeTask("task-unread-1", { content: "Retyped" }));
      });
    });
  });

  describe("useDeleteTask", () => {
    it("TC-OPT-10: optimistically removes task and rolls back cache when deletion fails", async () => {
      vi.mocked(taskMutations.delete).mockRejectedValueOnce(
        new Error("Delete failed"),
      );

      const tasksKey = ["tasks", { projectId: "proj-1" }];
      const initial = [makeTask("task-del-1")];
      queryClient.setQueryData(tasksKey, initial);

      const { result } = renderHook(() => useDeleteTask(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate("task-del-1");
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Must be restored on rollback
      const tasks = queryClient.getQueryData<Task[]>(tasksKey);
      expect(tasks).toEqual(initial);
    });
  });

  describe("useDuplicateTask", () => {
    it("TC-OPT-11: optimistically adds duplicated task to cache and replaces tempId on success", async () => {
      vi.mocked(taskMutations.duplicate).mockResolvedValueOnce(
        makeTask("dup-server-id", { content: "Task Copy" }),
      );

      const tasksKey = makeTaskKey();
      const source = makeTask("source-1", { content: "Task Copy" });
      queryClient.setQueryData(tasksKey, [source]);

      const { result } = renderHook(() => useDuplicateTask(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ sourceTask: source });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const tasks = queryClient.getQueryData<Task[]>(tasksKey);
      expect(tasks).toHaveLength(2);
      expect(tasks?.some((t) => t.id === "dup-server-id")).toBe(true);
    });

    it("TC-OPT-12: rolls back cache if duplicate fails", async () => {
      vi.mocked(taskMutations.duplicate).mockRejectedValueOnce(
        new Error("Dup failed"),
      );

      const tasksKey = makeTaskKey();
      const source = makeTask("source-fail", { content: "Original" });
      queryClient.setQueryData(tasksKey, [source]);

      const { result } = renderHook(() => useDuplicateTask(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ sourceTask: source });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const tasks = queryClient.getQueryData<Task[]>(tasksKey);
      expect(tasks).toEqual([source]);
    });
  });
});
