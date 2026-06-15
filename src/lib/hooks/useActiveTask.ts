"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import type { Task } from "@/lib/types/task";

/**
 * Resolves the task referenced by `taskId`, transparently switching between
 * a local mockStore lookup (guest mode, no network) and a Supabase fetch.
 */
export function useActiveTask(taskId: string | null): {
  data: Task | null;
  isLoading: boolean;
} {
  const { isGuestMode } = useAuth();
  const supabase = createClient();

  const guestActiveTask: Task | null = useMemo(() => {
    if (!isGuestMode || !taskId) return null;
    const all = mockStore.getTasks();
    return all.find((t) => t.id === taskId) ?? null;
  }, [isGuestMode, taskId]);

  const { data: fetchedActiveTask, isLoading } = useQuery({
    queryKey: ["task", taskId, isGuestMode],
    queryFn: async () => {
      if (!taskId) return null;
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();
      return data as Task | null;
    },
    enabled: !!taskId && !isGuestMode,
  });

  return {
    data: isGuestMode ? guestActiveTask : (fetchedActiveTask ?? null),
    isLoading: isGuestMode ? false : isLoading,
  };
}
