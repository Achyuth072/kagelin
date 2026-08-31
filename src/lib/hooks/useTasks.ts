"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import type { Task } from "@/lib/types/task";

interface UseTasksOptions {
  projectId?: string | null;
  showCompleted?: boolean;
  filter?: string;
}

export function useTasks(options: UseTasksOptions = {}) {
  const { projectId, showCompleted = false, filter } = options;
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["tasks", { projectId, showCompleted, filter, isGuestMode }],
    staleTime: 60000,
    queryFn: async (): Promise<Task[]> => {
      if (isGuestMode) {
        let tasks = mockStore.getTasks();

        if (filter === "today") {
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          tasks = tasks.filter(
            (t) => t.due_date && new Date(t.due_date) <= today,
          );
        } else if (filter === "p1") {
          tasks = tasks.filter((t) => t.priority === 1);
        }

        if (projectId === "inbox") {
          tasks = tasks.filter((t) => !t.project_id);
        } else if (projectId === "all") {
          const archivedProjectIds = new Set(
            mockStore
              .getProjects()
              .filter((p) => p.is_archived)
              .map((p) => p.id),
          );
          tasks = tasks.filter(
            (t) => !t.project_id || !archivedProjectIds.has(t.project_id),
          );
        } else if (projectId) {
          tasks = tasks.filter((t) => t.project_id === projectId);
        }

        if (!showCompleted) {
          tasks = tasks.filter((t) => {
            if (!t.is_completed) return true;
            if (!t.completed_at) return false;
            const completedDate = new Date(t.completed_at);
            const today = new Date();
            return (
              completedDate.getDate() === today.getDate() &&
              completedDate.getMonth() === today.getMonth() &&
              completedDate.getFullYear() === today.getFullYear()
            );
          });
        }

        const allTasks = mockStore.getTasks();
        const subtasksByParent = new Map<
          string,
          { id: string; is_completed: boolean }[]
        >();
        for (const t of allTasks) {
          if (t.parent_id) {
            const list = subtasksByParent.get(t.parent_id) || [];
            list.push({ id: t.id, is_completed: t.is_completed });
            subtasksByParent.set(t.parent_id, list);
          }
        }

        // Tie-break matches the Supabase query below (newest first) for consistent ordering.
        tasks = tasks
          .filter((t) => !t.parent_id)
          .sort((a, b) => {
            const diff = a.day_order - b.day_order;
            if (diff !== 0) return diff;
            return b.created_at.localeCompare(a.created_at);
          })
          .map((t) => ({
            ...t,
            subtasks: subtasksByParent.get(t.id) || [],
          }));

        return tasks;
      }

      const supabase = createClient();

      // Hoisted above paged fetch so every page filters against the exact same timestamp.
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let tasks = await fetchAllRows<
        Task & {
          projects: { is_archived: boolean } | null;
          subtasks?: { id: string; is_completed: boolean }[];
        }
      >((from, to) => {
        let query = supabase
          .from("tasks")
          .select(
            `
          *,
          projects!left(is_archived),
          subtasks:tasks!parent_id(id, is_completed)
        `,
          )
          .is("parent_id", null)
          .order("day_order", { ascending: true })
          .order("created_at", { ascending: false })
          .order("id", { ascending: true });

        if (filter === "today") {
          query = query.lte("due_date", todayEnd.toISOString());
        } else if (filter === "p1") {
          query = query.eq("priority", 1);
        }

        if (projectId === "inbox") {
          query = query.is("project_id", null);
        } else if (projectId && projectId !== "all") {
          query = query.eq("project_id", projectId);
        }

        if (!showCompleted) {
          query = query.or(
            `is_completed.eq.false,completed_at.gte.${todayStart.toISOString()}`,
          );
        }

        return query.range(from, to);
      });

      if (projectId === "all" || !projectId) {
        tasks = tasks.filter((t) => !t.projects?.is_archived);
      }

      return tasks;
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useTask(taskId: string | null) {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["task", taskId, isGuestMode],
    queryFn: async (): Promise<Task | null> => {
      if (!taskId) return null;

      if (isGuestMode) {
        const task = mockStore.getTask(taskId);
        if (!task) return null;
        const subtasks = mockStore
          .getSubtasks(taskId)
          .map((st) => ({ id: st.id, is_completed: st.is_completed }));
        return { ...task, subtasks };
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          subtasks:tasks!parent_id(id, is_completed)
        `,
        )
        .eq("id", taskId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as Task;
    },
    enabled: !!taskId,
  });
}

/**
 * All Occurrences (Task rows) sharing one recurring_series_id, for Task
 * Insights. Unlike useTasks(), this is unfiltered by completion/date so the
 * full history feeds the streak/on-time/heatmap math.
 */
export function useTaskSeries(seriesId: string | null) {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["task-series", seriesId, isGuestMode],
    staleTime: 60000,
    queryFn: async (): Promise<Task[]> => {
      if (!seriesId) return [];

      if (isGuestMode) {
        return mockStore
          .getTasks()
          .filter((t) => t.recurring_series_id === seriesId);
      }

      const supabase = createClient();
      return fetchAllRows<Task>((from, to) =>
        supabase
          .from("tasks")
          .select("*")
          .eq("recurring_series_id", seriesId)
          .order("id", { ascending: true })
          .range(from, to),
      );
    },
    enabled: !!seriesId,
  });
}

export function useInboxProject() {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["inbox-project"],
    queryFn: async () => {
      if (isGuestMode) {
        return mockStore.getProjects().find((p) => p.is_inbox) || null;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("is_inbox", true)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
  });
}
