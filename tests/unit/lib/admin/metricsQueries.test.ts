import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateMetricsData,
  getAdminMetricsSummary,
  DailyAggregateRow,
  RawTelemetryEventRow,
} from "@/lib/admin/metricsQueries";

describe("metricsQueries / aggregateMetricsData", () => {
  const refDate = new Date("2026-08-20T12:00:00.000Z");

  it("handles empty daily aggregates and empty events gracefully without NaN", () => {
    const result = aggregateMetricsData([], [], refDate);

    expect(result.hasData).toBe(false);
    expect(result.dailyTrends).toEqual([]);
    expect(result.kpis).toEqual({
      activeDevicesToday: 0,
      activeDevices7d: 0,
      activeDevices30d: 0,
      pwaRatioPercent: 0,
      totalPwaDevices: 0,
      totalBrowserDevices: 0,
      totalPwaInstalls: 0,
      totalFocusHours: 0,
      focusHoursToday: 0,
      totalTasksCreated: 0,
      totalTasksCompleted: 0,
      taskCompletionRatePercent: 0,
      timerCompletionRatePercent: 0,
      totalTimerCompleted: 0,
      totalTimerAbandoned: 0,
      totalHabitsLogged: 0,
      totalSignups: 0,
    });
  });

  it("correctly aggregates daily metrics and recent raw event device IDs", () => {
    const dailyAggregates: DailyAggregateRow[] = [
      {
        date: "2026-08-18",
        active_devices: 10,
        pwa_devices: 6,
        browser_devices: 4,
        pwa_installs: 2,
        tasks_created: 20,
        tasks_completed: 15,
        timer_sessions_completed: 8,
        timer_sessions_abandoned: 2,
        focus_minutes_total: 240, // 4 hours
        habits_logged: 30,
        signups_completed: 5,
      },
      {
        date: "2026-08-19",
        active_devices: 15,
        pwa_devices: 10,
        browser_devices: 5,
        pwa_installs: 1,
        tasks_created: 25,
        tasks_completed: 20,
        timer_sessions_completed: 10,
        timer_sessions_abandoned: 0,
        focus_minutes_total: 300, // 5 hours
        habits_logged: 40,
        signups_completed: 3,
      },
      {
        date: "2026-08-20",
        active_devices: 8,
        pwa_devices: 4,
        browser_devices: 4,
        pwa_installs: 0,
        tasks_created: 5,
        tasks_completed: 5,
        timer_sessions_completed: 2,
        timer_sessions_abandoned: 1,
        focus_minutes_total: 60, // 1 hour
        habits_logged: 10,
        signups_completed: 2,
      },
    ];

    const recentEvents: RawTelemetryEventRow[] = [
      {
        device_id: "dev-1",
        event_name: "app_opened",
        created_at: "2026-08-20T10:00:00.000Z", // today
      },
      {
        device_id: "dev-2",
        event_name: "app_opened",
        created_at: "2026-08-20T11:00:00.000Z", // today
      },
      {
        device_id: "dev-3",
        event_name: "app_opened",
        created_at: "2026-08-16T10:00:00.000Z", // within 7 days
      },
      {
        device_id: "dev-4",
        event_name: "app_opened",
        created_at: "2026-08-01T10:00:00.000Z", // within 30 days
      },
      {
        device_id: "dev-1",
        event_name: "focus_session",
        properties: { status: "completed", duration_minutes: 45 },
        created_at: "2026-08-20T09:00:00.000Z", // today
      },
    ];

    const result = aggregateMetricsData(dailyAggregates, recentEvents, refDate);

    expect(result.hasData).toBe(true);
    expect(result.dailyTrends.length).toBe(3);

    // Sums:
    // PWA devices: 6 + 10 + 4 = 20
    // Browser devices: 4 + 5 + 4 = 13
    // Total device launches = 33 -> PWA ratio = 20/33 * 100 = 61%
    expect(result.kpis.totalPwaDevices).toBe(20);
    expect(result.kpis.totalBrowserDevices).toBe(13);
    expect(result.kpis.pwaRatioPercent).toBe(61);

    // Focus hours: (240 + 300 + 60) / 60 = 10.0 hours
    expect(result.kpis.totalFocusHours).toBe(10);
    // Focus hours today: max(45m raw event, 60m aggregate) = 60m = 1.0 hour
    expect(result.kpis.focusHoursToday).toBe(1);

    // Tasks: 50 created, 40 completed -> 80%
    expect(result.kpis.totalTasksCreated).toBe(50);
    expect(result.kpis.totalTasksCompleted).toBe(40);
    expect(result.kpis.taskCompletionRatePercent).toBe(80);

    // Timer: completed 20, abandoned 3 -> 20/23 = 87%
    expect(result.kpis.totalTimerCompleted).toBe(20);
    expect(result.kpis.totalTimerAbandoned).toBe(3);
    expect(result.kpis.timerCompletionRatePercent).toBe(87);

    // Signups: 5 + 3 + 2 = 10
    expect(result.kpis.totalSignups).toBe(10);
    // Habits: 30 + 40 + 10 = 80
    expect(result.kpis.totalHabitsLogged).toBe(80);

    // Active devices:
    // Today: max(2 raw devs, 8 agg) = 8
    // 7d: max(3 raw devs, 10+15+8=33 agg) = 33
    // 30d: max(4 raw devs, 33 agg) = 33
    expect(result.kpis.activeDevicesToday).toBe(8);
    expect(result.kpis.activeDevices7d).toBe(33);
    expect(result.kpis.activeDevices30d).toBe(33);
  });
});

