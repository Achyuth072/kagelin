"use client";

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

// Matches the Undo toast duration — keyboard undo shouldn't outlive it.
const UNDO_TOAST_DURATION_MS = 5000;

function invalidateTaskCaches(queryClient: QueryClient): void {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["subtasks"] }),
    queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["stats-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["focus-tasks"] }),
    // Task Insights panel reads occurrences via ["task-series", …].
    queryClient.invalidateQueries({ queryKey: ["task-series"] }),
  ]);
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { isGuestMode } = useAuth();

  return useMutation({
    mutationKey: ["createTask"],
    mutationFn: taskMutations.create,
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      const previousTasks = queryClient.getQueryData<Task[]>([
        "tasks",
        { projectId: undefined, showCompleted: false, isGuestMode },
      ]);

      const clientId =
        (newTask as CreateTaskInput & { _clientId?: string })._clientId ||
        crypto.randomUUID();
      (newTask as CreateTaskInput & { _clientId?: string })._clientId =
        clientId;

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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Task[]>(
        ["tasks", { projectId: undefined, showCompleted: false, isGuestMode }],
        (old) => [optimisticTask, ...(old || [])],
      );

      return { previousTasks };
    },
    onSuccess: () => {
      trackTelemetry("task_action", { action: "created" });
    },
    onError: (err, _newTask, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(
          [
            "tasks",
            { projectId: undefined, showCompleted: false, isGuestMode },
          ],
          context.previousTasks,
        );
      }
      handleMutationError(err);
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
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["subtasks"] });

      const queryKey = [
        "tasks",
        { projectId: undefined, showCompleted: false, isGuestMode },
      ];
      const previousTasks = queryClient.getQueryData<Task[]>(queryKey);

      const patch = (old: Task[] | undefined) =>
        old?.map((task) =>
          task.id === id
            ? {
                ...task,
                is_completed,
                completed_at: is_completed ? new Date().toISOString() : null,
              }
            : task,
        );

      queryClient.setQueryData<Task[]>(queryKey, patch);

      // SubtaskList reads from the ["subtasks", parentId] cache, not ["tasks"] —
      // patch it too so a subtask checkbox reflects immediately.
      const previousSubtaskQueries = queryClient.getQueriesData<Task[]>({
        queryKey: ["subtasks"],
      });
      queryClient.setQueriesData<Task[]>({ queryKey: ["subtasks"] }, patch);

      return { previousTasks, previousSubtaskQueries };
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
      if (context?.previousTasks) {
        queryClient.setQueryData(
          [
            "tasks",
            { projectId: undefined, showCompleted: false, isGuestMode },
          ],
          context.previousTasks,
        );
      }
      context?.previousSubtaskQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      handleMutationError(err);
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
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["subtasks"] });

      const allTaskQueries = [
        ...queryClient.getQueriesData<Task[]>({ queryKey: ["tasks"] }),
        // SubtaskList reads from ["subtasks", parentId], not ["tasks"].
        ...queryClient.getQueriesData<Task[]>({ queryKey: ["subtasks"] }),
      ];

      for (const [queryKey] of allTaskQueries) {
        queryClient.setQueryData<Task[]>(queryKey, (old) =>
          old?.map((task) =>
            task.id === updates.id ? { ...task, ...updates } : task,
          ),
        );
      }

      return { previousTaskQueries: allTaskQueries };
    },
    onError: (err, _vars, context) => {
      if (context?.previousTaskQueries) {
        context.previousTaskQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      handleMutationError(err);
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
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["subtasks"] });

      const allTaskQueries = [
        ...queryClient.getQueriesData<Task[]>({ queryKey: ["tasks"] }),
        // A deleted subtask must also disappear from its parent's ["subtasks", parentId] list.
        ...queryClient.getQueriesData<Task[]>({ queryKey: ["subtasks"] }),
      ];
      let deletedTask: Task | undefined;

      for (const [, data] of allTaskQueries) {
        if (data) {
          const found = data.find((task) => task.id === id);
          if (found) {
            deletedTask = found;
            break;
          }
        }
      }

      for (const [queryKey] of allTaskQueries) {
        queryClient.setQueryData<Task[]>(queryKey, (old) =>
          old?.filter((task) => task.id !== id),
        );
      }

      // Cascades at the DB level — clear cached subtasks now, not orphaned later.
      for (const [queryKey] of queryClient.getQueriesData<Task[]>({
        queryKey: ["subtasks", id],
      })) {
        queryClient.setQueryData<Task[]>(queryKey, []);
      }

      return { deletedTask };
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
          mockStore.addTask(taskToRestore);
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
    onError: (err, id, _context) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      // Undoes the optimistic subtasks-cache clear from onMutate — the
      // delete never landed, so the subtree is still there.
      queryClient.invalidateQueries({ queryKey: ["subtasks", id] });
      handleMutationError(err);
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
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["subtasks"] });

      const allTaskQueries = queryClient.getQueriesData<Task[]>({
        queryKey: ["tasks"],
      });
      const allSubtaskQueries = queryClient.getQueriesData<Task[]>({
        queryKey: ["subtasks"],
      });

      const pairById = new Map(pairs.map((p) => [p.id, p.day_order]));

      for (const [queryKey] of allTaskQueries) {
        queryClient.setQueryData<Task[]>(queryKey, (old) => {
          if (!old) return old;

          // Pairs already carry final day_order (computeMoveOrders) — apply as-is.
          return old.map((task) => {
            const newOrder = pairById.get(task.id);
            return newOrder === undefined || task.day_order === newOrder
              ? task
              : { ...task, day_order: newOrder };
          });
        });
      }

      for (const [queryKey] of allSubtaskQueries) {
        queryClient.setQueryData<Task[]>(queryKey, (old) => {
          if (!old) return old;
          return old
            .map((task) => {
              const newOrder = pairById.get(task.id);
              return newOrder === undefined || task.day_order === newOrder
                ? task
                : { ...task, day_order: newOrder };
            })
            .sort(
              (a, b) =>
                (a.day_order ?? 0) - (b.day_order ?? 0) ||
                a.created_at.localeCompare(b.created_at),
            );
        });
      }

      return {
        previousTaskQueries: allTaskQueries,
        previousSubtaskQueries: allSubtaskQueries,
      };
    },
    onError: (err, _vars, context) => {
      if (context?.previousTaskQueries) {
        context.previousTaskQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousSubtaskQueries) {
        context.previousSubtaskQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      handleMutationError(err);
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
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      const previousTasks = queryClient.getQueriesData({ queryKey: ["tasks"] });

      queryClient.setQueriesData(
        { queryKey: ["tasks"] },
        (oldData: Task[] | undefined) => {
          if (!oldData) return oldData;
          if (Array.isArray(oldData)) {
            return oldData.filter((task: Task) => !task.is_completed);
          }
          return oldData;
        },
      );

      return { previousTasks };
    },
    onError: (err, _vars, context) => {
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      handleMutationError(err);
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
      overrides?: Partial<Task>;
    }) => taskMutations.duplicate(sourceTask, overrides),
    onSuccess: (newTask, variables) => {
      // Guests get a year of pre-seeded demo tasks; interacting with them
      // shouldn't inflate the "Engagement & Throughput" telemetry KPI.
      if (!(isGuestMode && mockStore.isSeedId(variables.sourceTask.id))) {
        trackTelemetry("task_action", { action: "created" });
      }
      trigger("success");
      notify("Task duplicated");
      if (newTask.parent_id) {
        queryClient.invalidateQueries({
          queryKey: ["subtasks", newTask.parent_id],
        });
      }
    },
    onError: (err) => {
      handleMutationError(err);
    },
    onSettled: () => {
      invalidateTaskCaches(queryClient);
    },
  });
}
