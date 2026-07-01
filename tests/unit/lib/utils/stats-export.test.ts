import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  dailyRollupToCsv,
  statsToExportJson,
  habitHistoryToCsv,
  escapeCsvField,
  triggerDownload,
  analyticsFilename,
} from "@/lib/utils/stats-export";
import type { StatsData, DailyStats } from "@/lib/hooks/useStats";
import type { StatsPeriod } from "@/lib/types/stats";
import type { Habit, HabitEntry } from "@/lib/types/habit";

function day(
  date: string,
  hours: number,
  totalSessions: number,
  tasksCompleted: number,
  habitReps: number,
): DailyStats {
  return { date, hours, totalSessions, tasksCompleted, habitReps };
}

const baseHabit: Habit = {
  id: "h1",
  user_id: "u1",
  name: "Read",
  description: null,
  color: "#ff0000",
  icon: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  archived_at: null,
  start_date: null,
  sort_order: 0,
  habit_type: "boolean",
  frequency_count: 1,
  frequency_period: "day",
};

function entry(date: string, value: number): HabitEntry {
  return {
    id: `e-${date}`,
    habit_id: "h1",
    date,
    value,
    created_at: `${date}T00:00:00.000Z`,
  };
}

describe("escapeCsvField", () => {
  it("passes through plain values", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });

  it("quotes fields containing a comma", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("quotes fields containing a quote by doubling it", () => {
    expect(escapeCsvField('she said "hi"')).toBe('"she said ""hi"""');
  });

  it("quotes fields containing a newline", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("quotes empty strings so a blank does not collapse away", () => {
    expect(escapeCsvField("")).toBe('""');
  });
});

describe("dailyRollupToCsv", () => {
  it("emits the header row with the documented columns", () => {
    const csv = dailyRollupToCsv([]);
    expect(csv.split("\n")[0]).toBe(
      "date,focus_hours,sessions,tasks_completed,habit_reps",
    );
  });

  it("ends with a single trailing newline", () => {
    const csv = dailyRollupToCsv([]);
    expect(csv.endsWith("\n")).toBe(true);
    expect(csv.match(/\n$/g)).toHaveLength(1);
  });

  it("writes one row per day in input order", () => {
    const days = [
      day("2026-06-01", 1.5, 2, 3, 1),
      day("2026-06-02", 0, 0, 0, 0),
      day("2026-06-03", 2.2, 3, 1, 4),
    ];
    const lines = dailyRollupToCsv(days).split("\n").filter(Boolean);
    expect(lines).toHaveLength(4); // header + 3 days
    expect(lines[1]).toBe("2026-06-01,1.5,2,3,1");
    expect(lines[2]).toBe("2026-06-02,0,0,0,0");
    expect(lines[3]).toBe("2026-06-03,2.2,3,1,4");
  });
});

describe("statsToExportJson", () => {
  const stats: StatsData = {
    totalFocusHours: 12.5,
    totalSessions: 10,
    tasksCompleted: 8,
    completionRate: 80,
    currentStreak: 5,
    dailyTrend: [day("2026-06-01", 1, 1, 1, 1)],
    habitReps: 7,
    trends: {
      focus: { value: 10, isPositive: true },
      tasks: { value: 25, isPositive: true },
      rate: { value: 5, isPositive: true },
      habitReps: { value: 0, isPositive: false },
    },
    byProject: [{ projectId: "p1", count: 4 }],
    byPriority: [
      { priority: 1, count: 1 },
      { priority: 2, count: 2 },
      { priority: 3, count: 3 },
      { priority: 4, count: 2 },
    ],
    timeOfDay: Array.from({ length: 7 }, () => new Array(24).fill(0)),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("wraps aggregates + daily series under a versioned analytics payload", () => {
    const payload = statsToExportJson(stats, {
      period: "30d",
    } as { period: StatsPeriod });

    expect(payload.schema).toBe("kanso.analytics.v1");
    expect(payload.period).toBe("30d");
    expect(payload.generatedAt).toBe("2026-06-15T12:00:00.000Z");
    expect(payload.aggregates).toEqual({
      totalFocusHours: 12.5,
      totalSessions: 10,
      tasksCompleted: 8,
      completionRate: 80,
      currentStreak: 5,
      habitReps: 7,
    });
    expect(payload.dailySeries).toEqual([
      {
        date: "2026-06-01",
        focusHours: 1,
        sessions: 1,
        tasksCompleted: 1,
        habitReps: 1,
      },
    ]);
  });

  it("includes breakdowns in the payload", () => {
    const payload = statsToExportJson(stats, {
      period: "30d",
    } as { period: StatsPeriod });

    expect(payload.breakdowns.byProject).toEqual([
      { projectId: "p1", count: 4 },
    ]);
    expect(payload.breakdowns.byPriority).toHaveLength(4);
    expect(payload.breakdowns.timeOfDay).toHaveLength(7);
  });

  it("records the human-readable period label", () => {
    const payload = statsToExportJson(stats, {
      period: "all",
    } as { period: StatsPeriod });
    expect(payload.periodLabel).toBe("All time");
  });
});

describe("habitHistoryToCsv", () => {
  it("emits the date,value header", () => {
    const csv = habitHistoryToCsv(baseHabit, []);
    expect(csv.split("\n")[0]).toBe("date,value");
  });

  it("writes one row per entry, sorted ascending by date", () => {
    const entries = [
      entry("2026-06-03", 1),
      entry("2026-06-01", 1),
      entry("2026-06-02", 0),
    ];
    const lines = habitHistoryToCsv(baseHabit, entries)
      .split("\n")
      .filter(Boolean);
    expect(lines).toHaveLength(4); // header + 3
    expect(lines[1]).toBe("2026-06-01,1");
    expect(lines[2]).toBe("2026-06-02,0");
    expect(lines[3]).toBe("2026-06-03,1");
  });

  it("keeps the raw measurable value (no done/undone coercion)", () => {
    const measurable: Habit = {
      ...baseHabit,
      habit_type: "measurable",
      target_type: "at_least",
      target_value: 10,
      unit: "pages",
    };
    const entries = [entry("2026-06-01", 7), entry("2026-06-02", 12)];
    const lines = habitHistoryToCsv(measurable, entries)
      .split("\n")
      .filter(Boolean);
    expect(lines[1]).toBe("2026-06-01,7");
    expect(lines[2]).toBe("2026-06-02,12");
  });
});

describe("analyticsFilename", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("embeds the period for stats exports so different windows don't collide", () => {
    expect(analyticsFilename("stats", "csv", { period: "7d" })).toBe(
      "kanso-stats-7d-2026-07-01.csv",
    );
    expect(analyticsFilename("stats", "json", { period: "30d" })).toBe(
      "kanso-stats-30d-2026-07-01.json",
    );
    expect(analyticsFilename("stats", "csv", { period: "all" })).toBe(
      "kanso-stats-all-2026-07-01.csv",
    );
  });

  it("embeds the habit id for habit history exports", () => {
    expect(analyticsFilename("habit", "csv", { habitId: "abc-123" })).toBe(
      "kanso-habit-2026-07-01-abc-123.csv",
    );
  });
});

describe("triggerDownload", () => {
  let anchorClickSpy: ReturnType<typeof vi.fn>;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    anchorClickSpy = vi.fn();
    createObjectURLSpy = vi.fn(() => "blob:some-url");
    revokeObjectURLSpy = vi.fn();
    // jsdom implements URL.createObjectURL, but stub it so we can assert calls.
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLSpy,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURLSpy,
    });
    // Stub document.createElement to return an anchor we can observe.
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") {
        el.click = anchorClickSpy as unknown as () => void;
      }
      return el;
    });
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a Blob with the given mime, anchors it, clicks, and revokes", () => {
    triggerDownload("kanso-stats-2026-06-15.csv", "a,b\n1,2\n", "text/csv");

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:some-url");
  });
});
