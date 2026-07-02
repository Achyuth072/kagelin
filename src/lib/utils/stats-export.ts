import type { StatsData, DailyStats } from "@/lib/hooks/useStats";
import type { StatsPeriod } from "@/lib/types/stats";
import type { Habit, HabitEntry } from "@/lib/types/habit";

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "Last year",
  all: "All time",
};

/**
 * Escapes a single CSV field per RFC 4180: wraps in double quotes when the
 * field contains a comma, double-quote, newline, or carriage return; doubles
 * any double-quote inside. Empty strings are quoted so they stay distinct from
 * an absent field on round-trip.
 */
export function escapeCsvField(value: string | number): string {
  const s = String(value);
  if (/[",\r\n]/.test(s) || s === "") {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Builds a CSV daily rollup `date,focus_hours,sessions,tasks_completed,habit_reps`
 * honoring the current Stats period (the caller already filters dailyTrend by
 * period — see useStats.calculateStats). One row per day, header included,
 * single trailing newline.
 */
const DAILY_ROLLUP_HEADER =
  "date,focus_hours,sessions,tasks_completed,habit_reps";

export function dailyRollupToCsv(daily: DailyStats[]): string {
  const rows = [DAILY_ROLLUP_HEADER];
  for (const d of daily) {
    rows.push(
      [d.date, d.hours, d.totalSessions, d.tasksCompleted, d.habitReps]
        .map((f) => escapeCsvField(f))
        .join(","),
    );
  }
  return `${rows.join("\n")}\n`;
}

interface StatsExportJsonOptions {
  period: StatsPeriod;
}

interface AnalyticsExportPayload {
  schema: "kanso.analytics.v1";
  period: StatsPeriod;
  periodLabel: string;
  generatedAt: string;
  aggregates: {
    totalFocusHours: number;
    totalSessions: number;
    tasksCompleted: number;
    completionRate: number;
    currentStreak: number;
    habitReps: number;
  };
  dailySeries: {
    date: string;
    focusHours: number;
    sessions: number;
    tasksCompleted: number;
    habitReps: number;
  }[];
  breakdowns: {
    byProject: { projectId: string | null; count: number }[];
    byPriority: { priority: 1 | 2 | 3 | 4; count: number }[];
    /** Minutes of focus, indexed [weekday][hour]. weekday 0=Mon..6=Sun (local). */
    timeOfDay: number[][];
  };
  trends: {
    focus: { value: number; isPositive: boolean };
    tasks: { value: number; isPositive: boolean };
    rate: { value: number; isPositive: boolean };
    habitReps: { value: number; isPositive: boolean };
  };
}

/**
 * Builds the structured JSON stats payload (aggregates + daily series +
 * breakdowns + trends) for analytics-only export. Read-only extract of the
 * already-computed StatsData; does not round-trip (see CONTEXT.md → Backup
 * vs Stats export).
 */
export function statsToExportJson(
  stats: StatsData,
  options: StatsExportJsonOptions,
): AnalyticsExportPayload {
  return {
    schema: "kanso.analytics.v1",
    period: options.period,
    periodLabel: PERIOD_LABELS[options.period],
    generatedAt: new Date().toISOString(),
    aggregates: {
      totalFocusHours: stats.totalFocusHours,
      totalSessions: stats.totalSessions,
      tasksCompleted: stats.tasksCompleted,
      completionRate: stats.completionRate,
      currentStreak: stats.currentStreak,
      habitReps: stats.habitReps,
    },
    dailySeries: stats.dailyTrend.map((d) => ({
      date: d.date,
      focusHours: d.hours,
      sessions: d.totalSessions,
      tasksCompleted: d.tasksCompleted,
      habitReps: d.habitReps,
    })),
    breakdowns: {
      byProject: stats.byProject,
      byPriority: stats.byPriority,
      timeOfDay: stats.timeOfDay,
    },
    trends: stats.trends,
  };
}

/**
 * Builds a per-habit history CSV (`date,value`) from the Insights tab's
 * already-fetched entries. Entries are sorted ascending by date for a stable
 * export regardless of insertion order. The raw `value` is preserved so a
 * Measurable Habit's quantities survive intact (no done/undone coercion).
 */
export function habitHistoryToCsv(
  _habit: Habit,
  entries: HabitEntry[],
): string {
  const sorted = [...entries].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  const rows = ["date,value"];
  for (const e of sorted) {
    rows.push([e.date, e.value].map((f) => escapeCsvField(f)).join(","));
  }
  return `${rows.join("\n")}\n`;
}

/**
 * Triggers a browser download of textual content (CSV / JSON) as a Blob with
 * the given mime type. Timestamped filenames are the caller's concern; this
 * just writes and clicks. Mirrors the anchor+revoke pattern in
 * `downloadBackup` but stays generic for any text export.
 */
export function triggerDownload(
  filename: string,
  content: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.body.appendChild(document.createElement("a"));
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Convenience: derives a timestamped analytics filename for the given period. */
export function analyticsFilename(
  prefix: "stats" | "habit",
  ext: "csv" | "json",
  options?: { period?: StatsPeriod; habitId?: string },
): string {
  const date = new Date().toISOString().split("T")[0];
  const periodPart = options?.period ? `-${options.period}` : "";
  const idPart = options?.habitId ? `-${options.habitId}` : "";
  return `kanso-${prefix}${periodPart}-${date}${idPart}.${ext}`;
}
