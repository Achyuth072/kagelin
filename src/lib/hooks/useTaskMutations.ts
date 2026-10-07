"use client";

import type { TaskPlacement } from "@/lib/utils/task-dnd";
import {
  useMutation,
  useQueryClient,
  QueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import type { Task, CreateTaskInput } from "@/lib/types/task";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { handleMutationError } from "@/lib/utils/mutation-error";
import { notify } from "@/lib/notify";

import { taskMutations } from "@/lib/mutations/task";
import { mockStore } from "@/lib/mock/mock-store";
import { useUiStore } from "@/lib/store/uiStore";
import { trackTelemetry } from "@/lib/telemetry/client";
import { requireReadable } from "@/lib/crypto/unreadable";

// Matches the Undo toast duration — keyboard undo shouldn't outlive it.
const UNDO_TOAST_DURATION_MS = 5000;

function invalidateTaskCaches(queryClient: QueryClient): void {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    // useTask / useActiveTask copies; ["tasks"] does not prefix-match "task".
    queryClient.invalidateQueries({ queryKey: ["task"] }),
    queryClient.invalidateQueries({ queryKey: ["subtasks"] }),
    queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["stats-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["focus-tasks"] }),
    // Task Insights panel reads occurrences via ["task-series", …].
    queryClient.invalidateQueries({ queryKey: ["task-series"] }),
  ]);
}

type TasksSnapshot = {
  tasks: [readonly unknown[], Task[] | undefined][];
  subtasks: [readonly unknown[], Task[] | undefined][];
  singleTasks: [readonly unknown[], Task | null | undefined][];
};

async function prepareTasksSnapshot(
  queryClient: QueryClient,
): Promise<TasksSnapshot> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: ["tasks"] }),
    queryClient.cancelQueries({ queryKey: ["subtasks"] }),
    queryClient.cancelQueries({ queryKey: ["task"] }),
  ]);

  return {
    tasks: queryClient.getQueriesData<Task[]>({ queryKey: ["tasks"] }),
    subtasks: queryClient.getQueriesData<Task[]>({ queryKey: ["subtasks"] }),
    singleTasks: queryClient.getQueriesData<Task | null>({
      queryKey: ["task"],
    }),
  };
}

function rollbackTasksSnapshot(
  queryClient: QueryClient,
  snapshot?: TasksSnapshot,
  err?: unknown,
) {
  if (snapshot) {
    snapshot.tasks.forEach(([key, data]) =>
      queryClient.setQueryData(key, data),
    );
    snapshot.subtasks.forEach(([key, data]) =>
      queryClient.setQueryData(key, data),
    );
    snapshot.singleTasks.forEach(([key, data]) =>
      queryClient.setQueryData(key, data),
    );
  }
  if (err) handleMutationError(err);
}

interface TaskSliceParams {
  projectId?: string | null;
  showCompleted?: boolean;
  filter?: string;
  isGuestMode?: boolean;
}

function taskMatchesSlice(task: Task, params?: TaskSliceParams): boolean {
  if (!params) return true;

  if (params.showCompleted === false && task.is_completed) {
    if (!task.completed_at) return false;
    const completedDate = new Date(task.completed_at);
    const today = new Date();
    const isToday =
      completedDate.getDate() === today.getDate() &&
      completedDate.getMonth() === today.getMonth() &&
      completedDate.getFullYear() === today.getFullYear();
    if (!isToday) return false;
  }

  if (params.projectId === "inbox") {
    if (task.project_id) return false;
  } else if (params.projectId && params.projectId !== "all") {
    if (task.project_id !== params.projectId) return false;
  }

  if (params.filter === "p1") {
    if (task.priority !== 1) return false;
  } else if (params.filter === "today") {
    if (!task.due_date) return false;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (new Date(task.due_date) > todayEnd) return false;
  }

  return true;
}

function applyOptimisticTaskInsert(
  queryClient: QueryClient,
  snapshot: TasksSnapshot,
  task: Task,
): void {
  if (task.parent_id) {
    snapshot.tasks.forEach(([key]) => {
      queryClient.setQueryData<Task[]>(key, (old) =>
        old?.map((parent) =>
          parent.id === task.parent_id
            ? {
                ...parent,
                subtasks: [
                  ...(parent.subtasks || []),
                  { id: task.id, is_completed: task.is_completed },
                ],
              }
            : parent,
        ),
      );
    });

    snapshot.subtasks.forEach(([key, data]) => {
      if (key[1] === task.parent_id) {
        queryClient.setQueryData<Task[]>(key, [...(data ?? []), task]);
      }
    });
  } else {
    snapshot.tasks.forEach(([key, data]) => {
      const params = key[1] as TaskSliceParams | undefined;
      if (taskMatchesSlice(task, params)) {
        queryClient.setQueryData<Task[]>(key, [task, ...(data ?? [])]);
      }
    });
  }
}

