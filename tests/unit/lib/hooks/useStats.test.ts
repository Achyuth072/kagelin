import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
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

    const result = calculateStats([log], [], [], "7d");

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

    const result = calculateStats([], [task], [], "7d");

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

    const result = calculateStats(logs, tasks, [], "7d");

    expect(result.currentStreak).toBeGreaterThanOrEqual(1);

    process.env.TZ = originalTz;
    vi.useRealTimers();
  });
});

describe("calculateStats period windows", () => {
  const NOW = new Date("2024-06-15T12:00:00.000Z");
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = "UTC";
  });
  afterAll(() => {
    process.env.TZ = originalTz;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("scopes headline totals to the selected period only", () => {
    const logs = [
      // 3 days ago — inside a 7d window
      { start_time: "2024-06-12T10:00:00.000Z", duration_seconds: 3600 },
      // 20 days ago — outside a 7d window, inside its 14-day prior-comparison window
      { start_time: "2024-05-26T10:00:00.000Z", duration_seconds: 7200 },
    ];

    const result = calculateStats(logs, [], [], "7d", NOW);

    expect(result.totalFocusHours).toBe(1);
  });

  it("computes a trend delta from the prior equal-length window", () => {
    const logs = [
      { start_time: "2024-06-14T10:00:00.000Z", duration_seconds: 3600 }, // current 7d
      { start_time: "2024-06-05T10:00:00.000Z", duration_seconds: 3600 }, // prior 7d (8 days ago)
    ];

    const result = calculateStats(logs, [], [], "7d", NOW);

    expect(result.trends.focus.value).toBe(0); // equal hours, 0% change
  });

  it("dailyTrend spans the full selected period, not a fixed 7 days", () => {
    const result = calculateStats([], [], [], "30d", NOW);
    expect(result.dailyTrend).toHaveLength(30);

    const resultWeek = calculateStats([], [], [], "7d", NOW);
    expect(resultWeek.dailyTrend).toHaveLength(7);
  });

  it("'all' period has no lower bound and reports a neutral trend baseline", () => {
    const logs = [
      { start_time: "2020-01-01T10:00:00.000Z", duration_seconds: 3600 },
    ];
    const result = calculateStats(logs, [], [], "all", NOW);

    expect(result.totalFocusHours).toBe(1);
    // No prior window exists for "all" — calculateTrend(curr, 0) reports 100%.
    expect(result.trends.focus).toEqual({ value: 100, isPositive: true });
  });

  it("'all' period's dailyTrend starts from the earliest activity date", () => {
    const logs = [
      { start_time: "2024-06-10T10:00:00.000Z", duration_seconds: 3600 },
    ];
    const result = calculateStats(logs, [], [], "all", NOW);

    // June 10 .. June 15 inclusive = 6 days
    expect(result.dailyTrend).toHaveLength(6);
    expect(result.dailyTrend[0].date).toBe("2024-06-10");
    expect(result.dailyTrend[result.dailyTrend.length - 1].date).toBe(
      "2024-06-15",
    );
  });

  it("'all' period with no data at all falls back to a single today entry", () => {
    const result = calculateStats([], [], [], "all", NOW);
    expect(result.dailyTrend).toHaveLength(1);
    expect(result.dailyTrend[0].date).toBe("2024-06-15");
  });

  it("counts a focus session predating the earliest task/habit activity in 'all'", () => {
    // The focus log is older than the only task — dailyTrend starts at the
    // earliest activity (the log), but totalSessions must count it regardless
    // of which collection seeded the trend window.
    const logs = [
      { start_time: "2024-06-08T10:00:00.000Z", duration_seconds: 3600 },
    ];
    const tasks = [
      {
        is_completed: true,
        completed_at: "2024-06-14T10:00:00.000Z",
        project_id: null,
        priority: 4 as const,
      },
    ];

    const result = calculateStats(logs, tasks, [], "all", NOW);

    expect(result.totalSessions).toBe(1);
    expect(result.totalFocusHours).toBe(1);
  });
});