describe("getAdminMetricsSummary", () => {
  it("queries supabase admin client and returns structured summary", async () => {
    const mockSelectAggregates = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: [
            {
              date: "2026-08-19",
              active_devices: 5,
              pwa_devices: 3,
              browser_devices: 2,
              pwa_installs: 1,
              tasks_created: 10,
              tasks_completed: 8,
              timer_sessions_completed: 4,
              timer_sessions_abandoned: 1,
              focus_minutes_total: 120,
              habits_logged: 15,
              signups_completed: 2,
            },
          ],
          error: null,
        }),
      }),
    });

    const mockSelectEvents = vi.fn().mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "telemetry_daily_aggregates") {
          return { select: mockSelectAggregates };
        }
        if (table === "telemetry_events") {
          return { select: mockSelectEvents };
        }
        return { select: vi.fn() };
      }),
    };

    const summary = await getAdminMetricsSummary(
      mockClient as unknown as SupabaseClient,
    );

    expect(summary).toBeDefined();
    expect(summary.hasData).toBe(true);
    expect(summary.kpis.totalTasksCreated).toBe(10);
    expect(summary.kpis.totalTasksCompleted).toBe(8);
    expect(summary.kpis.totalFocusHours).toBe(2);
    expect(summary.dailyTrends.length).toBe(1);
    expect(summary.generatedAt).toBeDefined();
  });

  it("pages past PostgREST's 1000-row response cap instead of truncating history", async () => {
    const makeRow = (i: number): DailyAggregateRow => ({
      date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      active_devices: 1,
      pwa_devices: 1,
      browser_devices: 0,
      pwa_installs: 0,
      tasks_created: 1,
      tasks_completed: 1,
      timer_sessions_completed: 0,
      timer_sessions_abandoned: 0,
      focus_minutes_total: 0,
      habits_logged: 0,
      signups_completed: 0,
    });
    const page1 = Array.from({ length: 1000 }, (_, i) => makeRow(i));
    const page2 = Array.from({ length: 5 }, (_, i) => makeRow(1000 + i));

    const mockRange = vi.fn((from: number) =>
      Promise.resolve({
        data: from === 0 ? page1 : page2,
        error: null,
      }),
    );
    const mockSelectAggregates = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({ range: mockRange }),
    });

    const mockSelectEvents = vi.fn().mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "telemetry_daily_aggregates") {
          return { select: mockSelectAggregates };
        }
        if (table === "telemetry_events") {
          return { select: mockSelectEvents };
        }
        return { select: vi.fn() };
      }),
    };

    const summary = await getAdminMetricsSummary(
      mockClient as unknown as SupabaseClient,
    );

    expect(mockRange).toHaveBeenCalledTimes(2);
    expect(summary.dailyTrends.length).toBe(1005);
    expect(summary.kpis.totalTasksCreated).toBe(1005);
  });
});
