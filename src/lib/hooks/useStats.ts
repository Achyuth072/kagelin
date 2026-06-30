import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  subDays,
  startOfDay,
  format,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import { PERIOD_DAY_COUNT, type StatsPeriod } from "@/lib/types/stats";

export interface DailyStats {
  date: string; // ISO 'yyyy-MM-dd' (local)
  hours: number;
  totalSessions: number;
  tasksCompleted: number;
}

export interface StatsTrend {
  value: number;
  isPositive: boolean;
}

export interface ProjectBreakdownCount {
  projectId: string | null;
  count: number;
}

export interface PriorityBreakdownCount {
  priority: 1 | 2 | 3 | 4;
  count: number;
}

export interface StatsData {
  totalFocusHours: number;
  totalSessions: number;
  tasksCompleted: number;
  completionRate: number;
  currentStreak: number;
  dailyTrend: DailyStats[];
  habitReps: number;
  trends: {
    focus: StatsTrend;
    tasks: StatsTrend;
    rate: StatsTrend;
    habitReps: StatsTrend;
  };
  byProject: ProjectBreakdownCount[];
  byPriority: PriorityBreakdownCount[];
  /** Minutes of focus, indexed [weekday][hour]. weekday 0=Mon..6=Sun (local). */
  timeOfDay: number[][];
}

interface StatsLog {
  start_time: string;
  duration_seconds: number | null;
}

interface StatsTask {
  is_completed: boolean;
  completed_at: string | null;
  project_id?: string | null;
  priority?: 1 | 2 | 3 | 4;
}

interface StatsHabitEntry {
  date: string;
}

/**
 * Returns the lower bound (inclusive) for the data this period's UI displays,
 * or null for "all" (no lower bound).
 */
function periodStart(period: StatsPeriod, now: Date): Date | null {
  if (period === "all") return null;
  return startOfDay(subDays(now, PERIOD_DAY_COUNT[period] - 1));
}

/**
 * Returns the lower bound (inclusive) for the prior period used to compute
 * trend deltas, or null when there's no meaningful "previous" window (period
 * is "all", or the period has no fixed length).
 */
function prevPeriodStart(period: StatsPeriod, now: Date): Date | null {
  if (period === "all") return null;
  return startOfDay(subDays(now, PERIOD_DAY_COUNT[period] * 2 - 1));
}

/**
 * The lower bound to actually fetch from the data source: current period +
 * an equal-length prior period (for trend deltas). Null = fetch everything.
 */
export function fetchLowerBound(
  period: StatsPeriod,
  now: Date = new Date(),
): Date | null {
  return prevPeriodStart(period, now);
}

/**
 * Processes raw stats data in a single pass per collection to optimize
 * performance (Phase 52 perf goal: O(n), no nested loops over the inputs).
 */
