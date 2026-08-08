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

function invalidateTaskCaches(queryClient: QueryClient): void {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
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

      const queryKey = [
        "tasks",
        { projectId: undefined, showCompleted: false, isGuestMode },
      ];
      const previousTasks = queryClient.getQueryData<Task[]>(queryKey);

      queryClient.setQueryData<Task[]>(queryKey, (old) =>
        old?.map((task) =>
          task.id === id
            ? {
                ...task,
                is_completed,
                completed_at: is_completed ? new Date().toISOString() : null,
              }
            : task,
        ),
      );

      return { previousTasks };
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

      const allTaskQueries = queryClient.getQueriesData<Task[]>({
        queryKey: ["tasks"],
      });

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

      const allTaskQueries = queryClient.getQueriesData<Task[]>({
        queryKey: ["tasks"],
      });
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

      // Deleting the parent cascades at the DB level, so any subtasks list
      // currently on screen for it goes stale the instant the delete lands —
      // clear it optimistically rather than leaving orphaned rows visible.
      for (const [queryKey] of queryClient.getQueriesData<Task[]>({
        queryKey: ["subtasks", id],
      })) {
        queryClient.setQueryData<Task[]>(queryKey, []);
      }

      return { deletedTask };
    },
    // Fires after the delete (and its cascade) is confirmed, using the
    // subtasks taskMutations.delete fetched before removing them — not the
    // cache from onMutate, which may be empty if the subtask list was never
    // opened. Waiting for confirmation also avoids offering an "Undo" for a
    // delete that never actually happened.
    onSuccess: (deletedSubtasks, _id, context) => {
      const deletedTask = context?.deletedTask;
      if (!deletedTask) return;

      const taskToRestore = { ...deletedTask };
      const subtasksToRestore = deletedSubtasks;

      trigger("success");

      // Task content is unbounded user text, so it's dropped rather than
      // folded into the title like other toasts (see ADR 0008).
      notify("Task deleted", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (isGuestMode) {
              mockStore.addTask(taskToRestore);
              queryClient.invalidateQueries({ queryKey: ["tasks"] });
              trigger("success");
              notify("Task restored");
              return;
            }

            // Task was hard-deleted, so undo re-inserts rather than updates —
            // parent first, then any subtasks the delete cascaded away.
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
          },
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

      const allTaskQueries = queryClient.getQueriesData<Task[]>({
        queryKey: ["tasks"],
      });

      const pairById = new Map(pairs.map((p) => [p.id, p.day_order]));

      for (const [queryKey] of allTaskQueries) {
        queryClient.setQueryData<Task[]>(queryKey, (old) => {
          if (!old) return old;

          // Pairs already carry each task's final day_order (computeMoveOrders in
          // reorder.ts / task-dnd.ts) — apply in place. Consumers (e.g.
          // useTaskViewData) sort by day_order themselves, so no reshuffling here.
          return old.map((task) => {
            const newOrder = pairById.get(task.id);
            return newOrder === undefined || task.day_order === newOrder
              ? task
              : { ...task, day_order: newOrder };
          });
        });
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
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
