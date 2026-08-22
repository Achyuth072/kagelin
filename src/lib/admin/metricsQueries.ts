import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DailyAggregateRow {
  date: string;
  active_devices: number;
  pwa_devices: number;
  browser_devices: number;
  pwa_installs: number;
  tasks_created: number;
  tasks_completed: number;
  timer_sessions_completed: number;
  timer_sessions_abandoned: number;
  focus_minutes_total: number;
  habits_logged: number;
  signups_completed: number;
}

export interface RawTelemetryEventRow {
  id?: string;
  device_id: string;
  event_name: string;
  properties?: Record<string, unknown>;
  created_at: string;
}

export interface AdminMetricsKpis {
  activeDevicesToday: number;
  activeDevices7d: number;
  activeDevices30d: number;
  pwaRatioPercent: number;
  totalPwaDevices: number;
  totalBrowserDevices: number;
  totalPwaInstalls: number;
  totalFocusHours: number;
  focusHoursToday: number;
  totalTasksCreated: number;
  totalTasksCompleted: number;
  taskCompletionRatePercent: number;
  timerCompletionRatePercent: number;
  totalTimerCompleted: number;
  totalTimerAbandoned: number;
  totalHabitsLogged: number;
  totalSignups: number;
}

export interface DailyTrendItem {
  date: string;
  activeDevices: number;
  pwaDevices: number;
  browserDevices: number;
  tasksCreated: number;
  tasksCompleted: number;
  focusHours: number;
  habitsLogged: number;
  signups: number;
}

export interface AdminMetricsSummary {
  kpis: AdminMetricsKpis;
  dailyTrends: DailyTrendItem[];
  hasData: boolean;
  generatedAt: string;
}

export function aggregateMetricsData(
  dailyAggregates: DailyAggregateRow[],
  recentEvents: RawTelemetryEventRow[] = [],
  referenceDate: Date = new Date(),
): { kpis: AdminMetricsKpis; dailyTrends: DailyTrendItem[]; hasData: boolean } {
  const nowMs = referenceDate.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sevenDaysAgoMs = nowMs - 7 * oneDayMs;
  const thirtyDaysAgoMs = nowMs - 30 * oneDayMs;

  const todayIsoDate = referenceDate.toISOString().slice(0, 10);

  const todayDevices = new Set<string>();
  const sevenDayDevices = new Set<string>();
  const thirtyDayDevices = new Set<string>();

  let todayFocusMinutes = 0;

  for (const event of recentEvents) {
    const eventTime = new Date(event.created_at).getTime();
    if (isNaN(eventTime)) continue;

    if (eventTime >= nowMs - oneDayMs) {
      todayDevices.add(event.device_id);
    }
    if (eventTime >= sevenDaysAgoMs) {
      sevenDayDevices.add(event.device_id);
    }
    if (eventTime >= thirtyDaysAgoMs) {
      thirtyDayDevices.add(event.device_id);
    }

    if (
      event.event_name === "focus_session" &&
      event.properties?.status === "completed" &&
      typeof event.properties?.duration_minutes === "number" &&
      eventTime >= nowMs - oneDayMs
    ) {
      todayFocusMinutes += event.properties.duration_minutes;
    }
  }

  let totalPwaDevices = 0;
  let totalBrowserDevices = 0;
  let totalPwaInstalls = 0;
  let totalTasksCreated = 0;
  let totalTasksCompleted = 0;
  let totalTimerCompleted = 0;
  let totalTimerAbandoned = 0;
  let totalFocusMinutes = 0;
  let totalHabitsLogged = 0;
  let totalSignups = 0;

  let todayAggActive = 0;
  let todayAggFocusMinutes = 0;

  const dailyTrends: DailyTrendItem[] = dailyAggregates.map((row) => {
    totalPwaDevices += row.pwa_devices ?? 0;
    totalBrowserDevices += row.browser_devices ?? 0;
    totalPwaInstalls += row.pwa_installs ?? 0;
    totalTasksCreated += row.tasks_created ?? 0;
    totalTasksCompleted += row.tasks_completed ?? 0;
    totalTimerCompleted += row.timer_sessions_completed ?? 0;
    totalTimerAbandoned += row.timer_sessions_abandoned ?? 0;
    totalFocusMinutes += row.focus_minutes_total ?? 0;
    totalHabitsLogged += row.habits_logged ?? 0;
    totalSignups += row.signups_completed ?? 0;

    if (row.date === todayIsoDate) {
      todayAggActive = row.active_devices ?? 0;
      todayAggFocusMinutes = row.focus_minutes_total ?? 0;
    }

    return {
      date: row.date,
      activeDevices: row.active_devices ?? 0,
      pwaDevices: row.pwa_devices ?? 0,
      browserDevices: row.browser_devices ?? 0,
      tasksCreated: row.tasks_created ?? 0,
      tasksCompleted: row.tasks_completed ?? 0,
      focusHours: Math.round(((row.focus_minutes_total ?? 0) / 60) * 10) / 10,
      habitsLogged: row.habits_logged ?? 0,
      signups: row.signups_completed ?? 0,
    };
  });

  // Prefer exact counts from raw events; fall back to daily rollups when raw events aren't available
  const activeDevicesToday = Math.max(todayDevices.size, todayAggActive);
  const activeDevices7d = Math.max(
    sevenDayDevices.size,
    dailyAggregates
      .slice(-7)
      .reduce((acc, r) => acc + (r.active_devices ?? 0), 0),
  );
  const activeDevices30d = Math.max(
    thirtyDayDevices.size,
    dailyAggregates
      .slice(-30)
      .reduce((acc, r) => acc + (r.active_devices ?? 0), 0),
  );

  const totalDeviceLaunches = totalPwaDevices + totalBrowserDevices;
  const pwaRatioPercent =
    totalDeviceLaunches > 0
      ? Math.round((totalPwaDevices / totalDeviceLaunches) * 100)
      : 0;

  const taskCompletionRatePercent =
    totalTasksCreated > 0
      ? Math.round((totalTasksCompleted / totalTasksCreated) * 100)
      : 0;

  const totalTimerSessions = totalTimerCompleted + totalTimerAbandoned;
  const timerCompletionRatePercent =
    totalTimerSessions > 0
      ? Math.round((totalTimerCompleted / totalTimerSessions) * 100)
      : 0;

  const totalFocusHours = Math.round((totalFocusMinutes / 60) * 10) / 10;
  const focusHoursToday =
    Math.round((Math.max(todayFocusMinutes, todayAggFocusMinutes) / 60) * 10) /
    10;

  const hasData =
    dailyAggregates.length > 0 ||
    recentEvents.length > 0 ||
    totalTasksCreated > 0 ||
    totalFocusHours > 0 ||
    totalSignups > 0;

  const kpis: AdminMetricsKpis = {
    activeDevicesToday,
    activeDevices7d,
    activeDevices30d,
    pwaRatioPercent,
    totalPwaDevices,
    totalBrowserDevices,
    totalPwaInstalls,
    totalFocusHours,
    focusHoursToday,
    totalTasksCreated,
    totalTasksCompleted,
    taskCompletionRatePercent,
    timerCompletionRatePercent,
    totalTimerCompleted,
    totalTimerAbandoned,
    totalHabitsLogged,
    totalSignups,
  };

  return {
    kpis,
    dailyTrends,
    hasData,
  };
}