export function calculateStats(
  logs: StatsLog[],
  tasks: StatsTask[],
  habitEntries: StatsHabitEntry[],
  period: StatsPeriod = "30d",
  now: Date = new Date(),
): StatsData {
  const currentStart = periodStart(period, now);
  const currentStartMs = currentStart ? currentStart.getTime() : -Infinity;
  const prevStart = prevPeriodStart(period, now);
  const prevStartMs = prevStart ? prevStart.getTime() : null;
  const hasPrevWindow = prevStartMs !== null;

  const dailyMap = new Map<
    string,
    { hours: number; totalSessions: number; tasksCompleted: number }
  >();
  const getBucket = (key: string) => {
    let bucket = dailyMap.get(key);
    if (!bucket) {
      bucket = { hours: 0, totalSessions: 0, tasksCompleted: 0 };
      dailyMap.set(key, bucket);
    }
    return bucket;
  };

  let minActivityMs: number | null = null;
  const trackMin = (ms: number) => {
    if (minActivityMs === null || ms < minActivityMs) minActivityMs = ms;
  };

  const activityDates = new Set<string>();
  const timeOfDay: number[][] = Array.from({ length: 7 }, () =>
    new Array(24).fill(0),
  );

  // 1. Process Focus Logs
  let currentFocusSec = 0;
  let currentSessions = 0;
  let prevFocusSec = 0;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const seconds = log.duration_seconds || 0;
    const startMs = Date.parse(log.start_time);
    const localDate = new Date(startMs);
    const dateKey = format(localDate, "yyyy-MM-dd");
    activityDates.add(dateKey);

    if (startMs >= currentStartMs) {
      currentFocusSec += seconds;
      currentSessions += 1;
      trackMin(startMs);

      const bucket = getBucket(dateKey);
      bucket.hours += seconds / 3600;
      bucket.totalSessions += 1;

      const weekday = (localDate.getDay() + 6) % 7; // Mon=0..Sun=6
      timeOfDay[weekday][localDate.getHours()] += seconds / 60;
    } else if (hasPrevWindow && startMs >= prevStartMs!) {
      prevFocusSec += seconds;
    }
  }

  // 2. Process Tasks
  let currentCompleted = 0;
  let prevCompleted = 0;
  let incompleteCount = 0;
  const byProjectMap = new Map<string | null, number>();
  const byPriorityCounts: Record<1 | 2 | 3 | 4, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task.is_completed) {
      incompleteCount++;
      continue;
    }
    if (!task.completed_at) continue;

    const completedMs = Date.parse(task.completed_at);
    const dateKey = format(new Date(completedMs), "yyyy-MM-dd");
    activityDates.add(dateKey);

    if (completedMs >= currentStartMs) {
      currentCompleted++;
      trackMin(completedMs);

      const bucket = getBucket(dateKey);
      bucket.tasksCompleted += 1;

      const projectKey = task.project_id ?? null;
      byProjectMap.set(projectKey, (byProjectMap.get(projectKey) ?? 0) + 1);
      if (task.priority) {
        byPriorityCounts[task.priority] += 1;
      }
    } else if (hasPrevWindow && completedMs >= prevStartMs!) {
      prevCompleted++;
    }
  }

  const currentTotal = currentCompleted + incompleteCount;
  const prevTotal = prevCompleted + incompleteCount;

  // 3. Process Habit Entries
  let currentHabitReps = 0;
  let prevHabitReps = 0;
  for (let i = 0; i < habitEntries.length; i++) {
    const entry = habitEntries[i];
    // Parse the bare yyyy-MM-dd as local midnight (not UTC, which Date.parse
    // would do) so window classification stays consistent with the local-time
    // bucketing used for focus logs and tasks above.
    const entryMs = parseISO(entry.date).getTime();
    if (entryMs >= currentStartMs) {
      currentHabitReps++;
    } else if (hasPrevWindow && entryMs >= prevStartMs!) {
      prevHabitReps++;
    }
  }

  // 4. Calculate Streak (walks back from today over every fetched activity date)
  let currentStreak = 0;
  if (activityDates.size > 0) {
    const checkDate = new Date(now);
    const getDateKey = (d: Date) => format(d, "yyyy-MM-dd");

    if (!activityDates.has(getDateKey(checkDate))) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (activityDates.has(getDateKey(checkDate))) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
      if (currentStreak > 365) break; // Safety break
    }
  }

  const calculateTrend = (curr: number, prev: number): StatsTrend => {
    if (prev === 0) return { value: curr > 0 ? 100 : 0, isPositive: curr > 0 };
    const diff = ((curr - prev) / prev) * 100;
    return {
      value: Math.abs(Math.round(diff * 10) / 10),
      isPositive: diff >= 0,
    };
  };

  // 5. Build the range-aware daily trend, spanning the current period only.
  const trendStart =
    currentStart ??
    (minActivityMs !== null
      ? startOfDay(new Date(minActivityMs))
      : startOfDay(now));
  const trendEnd = startOfDay(now);
  const trendDays =
    trendStart > trendEnd
      ? [trendEnd]
      : eachDayOfInterval({ start: trendStart, end: trendEnd });

  const dailyTrend: DailyStats[] = trendDays.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const bucket = dailyMap.get(key);
    return {
      date: key,
      hours: bucket ? Math.round(bucket.hours * 10) / 10 : 0,
      totalSessions: bucket ? bucket.totalSessions : 0,
      tasksCompleted: bucket ? bucket.tasksCompleted : 0,
    };
  });

  const currentRate =
    currentTotal > 0 ? (currentCompleted / currentTotal) * 100 : 0;
  const prevRate = prevTotal > 0 ? (prevCompleted / prevTotal) * 100 : 0;

  const byProject: ProjectBreakdownCount[] = Array.from(
    byProjectMap.entries(),
  ).map(([projectId, count]) => ({ projectId, count }));

  const byPriority: PriorityBreakdownCount[] = ([1, 2, 3, 4] as const).map(
    (priority) => ({ priority, count: byPriorityCounts[priority] }),
  );

  return {
    totalFocusHours: Math.round((currentFocusSec / 3600) * 10) / 10,
    totalSessions: currentSessions,
    tasksCompleted: currentCompleted,
    completionRate: Math.round(currentRate),
    currentStreak,
    dailyTrend,
    habitReps: currentHabitReps,
    trends: {
      focus: calculateTrend(currentFocusSec, prevFocusSec),
      tasks: calculateTrend(currentCompleted, prevCompleted),
      rate: calculateTrend(currentRate, prevRate),
      habitReps: calculateTrend(currentHabitReps, prevHabitReps),
    },
    byProject,
    byPriority,
    timeOfDay: timeOfDay.map((row) => row.map((m) => Math.round(m))),
  };
}