function reconcileTempTaskId(
  queryClient: QueryClient,
  snapshot: TasksSnapshot | undefined,
  tempId: string | undefined,
  serverTask: Task | null | undefined,
): void {
  if (!snapshot || !tempId || !serverTask?.id || serverTask.id === tempId) {
    return;
  }

  snapshot.tasks.forEach(([key]) => {
    queryClient.setQueryData<Task[]>(key, (old) =>
      old?.map((task) => {
        if (task.id === tempId) {
          return { ...serverTask, subtasks: task.subtasks || [] };
        }
        if (task.subtasks?.some((st) => st.id === tempId)) {
          return {
            ...task,
            subtasks: task.subtasks.map((st) =>
              st.id === tempId
                ? { id: serverTask.id, is_completed: st.is_completed }
                : st,
            ),
          };
        }
        return task;
      }),
    );
  });

  snapshot.subtasks.forEach(([key]) => {
    queryClient.setQueryData<Task[]>(key, (old) =>
      old?.map((task) => (task.id === tempId ? serverTask : task)),
    );
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { isGuestMode } = useAuth();

  return useMutation({
    mutationKey: ["createTask"],
    mutationFn: taskMutations.create,
    onMutate: async (newTask) => {
      const snapshot = await prepareTasksSnapshot(queryClient);

      const clientId =
        (newTask as CreateTaskInput & { _clientId?: string })._clientId ||
        crypto.randomUUID();
      (newTask as CreateTaskInput & { _clientId?: string })._clientId =
        clientId;

      const now = new Date().toISOString();
      const optimisticTask: Task = {
        id: clientId,
        user_id: isGuestMode ? "guest" : "",
        project_id: newTask.project_id || null,
        parent_id: newTask.parent_id || null,
        content: newTask.content,
        description: newTask.description || null,
        priority: newTask.priority || 4,
        due_date: newTask.due_date || null,
        do_date: newTask.do_date || null,
        is_evening: newTask.is_evening || false,
        is_completed: false,
        completed_at: null,
        day_order: 0,
        recurrence: null,
        recurring_series_id: null,
        google_event_id: null,
        google_etag: null,
        created_at: now,
        updated_at: now,
        subtasks: [],
      };

      applyOptimisticTaskInsert(queryClient, snapshot, optimisticTask);

      return { snapshot, clientId, tempId: clientId };
    },
    onSuccess: (createdTask, _variables, context) => {
      trackTelemetry("task_action", { action: "created" });

      reconcileTempTaskId(
        queryClient,
        context?.snapshot,
        context?.clientId,
        createdTask,
      );
    },
    onError: (err, _newTask, context) => {
      rollbackTasksSnapshot(queryClient, context?.snapshot, err);
    },
    onSettled: (_data, _error, variables) => {
      invalidateTaskCaches(queryClient);
      if (variables.parent_id) {
        queryClient.invalidateQueries({
          queryKey: ["subtasks", variables.parent_id],
        });
      }
    },
  });
}

export function useToggleTask() {
  const queryClient = useQueryClient();
  const { isGuestMode } = useAuth();

  return useMutation({
    mutationKey: ["toggleTask"],
    mutationFn: taskMutations.toggle,
    onMutate: async ({ id, is_completed }) => {
      const snapshot = await prepareTasksSnapshot(queryClient);
      const completed_at = is_completed ? new Date().toISOString() : null;

      const patch = (old: Task[] | undefined) =>
        old?.map((task) => {
          if (task.id === id) {
            return {
              ...task,
              is_completed,
              completed_at,
            };
          }
          if (task.subtasks?.some((st) => st.id === id)) {
            return {
              ...task,
              subtasks: task.subtasks.map((st) =>
                st.id === id ? { ...st, is_completed } : st,
              ),
            };
          }
          return task;
        });

      for (const [key] of [...snapshot.tasks, ...snapshot.subtasks]) {
        queryClient.setQueryData<Task[]>(key, patch);
      }

      for (const [key] of snapshot.singleTasks) {
        queryClient.setQueryData<Task | null>(key, (old) =>
          old && old.id === id
            ? {
                ...old,
                is_completed,
                completed_at,
              }
            : old,
        );
      }

      return { snapshot };
    },
    onSuccess: (_data, variables) => {
      // Guests get a year of pre-seeded demo tasks; interacting with them
      // shouldn't inflate the "Engagement & Throughput" telemetry KPI.
      if (isGuestMode && mockStore.isSeedId(variables.id)) return;

      if (variables.is_completed) {
        trackTelemetry("task_action", { action: "completed" });
      }
    },
    onError: (err, _vars, context) => {
      rollbackTasksSnapshot(queryClient, context?.snapshot, err);
    },
    onSettled: () => {
      invalidateTaskCaches(queryClient);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["updateTask"],
    mutationFn: taskMutations.update,
    onMutate: async (updates) => {
      const snapshot = await prepareTasksSnapshot(queryClient);
      const { id, ...rest } = updates;

      snapshot.tasks.forEach(([key]) => {
        queryClient.setQueryData<Task[]>(key, (old) =>
          old?.map((task) => {
            if (task.id === id) return { ...task, ...rest };
            if (task.subtasks?.some((st) => st.id === id)) {
              return {
                ...task,
                subtasks: task.subtasks.map((st) =>
                  st.id === id
                    ? {
                        ...st,
                        ...(rest.is_completed !== undefined
                          ? { is_completed: rest.is_completed }
                          : {}),
                      }
                    : st,
                ),
              };
            }
            return task;
          }),
        );
      });

      snapshot.subtasks.forEach(([key]) => {
        queryClient.setQueryData<Task[]>(key, (old) =>
          old?.map((task) => (task.id === id ? { ...task, ...rest } : task)),
        );
      });

      snapshot.singleTasks.forEach(([key]) => {
        queryClient.setQueryData<Task | null>(key, (old) =>
          old && old.id === id ? { ...old, ...rest } : old,
        );
      });

      return { snapshot };
    },
    onError: (err, _vars, context) => {
      rollbackTasksSnapshot(queryClient, context?.snapshot, err);
    },
    onSettled: () => {
      invalidateTaskCaches(queryClient);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { trigger } = useHaptic();
  const { isGuestMode } = useAuth();

  return useMutation({
    mutationKey: ["deleteTask"],
    mutationFn: taskMutations.delete,
    onMutate: async (id) => {
      const snapshot = await prepareTasksSnapshot(queryClient);
      let deletedTask: Task | undefined;

      for (const [, data] of [...snapshot.tasks, ...snapshot.subtasks]) {
        const found = data?.find((task) => task.id === id);
        if (found) {
          deletedTask = found;
          break;
        }
      }
      if (!deletedTask) {
        deletedTask =
          snapshot.singleTasks.find(([, task]) => task?.id === id)?.[1] ??
          undefined;
      }

      snapshot.tasks.forEach(([key]) => {
        queryClient.setQueryData<Task[]>(key, (old) =>
          old
            ?.filter((task) => task.id !== id)
            .map((task) =>
              task.subtasks?.some((st) => st.id === id)
                ? {
                    ...task,
                    subtasks: task.subtasks.filter((st) => st.id !== id),
                  }
                : task,
            ),
        );
      });

      snapshot.subtasks.forEach(([key]) => {
        queryClient.setQueryData<Task[]>(key, (old) =>
          old?.filter((task) => task.id !== id),
        );
      });

      snapshot.singleTasks.forEach(([key]) => {
        queryClient.setQueryData<Task | null>(key, (old) =>
          old && old.id === id ? null : old,
        );
      });

      // Cascades at the DB level — clear cached subtasks now, not orphaned later.
      for (const [queryKey] of queryClient.getQueriesData<Task[]>({
        queryKey: ["subtasks", id],
      })) {
        queryClient.setQueryData<Task[]>(queryKey, []);
      }

      return { snapshot, deletedTask };
    },
    // Uses the delete's cascaded subtasks, not onMutate's cache (may be
    // empty); confirmed first so Undo isn't offered for a delete that never landed.
    onSuccess: (deletedSubtasks, _id, context) => {
      const deletedTask = context?.deletedTask;
      if (!deletedTask) return;

      const taskToRestore = { ...deletedTask };
      const subtasksToRestore = deletedSubtasks;

      trigger("success");

      const undoAction = async () => {
        useUiStore.getState().setLastUndoAction(null);
        if (isGuestMode) {
          mockStore.addTask({
            ...taskToRestore,
            content: requireReadable(taskToRestore.content),
          });
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          trigger("success");
          notify("Task restored");
          return;
        }

        // Hard delete, so undo re-inserts rather than updates.
        try {
          await taskMutations.restore(taskToRestore, subtasksToRestore);
          trigger("success");
          notify("Task restored");
        } catch (err) {
          console.error("Failed to restore task:", err);
          trigger("thud");
          notify.error("Failed to restore task");
        }
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({
          queryKey: ["subtasks", taskToRestore.id],
        });
      };

      useUiStore.getState().setLastUndoAction(undoAction);
      // Reference-equality guard: no-op if already run or replaced by a later delete.
      setTimeout(() => {
        if (useUiStore.getState().lastUndoAction === undoAction) {
          useUiStore.getState().setLastUndoAction(null);
        }
      }, UNDO_TOAST_DURATION_MS);

      // Dropped, not folded into the title — task content is unbounded user text (ADR 0008).
      notify("Task deleted", {
        duration: UNDO_TOAST_DURATION_MS,
        action: {
          label: "Undo",
          onClick: undoAction,
        },
      });
    },
    onError: (err, _id, context) => {
      rollbackTasksSnapshot(queryClient, context?.snapshot, err);
    },
    onSettled: () => {
      invalidateTaskCaches(queryClient);
    },
  });
}

export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["reorderTasks"],
    mutationFn: taskMutations.reorder,
    onMutate: async (pairs: { id: string; day_order: number }[]) => {
      const snapshot = await prepareTasksSnapshot(queryClient);

      const pairById = new Map(pairs.map((p) => [p.id, p.day_order]));
      const applyDayOrders = (tasks: Task[] | undefined) =>
        tasks?.map((task) => {
          const newOrder = pairById.get(task.id);
          return newOrder === undefined || task.day_order === newOrder
            ? task
            : { ...task, day_order: newOrder };
        });

      for (const [queryKey] of snapshot.tasks) {
        queryClient.setQueryData<Task[]>(queryKey, (old) =>
          applyDayOrders(old),
        );
      }

      for (const [queryKey] of snapshot.subtasks) {
        queryClient.setQueryData<Task[]>(queryKey, (old) =>
          applyDayOrders(old)?.sort(
            (a, b) =>
              (a.day_order ?? 0) - (b.day_order ?? 0) ||
              a.created_at.localeCompare(b.created_at),
          ),
        );
      }

      return { snapshot };
    },
    onError: (err, _vars, context) => {
      rollbackTasksSnapshot(queryClient, context?.snapshot, err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats-dashboard"] });
    },
  });
}

export function useClearCompletedTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["clearCompletedTasks"],
    mutationFn: taskMutations.clearCompleted,
    onMutate: async () => {
      const snapshot = await prepareTasksSnapshot(queryClient);

      snapshot.tasks.forEach(([key]) => {
        queryClient.setQueryData<Task[]>(key, (oldData) =>
          oldData?.filter((task) => !task.is_completed),
        );
      });

      return { snapshot };
    },
    onError: (err, _vars, context) => {
      rollbackTasksSnapshot(queryClient, context?.snapshot, err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats-dashboard"] });
    },
  });
}

export function useDuplicateTask() {
  const queryClient = useQueryClient();
  const { trigger } = useHaptic();
  const { isGuestMode } = useAuth();

  return useMutation({
    mutationKey: ["duplicateTask"],
    mutationFn: ({
      sourceTask,
      overrides,
    }: {
      sourceTask: Task;
      overrides?: TaskPlacement;
    }) => taskMutations.duplicate(sourceTask, overrides),
    onMutate: async ({ sourceTask, overrides }) => {
      const snapshot = await prepareTasksSnapshot(queryClient);
      const tempId = crypto.randomUUID();
      const now = new Date().toISOString();

      const optimisticDuplicate: Task = {
        ...sourceTask,
        id: tempId,
        user_id: isGuestMode ? "guest" : sourceTask.user_id,
        created_at: now,
        updated_at: now,
        ...overrides,
        subtasks: (sourceTask.subtasks || []).map((st) => ({
          ...st,
          id: crypto.randomUUID(),
        })),
      };

      applyOptimisticTaskInsert(queryClient, snapshot, optimisticDuplicate);

      return { snapshot, tempId };
    },
    onSuccess: (newTask, variables, context) => {
      // Guests get a year of pre-seeded demo tasks; interacting with them
      // shouldn't inflate the "Engagement & Throughput" telemetry KPI.
      if (!(isGuestMode && mockStore.isSeedId(variables.sourceTask.id))) {
        trackTelemetry("task_action", { action: "created" });
      }
      trigger("success");
      notify("Task duplicated");

      reconcileTempTaskId(
        queryClient,
        context?.snapshot,
        context?.tempId,
        newTask,
      );

      if (newTask.parent_id) {
        queryClient.invalidateQueries({
          queryKey: ["subtasks", newTask.parent_id],
        });
      }
    },
    onError: (err, _vars, context) => {
      rollbackTasksSnapshot(queryClient, context?.snapshot, err);
    },
    onSettled: () => {
      invalidateTaskCaches(queryClient);
    },
  });
}
