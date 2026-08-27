import { useQuery } from "@tanstack/react-query";
import { startOfWeek, format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";

export interface GoalProgress {
  focusHoursToday: number;
  focusHoursThisWeek: number;
  tasksCompletedToday: number;
  tasksCompletedThisWeek: number;
}

interface GoalLog {
  start_time: string;
  duration_seconds: number | null;
}

interface GoalTask {
  completed_at: string | null;
}

/**
 * Goals are always daily/weekly (CONTEXT.md "Goal"), never period-scoped, so
 * this bisects a single Monday-start week fetch into today/this-week slices
 * rather than reusing useStats's period-selectable windowing.
 */
export function calculateGoalProgress(
  logs: GoalLog[],
  tasks: GoalTask[],
  now: Date = new Date(),
): GoalProgress {
  const weekStartMs = startOfWeek(now, { weekStartsOn: 1 }).getTime();
  const todayKey = format(now, "yyyy-MM-dd");

  let focusSecToday = 0;
  let focusSecThisWeek = 0;
  for (const log of logs) {
    const startMs = Date.parse(log.start_time);
    if (startMs < weekStartMs) continue;
    const seconds = log.duration_seconds || 0;
    focusSecThisWeek += seconds;
    if (format(startMs, "yyyy-MM-dd") === todayKey) {
      focusSecToday += seconds;
    }
  }

  let tasksCompletedToday = 0;
  let tasksCompletedThisWeek = 0;
  for (const task of tasks) {
    if (!task.completed_at) continue;
    const completedMs = Date.parse(task.completed_at);
    if (completedMs < weekStartMs) continue;
    tasksCompletedThisWeek++;
    if (format(completedMs, "yyyy-MM-dd") === todayKey) {
      tasksCompletedToday++;
    }
  }

  return {
    focusHoursToday: Math.round((focusSecToday / 3600) * 10) / 10,
    focusHoursThisWeek: Math.round((focusSecThisWeek / 3600) * 10) / 10,
    tasksCompletedToday,
    tasksCompletedThisWeek,
  };
}

export function useGoalProgress() {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["goal-progress", isGuestMode],
    staleTime: 60_000,
    queryFn: async (): Promise<GoalProgress> => {
      const now = new Date();
      const weekStartIso = startOfWeek(now, { weekStartsOn: 1 }).toISOString();

      if (isGuestMode) {
        const logs = mockStore
          .getFocusLogs()
          .filter((log) => log.start_time >= weekStartIso);
        const tasks = mockStore
          .getTasks()
          .filter(
            (t) =>
              t.is_completed &&
              t.completed_at &&
              t.completed_at >= weekStartIso,
          );
        return calculateGoalProgress(logs, tasks, now);
      }

      const supabase = createClient();
      const [logs, tasks] = await Promise.all([
        fetchAllRows<GoalLog>((from, to) =>
          supabase
            .from("focus_logs")
            .select("start_time, duration_seconds")
            .gte("start_time", weekStartIso)
            .order("start_time", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        ),
        supabase.auth.getSession().then(({ data: { session } }) => {
          const userId = session?.user?.id;
          if (!userId) throw new Error("Not authenticated");
          return fetchAllRows<GoalTask>((from, to) =>
            supabase
              .from("tasks")
              .select("completed_at")
              .eq("user_id", userId)
              .eq("is_completed", true)
              .gte("completed_at", weekStartIso)
              .order("id", { ascending: true })
              .range(from, to),
          );
        }),
      ]);

      return calculateGoalProgress(logs, tasks, now);
    },
  });
}