// Server-only: uses the privileged Supabase admin client to bypass RLS.
export async function getAdminMetricsSummary(
  client?: SupabaseClient,
): Promise<AdminMetricsSummary> {
  const supabase = client ?? createAdminClient();

  // Independent queries — fetch in parallel.
  const thirtyDaysAgoIso = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [dailyAggregatesResult, { data: eventRows, error: eventsError }] =
    await Promise.all([
      // PostgREST caps a single response at 1000 rows regardless of the
      // requested range — page through with fetchAllRows so history beyond
      // ~2.7 years doesn't silently truncate again.
      fetchAllRows<DailyAggregateRow>((from, to) =>
        supabase
          .from("telemetry_daily_aggregates")
          .select("*")
          .order("date", { ascending: true })
          .range(from, to),
      )
        .then((data) => ({ data, error: null }))
        .catch((error) => ({ data: null, error })),
      supabase
        .from("telemetry_events")
        .select("device_id, event_name, properties, created_at")
        .gte("created_at", thirtyDaysAgoIso)
        .order("created_at", { ascending: false })
        .limit(10000),
    ]);

  if (dailyAggregatesResult.error) {
    console.error(
      "[Admin Metrics] Error fetching daily aggregates:",
      dailyAggregatesResult.error,
    );
  }

  if (eventsError) {
    console.error(
      "[Admin Metrics] Error fetching recent telemetry events:",
      eventsError,
    );
  }

  const aggregates = dailyAggregatesResult.data || [];
  const events = (eventRows as RawTelemetryEventRow[]) || [];

  const { kpis, dailyTrends, hasData } = aggregateMetricsData(
    aggregates,
    events,
  );

  return {
    kpis,
    dailyTrends,
    hasData,
    generatedAt: new Date().toISOString(),
  };
}
