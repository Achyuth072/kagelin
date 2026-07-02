"use client";

import {
  useMutation,
  useQueryClient,
  QueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import type { Task, CreateTaskInput } from "@/lib/types/task";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { handleMutationError } from "@/lib/utils/mutation-error";

import { taskMutations } from "@/lib/mutations/task";
import { mockStore } from "@/lib/mock/mock-store";

function invalidateTaskCaches(queryClient: QueryClient): void {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["stats-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["focus-tasks"] }),
    // Keep Task Insights (streaks, on-time %, History) fresh after a
    // completion toggle — the panel reads occurrences via ["task-series", …].
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

      // If guest mode, we don't need optimistic updates because mockStore is synchronous
      // and fast, BUT keeping optimistic UI makes it feel same as prod.
      // However, mockStore persists immediately so careful not to dupe.
      // Actually, since mockStore is local, the mutationFn resolves instantly.
      // We can keep optimistic update logic or skip it for guest.
      // Skipping simplifies things, but let's keep it consistent.

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
  const { trigger } = useHaptic(); // Use haptic hook
  const { isGuestMode } = useAuth();
  const supabase = createClient(); // Still needed for UNDO logic below

  return useMutation({
    mutationKey: ["deleteTask"],
    mutationFn: taskMutations.delete,
    onMutate: async (id) => {
      // Import toast dynamically to avoid SSR issues
      const { toast } = await import("sonner");

      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      // Get all task query caches and find the deleted task
      const allTaskQueries = queryClient.getQueriesData<Task[]>({
        queryKey: ["tasks"],
      });
      let deletedTask: Task | undefined;

      // Search through all task caches to find the task being deleted
      for (const [, data] of allTaskQueries) {
        if (data) {
          const found = data.find((task) => task.id === id);
          if (found) {
            deletedTask = found;
            break;
          }
        }
      }

      // Optimistically remove from ALL task caches
      for (const [queryKey] of allTaskQueries) {
        queryClient.setQueryData<Task[]>(queryKey, (old) =>
          old?.filter((task) => task.id !== id),
        );
      }

      // Show undo toast
      if (deletedTask) {
        const taskToRestore = { ...deletedTask };

        // Success Haptic (Double Tick)
        trigger("success");

        toast("Task deleted", {
          description: deletedTask.content,
          duration: 5000,
          action: {
            label: "Undo",
            onClick: async () => {
              if (isGuestMode) {
                // Restore to mock store
                mockStore.addTask(taskToRestore);
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
                trigger("success");
                toast("Task restored");
                return;
              }

              // Re-insert into database using insert (task was hard-deleted)
              const { error } = await supabase.from("tasks").insert({
                id: taskToRestore.id,
                user_id: taskToRestore.user_id,
                project_id: taskToRestore.project_id,
                parent_id: taskToRestore.parent_id,
                content: taskToRestore.content,
                description: taskToRestore.description,
                priority: taskToRestore.priority,
                due_date: taskToRestore.due_date,
                do_date: taskToRestore.do_date,
                is_evening: taskToRestore.is_evening,
                is_completed: taskToRestore.is_completed,
                completed_at: taskToRestore.completed_at,
                day_order: taskToRestore.day_order,
                recurrence: taskToRestore.recurrence,
                google_event_id: taskToRestore.google_event_id,
                google_etag: taskToRestore.google_etag,
              });

              if (error) {
                console.error("Failed to restore task:", error);

                // Error Haptic (Strong Pulse)
                trigger("thud");

                toast.error("Failed to restore task");
              } else {
                // Success Haptic (Double Tick)
                trigger("success");

                toast("Task restored");
              }
              // Always invalidate to sync with database
              queryClient.invalidateQueries({ queryKey: ["tasks"] });
            },
          },
        });
      }

      return { deletedTask };
    },
    onError: (err, _id, _context) => {
      // Invalidate to refetch from database on error
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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

          // The pairs now come from computeMoveOrders (see reorder.ts / task-dnd.ts):
          // they describe a single task move within the shared flat list, and each
          // pair already carries the task's final day_order value. We just apply
          // those day_order updates in place. Consumers that care about order sort
          // by day_order (e.g. useTaskViewData), so the visual order is correct
          // without reshuffling the cache array here.
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
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      // Snapshot previous data for rollback
      const previousTasks = queryClient.getQueriesData({ queryKey: ["tasks"] });

      // Optimistically remove all completed tasks from cache
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
      // Rollback on error
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      handleMutationError(err);
    },
    onSettled: () => {
      // Invalidate all task queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats-dashboard"] });
    },
  });
}
