"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import type { Task } from "@/lib/types/task";

/**
 * Fetches all subtasks for a given parent task.
 */
export function useSubtasks<TData = Task[]>(
  parentId: string | null | undefined,
  options?: { select?: (data: Task[]) => TData },
) {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["subtasks", parentId, isGuestMode],
    select: options?.select,
    queryFn: async (): Promise<Task[]> => {
      if (!parentId) return [];

      if (isGuestMode) {
        return mockStore
          .getTasks()
          .filter((t) => t.parent_id === parentId)
          .sort(
            (a, b) =>
              (a.day_order ?? 0) - (b.day_order ?? 0) ||
              a.created_at.localeCompare(b.created_at),
          );
      }

      const supabase = createClient();
      // eslint-disable-next-line local/no-unbounded-supabase-select -- subtasks of one parent
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("parent_id", parentId)
        .order("day_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data as Task[];
    },
    enabled: !!parentId,
  });
}