describe("calculateStats breakdowns", () => {
  const NOW = new Date("2024-06-15T12:00:00.000Z");
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = "UTC";
  });
  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it("groups completed tasks by project within the current period", () => {
    const tasks = [
      {
        is_completed: true,
        completed_at: "2024-06-14T10:00:00.000Z",
        project_id: "proj-a",
        priority: 1 as const,
      },
      {
        is_completed: true,
        completed_at: "2024-06-14T10:00:00.000Z",
        project_id: "proj-a",
        priority: 2 as const,
      },
      {
        is_completed: true,
        completed_at: "2024-06-14T10:00:00.000Z",
        project_id: null,
        priority: 4 as const,
      },
      // Outside the 7d window — should not count
      {
        is_completed: true,
        completed_at: "2024-05-01T10:00:00.000Z",
        project_id: "proj-a",
        priority: 1 as const,
      },
    ];

    const result = calculateStats([], tasks, [], "7d", NOW);

    expect(result.byProject).toEqual(
      expect.arrayContaining([
        { projectId: "proj-a", count: 2 },
        { projectId: null, count: 1 },
      ]),
    );
    expect(result.byProject).toHaveLength(2);
  });

  it("always reports all 4 priority buckets, including zero-count ones", () => {
    const tasks = [
      {
        is_completed: true,
        completed_at: "2024-06-14T10:00:00.000Z",
        project_id: null,
        priority: 1 as const,
      },
    ];

    const result = calculateStats([], tasks, [], "7d", NOW);

    expect(result.byPriority).toEqual([
      { priority: 1, count: 1 },
      { priority: 2, count: 0 },
      { priority: 3, count: 0 },
      { priority: 4, count: 0 },
    ]);
  });

  it("does not count incomplete or undated-completion tasks in breakdowns", () => {
    const tasks = [
      {
        is_completed: false,
        completed_at: null,
        project_id: "proj-a",
        priority: 1 as const,
      },
      {
        is_completed: true,
        completed_at: null,
        project_id: "proj-a",
        priority: 1 as const,
      },
    ];

    const result = calculateStats([], tasks, [], "7d", NOW);

    expect(result.byProject).toHaveLength(0);
    expect(result.byPriority.every((p) => p.count === 0)).toBe(true);
  });
});

describe("calculateStats time-of-day heatmap", () => {
  it("buckets focus minutes into [weekday][hour], Mon=0..Sun=6, local time", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "UTC";
    const now = new Date("2024-06-15T12:00:00.000Z"); // Saturday

    // 2024-06-11 is a Tuesday, 14:30 UTC
    const logs = [
      { start_time: "2024-06-11T14:30:00.000Z", duration_seconds: 1800 }, // 30 min
    ];

    const result = calculateStats(logs, [], [], "7d", now);

    // Tuesday = weekday index 1, hour 14
    expect(result.timeOfDay[1][14]).toBe(30);
    // every other cell stays 0
    const total = result.timeOfDay.flat().reduce((a, b) => a + b, 0);
    expect(total).toBe(30);

    process.env.TZ = originalTz;
  });

  it("returns a 7x24 matrix even with no logs", () => {
    const result = calculateStats([], [], [], "7d", new Date());
    expect(result.timeOfDay).toHaveLength(7);
    result.timeOfDay.forEach((row) => expect(row).toHaveLength(24));
  });
});

describe("calculateStats daily habit-reps bucketing (for CSV export)", () => {
  const NOW = new Date("2024-06-15T12:00:00.000Z");
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = "UTC";
  });
  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it("counts habit entries into the day they fall on, inside the period", () => {
    const habitEntries = [
      { date: "2024-06-14" }, // inside 7d (June 9..15)
      { date: "2024-06-14" }, // same day → 2 reps that day
      { date: "2024-06-10" }, // another in-window day
      { date: "2024-05-01" }, // outside the 7d window → excluded
    ];

    const result = calculateStats([], [], habitEntries, "7d", NOW);

    // June 14 is index 5 (June 9..15 = 7 days); June 10 is index 1.
    expect(result.dailyTrend[5].habitReps).toBe(2);
    expect(result.dailyTrend[1].habitReps).toBe(1);
    // Every other day stays at 0.
    expect(result.dailyTrend[0].habitReps).toBe(0);
    expect(result.dailyTrend[6].habitReps).toBe(0);
    // The headline total still counts only in-window reps.
    expect(result.habitReps).toBe(3);
  });
});