export function useStats(period: StatsPeriod = "30d") {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["stats-dashboard", isGuestMode, period],
    staleTime: 60000, // Cache for 1 minute
    placeholderData: (previousData) => previousData,
    queryFn: async (): Promise<StatsData> => {
      let rawLogs, rawTasks, rawHabits;
      const now = new Date();
      const lowerBound = fetchLowerBound(period, now);

      if (isGuestMode) {
        rawLogs = lowerBound
          ? mockStore
              .getFocusLogs()
              .filter((log) => log.start_time >= lowerBound.toISOString())
          : mockStore.getFocusLogs();
        rawTasks = mockStore.getTasks();
        rawHabits = lowerBound
          ? mockStore
              .getHabitEntries()
              .filter((entry) => entry.date >= format(lowerBound, "yyyy-MM-dd"))
          : mockStore.getHabitEntries();
      } else {
        const supabase = createClient();

        let logsQuery = supabase
          .from("focus_logs")
          .select("start_time, duration_seconds");
        let habitsQuery = supabase.from("habit_entries").select("date");

        if (lowerBound) {
          logsQuery = logsQuery.gte("start_time", lowerBound.toISOString());
          habitsQuery = habitsQuery.gte(
            "date",
            format(lowerBound, "yyyy-MM-dd"),
          );
        }

        // Parallel fetch for better performance
        const [logsRes, tasksRes, habitsRes] = await Promise.all([
          logsQuery,
          supabase.auth.getSession().then(({ data: { session } }) => {
            const userId = session?.user?.id;
            if (!userId) throw new Error("Not authenticated");
            return supabase
              .from("tasks")
              .select(
                "is_completed, completed_at, project_id, priority, user_id",
              )
              .eq("user_id", userId);
          }),
          habitsQuery,
        ]);

        if (logsRes.error) throw logsRes.error;
        if (tasksRes.error) throw tasksRes.error;
        if (habitsRes.error) throw habitsRes.error;

        rawLogs = logsRes.data || [];
        rawTasks = tasksRes.data || [];
        rawHabits = habitsRes.data || [];
      }

      return calculateStats(rawLogs, rawTasks, rawHabits, period, now);
    },
  });
}
