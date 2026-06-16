import { describe, it, expect, vi, afterAll } from "vitest";
import { calculateStats } from "@/lib/hooks/useStats";

describe("calculateStats timezone fix", () => {
  afterAll(() => {
    vi.useRealTimers();
  });

  it("buckets logs into correct local day across UTC midnight boundary", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "Asia/Kolkata"; // UTC+5:30
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));

    // Log at June 14 23:30 UTC = June 15 05:00 IST
    const log = {
      start_time: "2024-06-14T23:30:00.000Z",
      duration_seconds: 3600,
    };

    const result = calculateStats([log], [], []);

    // dailyTrend[0] = 6 days ago (June 9), dailyTrend[6] = today (June 15)
    // Log is on June 15 (local) → dailyTrend[6]
    expect(result.dailyTrend[6].hours).toBe(1);
    expect(result.dailyTrend[6].totalSessions).toBe(1);
    // No log on June 14 (local) → dailyTrend[5] should be 0
    expect(result.dailyTrend[5].hours).toBe(0);

    process.env.TZ = originalTz;
    vi.useRealTimers();
  });

  it("buckets tasks into correct local day across UTC midnight boundary", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "America/New_York"; // UTC-4 (EDT in June)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));

    // Task at June 15 02:00 UTC = June 14 22:00 EDT
    const task = {
      is_completed: true,
      completed_at: "2024-06-15T02:00:00.000Z",
    };

    const result = calculateStats([], [task], []);

    // Task is on June 14 (local EDT) → dailyTrend[5]
    expect(result.dailyTrend[5].tasksCompleted).toBe(1);
    // No task on June 15 (local EDT) → dailyTrend[6] should be 0
    expect(result.dailyTrend[6].tasksCompleted).toBe(0);

    process.env.TZ = originalTz;
    vi.useRealTimers();
  });

  it("computes streak using local date keys", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "Asia/Kolkata"; // UTC+5:30
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));

    // June 14 18:30 UTC = June 15 00:00 IST
    // June 15 18:29 UTC = June 16 00:00 IST
    // These are consecutive IST days (June 15 and June 16)
    const logs = [
      { start_time: "2024-06-14T18:30:00.000Z", duration_seconds: 3600 },
    ];
    const tasks = [
      {
        is_completed: true,
        completed_at: "2024-06-15T18:29:59.000Z",
      },
    ];

    const result = calculateStats(logs, tasks, []);

    expect(result.currentStreak).toBeGreaterThanOrEqual(1);

    process.env.TZ = originalTz;
    vi.useRealTimers();
  });
});
